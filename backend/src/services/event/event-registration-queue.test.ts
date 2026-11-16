import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('./event-capacity.service', () => ({ withEventMutation: vi.fn((_id: string, fn: () => unknown) => fn()), afterEventCommit: vi.fn(), promoteOneWaitlisted: vi.fn() }));
import * as shared from './event-shared';
import { EventModel } from '../../models/event.model';
import { EventRegistrationModel } from '../../models/event-registration.model';
import { approveRegistration, rejectRegistration } from './event-registration.service';

let event: any;
let registration: any;
beforeEach(() => {
  vi.restoreAllMocks();
  event = { status: 'PUBLISHED', endDate: new Date(Date.now() + 86400000), capacity: 1, waitlistEnabled: false, sections: [] };
  registration = { eventId: 'event', status: 'PENDING_APPROVAL', save: vi.fn() };
  vi.spyOn(shared, 'requireEventManager').mockResolvedValue(event);
  vi.spyOn(EventModel, 'findById').mockResolvedValue(event);
  vi.spyOn(EventRegistrationModel, 'findById').mockResolvedValue(registration);
  vi.spyOn(EventRegistrationModel, 'countDocuments').mockResolvedValue(1);
});
describe('organizer queue decisions', () => {
  it('keeps a pending request pending when the event is full and waitlisting is disabled', async () => {
    await expect(approveRegistration('event', 'registration', 'host')).rejects.toThrow('Increase capacity or enable the waitlist');
    expect(registration.status).toBe('PENDING_APPROVAL');
    expect(registration.save).not.toHaveBeenCalled();
  });
  it.each(['COMPLETED', 'ARCHIVED'])('cannot confirm requests for a %s event', async (status) => {
    event.status = status;
    await expect(approveRegistration('event', 'registration', 'host')).rejects.toThrow('no longer accepting');
    expect(registration.save).not.toHaveBeenCalled();
  });
  it('cannot confirm requests for an event that has already ended', async () => {
    event.endDate = new Date(Date.now() - 1000);
    await expect(approveRegistration('event', 'registration', 'host')).rejects.toThrow('no longer accepting');
  });
  it('cannot use a queue decline action to revoke an already confirmed place', async () => {
    registration.status = 'CONFIRMED';
    await expect(rejectRegistration('event', 'registration', 'host')).rejects.toThrow('Only pending requests');
    expect(registration.save).not.toHaveBeenCalled();
  });
});
