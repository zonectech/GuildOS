import type { NextFunction, Request, Response } from 'express';
import { config } from '../config';
import type { AuthenticatedRequest } from './auth';

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

// Periodically drop expired buckets so the map can't grow unbounded (memory-DoS).
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}, CLEANUP_INTERVAL_MS).unref();

function getKey(req: Request) {
  return `${req.ip}:${req.path}`;
}

/** Global baseline flood guard: per IP+path, per minute (config.rateLimitWindowMs/Max). */
export function rateLimit(req: Request, res: Response, next: NextFunction) {
  const key = getKey(req);
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + config.rateLimitWindowMs });
    return next();
  }

  bucket.count += 1;

  if (bucket.count > config.rateLimitMax) {
    const retryAfterSeconds = Math.ceil((bucket.resetAt - now) / 1000);
    res.setHeader('Retry-After', String(retryAfterSeconds));
    return res.status(429).json({
      error: 'Too many requests',
      retryAfterSeconds,
    });
  }

  return next();
}

/**
 * Targeted limiter factory — much stricter buckets than the global baseline for
 * endpoints that are expensive (AI provider quota) or abusable (credential
 * stuffing, email spam). Each call gets its OWN isolated store, keyed by the
 * authenticated userId when available (so NAT'd campus networks don't share a
 * bucket) or the IP for anonymous traffic.
 *
 * In-memory/per-process by design — swap the Map for Redis when GuildOS runs
 * multiple instances.
 */
export function makeRateLimit(options: {
  /** Window size in milliseconds. */
  windowMs: number;
  /** Max requests per key within the window. */
  max: number;
  /** 429 message shown to the user. */
  message?: string;
  /** 'ip' for pre-auth endpoints (login/signup); default prefers userId. */
  keyBy?: 'ip' | 'user-or-ip';
  /**
   * The account a pre-auth request is about (e.g. the email being signed in to). When given, `max`
   * applies per account + address, so one person's typos never lock out a whole campus network.
   */
  account?: (req: Request) => string | undefined;
  /**
   * A second, higher ceiling for everything coming from one network address. Use together with
   * `account` or the default per-user key: the account limit stops one person, this stops one machine.
   */
  ipMax?: number;
}) {
  const { windowMs, max, keyBy = 'user-or-ip', account, ipMax } = options;
  const message = options.message ?? 'Too many requests. Please slow down and try again shortly.';
  const store = new Map<string, Bucket>();

  setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of store) {
      if (bucket.resetAt <= now) store.delete(key);
    }
  }, CLEANUP_INTERVAL_MS).unref();

  /** Counts one hit against a key; returns the seconds to wait when it is over its limit. */
  const hit = (key: string, limit: number, now: number) => {
    const bucket = store.get(key);
    if (!bucket || bucket.resetAt <= now) { store.set(key, { count: 1, resetAt: now + windowMs }); return 0; }
    bucket.count += 1;
    return bucket.count > limit ? Math.ceil((bucket.resetAt - now) / 1000) : 0;
  };

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip ?? 'unknown';
    const userId = keyBy === 'user-or-ip' ? (req as AuthenticatedRequest).userId : undefined;
    const who = account?.(req)?.trim().toLowerCase().slice(0, 200);
    const key = who ? `acct:${who}|${ip}` : userId ? `user:${userId}` : `ip:${ip}`;
    const now = Date.now();
    // The address-wide ceiling is counted first so it also sees requests the account limit rejects.
    const waits = [ipMax && key !== `ip:${ip}` ? hit(`net:${ip}`, ipMax, now) : 0, hit(key, max, now)];
    const retryAfterSeconds = Math.max(...waits);
    if (retryAfterSeconds > 0) {
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({ error: message, retryAfterSeconds });
    }
    return next();
  };
}

const emailOf = (req: Request) => (typeof req.body?.email === 'string' ? req.body.email : undefined);

/**
 * Sign-in: 10 tries per account from one address in 5 minutes (stops password guessing), and 150
 * sign-ins from one address overall (stops one machine trying many accounts). A hall or campus
 * network shares an address, so the per-address number has to fit a busy sign-up drive.
 */
export const loginLimiter = makeRateLimit({
  windowMs: 5 * 60_000,
  max: 10,
  keyBy: 'ip',
  account: emailOf,
  ipMax: 150,
  message: 'Too many attempts for this account. Wait a few minutes and try again.',
});

