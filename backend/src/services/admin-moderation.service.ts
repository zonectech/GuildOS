import mongoose from 'mongoose';
import { ContentReportModel } from '../models/content-report.model';
import { PostModel } from '../models/post.model';
import { PostCommentModel } from '../models/post-comment.model';
import { authStore } from '../store/auth-store';

function normalizeAvatar(avatar?: string) {
  if (!avatar) return '';
  if (avatar.startsWith('http') || avatar.startsWith('/')) return avatar;
  return `/uploads/${avatar}`;
}

async function authorBrief(userId: string) {
  const user = await authStore.getPublicUserById(userId).catch(() => null);
  return {
    id: userId,
    fullName: user?.fullName ?? 'Unknown user',
    username: user?.profile?.username ?? '',
    avatar: normalizeAvatar(user?.profile?.avatar),
  };
}

/**
 * Groups pending content reports by their target and enriches each with the
 * underlying post/comment and reporter count for the admin moderation queue.
 */
export async function listContentReports() {
  const reports = await ContentReportModel.find({ status: 'PENDING' }).sort({ createdAt: -1 }).lean();

  const grouped = new Map<string, { targetType: 'POST' | 'COMMENT'; targetId: string; reasons: string[]; count: number; lastAt: Date }>();
  for (const r of reports) {
    const key = `${r.targetType}:${r.targetId.toString()}`;
    const entry = grouped.get(key);
    if (entry) {
      entry.count += 1;
      if (r.reason) entry.reasons.push(r.reason);
    } else {
      grouped.set(key, {
        targetType: r.targetType,
        targetId: r.targetId.toString(),
        reasons: r.reason ? [r.reason] : [],
        count: 1,
        lastAt: r.createdAt,
      });
    }
  }

  const posts: unknown[] = [];
  const comments: unknown[] = [];

  for (const g of grouped.values()) {
    if (g.targetType === 'POST') {
      const post = await PostModel.findById(g.targetId).lean();
      if (!post) continue;
      posts.push({
        id: post._id.toString(),
        content: post.content,
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

export async function moderatePost(postId: string, action: 'REMOVE' | 'DISMISS', note = '') {
  if (!mongoose.Types.ObjectId.isValid(postId)) throw new Error('Post not found');
  const post = await PostModel.findById(postId);
  if (!post) throw new Error('Post not found');

  if (action === 'REMOVE') {
    post.hiddenAt = new Date();
    post.hiddenReason = note.slice(0, 300);
    await post.save();
    await ContentReportModel.updateMany({ targetType: 'POST', targetId: post._id, status: 'PENDING' }, { $set: { status: 'ACTIONED' } });
  } else {
    await ContentReportModel.updateMany({ targetType: 'POST', targetId: post._id, status: 'PENDING' }, { $set: { status: 'DISMISSED' } });
  }
  return { ok: true };
}

export async function moderateComment(commentId: string, action: 'REMOVE' | 'DISMISS') {
  if (!mongoose.Types.ObjectId.isValid(commentId)) throw new Error('Comment not found');
  const comment = await PostCommentModel.findById(commentId);
  if (!comment) throw new Error('Comment not found');

  if (action === 'REMOVE') {
    const postId = comment.postId;
    await comment.deleteOne();
    const count = await PostCommentModel.countDocuments({ postId });
    await PostModel.updateOne({ _id: postId }, { $set: { commentCount: count } });
    await ContentReportModel.updateMany({ targetType: 'COMMENT', targetId: commentId, status: 'PENDING' }, { $set: { status: 'ACTIONED' } });
  } else {
    await ContentReportModel.updateMany({ targetType: 'COMMENT', targetId: commentId, status: 'PENDING' }, { $set: { status: 'DISMISSED' } });
  }
  return { ok: true };
}
