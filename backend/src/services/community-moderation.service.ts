import mongoose from 'mongoose';
import { ContentReportModel } from '../models/content-report.model';
import { PostModel } from '../models/post.model';
import { PostCommentModel } from '../models/post-comment.model';
import { MembershipModel } from '../models/membership.model';
import { authStore } from '../store/auth-store';
import { moderateComment, moderatePost } from './admin-moderation.service';

const MANAGER_ROLES = ['COORDINATOR', 'SECRETARY', 'TREASURER', 'VICE_PRESIDENT', 'PRESIDENT', 'FOUNDER'];

async function requireManager(communityId: string, actorId: string) {
  const membership = await MembershipModel.findOne({ communityId, userId: actorId }).lean();
  const inactive = membership ? ['SUSPENDED', 'REMOVED', 'LEFT'].includes(membership.status as string) : true;
  if (!membership || inactive || !MANAGER_ROLES.includes(membership.role)) {
    throw new Error('Only community managers can moderate this community');
  }
}

async function authorBrief(userId: string) {
  const user = await authStore.getPublicUserById(userId).catch(() => null);
  return {
    id: userId,
    fullName: user?.fullName ?? 'Unknown user',
    username: user?.profile?.username ?? '',
    avatar: user?.profile?.avatar ?? '',
  };
}

/**
 * Pending reports on posts/comments belonging to one community, grouped by
 * target — the leader-facing mod queue (delegated moderation).
 */
export async function listCommunityReports(communityId: string, actorId: string) {
  await requireManager(communityId, actorId);

  const reports = await ContentReportModel.find({ status: 'PENDING' }).sort({ createdAt: -1 }).limit(500).lean();

  const grouped = new Map<string, { targetType: 'POST' | 'COMMENT'; targetId: string; reasons: string[]; count: number; lastAt: Date }>();
  for (const r of reports) {
    const key = `${r.targetType}:${r.targetId.toString()}`;
    const entry = grouped.get(key);
    if (entry) {
      entry.count += 1;
      if (r.reason) entry.reasons.push(r.reason);
    } else {
      grouped.set(key, { targetType: r.targetType, targetId: r.targetId.toString(), reasons: r.reason ? [r.reason] : [], count: 1, lastAt: r.createdAt });
    }
  }

  const posts: Array<Record<string, unknown>> = [];
  const comments: Array<Record<string, unknown>> = [];

  for (const g of grouped.values()) {
    if (g.targetType === 'POST') {
      const post = await PostModel.findById(g.targetId).lean();
      if (!post || !post.communityId || post.communityId.toString() !== communityId) continue;
      posts.push({
        id: post._id.toString(),
        content: post.content,
        imageUrl: post.imageUrl ?? '',
        author: await authorBrief(post.userId.toString()),
        reportCount: g.count,
        reasons: g.reasons.slice(0, 5),
        hidden: Boolean(post.hiddenAt),
        createdAt: post.createdAt,
        lastReportedAt: g.lastAt,
      });
    } else {
      const comment = await PostCommentModel.findById(g.targetId).lean();
      if (!comment) continue;
      const post = await PostModel.findById(comment.postId).select('communityId').lean();
      if (!post || !post.communityId || post.communityId.toString() !== communityId) continue;
      comments.push({
        id: comment._id.toString(),
        postId: comment.postId.toString(),
        content: comment.content,
        author: await authorBrief(comment.userId.toString()),
        reportCount: g.count,
        reasons: g.reasons.slice(0, 5),
        createdAt: comment.createdAt,
        lastReportedAt: g.lastAt,
      });
    }
  }

  return { posts, comments };
}

/** Hide (REMOVE) or clear reports (DISMISS) on a post in the manager's community. */
export async function moderateCommunityPost(communityId: string, actorId: string, postId: string, action: 'REMOVE' | 'DISMISS', note = '') {
  await requireManager(communityId, actorId);
  if (!mongoose.Types.ObjectId.isValid(postId)) throw new Error('Post not found');
  const post = await PostModel.findById(postId).select('communityId').lean();
  if (!post || !post.communityId || post.communityId.toString() !== communityId) throw new Error('Post not found');
  return moderatePost(postId, action, note);
}

/** Delete (REMOVE) or clear reports (DISMISS) on a comment under the manager's community posts. */
export async function moderateCommunityComment(communityId: string, actorId: string, commentId: string, action: 'REMOVE' | 'DISMISS') {
  await requireManager(communityId, actorId);
  if (!mongoose.Types.ObjectId.isValid(commentId)) throw new Error('Comment not found');
  const comment = await PostCommentModel.findById(commentId).select('postId').lean();
  if (!comment) throw new Error('Comment not found');
  const post = await PostModel.findById(comment.postId).select('communityId').lean();
  if (!post || !post.communityId || post.communityId.toString() !== communityId) throw new Error('Comment not found');
  return moderateComment(commentId, action);
}
