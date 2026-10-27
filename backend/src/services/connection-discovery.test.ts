import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ users: vi.fn(), blocks: [] as any[], profile: vi.fn(), ranked: vi.fn() }));
vi.mock('../models/user.model', () => ({ UserModel: { find: mocks.users } }));
vi.mock('../models/connection.model', () => ({ ConnectionModel: { find: () => ({ select: () => ({ lean: async () => [] }) }) } }));
vi.mock('./ranking/ranking.config', () => ({ isRankingEnabled: () => true, norm: (v: string) => v }));
vi.mock('./ranking/peer-ranking.service', () => ({ getRankedPeerSuggestions: mocks.ranked }));
vi.mock('../models/user-block.model', () => ({ UserBlockModel: { find: () => ({ select: () => ({ lean: async () => mocks.blocks }) }) } }));
vi.mock('../store/auth-store', () => ({ authStore: { getPublicUserById: mocks.profile } }));
import { getPeopleYouMayKnow } from './connection.service';
describe('people discovery for sparse networks', () => {
 beforeEach(() => {
  vi.clearAllMocks();
  mocks.ranked.mockResolvedValue([]);
  mocks.users.mockImplementation(() => ({ select: () => ({ sort: () => ({ limit: () => ({ lean: async () => [{ _id: 'person' }] }) }) }) }));
  mocks.blocks = [];
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
});
