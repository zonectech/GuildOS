import { Router } from 'express';
import { requireAuth, optionalAuth, type AuthenticatedRequest } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { addComment, createCommunityPost, createPost, deletePost, editPost, getCommunityPosts, getFeed, getPost, getTrending, getUserPosts, listComments, reportComment, reportPost, setPostPinned, toggleLike, votePoll } from '../services/feed.service';

export const feedRouter = Router();

function statusFor(message: string) {
  if (/not found/i.test(message)) return 404;
  if (/only delete|only edit|permission|managers/i.test(message)) return 403;
  return 400;
}

function parseTags(raw: unknown): Array<{ type?: string; id?: string }> {
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parsePoll(raw: unknown): { options: unknown[] } | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return { options: parsed };
    if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { options?: unknown }).options)) {
      return { options: (parsed as { options: unknown[] }).options };
    }
    return null;
  } catch {
    return null;
  }
}

feedRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const scope = req.query.scope === 'COMMUNITIES' ? 'COMMUNITIES' : 'FORYOU';
    const sort = req.query.sort === 'NEW' || req.query.sort === 'TOP' || req.query.sort === 'HOT' ? req.query.sort : undefined;
    const result = await getFeed(req.userId as string, {
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      before: req.query.before ? String(req.query.before) : undefined,
      scope,
      sort,
    });
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load feed' });
  }
});

feedRouter.post('/community/:communityId', requireAuth, upload.single('image'), async (req: AuthenticatedRequest, res) => {
  try {
    const { content } = req.body as { content?: string };
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : '';
    const tags = parseTags((req.body as { tags?: string }).tags);
    const poll = parsePoll((req.body as { poll?: string }).poll);
    const post = await createCommunityPost(req.userId as string, req.params.communityId, content ?? '', { imageUrl, tags, poll });
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

// NOTE: must be registered before GET /:id so 'trending' isn't treated as a post id.
feedRouter.get('/trending', requireAuth, async (_req, res) => {
  try {
    const result = await getTrending();
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load trending' });
  }
});

feedRouter.get('/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const post = await getPost(req.params.id, req.userId as string);
    return res.json({ post });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load post';
    return res.status(statusFor(message)).json({ error: message });
  }
});

feedRouter.post('/', requireAuth, upload.single('image'), async (req: AuthenticatedRequest, res) => {
  try {
    const { content, communityId } = req.body as { content?: string; communityId?: string };
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : '';
    const tags = parseTags((req.body as { tags?: string }).tags);
    const poll = parsePoll((req.body as { poll?: string }).poll);
    const post = await createPost(req.userId as string, { content, communityId: communityId || null, imageUrl, tags, poll });
    return res.status(201).json({ post });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create post';
    return res.status(statusFor(message)).json({ error: message });
  }
});

feedRouter.post('/report', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { targetType, targetId, reason } = req.body as { targetType?: string; targetId?: string; reason?: string };
    if (targetType !== 'POST' && targetType !== 'COMMENT') {
      return res.status(400).json({ error: 'Invalid report target' });
    }
    if (!targetId) {
      return res.status(400).json({ error: 'A target is required' });
    }
    const result =
      targetType === 'POST'
        ? await reportPost(req.userId as string, targetId, reason ?? '')
        : await reportComment(req.userId as string, targetId, reason ?? '');
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to submit report';
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

feedRouter.post('/:id/poll/vote', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { optionIndex } = req.body as { optionIndex?: number };
    const post = await votePoll(req.userId as string, req.params.id, Number(optionIndex));
    return res.json({ post });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to vote';
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
    const { content, parentId } = req.body as { content?: string; parentId?: string };
    const comment = await addComment(req.userId as string, req.params.id, content ?? '', parentId ?? null);
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

feedRouter.patch('/:id/pin', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const post = await setPostPinned(req.userId as string, req.params.id, Boolean(req.body?.pinned));
    return res.json({ post });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to pin post';
    return res.status(statusFor(message)).json({ error: message });
  }
});

feedRouter.patch('/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { content } = req.body as { content?: string };
    const post = await editPost(req.params.id, req.userId as string, content ?? '');
    return res.json({ post });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to edit post';
    return res.status(statusFor(message)).json({ error: message });
  }
});
