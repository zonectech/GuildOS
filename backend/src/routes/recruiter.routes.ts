import { Router } from 'express';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth';
import { getRecruiterAnalytics, getRecruiterDashboard, getPublicRecruiterReputation, registerRecruiter, requestRecruiterVerification, updateRecruiterProfile } from '../services/recruiter.service';
import {
  createOpportunity,
  getOpportunityApplicants,
  listOpportunitiesByOwner,
  searchCandidates,
  setApplicantStatus,
  updateOwnedOpportunity,
} from '../services/opportunity.service';

export const recruiterRouter = Router();

function statusFor(message: string) {
  if (/not found/i.test(message)) return 404;
  if (/permission|only manage|only view|admins cannot/i.test(message)) return 403;
  return 400;
}

const recruiterOnly = requireRole(['RECRUITER', 'ADMIN']);

recruiterRouter.post('/register', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await registerRecruiter(req.userId as string, req.body ?? {});
    return res.status(201).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to register as recruiter';
    return res.status(statusFor(message)).json({ error: message });
  }
});

recruiterRouter.get('/me', requireAuth, recruiterOnly, async (req: AuthenticatedRequest, res) => {
  try {
    const dashboard = await getRecruiterDashboard(req.userId as string);
    return res.json(dashboard);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load recruiter profile' });
  }
});

recruiterRouter.get('/analytics', requireAuth, recruiterOnly, async (req: AuthenticatedRequest, res) => {
  try {
    const analytics = await getRecruiterAnalytics(req.userId as string);
    return res.json(analytics);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load analytics' });
  }
});

recruiterRouter.get('/public/:userId', async (req, res) => {
  try {
    const reputation = await getPublicRecruiterReputation(req.params.userId);
    return res.json({ recruiter: reputation });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load recruiter' });
  }
});

recruiterRouter.patch('/me', requireAuth, recruiterOnly, async (req: AuthenticatedRequest, res) => {
  try {
    const recruiter = await updateRecruiterProfile(req.userId as string, req.body ?? {});
    return res.json({ recruiter });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update profile';
    return res.status(statusFor(message)).json({ error: message });
  }
});

recruiterRouter.post('/verify/request', requireAuth, recruiterOnly, async (req: AuthenticatedRequest, res) => {
  try {
    const recruiter = await requestRecruiterVerification(req.userId as string);
    return res.json({ recruiter });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to request verification';
    return res.status(statusFor(message)).json({ error: message });
  }
});

recruiterRouter.get('/opportunities', requireAuth, recruiterOnly, async (req: AuthenticatedRequest, res) => {
  try {
    const opportunities = await listOpportunitiesByOwner(req.userId as string);
    return res.json({ opportunities });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load opportunities' });
  }
});

recruiterRouter.post('/opportunities', requireAuth, recruiterOnly, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await createOpportunity(req.userId as string, req.body ?? {});
    return res.status(201).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create opportunity';
    return res.status(statusFor(message)).json({ error: message });
  }
});

recruiterRouter.patch('/opportunities/:id', requireAuth, recruiterOnly, async (req: AuthenticatedRequest, res) => {
  try {
    const isAdmin = req.user?.role === 'ADMIN';
    const opportunity = await updateOwnedOpportunity(req.params.id, req.userId as string, isAdmin, req.body ?? {});
    return res.json({ opportunity });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update opportunity';
    return res.status(statusFor(message)).json({ error: message });
  }
});

recruiterRouter.get('/opportunities/:id/applicants', requireAuth, recruiterOnly, async (req: AuthenticatedRequest, res) => {
  try {
    const isAdmin = req.user?.role === 'ADMIN';
    const result = await getOpportunityApplicants(req.params.id, req.userId as string, isAdmin);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load applicants';
    return res.status(statusFor(message)).json({ error: message });
  }
});

recruiterRouter.post('/opportunities/:id/applicants/:candidateId/status', requireAuth, recruiterOnly, async (req: AuthenticatedRequest, res) => {
  try {
    const isAdmin = req.user?.role === 'ADMIN';
    const { status, note } = req.body as { status?: string; note?: string };
    const result = await setApplicantStatus(req.params.id, req.params.candidateId, req.userId as string, isAdmin, status ?? '', note);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update applicant';
    return res.status(statusFor(message)).json({ error: message });
  }
});

recruiterRouter.get('/candidates', requireAuth, recruiterOnly, async (req, res) => {
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
