import { Router } from 'express';
import { CommunityModel } from '../models/community.model';
import { EventModel } from '../models/event.model';
import { EventRegistrationModel } from '../models/event-registration.model';
import { CertificateModel } from '../models/certificate.model';
import { PUBLIC_LIST_STATUSES } from '../services/event/event-shared';

export const publicRouter = Router();

type PlatformStats = {
  communities: number;
  universities: number;
  events: number;
  checkIns: number;
  certificates: number;
};

const CACHE_MS = 10 * 60 * 1000;
let cached: { at: number; stats: PlatformStats } | null = null;

/** Real platform-wide counts for the landing page — no estimates, no rounding up. */
async function loadStats(): Promise<PlatformStats> {
  const liveCommunity = { archivedAt: null, visibility: 'PUBLIC' };
  const [communities, universities, events, checkIns, certificates] = await Promise.all([
    CommunityModel.countDocuments(liveCommunity),
    CommunityModel.distinct('university', liveCommunity),
    EventModel.countDocuments({ deletedAt: null, visibility: 'PUBLIC', status: { $in: PUBLIC_LIST_STATUSES } }),
    EventRegistrationModel.countDocuments({ checkInAt: { $ne: null } }),
    CertificateModel.countDocuments({ status: 'VERIFIED' }),
  ]);
  return {
    communities,
    universities: universities.filter((u) => typeof u === 'string' && u.trim()).length,
    events,
    checkIns,
    certificates,
  };
}

/** GET /api/public/stats — cached for 10 minutes; safe to call from the logged-out landing page. */
publicRouter.get('/stats', async (_req, res) => {
  try {
    if (!cached || Date.now() - cached.at > CACHE_MS) cached = { at: Date.now(), stats: await loadStats() };
    res.setHeader('Cache-Control', 'public, max-age=600');
    return res.json({ stats: cached.stats });
  } catch {
    return res.status(503).json({ error: 'Stats are temporarily unavailable' });
  }
});
