import { beforeEach, describe, expect, it, vi } from 'vitest';
import { peopleSearchFilter } from './people-discovery-query';
const state = vi.hoisted(() => ({ me: {} as any, people: [] as any[], registrations: [] as any[], calls: 0 }));
const chain = (rows: unknown[]) => ({ select: () => ({ lean: async () => rows, limit: () => ({ lean: async () => rows }), sort: () => ({ limit: () => ({ lean: async () => rows }) }) }) });
vi.mock('../../models/user.model', () => ({ UserModel: { findById: () => ({ select: () => ({ lean: async () => ({ profile: state.me }) }) }), find: () => chain(state.people) } }));
vi.mock('../../models/connection.model', () => ({ ConnectionModel: { find: () => chain([]) } }));
vi.mock('../../models/membership.model', () => ({ MembershipModel: { find: () => chain([]) } }));
vi.mock('../../models/event-registration.model', () => ({ EventRegistrationModel: { find: () => chain([]) } }));
vi.mock('../../store/auth-store', () => ({ authStore: { getPublicUserById: async (id: string) => ({ id, fullName: id, profile: { username: id } }) } }));
import { getRankedPeerSuggestions } from './peer-ranking.service';
describe('cross-school discovery ranking', () => {
 beforeEach(() => { state.me = {}; state.people = [{ _id: 'unrelated', profile: {} }, { _id: 'matching', profile: {} }]; });
 it('includes people without shared affinities', async () => { expect(await getRankedPeerSuggestions('viewer')).toHaveLength(2); });
 it.each(['university', 'department', 'level'])('prioritises matching %s', async field => {
  state.me[field] = 'Shared'; state.people[1].profile[field] = ' shared ';
  expect((await getRankedPeerSuggestions('viewer'))[0].id).toBe('matching');
 });
 it.each(['interests', 'skills'])('prioritises matching %s across schools', async field => {
  state.me[field] = ['Design']; state.people[1].profile[field] = ['design'];
  expect((await getRankedPeerSuggestions('viewer'))[0].id).toBe('matching');
 });
 it('escapes search syntax and bounds input', () => {
  const filter = peopleSearchFilter('a.*') as any;
  expect(filter.$or[0].fullName.$regex).toBe('a\\.\\*');
  expect(JSON.stringify(peopleSearchFilter('x'.repeat(500)))).not.toContain('x'.repeat(81));
 });
});
