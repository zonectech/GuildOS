import mongoose from 'mongoose';
import { PostModel, type PostDocument } from '../models/post.model';
import { PostLikeModel } from '../models/post-like.model';
import { PollVoteModel } from '../models/poll-vote.model';
import { PostCommentModel } from '../models/post-comment.model';
import { CommunityModel } from '../models/community.model';
import { CertificateModel } from '../models/certificate.model';
import { EventModel } from '../models/event.model';
import { MembershipModel } from '../models/membership.model';
import { CommunityFollowModel } from '../models/community-follow.model';
import { ContentReportModel } from '../models/content-report.model';
import { ReputationScoreModel } from '../models/reputation-score.model';
import { authStore } from '../store/auth-store';
import { createNotification, pushGroupedNotificationActor, removeGroupedNotificationActor } from './notification.service';
import { isRankingEnabled, rankingConfig } from './ranking/ranking.config';
import { rankFeedPosts } from './ranking/feed-ranking.service';

const MANAGER_ROLES = ['COORDINATOR', 'SECRETARY', 'TREASURER', 'VICE_PRESIDENT', 'PRESIDENT', 'FOUNDER'];
const MAX_PINNED_POSTS = 3;

async function requireCommunityManager(communityId: string, actorId: string) {
  const membership = await MembershipModel.findOne({ communityId, userId: actorId }).lean();
  const inactive = membership ? ['SUSPENDED', 'REMOVED', 'LEFT'].includes(membership.status as string) : true;
  if (!membership || inactive || !MANAGER_ROLES.includes(membership.role)) {
    throw new Error('Only community managers can do this');
  }
}

async function authorInfo(userId: string) {
  const [user, reputation] = await Promise.all([
    authStore.getPublicUserById(userId),
    ReputationScoreModel.findOne({ userId }).select('level').lean().catch(() => null),
  ]);
  return {
    id: userId,
    fullName: user?.fullName ?? 'Student',
    username: user?.profile?.username ?? '',
    avatar: user?.profile?.avatar ?? '',
    headline: [user?.profile?.department, user?.profile?.university].filter(Boolean).join(' · '),
    isCommunity: false,
    // Guild tier (Bronze/Silver/Gold/...) so the feed can render a reputation-tier avatar ring.
    level: reputation?.level ?? 'Explorer Guild',
  };
}

type Community = { name: string; slug: string; logo: string } | null;

type MilestoneCertificate = {
  serial: string;
  eventTitle: string;
  communityName: string;
  attendeeName: string;
  type: string;
  style: string;
  accent: string;
  eventDate: Date | null;
} | null;

/** Certificate snapshot for CERTIFICATE milestone posts so the feed can render a diploma card. */
async function certificateForMilestone(post: Pick<PostDocument, 'kind' | 'milestone'>): Promise<MilestoneCertificate> {
  if (post.kind !== 'MILESTONE' || post.milestone?.type !== 'CERTIFICATE' || !post.milestone.refId) return null;
  if (!mongoose.Types.ObjectId.isValid(post.milestone.refId)) return null;
  const cert = await CertificateModel.findById(post.milestone.refId)
    .select('serial eventTitle communityName attendeeName type style theme status eventDate')
    .lean()
    .catch(() => null);
  if (!cert || cert.status !== 'VERIFIED') return null;
  return {
    serial: cert.serial,
    eventTitle: cert.eventTitle,
    communityName: cert.communityName,
    attendeeName: cert.attendeeName,
    type: cert.type,
    style: cert.style ?? 'CLASSIC',
    accent: cert.theme?.accent ?? '',
    eventDate: cert.eventDate ?? null,
  };
}

/** Validate poll input: 2-6 distinct non-empty options, 80 chars each. */
function sanitizePoll(raw: unknown): { options: { text: string; count: number }[] } | null {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { options?: unknown }).options)) return null;
  const seen = new Set<string>();
  const options = ((raw as { options: unknown[] }).options)
    .map((o) => String(o ?? '').trim().slice(0, 80))
    .filter((text) => {
      if (!text) return false;
      const key = text.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 6)
    .map((text) => ({ text, count: 0 }));
  return options.length >= 2 ? { options } : null;
}

