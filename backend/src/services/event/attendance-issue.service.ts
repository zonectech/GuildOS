import { AttendanceIssueModel } from '../../models/attendance-issue.model';
import { EventModel } from '../../models/event.model';
import { EventRegistrationModel } from '../../models/event-registration.model';
import { UserModel } from '../../models/user.model';
import { MembershipModel } from '../../models/membership.model';
import { createNotification } from '../notification.service';
import { requireEventManager } from './event-shared';

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** A student reports a problem with their attendance record for an event that has ended. */
export async function reportAttendanceIssue(eventId: string, userId: string, input: { message?: unknown }) {
  const message = clean(input.message, 600);
  if (message.length < 10) throw new Error('Tell the organizers what happened (at least a sentence)');
  const event = await EventModel.findOne({ _id: eventId, deletedAt: null }).select('title slug endDate communityId createdBy').lean();
  if (!event) throw new Error('Event not found');
  if (!event.endDate || new Date(event.endDate).getTime() > Date.now()) throw new Error('You can report an attendance issue once the event has ended');
  const registration = await EventRegistrationModel.findOne({ eventId, userId, status: { $nin: ['CANCELLED', 'REJECTED'] } }).select('_id').lean();
  if (!registration) throw new Error('You were not registered for this event');
  if (await AttendanceIssueModel.exists({ eventId, userId, status: 'SENT' })) throw new Error('You already have a report waiting for the organizers');
  const issue = await AttendanceIssueModel.create({ eventId, userId, registrationId: registration._id, message });

  // Tell the people who can fix it: the event's creator and the community's senior leaders.
  const student = await UserModel.findById(userId).select('fullName').lean();
  const leaders = await MembershipModel.find({ communityId: event.communityId, status: 'ACTIVE', role: { $in: ['FOUNDER', 'PRESIDENT', 'VICE_PRESIDENT'] } }).select('userId').lean();
  const to = new Set([String(event.createdBy), ...leaders.map((l) => String(l.userId))]);
  for (const id of to) {
    await createNotification({ userId: id, type: 'SYSTEM', actorId: userId, title: `Attendance issue: ${event.title}`, body: `${student?.fullName ?? 'A student'}: ${message.slice(0, 140)}`, link: `/events/${event.slug}/manage` });
  }
  return issue;
}

/** The student's own reports, newest first, with the event title. */
export async function myAttendanceIssues(userId: string) {
  const issues = await AttendanceIssueModel.find({ userId }).sort({ createdAt: -1 }).limit(50).lean();
  const events = await EventModel.find({ _id: { $in: issues.map((i) => i.eventId) } }).select('title slug').lean();
  const byId = new Map(events.map((e) => [String(e._id), e]));
  return issues.map((i) => ({ ...i, event: byId.get(String(i.eventId)) ?? null }));
}

/** Organizers: reports for one event, with the student's name. */
export async function eventAttendanceIssues(eventId: string, actorId: string) {
  await requireEventManager(eventId, actorId);
  const issues = await AttendanceIssueModel.find({ eventId }).sort({ createdAt: -1 }).limit(200).lean();
  const users = await UserModel.find({ _id: { $in: issues.map((i) => i.userId) } }).select('fullName').lean();
  const names = new Map(users.map((u) => [String(u._id), u.fullName]));
  return issues.map((i) => ({ ...i, studentName: names.get(String(i.userId)) ?? 'Student' }));
}

/** Organizers mark a report reviewed, with a short reply the student sees. */
export async function reviewAttendanceIssue(eventId: string, issueId: string, actorId: string, input: { response?: unknown }) {
  const event = await requireEventManager(eventId, actorId);
  const response = clean(input.response, 600);
  if (response.length < 5) throw new Error('Write a short reply for the student');
  const issue = await AttendanceIssueModel.findOne({ _id: issueId, eventId });
  if (!issue) throw new Error('Report not found');
  if (issue.status === 'REVIEWED') throw new Error('This report was already reviewed');
  issue.status = 'REVIEWED';
  issue.response = response;
  issue.reviewedBy = actorId as never;
  issue.reviewedAt = new Date();
  await issue.save();
  await createNotification({ userId: String(issue.userId), type: 'SYSTEM', actorId, title: `Your attendance report for ${event.title} was reviewed`, body: response.slice(0, 160), link: '/me' });
  return issue;
}
