import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ candidate: null as any, community: null as any, claimed: false, memberships: [] as any[], attendees: [] as any[], users: [] as any[] }));
const mocks = vi.hoisted(() => ({ claim: vi.fn(), recipients: vi.fn(), attendance: vi.fn(), notify: vi.fn(), email: vi.fn() }));
const rows = (value: unknown) => ({ select: () => ({ lean: async () => value }) });
vi.mock('../models/event.model', () => ({ EventModel: {
  findOne: vi.fn(() => ({ lean: async () => state.candidate })),
  findOneAndUpdate: mocks.claim.mockImplementation(() => ({ lean: async () => { if(state.claimed) return null; state.claimed = true; return state.candidate; } })),
  find: vi.fn(() => rows([{ _id: 'previous' }])),
} }));
vi.mock('../models/community.model', () => ({ CommunityModel: { findOne: vi.fn(() => ({ lean: async () => state.community })) } }));
vi.mock('../models/event-bookmark.model', () => ({ EventBookmarkModel: { find: vi.fn(() => rows([{userId:'member'}])) } }));
vi.mock('../models/membership.model', () => ({ MembershipModel: { find: vi.fn(() => rows(state.memberships)) } }));
vi.mock('../models/event-registration.model', () => ({ EventRegistrationModel: { distinct: mocks.attendance.mockImplementation(async () => state.attendees) } }));
vi.mock('../models/user.model', () => ({ UserModel: { find: mocks.recipients.mockImplementation(() => rows(state.users)) } }));
vi.mock('./notification.service', () => ({ createNotification: mocks.notify.mockResolvedValue(undefined) }));
vi.mock('../utils/email', () => ({ sendEmail: mocks.email.mockResolvedValue(undefined), categoryEmail: (_category: string, value: unknown) => value }));
import { EventModel } from '../models/event.model';
import { CommunityModel } from '../models/community.model';
import { notifyCommunityNewEvent } from './community-event-notification.service';

describe('new community event alerts', () => {
  beforeEach(() => {
    vi.clearAllMocks(); state.claimed = false;
    state.candidate = { _id: 'event', communityId: 'community', createdBy: 'organizer', title: 'Build day', slug: 'build-day', endDate: new Date(Date.now()+86400000) };
    state.community = { _id: 'community', name: 'Builders' };
    state.memberships = [{userId:'member',status:'ACTIVE'},{userId:'organizer',status:'ACTIVE'},{userId:'removed',status:'REMOVED'},{userId:'suspended',status:'SUSPENDED'}];
    state.attendees = ['member','alumni','removed','suspended'];
    state.users = [{_id:'member',email:'member@school.edu',fullName:'Member',emailVerified:true},{_id:'alumni',email:'alumni@school.edu',fullName:'Alumni',emailVerified:true}];
  });
  it('deduplicates members and past attendees and excludes the actor and removed/suspended memberships', async () => {
    await notifyCommunityNewEvent('event');
    expect(mocks.recipients.mock.calls[0][0]._id.$in).toEqual(['member','alumni']);
    expect(mocks.recipients.mock.calls[0][0]).toMatchObject({status:'ACTIVE',deletedAt:null});
    expect(mocks.notify).toHaveBeenCalledTimes(2); expect(mocks.email).toHaveBeenCalledTimes(2);
    expect(mocks.notify.mock.calls[0][0]).toMatchObject({title:'Builders has a new event',body:'Build day',link:'/events/build-day'});
  });
  it('requires attendance evidence, not merely registration', async () => {
    await notifyCommunityNewEvent('event');
    expect(mocks.attendance.mock.calls[0][1]).toMatchObject({eventId:{$in:['previous']},status:{$in:['CHECKED_IN','CHECKED_OUT','COMPLETED','PARTIAL_ATTENDANCE']}});
    expect(mocks.attendance.mock.calls[0][1].$or).toContainEqual({'externalAttendance.0':{$exists:true}});
  });
  it('does not send twice on repeated publication requests', async () => {
    await Promise.all([notifyCommunityNewEvent('event'),notifyCommunityNewEvent('event')]);
    expect(mocks.notify).toHaveBeenCalledTimes(2); expect(mocks.email).toHaveBeenCalledTimes(2);
    expect(mocks.claim.mock.calls[0][0]).toMatchObject({visibility:'PUBLIC',registrationPolicy:{$ne:'INVITE'},communityEventNotifiedAt:null});
  });
  it('keeps in-app alerts when email is disabled or the email is unverified', async () => {
    state.users[0].newEventEmailEnabled=false; state.users[1].emailVerified=false;
    await notifyCommunityNewEvent('event'); expect(mocks.notify).toHaveBeenCalledTimes(2); expect(mocks.email).not.toHaveBeenCalled();
  });
  it('does not alert for unavailable communities, unpublished/inaccessible events, or ended events', async () => {
    state.community=null; await notifyCommunityNewEvent('event'); expect(mocks.claim).not.toHaveBeenCalled();
    state.candidate=null; await notifyCommunityNewEvent('event'); expect(mocks.notify).not.toHaveBeenCalled();
    state.candidate={endDate:new Date(0)}; await notifyCommunityNewEvent('event'); expect(mocks.claim).not.toHaveBeenCalled();
  });
  it('restricts event discovery and excludes recipients already getting registration-opening alerts', async () => {
    await notifyCommunityNewEvent('event', {excludeAnticipated:true});
    expect(EventModel.findOne).toHaveBeenCalledWith(expect.objectContaining({status:'PUBLISHED',visibility:'PUBLIC',registrationPolicy:{$ne:'INVITE'},deletedAt:null}));
    expect(CommunityModel.findOne).toHaveBeenCalledWith(expect.objectContaining({verificationStatus:'VERIFIED',visibility:'PUBLIC',adminSuspended:{$ne:true},archivedAt:null}));
    expect(mocks.recipients.mock.calls[0][0]._id.$in).toEqual(['alumni']);
  });
  it('does not email seed fixture addresses', async () => {
    state.users[0].email='member@example.com'; state.users[1].email='alumni@guildos.local';
    await notifyCommunityNewEvent('event'); expect(mocks.notify).toHaveBeenCalledTimes(2); expect(mocks.email).not.toHaveBeenCalled();
  });
});
