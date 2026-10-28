vi.mock('./hackathon-public.service',()=>({getPublicHackathonJudges:async()=>[]}));
import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ published: false, manager: false, viewer: '' }));
const submissions = [
  { _id: 'winner', teamId: 'team-a', title: 'Winning project' },
  { _id: 'other', teamId: 'team-b', title: 'Private project' },
];
const teams = [
  { _id: 'team-a', name: 'A', memberIds: ['alice'] },
  { _id: 'team-b', name: 'B', memberIds: ['bob'] },
];
vi.mock('../../models/event-registration.model', () => ({ EventRegistrationModel: { findOne: () => ({ select: () => ({ lean: async () => ({ status: 'CONFIRMED' }) }) }) } }));
vi.mock('../../models/hackathon-team.model', () => ({ HackathonTeamModel: { find: () => ({ lean: async () => teams }) } }));
vi.mock('../../models/hackathon-submission.model', () => ({ HackathonSubmissionModel: { find: () => ({ sort: () => ({ lean: async () => submissions }) }) } }));
vi.mock('../../models/hackathon-score.model', () => ({ HackathonScoreModel: { find: () => ({ lean: async () => [
  { submissionId: 'winner', judgeId: 'judge', scores: { build: 9 } },
  { submissionId: 'other', judgeId: 'judge', scores: { build: 7 } },
] }) } }));
vi.mock('./hackathon-shared', () => ({
  findHackathonEvent: async () => ({ _id: 'event', slug: 'demo', title: 'Demo', communityId: 'community', status: 'PUBLISHED', visibility: 'PUBLIC' }),
  canManageHackathon: async () => state.manager,
  loadHackathon: async () => ({ resultsPublishedAt: state.published ? new Date() : null, criteria: [{ key: 'build', name: 'Build', weight: 100 }], awards: [{ submissionId: 'winner' }] }),
  publicMembers: async (ids: string[]) => ids,
  serializeSubmission: (s: typeof submissions[number]) => ({ id: s._id, title: s.title }),
  serializeTeam: async (t: typeof teams[number]) => ({ id: t._id }),
  serializeSettings: () => ({}), serializeAwards: () => [{ submissionId: 'winner' }],
  assertSubmissionsOpen: vi.fn(), assertTeamsUnlocked: vi.fn(), requireParticipant: vi.fn(),
}));
import { getHackathonHub } from './hackathon-team.service';
beforeEach(() => { state.published = false; state.manager = false; });
describe('public hackathon project visibility', () => {
  it('hides every project and draft award before publication', async () => {
    const hub = await getHackathonHub('demo');
    expect(hub.submissions).toEqual([]); expect(hub.awards).toEqual([]); expect(hub.leaderboard).toBeNull();
  });
  it('returns only awarded projects and score rows after publication', async () => {
    state.published = true;
    const hub = await getHackathonHub('demo');
    expect(hub.submissions.map(s => s.id)).toEqual(['winner']);
    expect(hub.leaderboard?.map(s => s.submissionId)).toEqual(['winner']);
    expect(JSON.stringify(hub)).not.toContain('Private project');
  });
  it('keeps a participant own submission private before results', async () => {
    const hub = await getHackathonHub('demo', 'bob');
    expect(hub.submissions).toEqual([]);
    expect(hub.viewer.submission).toMatchObject({ id: 'other', title: 'Private project' });
  });
  it('keeps a non-winning team own project available after results', async () => {
    state.published = true;
    const hub = await getHackathonHub('demo', 'bob');
    expect(hub.submissions.map(s => s.id)).toEqual(['winner']);
    expect(hub.viewer.submission).toMatchObject({ id: 'other' });
  });
  it('does not add organizer-only projects to the public hub response', async () => {
    state.published = true; state.manager = true;
    const hub = await getHackathonHub('demo', 'organizer');
    expect(hub.submissions.map(s => s.id)).toEqual(['winner']);
    expect(hub.viewer.submission).toBeNull();
  });
});
