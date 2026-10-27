import { describe, expect, it } from 'vitest';
import { similarEventScore } from '../../../../frontend/app/events/_components/event-discovery';
import type { EventSummary } from '../../../../frontend/components/guildos/event-api';
const source = { type: 'WORKSHOP', mode: 'VIRTUAL', communityId: 'community-a', tags: ['AI', 'Careers'], communityUniversity: 'Test University' } as EventSummary;
describe('related event discovery', () => {
  it('prioritizes shared topics and event type over an unrelated event', () => {
    const related = { ...source, communityId: 'other', tags: ['ai'] };
    const unrelated = { ...source, type: 'MEETUP', tags: [], communityUniversity: '', communityId: 'another' } as EventSummary;
    expect(similarEventScore(related, source)).toBeGreaterThan(similarEventScore(unrelated, source));
  });
  it('normalizes topics and counts duplicate tags only once', () => {
    expect(similarEventScore({ ...source, tags: [' AI ', 'ai'] }, source)).toBe(similarEventScore({ ...source, tags: ['ai'] }, source));
  });
  it('still ranks events when topic information is absent', () => {
    expect(similarEventScore({ ...source, tags: [] }, { ...source, tags: [] })).toBeGreaterThan(0);
  });
});
