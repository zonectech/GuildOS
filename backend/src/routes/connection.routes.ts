import { Router } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import { connectionRequestLimiter } from '../middleware/rate-limit';
import {
  getConnectionCount,
  getConnectionState,
  getMutualCount,
  getPeopleYouMayKnow,
  listConnections,
  listPendingRequests,
  removeConnection,
  respondToRequest,
  sendConnectionRequest,
} from '../services/connection.service';

export const connectionRouter = Router();

function statusFor(message: string) {
  if (/not found/i.test(message)) return 404;
  if (/yourself/i.test(message)) return 400;
  return 400;
}

connectionRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const [connections, count] = await Promise.all([
      listConnections(req.userId as string),
      getConnectionCount(req.userId as string),
    ]);
    return res.json({ connections, count });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load connections' });
  }
});

connectionRouter.get('/requests', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const requests = await listPendingRequests(req.userId as string);
    return res.json({ requests });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load requests' });
  }
});

connectionRouter.get('/suggestions', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const suggestions = await getPeopleYouMayKnow(req.userId as string, req.query.limit ? Number(req.query.limit) : 12);
    return res.json({ suggestions });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load suggestions' });
  }
});

connectionRouter.get('/state/:userId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const [state, mutual] = await Promise.all([
      getConnectionState(req.userId as string, req.params.userId),
      getMutualCount(req.userId as string, req.params.userId),
    ]);
    return res.json({ state, mutual });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load connection state' });
  }
});

connectionRouter.post('/:userId/request', requireAuth, connectionRequestLimiter, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await sendConnectionRequest(req.userId as string, req.params.userId);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to send request';
    return res.status(statusFor(message)).json({ error: message });
  }
});

connectionRouter.post('/:userId/respond', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { accept } = req.body as { accept?: boolean };
    const result = await respondToRequest(req.userId as string, req.params.userId, Boolean(accept));
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to respond to request';
    return res.status(statusFor(message)).json({ error: message });
  }
});

connectionRouter.delete('/:userId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await removeConnection(req.userId as string, req.params.userId);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to remove connection' });
  }
});
