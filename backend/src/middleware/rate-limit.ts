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

/** Global baseline: 40 requests/min per IP+path (config.rateLimitWindowMs/Max). */
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
}) {
  const { windowMs, max, keyBy = 'user-or-ip' } = options;
  const message = options.message ?? 'Too many requests — please slow down and try again shortly.';
  const store = new Map<string, Bucket>();

  setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of store) {
      if (bucket.resetAt <= now) store.delete(key);
    }
  }, CLEANUP_INTERVAL_MS).unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const userId = keyBy === 'user-or-ip' ? (req as AuthenticatedRequest).userId : undefined;
    const key = userId ?? req.ip ?? 'unknown';
    const now = Date.now();
    const bucket = store.get(key);

    if (!bucket || bucket.resetAt <= now) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    bucket.count += 1;
    if (bucket.count > max) {
      const retryAfterSeconds = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({ error: message, retryAfterSeconds });
    }

    return next();
  };
}

/** Login/signup/reset-password: strict + IP-keyed (credential-stuffing vector). */
export const authAttemptLimiter = makeRateLimit({
  windowMs: 5 * 60_000,
  max: 15,
  keyBy: 'ip',
  message: 'Too many attempts — wait a few minutes and try again.',
});

/** Endpoints that SEND EMAIL to arbitrary addresses (forgot-password, resend-verification): very strict. */
export const emailSenderLimiter = makeRateLimit({
  windowMs: 15 * 60_000,
  max: 5,
  keyBy: 'ip',
  message: 'Too many requests — wait a few minutes before requesting another email.',
});

/** AI-backed endpoints: every call spends provider quota (Gemini/OpenAI). */
export const aiLimiter = makeRateLimit({
  windowMs: 10 * 60_000,
  max: 20,
  message: 'You\u2019re using AI features too quickly — give it a few minutes and try again.',
});

/** File uploads: size limits exist per-endpoint; this caps frequency per user. */
export const uploadLimiter = makeRateLimit({
  windowMs: 10 * 60_000,
  max: 60,
  message: 'Too many uploads — wait a few minutes and try again.',
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
  message: 'Too many invite batches — wait a bit before sending more.',
});

/** Chat sends: 60 messages / 10 min per user — fluid conversation, useless for spam floods. */
export const messageSendLimiter = makeRateLimit({
  windowMs: 10 * 60_000,
  max: 60,
  message: 'You’re sending messages too quickly — give it a moment.',
});

/** Connection requests: 15 / 30 min per user — real networking fits; mass cold-adding doesn't. */
export const connectionRequestLimiter = makeRateLimit({
  windowMs: 30 * 60_000,
  max: 15,
  message: 'Too many connection requests — wait a while before sending more.',
});

/** Self-service data export: a full account dump is a heavy read; nobody legitimately needs it often. */
export const dataExportLimiter = makeRateLimit({
  windowMs: 60 * 60_000,
  max: 3,
  message: 'Too many export requests — wait a while before requesting your data again.',
});
