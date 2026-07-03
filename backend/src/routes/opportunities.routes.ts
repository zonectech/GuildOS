import { Router } from 'express';
import { requireAuth, requireRole, optionalAuth, type AuthenticatedRequest } from '../middleware/auth';
import {
  createOpportunity,
  getMyMatches,
  getOpportunityDetail,
  getRecommendedOpportunities,
  getSavedOpportunities,
  listOpportunities,
  listOpportunitiesForModeration,
  recordOpportunityAction,
  reportOpportunity,
  searchCandidates,
  setOpportunityModeration,
} from '../services/opportunity.service';
import { syncOpportunities } from '../services/opportunity-ingest.service';

export const opportunitiesRouter = Router();

function statusFor(message: string) {
  if (/not found/i.test(message)) return 404;
  if (/permission|forbidden/i.test(message)) return 403;
  return 400;
}

opportunitiesRouter.get('/recommended', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await getRecommendedOpportunities(req.userId as string);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load recommendations' });
  }
});

opportunitiesRouter.get('/matches', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const matches = await getMyMatches(req.userId as string);
    return res.json({ matches });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load matches' });
  }
});

opportunitiesRouter.get('/saved', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const opportunities = await getSavedOpportunities(req.userId as string);
    return res.json({ opportunities });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load saved opportunities' });
  }
});

opportunitiesRouter.get('/candidates', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const candidates = await searchCandidates({
      university: req.query.university ? String(req.query.university) : undefined,
      faculty: req.query.faculty ? String(req.query.faculty) : undefined,
      department: req.query.department ? String(req.query.department) : undefined,
      minGuildScore: req.query.minGuildScore ? Number(req.query.minGuildScore) : undefined,
      requireLeadership: req.query.requireLeadership === 'true',
      openToWork: req.query.openToWork === 'true',
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    return res.json({ candidates });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to search candidates' });
  }
});

opportunitiesRouter.post('/', requireAuth, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const result = await createOpportunity(req.userId as string, req.body ?? {}, { autoVerify: true });
    return res.status(201).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create opportunity';
    return res.status(statusFor(message)).json({ error: message });
  }
});

opportunitiesRouter.get('/moderation/pending', requireAuth, requireRole('ADMIN'), async (_req, res) => {
  try {
    const opportunities = await listOpportunitiesForModeration();
    return res.json({ opportunities });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load moderation queue' });
  }
});

opportunitiesRouter.patch('/:id/moderation', requireAuth, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const { status } = req.body as { status?: string };
    const result = await setOpportunityModeration(req.params.id, status ?? '');
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update moderation status';
    return res.status(statusFor(message)).json({ error: message });
  }
});

opportunitiesRouter.post('/sync', requireAuth, requireRole('ADMIN'), async (_req, res) => {
  try {
    const result = await syncOpportunities();
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to sync opportunities' });
  }
});

opportunitiesRouter.get('/', optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const opportunities = await listOpportunities(req.userId ?? null, {
      category: req.query.category ? String(req.query.category) : undefined,
      search: req.query.search ? String(req.query.search) : undefined,
    });
    return res.json({ opportunities });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load opportunities' });
  }
});

opportunitiesRouter.get('/:id', optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const opportunity = await getOpportunityDetail(req.params.id, req.userId ?? null);
    return res.json({ opportunity });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load opportunity';
    return res.status(statusFor(message)).json({ error: message });
  }
});

opportunitiesRouter.post('/:id/save', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await recordOpportunityAction(req.userId as string, req.params.id, 'SAVED');
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save opportunity';
    return res.status(statusFor(message)).json({ error: message });
  }
});

opportunitiesRouter.post('/:id/apply-status', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { action } = req.body as { action?: string };
    const result = await recordOpportunityAction(req.userId as string, req.params.id, action ?? '');
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update status';
    return res.status(statusFor(message)).json({ error: message });
  }
});

opportunitiesRouter.post('/:id/report', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { reason } = req.body as { reason?: string };
    const result = await reportOpportunity(req.userId as string, req.params.id, reason ?? '');
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to report opportunity';
    return res.status(statusFor(message)).json({ error: message });
  }
});
