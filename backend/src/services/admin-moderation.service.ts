import mongoose from 'mongoose';
import { ContentReportModel } from '../models/content-report.model';
import { PostModel } from '../models/post.model';
import { PostCommentModel } from '../models/post-comment.model';
import { StatusStoryModel } from '../models/status.model';
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

  const grouped = new Map<string, { targetType: 'POST' | 'COMMENT' | 'STATUS'; targetId: string; reasons: string[]; count: number; lastAt: Date }>();
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
  const statuses: unknown[] = [];

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
    } else if (g.targetType === 'COMMENT') {
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
    } else {
      // Status stories expire after 24h and are then deleted, so a missing one is skipped like a deleted post.
      const status = await StatusStoryModel.findById(g.targetId).lean();
      if (!status) continue;
      statuses.push({
        id: status._id.toString(),
        content: status.content,
        attachment: status.attachment
          ? { type: status.attachment.type, title: status.attachment.title }
          : null,
        // Always the real person who posted; community posts also say which community it went out as.
        author: await authorBrief(status.userId.toString()),
        postedAsCommunity: status.communityId ? status.authorName : '',
        reportCount: g.count,
        reasons: g.reasons.slice(0, 5),
        hidden: Boolean(status.hiddenAt),
        createdAt: status.createdAt,
        expiresAt: status.expiresAt,
        lastReportedAt: g.lastAt,
      });
    }
  }

  return { posts, comments, statuses };
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

export async function moderateStatus(statusId: string, action: 'REMOVE' | 'DISMISS', note = '') {
  if (!mongoose.Types.ObjectId.isValid(statusId)) throw new Error('Status not found');
  const status = await StatusStoryModel.findById(statusId);
  if (!status) throw new Error('Status not found');

  if (action === 'REMOVE') {
    status.hiddenAt = new Date();
    status.hiddenReason = note.slice(0, 300);
    await status.save();
    await ContentReportModel.updateMany({ targetType: 'STATUS', targetId: status._id, status: 'PENDING' }, { $set: { status: 'ACTIONED' } });
  } else {
    await ContentReportModel.updateMany({ targetType: 'STATUS', targetId: status._id, status: 'PENDING' }, { $set: { status: 'DISMISSED' } });
  }
  return { ok: true };
}