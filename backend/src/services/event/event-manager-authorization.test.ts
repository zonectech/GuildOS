vi.mock('../community-state-policy',()=>({assertCommunityActive:vi.fn(async()=>{}),activeCommunityIds:vi.fn(async(ids:string[])=>ids)}));
import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ approved: true, membershipStatus: 'ACTIVE', role: 'COORDINATOR', inCommunity: true }));
vi.mock('../../models/user.model', () => ({ UserModel: { findById: vi.fn(() => ({ select: () => ({ lean: async () => ({ status: 'ACTIVE', deletedAt: null, emailVerified: true, role: 'STUDENT', communityAccessStatus: state.approved ? 'APPROVED' : 'REJECTED' }) }) })) } }));
vi.mock('../../models/event.model', async importOriginal => ({ ...await importOriginal<typeof import('../../models/event.model')>(), EventModel: { findOne: vi.fn(async () => ({ _id: 'event', communityId: 'community', attendanceSource: 'GUILDOS' })) } }));
vi.mock('../../models/event-partnership.model', () => ({ EventPartnershipModel: { find: vi.fn(() => ({ select: () => ({ lean: async () => [] }) })) } }));
vi.mock('../../models/membership.model', () => ({ MembershipModel: {
  findOne: vi.fn(async query => state.inCommunity && query.status === state.membershipStatus ? { role: state.role, status: state.membershipStatus } : null),
  find: vi.fn(query => ({ lean: async () => state.inCommunity && query.status === state.membershipStatus ? [{ role: state.role, status: state.membershipStatus }] : [] })),
} }));
import { getManagerMembership, requireEventManager, requireEventScanner } from './event-shared';
import { hasCommunityPermission } from '../community/community-shared';
beforeEach(() => { state.approved = true; state.membershipStatus = 'ACTIVE'; state.role = 'COORDINATOR'; state.inCommunity = true; });
describe('event manager access after approval', () => {
  it('allows an approved active manager in the event community', async () => {
    expect((await requireEventManager('event', 'user'))._id).toBe('event'); expect((await getManagerMembership('community', 'user')).role).toBe('COORDINATOR');
  });
  it.each(['SUSPENDED', 'REMOVED', 'LEFT'])('denies a %s manager and scanner', async status => {
    state.membershipStatus = status;
    await expect(requireEventManager('event', 'user')).rejects.toThrow(/permissions/);
    await expect(requireEventScanner('event', 'user')).rejects.toThrow(/permissions/);
    await expect(getManagerMembership('community', 'user')).rejects.toThrow(/permissions/);
  });
  it('does not let personal approval grant access to another community', async () => {
    state.inCommunity = false; await expect(requireEventManager('event', 'user')).rejects.toThrow(/permissions/);
  });
  it('denies a revoked user despite an active manager role', async () => {
    state.approved = false; await expect(requireEventManager('event', 'user')).rejects.toThrow(/approval/); await expect(requireEventScanner('event', 'user')).rejects.toThrow(/approval/);
  });
  it('keeps ordinary members below manager permissions', async () => {
    state.role = 'MEMBER'; await expect(requireEventManager('event', 'user')).rejects.toThrow(/permissions/);
  });
  it('rejects unknown role names instead of treating their negative rank as authorization', () => {
    expect(hasCommunityPermission('MEMBER', 'INVALID' as any)).toBe(false);
    expect(hasCommunityPermission('INVALID' as any, 'INVALID' as any)).toBe(false);
    expect(hasCommunityPermission('FOUNDER', 'COORDINATOR')).toBe(true);
  });
});
