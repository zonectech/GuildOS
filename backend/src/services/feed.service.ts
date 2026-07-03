import mongoose from 'mongoose';
import { PostModel, type PostDocument } from '../models/post.model';
import { PostLikeModel } from '../models/post-like.model';
import { PostCommentModel } from '../models/post-comment.model';
import { CommunityModel } from '../models/community.model';
import { MembershipModel } from '../models/membership.model';
import { CommunityFollowModel } from '../models/community-follow.model';
import { authStore } from '../store/auth-store';
import { createNotification } from './notification.service';

const MANAGER_ROLES = ['COORDINATOR', 'SECRETARY', 'TREASURER', 'VICE_PRESIDENT', 'PRESIDENT', 'FOUNDER'];

async function authorInfo(userId: string) {
  const user = await authStore.getPublicUserById(userId);
  return {
    id: userId,
    fullName: user?.fullName ?? 'Student',
    username: user?.profile?.username ?? '',
    avatar: user?.profile?.avatar ?? '',
    headline: [user?.profile?.department, user?.profile?.university].filter(Boolean).join(' · '),
    isCommunity: false,
  };
}

type Community = { name: string; slug: string; logo: string } | null;

function serializePost(post: PostDocument & { _id: unknown }, userAuthor: Awaited<ReturnType<typeof authorInfo>>, liked: boolean, community: Community) {
  const isCommunityPost = post.authorType === 'COMMUNITY' && community;
  const author = isCommunityPost
    ? { id: post.communityId ? String(post.communityId) : '', fullName: community!.name, username: community!.slug, avatar: community!.logo, headline: 'Community', isCommunity: true }
    : userAuthor;
  return {
    id: String(post._id),
    kind: post.kind,
    content: post.content,
    milestone: post.milestone && post.milestone.type ? post.milestone : null,
    communityId: post.communityId ? String(post.communityId) : null,
    communityName: isCommunityPost ? null : community?.name ?? null,
    author,
    likeCount: post.likeCount,
    commentCount: post.commentCount,
    liked,
    createdAt: post.createdAt,
  };
}

export async function createPost(userId: string, input: { content?: string; communityId?: string | null }) {
  const content = (input.content ?? '').trim();
  if (!content) {
    throw new Error('Post content is required');
  }
  if (content.length > 3000) {
    throw new Error('Post is too long');
  }
  const post = await PostModel.create({
    userId,
    communityId: input.communityId ? new mongoose.Types.ObjectId(input.communityId) : null,
    kind: 'TEXT',
    content,
  });
  return getPost(post._id.toString(), userId);
}

