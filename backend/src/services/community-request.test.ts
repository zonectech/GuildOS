import { beforeEach, describe, it, expect, vi } from 'vitest';
const state = vi.hoisted(() => ({ user: null as any, community: null as any, updates: [] as any[] }));
vi.mock('../models/user.model', () => ({ UserModel: {
  findById: vi.fn(() => ({ select: () => ({ lean: async () => state.user }) })),
  updateOne: vi.fn(async (filter: any, update: any) => { state.updates.push({ filter, update }); return {}; }),
} }));
vi.mock('../models/community.model', () => ({ CommunityModel: { findById: vi.fn(async () => state.community) } }));
vi.mock('../models/community-endorsement.model', () => ({ CommunityEndorsementModel: { countDocuments: vi.fn(async () => 0) } }));
vi.mock('./reputation.service', () => ({ recalculateReputation: vi.fn(async () => undefined) }));
import { canRequestCommunity } from './community-access-policy';
import { verifyCommunity } from './community/community-admin.service';
import { certificateOffer } from './event/event-shared';

beforeEach(() => {
  state.updates = [];
  state.user = { role: 'STUDENT', status: 'ACTIVE', emailVerified: true, deletedAt: null, communityAccessStatus: 'NONE' };
  state.community = { founder: 'founder', verificationMethod: 'UNIVERSITY_EMAIL', save: vi.fn(async () => undefined) };
});

describe('sending a community for review', () => {
  it.each(['NONE', 'PENDING', 'APPROVED'])('lets a verified account with %s access send one', async (status) => {
    state.user.communityAccessStatus = status;
    expect(await canRequestCommunity('user')).toBe(true);
  });
  it('refuses accounts an admin declined, unverified emails and inactive accounts', async () => {
    state.user.communityAccessStatus = 'REJECTED'; expect(await canRequestCommunity('user')).toBe(false);
    state.user.communityAccessStatus = 'NONE'; state.user.emailVerified = false; expect(await canRequestCommunity('user')).toBe(false);
    state.user.emailVerified = true; state.user.status = 'BLOCKED'; expect(await canRequestCommunity('user')).toBe(false);
    state.user = null; expect(await canRequestCommunity('user')).toBe(false);
  });
});

describe('verifying a community is the founder approval', () => {
  it('marks the community verified and gives the founder organizer access', async () => {
    const community = await verifyCommunity('community', 'admin');
    expect(community.verificationStatus).toBe('VERIFIED');
    expect(state.updates).toContainEqual({ filter: { _id: 'founder', communityAccessStatus: { $ne: 'APPROVED' } }, update: { $set: { communityAccessStatus: 'APPROVED' } } });
    expect(state.updates).toContainEqual({ filter: { _id: 'founder', role: 'STUDENT' }, update: { $set: { role: 'COMMUNITY_LEADER' } } });
  });
});

describe('certificate label shown before registering', () => {
  const day = (d: string) => new Date(`2026-11-${d}T10:00:00Z`);
  const single = { certificateEnabled: true, qrEnabled: true, attendanceSource: 'GUILDOS', startDate: day('14'), endDate: new Date('2026-11-14T14:00:00Z'), days: [] };
  it('is instant for a single-day check-in event from a verified community', () => {
    expect(certificateOffer(single, true)).toBe('INSTANT');
  });
  it('waits for the end of multi-day events and outside attendance reports', () => {
    expect(certificateOffer({ ...single, endDate: day('16') }, true)).toBe('AFTER_EVENT');
    expect(certificateOffer({ ...single, attendanceSource: 'EXTERNAL' }, true)).toBe('AFTER_EVENT');
  });
  it('offers none when certificates are off, check-in is off or the community is unverified', () => {
    expect(certificateOffer({ ...single, certificateEnabled: false }, true)).toBe('NONE');
    expect(certificateOffer({ ...single, qrEnabled: false }, true)).toBe('NONE');
    expect(certificateOffer(single, false)).toBe('NONE');
  });
});