/** Bulk-fetch the viewer's poll votes for a page of posts (postId -> optionIndex). */
async function viewerPollVotes(viewerId: string | null, postIds: string[]) {
  if (!viewerId || !postIds.length) return new Map<string, number>();
  const votes = await PollVoteModel.find({ userId: viewerId, postId: { $in: postIds } })
    .select('postId optionIndex')
    .lean();
  return new Map(votes.map((v) => [v.postId.toString(), v.optionIndex]));
}

function serializePost(
  post: PostDocument & { _id: unknown },
  userAuthor: Awaited<ReturnType<typeof authorInfo>>,
  liked: boolean,
  community: Community,
  certificate: MilestoneCertificate = null,
  pollVote: number | null = null,
) {
  const isCommunityPost = post.authorType === 'COMMUNITY' && community;
  const author = isCommunityPost
    ? { id: post.communityId ? String(post.communityId) : '', fullName: community!.name, username: community!.slug, avatar: community!.logo, headline: 'Community', isCommunity: true, level: null }
    : userAuthor;
  const pollOptions = post.poll?.options ?? [];
  return {
    id: String(post._id),
    kind: post.kind,
    content: post.content,
    imageUrl: post.imageUrl ?? '',
    tags: (post.tags ?? []).map((t) => ({ type: t.type, id: String(t.refId), label: t.label, handle: t.handle })),
    poll: pollOptions.length
      ? {
          options: pollOptions.map((o) => ({ text: o.text, count: o.count })),
          totalVotes: pollOptions.reduce((sum, o) => sum + o.count, 0),
          viewerVote: pollVote,
        }
      : null,
    milestone: post.milestone && post.milestone.type ? post.milestone : null,
    cta: post.cta && post.cta.label && post.cta.url ? { label: post.cta.label, url: post.cta.url } : null,
    certificate,
    communityId: post.communityId ? String(post.communityId) : null,
    communityName: isCommunityPost ? null : community?.name ?? null,
    author,
    likeCount: post.likeCount,
    commentCount: post.commentCount,
    liked,
    pinned: Boolean(post.pinnedAt),
    createdAt: post.createdAt,
  };
}

type IncomingTag = { type?: string; id?: string };

/**
 * Validate requested tags: users must exist; communities must be public,
 * verified, and not archived. Returns storable tag docs and the tagged user ids.
 */
