import { beforeEach, describe, it, expect, vi } from 'vitest';
const state = vi.hoisted(() => ({ user: null as any }));
vi.mock('../models/user.model', () => ({ UserModel: { findById: vi.fn(() => ({ select: () => ({ lean: async () => state.user }) })) } }));
import { hasApprovedCommunityAccess, assertApprovedCommunityAccess } from './community-access-policy';
import { hasCommunityAccess, canCreateCommunity } from './community-access.service';
beforeEach(() => { state.user = { role: 'STUDENT', status: 'ACTIVE', emailVerified: true, deletedAt: null, communityAccessStatus: 'NONE' }; });
describe('personal Community Mode approval', () => {
  it.each(['NONE', 'PENDING', 'REJECTED'])('denies %s even with a community-leader label', async status => {
    state.user.role = 'COMMUNITY_LEADER'; state.user.communityAccessStatus = status;
    expect(await hasApprovedCommunityAccess('user')).toBe(false); expect(await hasCommunityAccess('user')).toBe(false); expect(await canCreateCommunity('user')).toBe(false);
  });
  it('allows an approved active user and an active verified administrator', async () => {
    state.user.communityAccessStatus = 'APPROVED'; expect(await hasApprovedCommunityAccess('user')).toBe(true);
    state.user.communityAccessStatus = 'NONE'; state.user.role = 'ADMIN'; expect(await hasApprovedCommunityAccess('user')).toBe(true);
  });
  it.each(['BLOCKED', 'MISSING'])('denies %s accounts despite approval', async status => {
    state.user.communityAccessStatus = 'APPROVED'; if (status === 'MISSING') state.user = null; else state.user.status = status;
    await expect(assertApprovedCommunityAccess('user')).rejects.toThrow(/approval/);
  });
  it('denies deleted and unverified accounts', async () => {
    state.user.communityAccessStatus = 'APPROVED'; state.user.deletedAt = new Date(); expect(await hasApprovedCommunityAccess('user')).toBe(false);
    state.user.deletedAt = null; state.user.emailVerified = false; expect(await hasApprovedCommunityAccess('user')).toBe(false);
  });
  it('rechecks revocation immediately instead of trusting an old session', async () => {
    state.user.communityAccessStatus = 'APPROVED'; expect(await hasApprovedCommunityAccess('user')).toBe(true);
    state.user.communityAccessStatus = 'REJECTED'; expect(await hasApprovedCommunityAccess('user')).toBe(false);
  });
});