export async function createMilestonePost(
  userId: string,
  input: { type: string; label: string; refId: string; communityId?: string | null },
) {
  try {
    await PostModel.create({
      userId,
      communityId: input.communityId ? new mongoose.Types.ObjectId(input.communityId) : null,
      kind: 'MILESTONE',
      content: input.label,
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
  if (!post) throw new Error('Post not found');
  const [author, liked, community] = await Promise.all([
    authorInfo(post.userId.toString()),
    viewerId ? PostLikeModel.exists({ postId, userId: viewerId }).then(Boolean) : Promise.resolve(false),
    post.communityId ? CommunityModel.findById(post.communityId).select('name slug logo').lean() : Promise.resolve(null),
  ]);
  return serializePost(post as PostDocument & { _id: unknown }, author, liked, community ? { name: community.name, slug: community.slug, logo: community.logo } : null);
}

export async function createCommunityPost(actorId: string, communityId: string, content: string) {
  const clean = (content ?? '').trim();
  if (!clean) throw new Error('Post content is required');
  const membership = await MembershipModel.findOne({ communityId, userId: actorId }).lean();
  const inactive = membership ? ['SUSPENDED', 'REMOVED', 'LEFT'].includes(membership.status as string) : true;
  if (!membership || inactive || !MANAGER_ROLES.includes(membership.role)) {
    throw new Error('Only community managers can post as the community');
  }
  const post = await PostModel.create({
    userId: actorId,
    communityId: new mongoose.Types.ObjectId(communityId),
    authorType: 'COMMUNITY',
    kind: 'TEXT',
    content: clean.slice(0, 3000),
  });
  return getPost(post._id.toString(), actorId);
}

export async function getFeed(viewerId: string, options: { limit?: number; before?: string; scope?: 'FORYOU' | 'COMMUNITIES' } = {}) {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 50);
  const query: Record<string, unknown> = {};
  if (options.before) {
    const beforeDate = new Date(options.before);
    if (!Number.isNaN(beforeDate.getTime())) query.createdAt = { $lt: beforeDate };
  }
  if (options.scope === 'COMMUNITIES') {
    const [memberships, follows] = await Promise.all([
      MembershipModel.find({ userId: viewerId, status: { $nin: ['SUSPENDED', 'REMOVED', 'LEFT'] } }).select('communityId').lean(),
      CommunityFollowModel.find({ userId: viewerId }).select('communityId').lean(),
    ]);
    const ids = [...memberships.map((m) => m.communityId), ...follows.map((f) => f.communityId)];
    query.communityId = { $in: ids };
  }
  const posts = await PostModel.find(query).sort({ createdAt: -1 }).limit(limit).lean();
  const ids = posts.map((p) => p._id.toString());
  const likedIds = new Set(
    (await PostLikeModel.find({ userId: viewerId, postId: { $in: ids } }).select('postId').lean()).map((l) => l.postId.toString()),
  );
  const communityIds = Array.from(new Set(posts.filter((p) => p.communityId).map((p) => p.communityId!.toString())));
  const communities = communityIds.length ? await CommunityModel.find({ _id: { $in: communityIds } }).select('name slug logo').lean() : [];
  const communityById = new Map(communities.map((c) => [c._id.toString(), { name: c.name, slug: c.slug, logo: c.logo }]));

  const items = await Promise.all(
    posts.map(async (p) => {
      const author = await authorInfo(p.userId.toString());
      return serializePost(
        p as PostDocument & { _id: unknown },
        author,
        likedIds.has(p._id.toString()),
        p.communityId ? communityById.get(p.communityId.toString()) ?? null : null,
      );
    }),
  );
  return { posts: items, nextCursor: items.length === limit ? items[items.length - 1].createdAt : null };
}

export async function getCommunityPosts(communityId: string, viewerId: string, limit = 20) {
  const community = await CommunityModel.findById(communityId).select('name slug logo').lean();
  const posts = await PostModel.find({ communityId }).sort({ createdAt: -1 }).limit(Math.min(Math.max(limit, 1), 50)).lean();
  const ids = posts.map((p) => p._id.toString());
  const likedIds = new Set(
    (await PostLikeModel.find({ userId: viewerId, postId: { $in: ids } }).select('postId').lean()).map((l) => l.postId.toString()),
  );
  const communityInfo = community ? { name: community.name, slug: community.slug, logo: community.logo } : null;
  return Promise.all(
    posts.map(async (p) => {
      const author = await authorInfo(p.userId.toString());
      return serializePost(p as PostDocument & { _id: unknown }, author, likedIds.has(p._id.toString()), communityInfo);
    }),
  );
}

export async function getUserPosts(userId: string, viewerId: string | null, limit = 20) {
  const posts = await PostModel.find({ userId, authorType: { $ne: 'COMMUNITY' } })
    .sort({ createdAt: -1 })
    .limit(Math.min(Math.max(limit, 1), 50))
    .lean();
  const ids = posts.map((p) => p._id.toString());
  const likedIds = new Set(
    viewerId
      ? (await PostLikeModel.find({ userId: viewerId, postId: { $in: ids } }).select('postId').lean()).map((l) => l.postId.toString())
      : [],
  );
  const communityIds = [...new Set(posts.filter((p) => p.communityId).map((p) => p.communityId!.toString()))];
  const communities = communityIds.length
    ? await CommunityModel.find({ _id: { $in: communityIds } }).select('name slug logo').lean()
    : [];
  const communityById = new Map(communities.map((c) => [c._id.toString(), { name: c.name, slug: c.slug, logo: c.logo }]));
  const author = await authorInfo(userId);
  return posts.map((p) =>
    serializePost(
      p as PostDocument & { _id: unknown },
      author,
      likedIds.has(p._id.toString()),
      p.communityId ? communityById.get(p.communityId.toString()) ?? null : null,
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
  if (liked && post.userId.toString() !== userId) {
    const actor = await authorInfo(userId);
    await createNotification({
      userId: post.userId.toString(),
      actorId: userId,
      type: 'POST_LIKE',
      title: `${actor.fullName} liked your post`,
      body: post.content.slice(0, 100),
      link: '/home',
    });
  }
  return { liked, likeCount };
}

export async function addComment(userId: string, postId: string, content: string) {
  const clean = (content ?? '').trim();
  if (!clean) throw new Error('Comment is required');
  const post = await PostModel.findById(postId);
  if (!post) throw new Error('Post not found');
  const comment = await PostCommentModel.create({ postId, userId, content: clean.slice(0, 1000) });
  post.commentCount = await PostCommentModel.countDocuments({ postId });
  await post.save();
  const author = await authorInfo(userId);
  if (post.userId.toString() !== userId) {
    await createNotification({
      userId: post.userId.toString(),
      actorId: userId,
      type: 'POST_COMMENT',
      title: `${author.fullName} commented on your post`,
      body: clean.slice(0, 100),
      link: '/home',
    });
  }
  return { id: comment._id.toString(), content: comment.content, author, createdAt: comment.createdAt };
}

export async function listComments(postId: string) {
  const comments = await PostCommentModel.find({ postId }).sort({ createdAt: 1 }).limit(100).lean();
  return Promise.all(
    comments.map(async (c) => ({
      id: c._id.toString(),
      content: c.content,
      author: await authorInfo(c.userId.toString()),
      createdAt: c.createdAt,
    })),
  );
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
