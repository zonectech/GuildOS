import { EventCreationGuardModel } from '../models/event-creation-guard.model';
import { EventModel } from '../models/event.model';
import { communityNameSimilarity, normalizeIdentity } from '../utils/community-identity';

export const EVENT_CREATION_POLICY = {
  userDailyLimit: 10,
  communityDailyLimit: 20,
  userCooldownMs: 2 * 60 * 1000,
  similarTitleThreshold: 0.9,
  similarDateWindowMs: 7 * 24 * 60 * 60 * 1000,
  maxDurationMs: 31 * 24 * 60 * 60 * 1000,
  maxScheduleHorizonMs: 2 * 365 * 24 * 60 * 60 * 1000,
} as const;

export class EventPolicyError extends Error {
  constructor(message: string, public statusCode: 400 | 409 | 429, public retryAfterSeconds?: number) {
    super(message);
    this.name = 'EventPolicyError';
  }
}

const IMPERSONATION_TITLE = /\b(official|verified|authori[sz]ed|administrator|admin)\b/i;
const PHISHING_PATTERNS = [
  /\b(verify|confirm|unlock|restore)\s+(your\s+)?(account|password|wallet|login)\b/i,
  /(?:\b(password|one[- ]time password|otp|recovery code)\b.*\b(send|share|enter|submit)\b|\b(send|share|enter|submit)\b.*\b(password|one[- ]time password|otp|recovery code)\b)/i,
  /\b(buy|sell|double)\s+(crypto|bitcoin|money)\b/i,
  /\bfree\s+(money|airdrop|giveaway)\b/i,
  /(.)\1{9,}/i,
];

export function validateEventContent(input: {
  title: string;
  shortDescription?: string;
  description?: string;
  theme?: string;
}) {
  const title = input.title.trim();
  if (!title) throw new EventPolicyError('Event title is required', 400);
  if (title.length > 120) throw new EventPolicyError('Event title must be at most 120 characters', 400);
  if ((input.shortDescription ?? '').trim().length > 240) throw new EventPolicyError('Short description must be at most 240 characters', 400);
  if ((input.description ?? '').trim().length > 10000) throw new EventPolicyError('Event description must be at most 10000 characters', 400);
  if (IMPERSONATION_TITLE.test(title)) {
    throw new EventPolicyError('Event titles cannot claim official, verified, authorized, or administrator status', 400);
  }
  const content = [title, input.shortDescription, input.description, input.theme].filter(Boolean).join('\n');
  if (PHISHING_PATTERNS.some((pattern) => pattern.test(content))) {
    throw new EventPolicyError('Event details contain phishing, spam, or prohibited promotional content', 400);
  }
}

export function eventStartDay(startDate?: Date | null) {
  return startDate && !Number.isNaN(startDate.getTime()) ? startDate.toISOString().slice(0, 10) : 'unscheduled';
}

export function validateEventDates(startDate?: Date | null, endDate?: Date | null, now = new Date(), publishing = false) {
  if (publishing && (!startDate || !endDate)) throw new EventPolicyError('Start and end dates are required to publish', 400);
  if (!startDate && !endDate) return;
  if (!startDate || !endDate || Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    throw new EventPolicyError('Enter valid start and end dates', 400);
  }
  if (endDate <= startDate) throw new EventPolicyError('End time must be after start time', 400);
  if (endDate.getTime() - startDate.getTime() > EVENT_CREATION_POLICY.maxDurationMs) {
    throw new EventPolicyError('Events cannot last longer than 31 days', 400);
  }
  if (startDate.getTime() > now.getTime() + EVENT_CREATION_POLICY.maxScheduleHorizonMs) {
    throw new EventPolicyError('Events cannot be scheduled more than 2 years in advance', 400);
  }
  if (publishing && endDate.getTime() <= now.getTime()) throw new EventPolicyError('Past events cannot be published', 400);
}

export async function enforceUniqueEventTitle(input: {
  communityId: string;
  title: string;
  startDate?: Date | null;
  excludeId?: string;
}) {
  const normalizedTitle = normalizeIdentity(input.title);
  const query: Record<string, unknown> = {
    communityId: input.communityId,
    deletedAt: null,
    status: { $ne: 'ARCHIVED' },
    ...(input.excludeId ? { _id: { $ne: input.excludeId } } : {}),
  };
  if (input.startDate) {
    query.startDate = {
      $gte: new Date(input.startDate.getTime() - EVENT_CREATION_POLICY.similarDateWindowMs),
      $lte: new Date(input.startDate.getTime() + EVENT_CREATION_POLICY.similarDateWindowMs),
    };
  } else {
    query.startDate = null;
  }
  const candidates = await EventModel.find(query).select('title slug startDate').limit(250).lean();
  const match = candidates
    .map((event) => ({ event, score: communityNameSimilarity(input.title, event.title) }))
    .sort((left, right) => right.score - left.score)[0];
  if (match && match.score >= EVENT_CREATION_POLICY.similarTitleThreshold) {
    throw new EventPolicyError(`Event title is too similar to “${match.event.title}” scheduled around the same date`, 409);
  }
  return { normalizedTitle, eventStartDay: eventStartDay(input.startDate) };
}

