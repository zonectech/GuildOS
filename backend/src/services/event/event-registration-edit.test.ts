import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./event-capacity.service', () => ({
  withEventMutation: vi.fn((_id: string, fn: () => Promise<unknown>) => fn()),
  afterEventCommit: vi.fn(), promoteOneWaitlisted: vi.fn(),
}));
vi.mock('../community-state-policy', () => ({ assertCommunityActive: vi.fn(async () => undefined) }));

import { EventModel } from '../../models/event.model';
import { EventRegistrationModel } from '../../models/event-registration.model';
import { updateRegistrationAnswers } from './event-registration.service';

let event: any;
let registration: any;
beforeEach(() => {
  vi.restoreAllMocks();
  event = { communityId: 'club', attendanceSource: 'GUILDOS', status: 'PUBLISHED', startDate: new Date(Date.now() + 86400000), registrationQuestions: [
    { key: 'goal', label: 'Learning goal', type: 'TEXT', options: [], platform: 'WEBSITE', required: true },
    { key: 'experience', label: 'Experience', type: 'SELECT', options: ['Beginner', 'Advanced'], platform: 'WEBSITE', required: false },
  ] };
  registration = { _id: 'registration', status: 'CONFIRMED', userId: 'student', qrToken: 'same-pass', passCode: 'ABC123', registeredAt: new Date('2026-01-01'), answers: [
    { key: 'old', label: 'Removed question', value: 'Historical answer' },
    { key: 'goal', label: 'Learning goal', value: 'Original goal' },
    { key: 'experience', label: 'Experience', value: 'Beginner' },
  ], save: vi.fn(async () => undefined) };
  vi.spyOn(EventModel, 'findOne').mockResolvedValue(event);
  vi.spyOn(EventRegistrationModel, 'findOne').mockImplementation((query: any) => Promise.resolve(query.userId === 'student' ? registration : null) as any);
});

describe('editing your registration answers', () => {
  it('updates answers while retaining the same registration, pass, status and removed-question history', async () => {
    const result = await updateRegistrationAnswers('event', 'student', { goal: 'Updated goal', experience: 'Advanced' });
    expect(result).toBe(registration);
    expect(result).toMatchObject({ _id: 'registration', status: 'CONFIRMED', qrToken: 'same-pass', passCode: 'ABC123', registeredAt: new Date('2026-01-01') });
    expect(result.answers).toEqual([
      { key: 'old', label: 'Removed question', value: 'Historical answer' },
      { key: 'goal', label: 'Learning goal', value: 'Updated goal' },
      { key: 'experience', label: 'Experience', value: 'Advanced' },
    ]);
    expect(registration.save).toHaveBeenCalledOnce();
  });
  it('only looks up the signed-in attendee’s registration', async () => {
    await expect(updateRegistrationAnswers('event', 'someone-else', { goal: 'Tamper' })).rejects.toThrow('No editable registration');
    expect(EventRegistrationModel.findOne).toHaveBeenCalledWith({ eventId: 'event', userId: 'someone-else' });
    expect(registration.save).not.toHaveBeenCalled();
  });
  it.each(['PENDING_APPROVAL', 'WAITLISTED'])('allows %s attendees to correct their answers', async (status) => {
    registration.status = status;
    await updateRegistrationAnswers('event', 'student', { goal: 'Updated' });
    expect(registration.status).toBe(status);
  });
  it('preserves omitted answers and clears an explicitly blank optional answer', async () => {
    await updateRegistrationAnswers('event', 'student', { experience: '' });
    expect(registration.answers).toContainEqual({ key: 'goal', label: 'Learning goal', value: 'Original goal' });
    expect(registration.answers.some((a: any) => a.key === 'experience')).toBe(false);
  });
  it.each([{ goal: '' }, { experience: 'Invalid' }, { unknown: 'value' }])('rejects invalid answers without saving: %j', async (answers) => {
    await expect(updateRegistrationAnswers('event', 'student', answers)).rejects.toThrow();
    expect(registration.save).not.toHaveBeenCalled();
  });
  it.each(['CANCELLED', 'REJECTED', 'CHECKED_IN', 'COMPLETED'])('rejects edits to a %s registration', async (status) => {
    registration.status = status;
    await expect(updateRegistrationAnswers('event', 'student', { goal: 'Changed' })).rejects.toThrow('No editable registration');
    expect(registration.save).not.toHaveBeenCalled();
  });
  it.each(['started', 'cancelled', 'external', 'finalized', 'checked-in'])('rejects editing when %s', async (reason) => {
    if (reason === 'started') event.startDate = new Date(Date.now() - 1000);
    if (reason === 'cancelled') event.status = 'ARCHIVED';
    if (reason === 'external') event.attendanceSource = 'EXTERNAL';
    if (reason === 'finalized') event.attendanceFinalizedAt = new Date();
    if (reason === 'checked-in') registration.checkInAt = new Date();
    await expect(updateRegistrationAnswers('event', 'student', { goal: 'Changed' })).rejects.toThrow();
    expect(registration.save).not.toHaveBeenCalled();
  });
});