async function resolveTags(rawTags: IncomingTag[] | undefined) {
  if (!Array.isArray(rawTags) || !rawTags.length) return { tags: [], userIds: [] as string[], communityOwnerIds: [] as Array<{ ownerId: string; name: string; slug: string }> };
  const tags: Array<{ type: 'USER' | 'COMMUNITY'; refId: mongoose.Types.ObjectId; label: string; handle: string }> = [];
  const userIds: string[] = [];
  const communityOwnerIds: Array<{ ownerId: string; name: string; slug: string }> = [];
  const seen = new Set<string>();

  for (const raw of rawTags.slice(0, 20)) {
    if (!raw?.id || !mongoose.Types.ObjectId.isValid(raw.id)) continue;
    const key = `${raw.type}:${raw.id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    if (raw.type === 'USER') {
      const user = await authStore.getPublicUserById(raw.id).catch(() => null);
      if (!user) continue;
      tags.push({ type: 'USER', refId: new mongoose.Types.ObjectId(raw.id), label: user.fullName, handle: user.profile?.username ?? '' });
      userIds.push(raw.id);
    } else if (raw.type === 'COMMUNITY') {
      const community = await CommunityModel.findById(raw.id).select('name slug founder visibility verificationStatus archivedAt').lean();
      if (!community || community.visibility !== 'PUBLIC' || community.verificationStatus !== 'VERIFIED' || community.archivedAt) continue;
      tags.push({ type: 'COMMUNITY', refId: new mongoose.Types.ObjectId(raw.id), label: community.name, handle: community.slug });
      if (community.founder) communityOwnerIds.push({ ownerId: community.founder.toString(), name: community.name, slug: community.slug });
    }
  }
  return { tags, userIds, communityOwnerIds };
}

async function notifyMentioned(
  actorId: string,
  userIds: string[],
  communityOwnerIds: Array<{ ownerId: string; name: string; slug: string }>,
) {
  const actor = await authStore.getPublicUserById(actorId).catch(() => null);
  const actorName = actor?.fullName ?? 'Someone';
  await Promise.all([
    ...userIds
      .filter((id) => id !== actorId)
      .map((id) =>
        createNotification({
          userId: id,
          actorId,
          type: 'MENTION',
          title: `${actorName} mentioned you in a post`,
          link: '/home',
        }).catch(() => undefined),
      ),
    ...communityOwnerIds
      .filter((c) => c.ownerId !== actorId)
      .map((c) =>
        createNotification({
          userId: c.ownerId,
          actorId,
          type: 'MENTION',
          title: `${actorName} tagged ${c.name} in a post`,
          link: `/communities/${c.slug}`,
        }).catch(() => undefined),
      ),
  ]);
}

export async function createPost(
  userId: string,
  input: { content?: string; communityId?: string | null; imageUrl?: string; tags?: IncomingTag[]; poll?: unknown },
) {
  const content = (input.content ?? '').trim();
  const imageUrl = (input.imageUrl ?? '').trim();
  const poll = sanitizePoll(input.poll);
  if (!content && !imageUrl && !poll) {
    throw new Error('Add some text or an image to post');
  }
  if (poll && !content) {
    throw new Error('Add a question for your poll');
  }
  if (content.length > 3000) {
    throw new Error('Post is too long');
  }
  const { tags, userIds, communityOwnerIds } = await resolveTags(input.tags);
  const post = await PostModel.create({
    userId,
    communityId: input.communityId ? new mongoose.Types.ObjectId(input.communityId) : null,
    kind: 'TEXT',
    content,
    imageUrl,
    tags,
    poll,
  });
  await notifyMentioned(userId, userIds, communityOwnerIds);
  return getPost(post._id.toString(), userId);
}

export async function createMilestonePost(
  userId: string,
  input: {
    type: string;
    label: string;
    refId: string;
    communityId?: string | null;
    tags?: Array<{ type: 'USER' | 'COMMUNITY'; refId: string; label: string; handle: string }>;
  },
) {
  try {
    await PostModel.create({
      userId,
      communityId: input.communityId ? new mongoose.Types.ObjectId(input.communityId) : null,
      kind: 'MILESTONE',
      content: input.label,
      tags: (input.tags ?? []).map((t) => ({ type: t.type, refId: new mongoose.Types.ObjectId(t.refId), label: t.label, handle: t.handle })),
      milestone: { type: input.type, label: input.label, refId: input.refId },
    });
  } catch (error) {
    // Duplicate milestone (already posted) — ignore.
    if ((error as { code?: number }).code !== 11000) {
      console.warn('[GuildOS] milestone post failed', error instanceof Error ? error.message : error);
    }
  }
}

export async function getPost(postId: string, viewerId: string | null) {
  const post = await PostModel.findById(postId).lean();
  if (!post || post.hiddenAt) throw new Error('Post not found');
  const [author, liked, community, certificate, pollVotes] = await Promise.all([
    authorInfo(post.userId.toString()),
    viewerId ? PostLikeModel.exists({ postId, userId: viewerId }).then(Boolean) : Promise.resolve(false),
    post.communityId ? CommunityModel.findById(post.communityId).select('name slug logo').lean() : Promise.resolve(null),
    certificateForMilestone(post),
    viewerPollVotes(viewerId, [postId]),
  ]);
  return serializePost(post as PostDocument & { _id: unknown }, author, liked, community ? { name: community.name, slug: community.slug, logo: community.logo } : null, certificate, pollVotes.get(postId) ?? null);
}

/** Vote on a poll: same option retracts, another option switches, first vote counts. */
export async function votePoll(userId: string, postId: string, optionIndex: number) {
  const post = await PostModel.findById(postId).select('poll hiddenAt').lean();
  if (!post || post.hiddenAt) throw new Error('Post not found');
  const options = post.poll?.options ?? [];
  if (!options.length) throw new Error('This post has no poll');
  const idx = Math.floor(Number(optionIndex));
  if (!Number.isFinite(idx) || idx < 0 || idx >= options.length) throw new Error('Invalid poll option');

  const existing = await PollVoteModel.findOne({ postId, userId });
  if (existing && existing.optionIndex === idx) {
    await existing.deleteOne();
    await PostModel.updateOne({ _id: postId }, { $inc: { [`poll.options.${idx}.count`]: -1 } });
  } else if (existing) {
    const previous = existing.optionIndex;
    existing.optionIndex = idx;
    await existing.save();
    await PostModel.updateOne({ _id: postId }, { $inc: { [`poll.options.${previous}.count`]: -1, [`poll.options.${idx}.count`]: 1 } });
  } else {
    try {
      await PollVoteModel.create({ postId, userId, optionIndex: idx });
      await PostModel.updateOne({ _id: postId }, { $inc: { [`poll.options.${idx}.count`]: 1 } });
    } catch (error) {
      // Simultaneous first votes: unique index wins, ignore the duplicate.
      if ((error as { code?: number }).code !== 11000) throw error;
    }
  }
  return getPost(postId, userId);
}

export async function createCommunityPost(
  actorId: string,
  communityId: string,
  content: string,
  input: { imageUrl?: string; tags?: IncomingTag[]; poll?: unknown; cta?: { label: string; url: string } } = {},
) {
  const clean = (content ?? '').trim();
  const imageUrl = (input.imageUrl ?? '').trim();
  const poll = sanitizePoll(input.poll);
  if (!clean && !imageUrl && !poll) throw new Error('Add some text or an image to post');
  if (poll && !clean) throw new Error('Add a question for your poll');
  const community = await CommunityModel.findById(communityId).select('verificationStatus archivedAt').lean();
  if (!community) throw new Error('Community not found');
  if (community.archivedAt || community.verificationStatus !== 'VERIFIED') {
    throw new Error('Only verified communities can post');
  }
  const membership = await MembershipModel.findOne({ communityId, userId: actorId }).lean();
  const inactive = membership ? ['SUSPENDED', 'REMOVED', 'LEFT'].includes(membership.status as string) : true;
  if (!membership || inactive || !MANAGER_ROLES.includes(membership.role)) {
    throw new Error('Only community managers can post as the community');
  }
  const { tags, userIds, communityOwnerIds } = await resolveTags(input.tags);
  // CTA buttons are SYSTEM-only (sponsor announcements etc.) — the public route never passes one.
  const cta =
    input.cta && input.cta.label.trim() && /^(https?:\/\/|\/)/.test(input.cta.url.trim())
      ? { label: input.cta.label.trim().slice(0, 40), url: input.cta.url.trim().slice(0, 300) }
      : null;
  const post = await PostModel.create({
    userId: actorId,
    communityId: new mongoose.Types.ObjectId(communityId),
    authorType: 'COMMUNITY',
    kind: 'TEXT',
    content: clean.slice(0, 3000),
    imageUrl,
    tags,
    poll,
    cta,
  });
  await notifyMentioned(actorId, userIds, communityOwnerIds);
  return getPost(post._id.toString(), actorId);
}

export async function editPost(postId: string, actorId: string, content: string) {
  const post = await PostModel.findById(postId);
  if (!post) throw new Error('Post not found');
  if (post.userId.toString() !== actorId) throw new Error('You can only edit your own posts');
  if (post.kind === 'MILESTONE') throw new Error('Milestone posts cannot be edited');
  const clean = (content ?? '').trim();
  if (!clean && !post.imageUrl) throw new Error('Add some text or an image to post');
  if (clean.length > 3000) throw new Error('Post is too long');
  post.content = clean;
  await post.save();
  return getPost(post._id.toString(), actorId);
}

export type FeedSort = 'NEW' | 'TOP' | 'HOT';

/** Engagement score used by the Top sort. */
function engagementScore(post: { likeCount: number; commentCount: number }) {
  return post.likeCount * 2 + post.commentCount;
}

/** Reddit-style hot score: engagement dampened by age. */
function hotScore(post: { likeCount: number; commentCount: number; createdAt: Date }) {
  const ageHours = (Date.now() - new Date(post.createdAt).getTime()) / 3_600_000;
  return (engagementScore(post) + 1) / Math.pow(ageHours + 2, 1.5);
}

export async function getFeed(
  viewerId: string,
  options: { limit?: number; before?: string; scope?: 'FORYOU' | 'COMMUNITIES'; sort?: FeedSort } = {},
) {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 50);
  const query: Record<string, unknown> = { hiddenAt: null };
  if (options.before) {
    const beforeDate = new Date(options.before);
    if (!Number.isNaN(beforeDate.getTime())) query.createdAt = { $lt: beforeDate };
  }

  // Posts from archived communities are hidden from all feeds (reversible on reopen).
  const archived = await CommunityModel.find({ archivedAt: { $ne: null } }).select('_id').lean();
  const archivedIdSet = new Set(archived.map((c) => c._id.toString()));

  if (options.scope === 'COMMUNITIES') {
    const [memberships, follows] = await Promise.all([
      MembershipModel.find({ userId: viewerId, status: { $nin: ['SUSPENDED', 'REMOVED', 'LEFT'] } }).select('communityId').lean(),
      CommunityFollowModel.find({ userId: viewerId }).select('communityId').lean(),
    ]);
    const ids = [...memberships.map((m) => m.communityId), ...follows.map((f) => f.communityId)].filter(
      (id) => !archivedIdSet.has(id.toString()),
    );
    query.communityId = { $in: ids };
  } else if (archived.length) {
    query.communityId = { $nin: archived.map((c) => c._id) };
  }

  // Ranked "For You" first page (see docs/discovery-ranking-algorithms.md).
  // Older pages stay chronological so cursor pagination keeps working.
  // Explicit sorts: NEW = pure chronological, TOP = 7-day engagement, HOT = age-decayed engagement.
  const sort = options.sort;
  let posts: Array<PostDocument & { _id: mongoose.Types.ObjectId }>;
  if (sort === 'TOP' || sort === 'HOT') {
    const windowDays = sort === 'TOP' ? 7 : 14;
    query.createdAt = { ...(query.createdAt as object | undefined), $gte: new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000) };
    const pool = await PostModel.find(query).sort({ createdAt: -1 }).limit(200).lean();
    const scorer = sort === 'TOP' ? engagementScore : hotScore;
    posts = pool
      .map((p) => ({ p, score: scorer(p) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((x) => x.p);
  } else {
    const useRanking = isRankingEnabled() && options.scope !== 'COMMUNITIES' && sort !== 'NEW' && !options.before;
    posts = useRanking
      ? (await rankFeedPosts(
          viewerId,
          await PostModel.find(query).sort({ createdAt: -1 }).limit(rankingConfig.feedPoolSize).lean(),
        )).slice(0, limit)
      : await PostModel.find(query).sort({ createdAt: -1 }).limit(limit).lean();
  }
  const ids = posts.map((p) => p._id.toString());
  const likedIds = new Set(
    (await PostLikeModel.find({ userId: viewerId, postId: { $in: ids } }).select('postId').lean()).map((l) => l.postId.toString()),
  );
  const pollVotes = await viewerPollVotes(viewerId, ids);
  const communityIds = Array.from(new Set(posts.filter((p) => p.communityId).map((p) => p.communityId!.toString())));
  const communities = communityIds.length ? await CommunityModel.find({ _id: { $in: communityIds } }).select('name slug logo').lean() : [];
  const communityById = new Map(communities.map((c) => [c._id.toString(), { name: c.name, slug: c.slug, logo: c.logo }]));

  const items = await Promise.all(
    posts.map(async (p) => {
      const [author, certificate] = await Promise.all([authorInfo(p.userId.toString()), certificateForMilestone(p)]);
      return serializePost(
        p as PostDocument & { _id: unknown },
        author,
        likedIds.has(p._id.toString()),
        p.communityId ? communityById.get(p.communityId.toString()) ?? null : null,
        certificate,
        pollVotes.get(p._id.toString()) ?? null,
      );
    }),
  );
  return {
    posts: items,
    nextCursor:
      sort === 'TOP' || sort === 'HOT'
        ? null
        : items.length === limit
          ? items.reduce((oldest, p) => (p.createdAt < oldest ? p.createdAt : oldest), items[items.length - 1].createdAt)
          : null,
  };
}

export async function getCommunityPosts(communityId: string, viewerId: string, limit = 20) {
  const community = await CommunityModel.findById(communityId).select('name slug logo').lean();
  const cappedLimit = Math.min(Math.max(limit, 1), 50);
  const pinned = await PostModel.find({ communityId, hiddenAt: null, pinnedAt: { $ne: null } })
    .sort({ pinnedAt: -1 })
    .limit(MAX_PINNED_POSTS)
    .lean();
  const rest = await PostModel.find({ communityId, hiddenAt: null, _id: { $nin: pinned.map((p) => p._id) } })
    .sort({ createdAt: -1 })
    .limit(cappedLimit)
    .lean();
  const posts = [...pinned, ...rest];
  const ids = posts.map((p) => p._id.toString());
  const likedIds = new Set(
    (await PostLikeModel.find({ userId: viewerId, postId: { $in: ids } }).select('postId').lean()).map((l) => l.postId.toString()),
  );
  const pollVotes = await viewerPollVotes(viewerId, ids);
  const communityInfo = community ? { name: community.name, slug: community.slug, logo: community.logo } : null;
  return Promise.all(
    posts.map(async (p) => {
      const [author, certificate] = await Promise.all([authorInfo(p.userId.toString()), certificateForMilestone(p)]);
      return serializePost(
        p as PostDocument & { _id: unknown },
        author,
        likedIds.has(p._id.toString()),
        communityInfo,
        certificate,
        pollVotes.get(p._id.toString()) ?? null,
      );
    }),
  );
}

export async function getUserPosts(userId: string, viewerId: string | null, limit = 20) {
  const posts = await PostModel.find({ userId, authorType: { $ne: 'COMMUNITY' }, hiddenAt: null })
    .sort({ createdAt: -1 })
    .limit(Math.min(Math.max(limit, 1), 50))
    .lean();
  const ids = posts.map((p) => p._id.toString());
  const likedIds = new Set(
    viewerId
      ? (await PostLikeModel.find({ userId: viewerId, postId: { $in: ids } }).select('postId').lean()).map((l) => l.postId.toString())
      : [],
  );
  const pollVotes = await viewerPollVotes(viewerId, ids);
  const communityIds = [...new Set(posts.filter((p) => p.communityId).map((p) => p.communityId!.toString()))];
  const communities = communityIds.length
    ? await CommunityModel.find({ _id: { $in: communityIds } }).select('name slug logo').lean()
    : [];
  const communityById = new Map(communities.map((c) => [c._id.toString(), { name: c.name, slug: c.slug, logo: c.logo }]));
  const author = await authorInfo(userId);
  return Promise.all(
    posts.map(async (p) =>
      serializePost(
        p as PostDocument & { _id: unknown },
        author,
        likedIds.has(p._id.toString()),
        p.communityId ? communityById.get(p.communityId.toString()) ?? null : null,
        await certificateForMilestone(p),
        pollVotes.get(p._id.toString()) ?? null,
      ),
    ),
  );
}

export async function toggleLike(userId: string, postId: string) {
  const post = await PostModel.findById(postId);
  if (!post) throw new Error('Post not found');
  const existing = await PostLikeModel.findOne({ postId, userId });
  let liked: boolean;
  if (existing) {
    await existing.deleteOne();
    liked = false;
  } else {
    await PostLikeModel.create({ postId, userId });
    liked = true;
  }
  const likeCount = await PostLikeModel.countDocuments({ postId });
  post.likeCount = likeCount;
  await post.save();
  if (post.userId.toString() !== userId) {
    const groupKey = `POST_LIKE:${postId}`;
    if (liked) {
      const actor = await authorInfo(userId);
      await pushGroupedNotificationActor({
        userId: post.userId.toString(),
        actorId: userId,
        actorName: actor.fullName,
        type: 'POST_LIKE',
        groupKey,
        label: 'liked your post',
        body: post.content.slice(0, 100),
        link: `/posts/${postId}`,
      });
    } else {
      await removeGroupedNotificationActor({
        userId: post.userId.toString(),
        actorId: userId,
        type: 'POST_LIKE',
        groupKey,
        label: 'liked your post',
      });
    }
  }
  return { liked, likeCount };
}

export async function reportPost(userId: string, postId: string, reason: string) {
  if (!mongoose.Types.ObjectId.isValid(postId)) throw new Error('Post not found');
  const post = await PostModel.findById(postId);
  if (!post || post.hiddenAt) throw new Error('Post not found');
  if (post.userId.toString() === userId) throw new Error('You cannot report your own post');
  try {
    await ContentReportModel.create({ targetType: 'POST', targetId: post._id, reporterId: userId, reason: (reason ?? '').trim().slice(0, 300) });
    await PostModel.updateOne({ _id: post._id }, { $inc: { reportCount: 1 } });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return { reported: true, already: true };
    throw error;
  }
  return { reported: true, already: false };
}

export async function reportComment(userId: string, commentId: string, reason: string) {
  if (!mongoose.Types.ObjectId.isValid(commentId)) throw new Error('Comment not found');
  const comment = await PostCommentModel.findById(commentId).lean();
  if (!comment) throw new Error('Comment not found');
  if (comment.userId.toString() === userId) throw new Error('You cannot report your own comment');
  try {
    await ContentReportModel.create({ targetType: 'COMMENT', targetId: comment._id, reporterId: userId, reason: (reason ?? '').trim().slice(0, 300) });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return { reported: true, already: true };
    throw error;
  }
  return { reported: true, already: false };
}

export async function addComment(userId: string, postId: string, content: string, parentId?: string | null) {
  const clean = (content ?? '').trim();
  if (!clean) throw new Error('Comment is required');
  const post = await PostModel.findById(postId);
  if (!post) throw new Error('Post not found');
  let parent: { _id: mongoose.Types.ObjectId; userId: mongoose.Types.ObjectId; parentId: mongoose.Types.ObjectId | null } | null = null;
  if (parentId) {
    if (!mongoose.Types.ObjectId.isValid(parentId)) throw new Error('Comment not found');
    parent = await PostCommentModel.findById(parentId).select('userId parentId postId').lean();
    if (!parent || String((parent as { postId?: unknown }).postId) !== String(post._id)) throw new Error('Comment not found');
    // One level of nesting: replying to a reply attaches to the top-level comment.
    if (parent.parentId) parent = await PostCommentModel.findById(parent.parentId).select('userId parentId postId').lean();
  }
  const comment = await PostCommentModel.create({ postId, userId, parentId: parent ? parent._id : null, content: clean.slice(0, 1000) });
  post.commentCount = await PostCommentModel.countDocuments({ postId });
  await post.save();
  const author = await authorInfo(userId);
  const notifyUserId = parent ? parent.userId.toString() : post.userId.toString();
  if (notifyUserId !== userId) {
    await createNotification({
      userId: notifyUserId,
      actorId: userId,
      type: 'POST_COMMENT',
      title: parent ? `${author.fullName} replied to your comment` : `${author.fullName} commented on your post`,
      body: clean.slice(0, 100),
      link: `/posts/${postId}`,
    });
  }
  return { id: comment._id.toString(), parentId: comment.parentId ? comment.parentId.toString() : null, content: comment.content, author, createdAt: comment.createdAt, replies: [] };
}

export async function listComments(postId: string) {
  const comments = await PostCommentModel.find({ postId }).sort({ createdAt: 1 }).limit(300).lean();
  const serialized = await Promise.all(
    comments.map(async (c) => ({
      id: c._id.toString(),
      parentId: c.parentId ? c.parentId.toString() : null,
      content: c.content,
      author: await authorInfo(c.userId.toString()),
      createdAt: c.createdAt,
      replies: [] as Array<{ id: string; parentId: string | null; content: string; author: Awaited<ReturnType<typeof authorInfo>>; createdAt: Date }>,
    })),
  );
  // Thread: top-level comments in order, replies nested beneath their parent.
  const byId = new Map(serialized.map((c) => [c.id, c]));
  const topLevel: typeof serialized = [];
  for (const c of serialized) {
    const parent = c.parentId ? byId.get(c.parentId) : null;
    if (parent) parent.replies.push(c);
    else topLevel.push(c);
  }
  return topLevel;
}

/** Pin or unpin a community post (community managers only, max 3 pinned). */
export async function setPostPinned(actorId: string, postId: string, pinned: boolean) {
  const post = await PostModel.findById(postId);
  if (!post || post.hiddenAt) throw new Error('Post not found');
  if (!post.communityId) throw new Error('Only community posts can be pinned');
  await requireCommunityManager(post.communityId.toString(), actorId);
  if (pinned && !post.pinnedAt) {
    const pinnedCount = await PostModel.countDocuments({ communityId: post.communityId, pinnedAt: { $ne: null }, hiddenAt: null });
    if (pinnedCount >= MAX_PINNED_POSTS) {
      throw new Error(`You can pin up to ${MAX_PINNED_POSTS} posts. Unpin one first.`);
    }
  }
  post.pinnedAt = pinned ? new Date() : null;
  await post.save();
  return getPost(post._id.toString(), actorId);
}

/**
 * Trending across campus: upcoming events with the most registrations plus
 * communities with the most new members this week. Powers the /home module.
 */
export async function getTrending() {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [events, joins] = await Promise.all([
    EventModel.find({ status: { $in: ['PUBLISHED', 'CHECK_IN'] }, startDate: { $gte: new Date() } })
      .sort({ registrationCount: -1, startDate: 1 })
      .limit(4)
      .select('title slug startDate venue mode registrationCount bannerImage')
      .lean(),
    MembershipModel.aggregate<{ _id: mongoose.Types.ObjectId; joins: number }>([
      { $match: { joinedAt: { $gte: weekAgo }, status: 'ACTIVE' } },
      { $group: { _id: '$communityId', joins: { $sum: 1 } } },
      { $sort: { joins: -1 } },
      { $limit: 10 },
    ]),
  ]);

  const communityDocs = joins.length
    ? await CommunityModel.find({
        _id: { $in: joins.map((j) => j._id) },
        visibility: 'PUBLIC',
        verificationStatus: 'VERIFIED',
        archivedAt: null,
      })
        .select('name slug logo memberCount')
        .lean()
    : [];
  const joinsById = new Map(joins.map((j) => [j._id.toString(), j.joins]));
  const communities = communityDocs
    .map((c) => ({
      id: c._id.toString(),
      name: c.name,
      slug: c.slug,
      logo: c.logo,
      memberCount: c.memberCount,
      newMembers: joinsById.get(c._id.toString()) ?? 0,
    }))
    .sort((a, b) => b.newMembers - a.newMembers)
    .slice(0, 4);

  return {
    events: events.map((e) => ({
      id: e._id.toString(),
      title: e.title,
      slug: e.slug,
      startDate: e.startDate,
      venue: e.venue ?? '',
      mode: e.mode ?? '',
      registrationCount: e.registrationCount,
    })),
    communities,
  };
}

export async function deletePost(userId: string, postId: string) {
  const post = await PostModel.findById(postId);
  if (!post) throw new Error('Post not found');
  if (post.userId.toString() !== userId) {
    throw new Error('You can only delete your own posts');
  }
  await Promise.all([
    post.deleteOne(),
    PostLikeModel.deleteMany({ postId }),
    PostCommentModel.deleteMany({ postId }),
  ]);
  return { message: 'Post deleted' };
}
