import { Router } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import { messageSendLimiter } from '../middleware/rate-limit';
import {
  audienceOf, blockedCommunities, communityAnnouncements, markAnnouncementsSeen, messageCommunity, myAnnouncements, openThread, postAnnouncement,
  postInThread, react, reportContent, requireTeam, setBlocked, setThreadStatus, studentThreads, teamThreads, unreadCounts, viewingThread,
} from '../services/community/community-inbox.service';

/**
 * The inbox: students and communities (never student to student), and community announcements.
 * Chats are a shared team inbox on the community side.
 */
export const inboxRouter = Router();

function fail(res: { status: (n: number) => { json: (b: unknown) => unknown } }, error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const status = /not found/i.test(message) ? 404 : /only the community|leaders/i.test(message) ? 403 : 400;
  return res.status(status).json({ error: message });
}
const uid = (req: AuthenticatedRequest) => req.userId as string;

inboxRouter.get('/unread', requireAuth, async (req: AuthenticatedRequest, res) => {
  try { return res.json(await unreadCounts(uid(req))); } catch (e) { return fail(res, e, 'Unable to load'); }
});

/* Chats */
inboxRouter.get('/chats', requireAuth, async (req: AuthenticatedRequest, res) => {
  try { return res.json({ chats: await studentThreads(uid(req)) }); } catch (e) { return fail(res, e, 'Unable to load chats'); }
});
inboxRouter.post('/chats', requireAuth, messageSendLimiter, async (req: AuthenticatedRequest, res) => {
  try { return res.status(201).json({ chat: await messageCommunity(uid(req), req.body ?? {}) }); } catch (e) { return fail(res, e, 'Unable to send'); }
});
inboxRouter.get('/chats/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try { return res.json(await openThread(req.params.id, uid(req))); } catch (e) { return fail(res, e, 'Unable to open'); }
});
inboxRouter.post('/chats/:id/messages', requireAuth, messageSendLimiter, async (req: AuthenticatedRequest, res) => {
  try { return res.status(201).json({ message: await postInThread(req.params.id, uid(req), req.body ?? {}) }); } catch (e) { return fail(res, e, 'Unable to send'); }
});
inboxRouter.post('/chats/:id/viewing', requireAuth, async (req: AuthenticatedRequest, res) => {
  try { return res.json(await viewingThread(req.params.id, uid(req))); } catch (e) { return fail(res, e, 'Unable to update'); }
});
inboxRouter.patch('/chats/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try { return res.json({ chat: await setThreadStatus(req.params.id, uid(req), req.body?.status) }); } catch (e) { return fail(res, e, 'Unable to update'); }
});
inboxRouter.post('/messages/:id/report', requireAuth, async (req: AuthenticatedRequest, res) => {
  try { return res.json(await reportContent('COMMUNITY_MESSAGE', req.params.id, uid(req), req.body?.reason)); } catch (e) { return fail(res, e, 'Unable to report'); }
});

/* Announcements (students) */
inboxRouter.get('/announcements', requireAuth, async (req: AuthenticatedRequest, res) => {
  try { return res.json(await myAnnouncements(uid(req), typeof req.query.before === 'string' ? req.query.before : undefined)); } catch (e) { return fail(res, e, 'Unable to load'); }
});
inboxRouter.post('/announcements/seen', requireAuth, async (req: AuthenticatedRequest, res) => {
  try { await markAnnouncementsSeen(uid(req)); return res.json({ ok: true }); } catch (e) { return fail(res, e, 'Unable to update'); }
});
inboxRouter.post('/announcements/:id/react', requireAuth, async (req: AuthenticatedRequest, res) => {
  try { return res.json({ announcement: await react(req.params.id, uid(req), req.body?.emoji) }); } catch (e) { return fail(res, e, 'Unable to react'); }
});
inboxRouter.post('/announcements/:id/report', requireAuth, async (req: AuthenticatedRequest, res) => {
  try { return res.json(await reportContent('ANNOUNCEMENT', req.params.id, uid(req), req.body?.reason)); } catch (e) { return fail(res, e, 'Unable to report'); }
});

/* Blocking a community's messages */
inboxRouter.get('/blocks', requireAuth, async (req: AuthenticatedRequest, res) => {
  try { return res.json({ communities: await blockedCommunities(uid(req)) }); } catch (e) { return fail(res, e, 'Unable to load'); }
});
inboxRouter.post('/blocks/:communityId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try { return res.json(await setBlocked(uid(req), req.params.communityId, true)); } catch (e) { return fail(res, e, 'Unable to block'); }
});
inboxRouter.delete('/blocks/:communityId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try { return res.json(await setBlocked(uid(req), req.params.communityId, false)); } catch (e) { return fail(res, e, 'Unable to unblock'); }
});

/* Community side (Owner / Admins) */
inboxRouter.get('/community/:communityId/chats', requireAuth, async (req: AuthenticatedRequest, res) => {
  try { return res.json({ chats: await teamThreads(req.params.communityId, uid(req), req.query.status === 'RESOLVED' ? 'RESOLVED' : 'OPEN') }); } catch (e) { return fail(res, e, 'Unable to load'); }
});
inboxRouter.get('/community/:communityId/announcements', requireAuth, async (req: AuthenticatedRequest, res) => {
  try { return res.json({ announcements: await communityAnnouncements(req.params.communityId, uid(req)) }); } catch (e) { return fail(res, e, 'Unable to load'); }
});
inboxRouter.post('/community/:communityId/audience', requireAuth, async (req: AuthenticatedRequest, res) => {
  try { await requireTeam(req.params.communityId, uid(req)); const a = await audienceOf(req.params.communityId, req.body ?? {}); return res.json({ count: a.ids.length }); } catch (e) { return fail(res, e, 'Unable to count'); }
});
inboxRouter.post('/community/:communityId/announcements', requireAuth, async (req: AuthenticatedRequest, res) => {
  try { const a = await postAnnouncement(req.params.communityId, uid(req), req.body ?? {}); return res.status(201).json({ announcement: { id: String(a._id), deliveredCount: a.deliveredCount } }); } catch (e) { return fail(res, e, 'Unable to send'); }
});