/** Registering for events: 30 per account in 10 minutes, 300 per address. */
export const registrationLimiter = makeRateLimit({ windowMs: 10 * 60_000, max: 30, ipMax: 300, message: 'You’re registering very quickly. Give it a few minutes.' });
/** Reports (attendance issues, reported messages and announcements): 10 per account per hour, 60 per address. */
export const reportLimiter = makeRateLimit({ windowMs: 60 * 60_000, max: 10, ipMax: 60, message: 'You’ve sent a lot of reports. Try again later.' });
/** Announcements and event updates go to many people: 6 per account per hour, 20 per address. */
export const broadcastLimiter = makeRateLimit({ windowMs: 60 * 60_000, max: 6, ipMax: 20, message: 'That’s a lot of announcements in an hour. Wait a while before sending another.' });

/** Door scans: a busy door scans about one pass every few seconds, per device. */
export const doorScanLimiter = makeRateLimit({ windowMs: 10 * 60_000, max: 600, ipMax: 3000, message: 'Scanning very quickly. Wait a moment and try again.' });

/** Signup/reset-password: IP-keyed (new accounts have no identity yet). */
export const authAttemptLimiter = makeRateLimit({
  windowMs: 5 * 60_000,
  // A shared campus address during a sign-up drive: 15 was low enough to lock a whole hall out.
  max: 60,
  keyBy: 'ip',
  message: 'Too many attempts. Wait a few minutes and try again.',
});

/** Endpoints that SEND EMAIL to arbitrary addresses (forgot-password, resend-verification): very strict. */
export const emailSenderLimiter = makeRateLimit({
  windowMs: 15 * 60_000,
  max: 5,
  keyBy: 'ip',
  message: 'Too many requests. Wait a few minutes before asking for another email.',
});

/** AI-backed endpoints: every call spends provider quota (Gemini/OpenAI). */
export const aiLimiter = makeRateLimit({
  windowMs: 10 * 60_000,
  max: 20,
  message: 'You\u2019re using AI features too quickly. Give it a few minutes and try again.',
});

/** File uploads: size limits exist per-endpoint; this caps frequency per user. */
export const uploadLimiter = makeRateLimit({
  windowMs: 10 * 60_000,
  max: 60,
  message: 'Too many uploads. Wait a few minutes and try again.',
});

/**
 * Public page-view ping: unauthenticated by design, so a curl loop could inflate an
 * event's funnel numbers. 30 pings / 10 min / IP is far more events than any real
 * person browses while keeping fake-view farming impractical from one address.
 */
export const viewPingLimiter = makeRateLimit({
  windowMs: 10 * 60_000,
  max: 30,
  keyBy: 'ip',
  message: 'Too many requests.',
});

/**
 * Bulk member invites: each call can send up to 50 emails, so cap the CALLS per
 * leader — 4 batches (≤200 invites) per half hour is generous for onboarding an
 * association and useless as a spam cannon. Separate store from emailSenderLimiter
 * so inviting members never eats the forgot-password budget of a shared campus IP.
 */
export const bulkInviteLimiter = makeRateLimit({
  windowMs: 30 * 60_000,
  max: 4,
  message: 'Too many invite batches. Wait a little before sending more.',
});

/** Chat sends: 60 messages / 10 min per user — fluid conversation, useless for spam floods. */
export const messageSendLimiter = makeRateLimit({
  windowMs: 10 * 60_000,
  max: 60,
  ipMax: 600,
  message: 'You’re sending messages too quickly. Give it a moment.',
});

/** Connection requests: 15 / 30 min per user — real networking fits; mass cold-adding doesn't. */
export const connectionRequestLimiter = makeRateLimit({
  windowMs: 30 * 60_000,
  max: 15,
  message: 'Too many connection requests. Wait a while before sending more.',
});

/** Self-service data export: a full account dump is a heavy read; nobody legitimately needs it often. */
export const dataExportLimiter = makeRateLimit({
  windowMs: 60 * 60_000,
  max: 3,
  message: 'Too many export requests. Wait a while before requesting your data again.',
});

/** Authenticated verification flows are user-keyed so a shared campus IP does not block everyone. */
export const communityEmailSenderLimiter = makeRateLimit({ windowMs: 15 * 60_000, max: 5, message: 'Too many verification emails. Wait before requesting another code.' });
export const communityEmailVerifyLimiter = makeRateLimit({ windowMs: 5 * 60_000, max: 15, message: 'Too many code attempts. Wait a few minutes and try again.' });
