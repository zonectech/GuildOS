import { beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
vi.mock('../community-state-policy', () => ({ assertCommunityActive: vi.fn(async () => undefined) }));
import { EventModel } from '../../models/event.model';
import { EventRegistrationModel } from '../../models/event-registration.model';
import { TicketPaymentModel } from '../../models/ticket-payment.model';
import { TicketClaimModel } from '../../models/ticket-claim.model';
import { promoteOneWaitlisted } from './event-capacity.service';

let event: any;
let people: any[];
function query(value: any): any {
  return { then: (resolve: any, reject: any) => Promise.resolve(value).then(resolve, reject), lean: async () => value, select() { return this; }, sort(spec: any) { expect(spec).toEqual({ registeredAt: 1, _id: 1 }); value.sort((a: any, b: any) => a.registeredAt - b.registeredAt || a._id.localeCompare(b._id)); return this; } };
}
const attendee = (id: string, when: number, status = 'WAITLISTED', sectionKey = '') => ({ _id: id, userId: id, status, sectionKey, plannedDays: [], registeredAt: new Date(when), save: vi.fn(async () => undefined) });
beforeEach(() => {
  vi.restoreAllMocks();
  event = { _id: 'event', communityId: 'club', waitlistEnabled: true, attendanceSource: 'GUILDOS', status: 'PUBLISHED', capacity: 1, endDate: new Date(Date.now() + 86400000), sections: [], days: [], ticketTiers: [] };
  people = [attendee('later', 2), attendee('first', 1)];
  vi.spyOn(mongoose.connection, 'transaction').mockImplementation((async (fn: any) => fn({})) as any);
  vi.spyOn(EventModel, 'findOneAndUpdate').mockResolvedValue(event);
  vi.spyOn(EventModel, 'findById').mockImplementation(() => query(event));
  vi.spyOn(EventRegistrationModel, 'find').mockImplementation((filter: any) => query(people.filter((p) => !filter.status || p.status === filter.status)));
  vi.spyOn(TicketPaymentModel, 'find').mockImplementation(() => query([]));
  vi.spyOn(TicketClaimModel, 'find').mockImplementation(() => query([]));
});
describe('waitlist promotion', () => {
  it('confirms the oldest eligible attendee and leaves the next one waiting when the event fills', async () => {
    expect((await promoteOneWaitlisted('event'))?._id).toBe('first');
    expect(await promoteOneWaitlisted('event')).toBeNull();
    expect(people.find((p) => p._id === 'later').status).toBe('WAITLISTED');
  });
  it('does not exceed capacity while another attendee holds the place', async () => {
    people.push(attendee('holding', 0, 'CONFIRMED'));
    expect(await promoteOneWaitlisted('event')).toBeNull();
    expect(people.filter((p) => p.status === 'CONFIRMED')).toHaveLength(1);
  });
  it('skips an older attendee whose section is full without skipping an eligible older attendee', async () => {
    event.capacity = 3; event.sections = [{ key: 'a', name: 'A', capacity: 1 }, { key: 'b', name: 'B', capacity: 2 }];
    people = [attendee('holding', 0, 'CONFIRMED', 'a'), attendee('blocked', 1, 'WAITLISTED', 'a'), attendee('next', 2, 'WAITLISTED', 'b')];
    expect((await promoteOneWaitlisted('event'))?._id).toBe('next');
    expect(people[1].status).toBe('WAITLISTED');
  });
  it.each(['disabled', 'closed', 'ended', 'cancelled', 'deadline', 'external'])('does not promote when %s', async (reason) => {
    if (reason === 'disabled') event.waitlistEnabled = false;
    if (reason === 'closed') event.registrationClosed = true;
    if (reason === 'ended') event.endDate = new Date(Date.now() - 1000);
    if (reason === 'cancelled') event.status = 'ARCHIVED';
    if (reason === 'deadline') event.registrationDeadline = new Date(Date.now() - 1000);
    if (reason === 'external') event.attendanceSource = 'EXTERNAL';
    expect(await promoteOneWaitlisted('event')).toBeNull();
    expect(people.every((p) => p.status === 'WAITLISTED')).toBe(true);
  });
});
