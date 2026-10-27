import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ users: vi.fn(), blocks: [] as any[], relations: [] as any[], blockedCheck: vi.fn(), profile: vi.fn(), ranked: vi.fn() }));
vi.mock('../models/user.model', () => ({ UserModel: { find: mocks.users } }));
vi.mock('../models/connection.model', () => { const query = { select: () => query, sort: () => query, lean: async () => mocks.relations }; return { ConnectionModel: { find: () => query } }; });
vi.mock('./user-safety.service', () => ({ isBlockedBetween: mocks.blockedCheck }));
vi.mock('./ranking/ranking.config', () => ({ isRankingEnabled: () => true, norm: (v: string) => v }));
vi.mock('./ranking/peer-ranking.service', () => ({ getRankedPeerSuggestions: mocks.ranked }));
vi.mock('../models/user-block.model', () => ({ UserBlockModel: { find: () => ({ select: () => ({ lean: async () => mocks.blocks }) }) } }));
vi.mock('../store/auth-store', () => ({ authStore: { getPublicUserById: mocks.profile } }));
import { getPeopleYouMayKnow, listOutgoingRequests } from './connection.service';
describe('people discovery for sparse networks', () => {
 beforeEach(() => {
  vi.clearAllMocks();
  mocks.ranked.mockResolvedValue([]);
  mocks.users.mockImplementation(() => ({ select: () => ({ sort: () => ({ limit: () => ({ lean: async () => [{ _id: 'person' }] }) }) }) }));
  mocks.blocks = []; mocks.relations = []; mocks.blockedCheck.mockResolvedValue(false);
  mocks.profile.mockResolvedValue({ id: 'person', fullName: 'Public Person', profile: { username: 'person' } });
 });
 it('finds a public person without shared school or communities', async () => {
  expect(await getPeopleYouMayKnow('viewer')).toEqual([expect.objectContaining({ id: 'person', reason: 'Discover someone on GuildOS' })]);
  expect(mocks.users).toHaveBeenCalledWith(expect.objectContaining({ status: 'ACTIVE', deletedAt: null, 'profile.profileVisibility': 'PUBLIC' }));
 });
 it('never suggests a person blocked in either direction', async () => {
  mocks.blocks = [{ blockerId: 'person', blockedId: 'viewer' }];
  expect(await getPeopleYouMayKnow('viewer')).toEqual([]);
  expect(mocks.profile).not.toHaveBeenCalled();
 });
 it.each(['ACCEPTED', 'PENDING'])('keeps %s people discoverable and labels their relationship', async status => {
  mocks.relations = [{ requesterId: 'viewer', addresseeId: 'person', status }];
  expect(await getPeopleYouMayKnow('viewer')).toEqual([expect.objectContaining({ id: 'person', state: status === 'ACCEPTED' ? 'CONNECTED' : 'PENDING_OUTGOING' })]);
 });
 it('labels incoming requests', async () => {
  mocks.relations = [{ requesterId: 'person', addresseeId: 'viewer', status: 'PENDING' }];
  expect(await getPeopleYouMayKnow('viewer')).toEqual([expect.objectContaining({ state: 'PENDING_INCOMING' })]);
 });

 it('lists sent requests separately and suppresses blocked recipients', async () => {
  const createdAt = new Date('2026-10-27T00:00:00Z');
  mocks.relations = [{ requesterId: 'viewer', addresseeId: 'person', status: 'PENDING', createdAt }];
  expect(await listOutgoingRequests('viewer')).toEqual([expect.objectContaining({ recipient: expect.objectContaining({ id: 'person' }), createdAt })]);
  mocks.blockedCheck.mockResolvedValue(true);
  expect(await listOutgoingRequests('viewer')).toEqual([]);
 });

 it.each([true, false])('only exposes school details when sharing is %s', async showUniversity => {
  mocks.profile.mockResolvedValue({ id: 'person', fullName: 'Person', profile: { username: 'person', university: 'Sample University', department: 'Computing', showUniversity } });
  const people = await getPeopleYouMayKnow('viewer');
  expect(people[0].headline).toBe(showUniversity ? 'Computing · Sample University' : '');
 });

});
