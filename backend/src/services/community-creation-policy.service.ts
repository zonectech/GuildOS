import { CommunityModel } from '../models/community.model';
import { CommunityCreationGuardModel } from '../models/community-creation-guard.model';
import { communityNameSimilarity, normalizeIdentity, validateCommunityContent } from '../utils/community-identity';

export const COMMUNITY_CREATION_POLICY = {
  dailyLimit: 2,
  cooldownMs: 6 * 60 * 60 * 1000,
  activeLimit: 5,
  similarNameThreshold: 0.88,
} as const;

export class CommunityCreationLimitError extends Error {
  constructor(message: string, public retryAfterSeconds: number) {
    super(message);
    this.name = 'CommunityCreationLimitError';
  }
}

export async function enforceCommunityCreationQuota(userId: string, now = new Date()) {
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  const [activeCount, todayCount, latest] = await Promise.all([
    CommunityModel.countDocuments({ founder: userId, archivedAt: null, verificationStatus: { $ne: 'REJECTED' } }),
    CommunityModel.countDocuments({ founder: userId, createdAt: { $gte: dayStart } }),
    CommunityModel.findOne({ founder: userId }).select('createdAt').sort({ createdAt: -1 }).lean(),
  ]);
  if (activeCount >= COMMUNITY_CREATION_POLICY.activeLimit) {
    throw new CommunityCreationLimitError(`You can manage at most ${COMMUNITY_CREATION_POLICY.activeLimit} active communities. Archive an unused community or contact an administrator.`, 86400);
  }

  try {
    await CommunityCreationGuardModel.updateOne(
      { userId },
      {
        $setOnInsert: {
          windowStart: dayStart,
          windowCount: Math.min(todayCount, COMMUNITY_CREATION_POLICY.dailyLimit),
          nextAllowedAt: latest?.createdAt
            ? new Date(latest.createdAt.getTime() + COMMUNITY_CREATION_POLICY.cooldownMs)
            : new Date(0),
        },
      },
      { upsert: true },
    );
  } catch (error) {
    // A simultaneous first request may win the unique userId upsert. Continue
    // against that guard; any other database error must still fail closed.
    if (!(typeof error === 'object' && error && 'code' in error && error.code === 11000)) throw error;
  }

  // This conditional update is the quota reservation. MongoDB applies it
  // atomically, so parallel requests cannot all pass an earlier count query.
  const reserved = await CommunityCreationGuardModel.findOneAndUpdate(
    {
      userId,
      nextAllowedAt: { $lte: now },
      $or: [{ windowStart: { $lt: dayStart } }, { windowCount: { $lt: COMMUNITY_CREATION_POLICY.dailyLimit } }],
    },
    [
      {
        $set: {
          windowCount: {
            $cond: [{ $lt: ['$windowStart', dayStart] }, 1, { $add: ['$windowCount', 1] }],
          },
          windowStart: { $cond: [{ $lt: ['$windowStart', dayStart] }, dayStart, '$windowStart'] },
          nextAllowedAt: new Date(now.getTime() + COMMUNITY_CREATION_POLICY.cooldownMs),
        },
      },
    ],
    { new: true },
  ).lean();

  if (!reserved) {
    const guard = await CommunityCreationGuardModel.findOne({ userId }).lean();
    const tomorrow = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const cooldownRetry = guard ? guard.nextAllowedAt.getTime() - now.getTime() : 0;
    const dailyRetry = guard && guard.windowStart >= dayStart && guard.windowCount >= COMMUNITY_CREATION_POLICY.dailyLimit
      ? tomorrow.getTime() - now.getTime()
      : 0;
    const retryAfterSeconds = Math.max(1, Math.ceil(Math.max(cooldownRetry, dailyRetry) / 1000));
    const message = dailyRetry > 0
      ? `Daily community creation limit (${COMMUNITY_CREATION_POLICY.dailyLimit}) reached`
      : 'Please wait before creating another community';
    throw new CommunityCreationLimitError(message, retryAfterSeconds);
  }
}

export async function enforceUniqueCommunityName(name: string, institutionId: string, excludeId?: string) {
  const normalizedName = normalizeIdentity(name);
  const candidates = await CommunityModel.find({
    institutionId,
    archivedAt: null,
    verificationStatus: { $ne: 'REJECTED' },
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  }).select('name slug verificationStatus').limit(250).lean();
  const match = candidates
    .map((community) => ({ community, score: communityNameSimilarity(name, community.name) }))
    .sort((left, right) => right.score - left.score)[0];
  if (match && match.score >= COMMUNITY_CREATION_POLICY.similarNameThreshold) {
    throw new Error(`Community name is too similar to the existing community “${match.community.name}” at this institution`);
  }
  return normalizedName;
}

export function enforceSafeCommunityContent(name: string, shortDescription: string, description?: string) {
  validateCommunityContent(name, shortDescription, description);
}