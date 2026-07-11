/**
 * Feed ranking — scores a candidate pool of posts for the "For You" feed.
 * Spec: docs/discovery-ranking-algorithms.md §1.
 *
 * score = (base + affinity + engagement + content) × decay(age) × diversity
 */

import type mongoose from 'mongoose';
import { ConnectionModel } from '../../models/connection.model';
import { MembershipModel } from '../../models/membership.model';
import { CommunityFollowModel } from '../../models/community-follow.model';
import { UserModel } from '../../models/user.model';
import { RANKING_WEIGHTS, log2p1, norm } from './ranking.config';

type LeanPost = {
  _id: unknown;
  userId: mongoose.Types.ObjectId;
  communityId: mongoose.Types.ObjectId | null;
  kind: string;
  imageUrl: string;
  tags: { type: string; refId: mongoose.Types.ObjectId }[];
  milestone: { type?: string } | null;
  likeCount: number;
  commentCount: number;
  createdAt: Date;
};

type ViewerContext = {
  connectionIds: Set<string>;
  memberCommunityIds: Set<string>;
  followedCommunityIds: Set<string>;
  university: string;
};

async function buildViewerContext(viewerId: string): Promise<ViewerContext> {
  const [connections, memberships, follows, me] = await Promise.all([
    ConnectionModel.find({ status: 'ACCEPTED', $or: [{ requesterId: viewerId }, { addresseeId: viewerId }] })
      .select('requesterId addresseeId')
      .lean(),
    MembershipModel.find({ userId: viewerId, status: { $nin: ['SUSPENDED', 'REMOVED', 'LEFT'] } })
      .select('communityId')
      .lean(),
    CommunityFollowModel.find({ userId: viewerId }).select('communityId').lean(),
    UserModel.findById(viewerId).select('profile.university').lean(),
  ]);

  const connectionIds = new Set(
    connections.map((c) =>
      c.requesterId.toString() === viewerId ? c.addresseeId.toString() : c.requesterId.toString(),
    ),
  );
  return {
    connectionIds,
    memberCommunityIds: new Set(memberships.map((m) => m.communityId.toString())),
    followedCommunityIds: new Set(follows.map((f) => f.communityId.toString())),
    university: norm(me?.profile?.university),
  };
}

function scorePost(post: LeanPost, ctx: ViewerContext, authorUniversity: string, now: number) {
  const w = RANKING_WEIGHTS.feed;
  let score = w.base;

  // Affinity
  const authorId = post.userId.toString();
  const communityId = post.communityId?.toString() ?? null;
  if (ctx.connectionIds.has(authorId)) score += w.authorIsConnection;
  if (communityId && ctx.memberCommunityIds.has(communityId)) score += w.inMyCommunity;
  else if (communityId && ctx.followedCommunityIds.has(communityId)) score += w.inFollowedCommunity;
  if (ctx.university && authorUniversity && ctx.university === authorUniversity) score += w.sameUniversity;

  // Engagement (log-scaled, comments > likes)
  score += w.likeLogWeight * log2p1(post.likeCount) + w.commentLogWeight * log2p1(post.commentCount);

  // Content quality — verified achievement is the product
  if (post.kind === 'MILESTONE' || post.milestone?.type) score += w.milestoneBoost;
  if (post.imageUrl) score += w.imageBoost;

  // Recency decay (half-life)
  const ageHours = Math.max(0, (now - new Date(post.createdAt).getTime()) / 36e5);
  score *= Math.pow(0.5, ageHours / w.halfLifeHours);

  return score;
}

/**
 * Ranks a candidate pool of lean post documents for a viewer.
 * Tag boost + author-diversity guard applied here. Returns posts sorted
 * by score (highest first) — caller slices to page size.
 */
export async function rankFeedPosts<T extends LeanPost>(viewerId: string, posts: T[]): Promise<T[]> {
  if (posts.length === 0) return posts;
  const ctx = await buildViewerContext(viewerId);
  const now = Date.now();
  const w = RANKING_WEIGHTS.feed;

  // Author universities in one query (campus-locality signal).
  const authorIds = Array.from(new Set(posts.map((p) => p.userId.toString())));
  const authors = await UserModel.find({ _id: { $in: authorIds } }).select('profile.university').lean();
  const universityByAuthor = new Map(authors.map((a) => [a._id.toString(), norm(a.profile?.university)]));

  const scored = posts.map((post) => {
    let score = scorePost(post, ctx, universityByAuthor.get(post.userId.toString()) ?? '', now);
    const taggedMe = (post.tags ?? []).some((t) => t.type === 'USER' && t.refId?.toString() === viewerId);
    if (taggedMe) score += w.taggedMe;
    return { post, score };
  });

  scored.sort((a, b) => b.score - a.score);

  // Diversity guard: demote repeated authors within the page.
  const authorSeen = new Map<string, number>();
  for (const item of scored) {
    const authorId = item.post.userId.toString();
    const seen = authorSeen.get(authorId) ?? 0;
    if (seen > 0) item.score *= Math.pow(w.authorDiversityFactor, seen);
    authorSeen.set(authorId, seen + 1);
  }
  scored.sort((a, b) => b.score - a.score);

  return scored.map((s) => s.post);
}
