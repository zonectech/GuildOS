import express from 'express';
import type { Server } from 'node:http';
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
const state = vi.hoisted(() => ({ approved: false }));
vi.mock('../utils/token', () => ({ verifyToken: vi.fn((token: string) => token === 'audit-session' ? { sub: '111111111111111111111111', purpose: 'access' } : null), createToken: vi.fn(), createRandomToken: vi.fn() }));
vi.mock('../store/auth-store', () => ({ authStore: { getActivePublicUserById: vi.fn(async () => ({ id: '111111111111111111111111', role: 'COMMUNITY_LEADER', emailVerified: true, profileComplete: true })) } }));
vi.mock('../models/user.model', () => ({ UserModel: {
  findById: vi.fn(() => ({ select: () => ({ lean: async () => ({ role: 'COMMUNITY_LEADER', status: 'ACTIVE', deletedAt: null, emailVerified: true, communityAccessStatus: state.approved ? 'APPROVED' : 'REJECTED' }) }) })),
  updateOne: vi.fn(async () => ({})),
} }));
import { requireCommunityAuth } from '../middleware/community-access';
import { requireAuth } from '../middleware/auth';
import { eventsRouter } from './events.routes';
import { communitiesRouter } from './communities.routes';
import { communityUploadRouter } from './community-upload.routes';
import { membershipsRouter } from './memberships.routes';
import { rolesRouter } from './roles.routes';
import { attendanceRouter } from './attendance.routes';
import { certificatesRouter } from './certificates.routes';
import { hackathonRouter } from './hackathon.routes';
const routers = [ ['/events', eventsRouter], ['/communities', communitiesRouter], ['/community-upload', communityUploadRouter], ['/memberships', membershipsRouter], ['/roles', rolesRouter], ['/attendance', attendanceRouter], ['/certificates', certificatesRouter], ['/hackathons', hackathonRouter] ] as const;
const protectedRoutes = routers.flatMap(([prefix, router]) => (router as any).stack.filter((layer: any) => layer.route && layer.route.stack.some((handler: any) => handler.handle === requireCommunityAuth)).map((layer: any) => ({ prefix, path: layer.route.path, method: Object.keys(layer.route.methods)[0] })));
let server: Server; let base: string;
beforeAll(async () => {
  const app = express(); app.use(express.json());
  for (const [prefix, router] of routers) app.use(prefix, router);
  app.get('/guard-probe', requireCommunityAuth, (_req, res) => res.json({ allowed: true }));
  server = await new Promise<Server>(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  base = 'http://127.0.0.1:' + (server.address() as any).port;
});
afterAll(() => new Promise<void>(resolve => server.close(() => resolve())));
describe('real organizer router access gates', () => {
  it('protects organizer routes before handlers and upload middleware', () => {
    expect(protectedRoutes.length).toBeGreaterThan(120);
    for (const [prefix, router] of routers) {
      for (const layer of (router as any).stack.filter((l: any) => l.route && l.route.stack.some((h: any) => h.handle === requireCommunityAuth))) {
        expect(layer.route.stack[0].handle, prefix + layer.route.path).toBe(requireCommunityAuth);
      }
    }
  });
  it('rejects every protected organizer endpoint for a signed-in unapproved user', async () => {
    state.approved = false;
    for (const entry of protectedRoutes) {
      const path = entry.path.replace(/:[A-Za-z0-9_]+/g, '222222222222222222222222');
      const response = await fetch(base + entry.prefix + path, { method: entry.method.toUpperCase(), headers: { Authorization: 'Bearer audit-session', 'Content-Type': 'application/json' }, ...(entry.method === 'get' ? {} : { body: '{}' }) });
      expect(response.status, entry.method + ' ' + entry.prefix + entry.path).toBe(403);
      expect((await response.json()).code).toBe('COMMUNITY_ACCESS_REQUIRED');
    }
  }, 60000);
  it('denies unauthenticated requests and honors revocation on the next request', async () => {
    expect((await fetch(base + '/guard-probe')).status).toBe(401);
    state.approved = true; expect((await fetch(base + '/guard-probe', { headers: { Authorization: 'Bearer audit-session' } })).status).toBe(200);
    state.approved = false; expect((await fetch(base + '/guard-probe', { headers: { Authorization: 'Bearer audit-session' } })).status).toBe(403);
  });
  it('requires an explicit student exception for every unguarded authenticated event route', () => {
    const memberPaths = new Set(['/recommended','/member-emails','/member-emails/request','/member-emails/verify','/:id/partner-opened','/calendar-feed','/:id/ticket/checkout','/:id/ticket/transfer','/:id/ticket/claims','/ticket/claim','/:id/ticket/verify','/:id/ticket/check','/bookmarks/mine','/:id/bookmark','/:id/register','/:id/register/section','/:id/attendance/self-check-in','/:id/registration/partner-form','/:id/attendance/self-check-out','/:id/cancel','/:id/walk-in','/:id/my-registration','/:id/sponsorship/inquiries/:inquiryId/checkout']);
    for (const layer of (eventsRouter as any).stack.filter((l: any) => l.route)) {
      const route = layer.route;
      if (route.stack.some((h: any) => h.handle === requireAuth)) expect(memberPaths.has(route.path) || (route.path === '/:id/feedback' && route.methods.post), route.path).toBe(true);
    }
  });
  it('keeps student participation separate from organizer approval', () => {
    for (const path of ['/:id/register', '/:id/my-registration', '/:id/attendance/self-check-in', '/:id/registration/partner-form']) {
      const route = (eventsRouter as any).stack.find((l: any) => l.route?.path === path)?.route;
      expect(route, path).toBeTruthy(); expect(route.stack.some((h: any) => h.handle === requireCommunityAuth), path).toBe(false);
    }
  });
});
