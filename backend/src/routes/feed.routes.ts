import { Router } from 'express';
import { requireAuth, optionalAuth, type AuthenticatedRequest } from '../middleware/auth';
import { addComment, createCommunityPost, createPost, deletePost, getCommunityPosts, getFeed, getUserPosts, listComments, toggleLike } from '../services/feed.service';

export const feedRouter = Router();

function statusFor(message: string) {
  if (/not found/i.test(message)) return 404;
  if (/only delete|permission|managers/i.test(message)) return 403;
  return 400;
}

feedRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const scope = req.query.scope === 'COMMUNITIES' ? 'COMMUNITIES' : 'FORYOU';
    const result = await getFeed(req.userId as string, {
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      before: req.query.before ? String(req.query.before) : undefined,
      scope,
    });
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load feed' });
  }
});

feedRouter.post('/community/:communityId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { content } = req.body as { content?: string };
    const post = await createCommunityPost(req.userId as string, req.params.communityId, content ?? '');
    return res.status(201).json({ post });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to post as community';
    return res.status(statusFor(message)).json({ error: message });
  }
});

feedRouter.get('/community/:communityId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const posts = await getCommunityPosts(req.params.communityId, req.userId as string);
    return res.json({ posts });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load community posts' });
  }
});

feedRouter.get('/user/:userId', optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const posts = await getUserPosts(req.params.userId, req.userId ?? null);
    return res.json({ posts });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load posts' });
  }
});

feedRouter.post('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const post = await createPost(req.userId as string, req.body ?? {});
    return res.status(201).json({ post });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create post';
    return res.status(statusFor(message)).json({ error: message });
  }
});

feedRouter.post('/:id/like', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await toggleLike(req.userId as string, req.params.id);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to like post';
    return res.status(statusFor(message)).json({ error: message });
  }
});

feedRouter.get('/:id/comments', requireAuth, async (req, res) => {
  try {
    const comments = await listComments(req.params.id);
    return res.json({ comments });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load comments' });
  }
});

feedRouter.post('/:id/comments', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { content } = req.body as { content?: string };
    const comment = await addComment(req.userId as string, req.params.id, content ?? '');
    return res.status(201).json({ comment });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to add comment';
    return res.status(statusFor(message)).json({ error: message });
  }
});

feedRouter.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await deletePost(req.userId as string, req.params.id);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to delete post';
    return res.status(statusFor(message)).json({ error: message });
  }
});