type Reservation = { keys: string[] };

async function initializeGuard(key: string, initialCount: number, dayStart: Date, nextAllowedAt: Date) {
  try {
    await EventCreationGuardModel.updateOne(
      { key },
      { $setOnInsert: { windowStart: dayStart, windowCount: initialCount, nextAllowedAt } },
      { upsert: true },
    );
  } catch (error) {
    if (!(typeof error === 'object' && error && 'code' in error && error.code === 11000)) throw error;
  }
}

async function reserveGuard(input: {
  key: string;
  limit: number;
  cooldownMs: number;
  initialCount: number;
  initialNextAllowedAt: Date;
  dayStart: Date;
  now: Date;
}) {
  await initializeGuard(input.key, Math.min(input.initialCount, input.limit), input.dayStart, input.initialNextAllowedAt);
  const reserved = await EventCreationGuardModel.findOneAndUpdate(
    {
      key: input.key,
      nextAllowedAt: { $lte: input.now },
      $or: [{ windowStart: { $lt: input.dayStart } }, { windowCount: { $lt: input.limit } }],
    },
    [
      {
        $set: {
          windowCount: { $cond: [{ $lt: ['$windowStart', input.dayStart] }, 1, { $add: ['$windowCount', 1] }] },
          windowStart: { $cond: [{ $lt: ['$windowStart', input.dayStart] }, input.dayStart, '$windowStart'] },
          nextAllowedAt: new Date(input.now.getTime() + input.cooldownMs),
        },
      },
    ],
    { new: true },
  ).lean();
  if (reserved) return;

  const guard = await EventCreationGuardModel.findOne({ key: input.key }).lean();
  const tomorrow = new Date(input.dayStart.getTime() + 24 * 60 * 60 * 1000);
  const dailyRetry = guard && guard.windowStart >= input.dayStart && guard.windowCount >= input.limit
    ? tomorrow.getTime() - input.now.getTime()
    : 0;
  const cooldownRetry = guard ? guard.nextAllowedAt.getTime() - input.now.getTime() : 0;
  const scope = input.key.startsWith('community:') ? 'Community' : 'User';
  const message = dailyRetry > 0 ? `${scope} daily event creation limit (${input.limit}) reached` : 'Please wait before creating another event';
  throw new EventPolicyError(message, 429, Math.max(1, Math.ceil(Math.max(dailyRetry, cooldownRetry) / 1000)));
}

export async function reserveEventCreation(communityId: string, userId: string, now = new Date()): Promise<Reservation> {
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  const [communityCount, userCount, latestUserEvent] = await Promise.all([
    EventModel.countDocuments({ communityId, createdAt: { $gte: dayStart }, deletedAt: null }),
    EventModel.countDocuments({ createdBy: userId, createdAt: { $gte: dayStart }, deletedAt: null }),
    EventModel.findOne({ createdBy: userId, deletedAt: null }).select('createdAt').sort({ createdAt: -1 }).lean(),
  ]);
  const keys: string[] = [];
  const communityKey = `community:${communityId}`;
  const userKey = `user:${userId}`;
  await reserveGuard({ key: communityKey, limit: EVENT_CREATION_POLICY.communityDailyLimit, cooldownMs: 0, initialCount: communityCount, initialNextAllowedAt: new Date(0), dayStart, now });
  keys.push(communityKey);
  try {
    await reserveGuard({
      key: userKey,
      limit: EVENT_CREATION_POLICY.userDailyLimit,
      cooldownMs: EVENT_CREATION_POLICY.userCooldownMs,
      initialCount: userCount,
      initialNextAllowedAt: latestUserEvent?.createdAt
        ? new Date(latestUserEvent.createdAt.getTime() + EVENT_CREATION_POLICY.userCooldownMs)
        : new Date(0),
      dayStart,
      now,
    });
    keys.push(userKey);
    return { keys };
  } catch (error) {
    await releaseEventCreation({ keys });
    throw error;
  }
}

export async function releaseEventCreation(reservation: Reservation) {
  if (!reservation.keys.length) return;
  await EventCreationGuardModel.updateMany(
    { key: { $in: reservation.keys }, windowCount: { $gt: 0 } },
    { $inc: { windowCount: -1 }, $set: { nextAllowedAt: new Date(0) } },
  );
}