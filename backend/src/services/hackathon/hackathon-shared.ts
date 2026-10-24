import mongoose from 'mongoose';
import { EventModel } from '../../models/event.model';
import { EventRegistrationModel } from '../../models/event-registration.model';
import { HackathonModel, type HackathonDocument, type HackathonHydratedDocument } from '../../models/hackathon.model';
import type { HackathonTeamDocument } from '../../models/hackathon-team.model';
import type { HackathonSubmissionDocument } from '../../models/hackathon-submission.model';
import { authStore } from '../../store/auth-store';
import { findEventMemberships, membershipWith } from '../event/event-shared';
import { PARTICIPANT_STATUSES, submissionWindow, teamsLocked } from './hackathon-rules';

type WithId<T> = T & { _id: mongoose.Types.ObjectId };

/** Loads a live HACKATHON-type event by id or slug. */
export async function findHackathonEvent(idOrSlug: string) {
  const filter = mongoose.Types.ObjectId.isValid(idOrSlug) ? { _id: idOrSlug } : { slug: idOrSlug };
  const event = await EventModel.findOne({ ...filter, deletedAt: null });
  if (!event) throw new Error('Event not found');
  if (event.type !== 'HACKATHON') throw new Error('This event is not a hackathon');
  return event;
}

export type HackathonEvent = Awaited<ReturnType<typeof findHackathonEvent>>;

/** Hackathon settings for an event, created with defaults on first use. */
export async function loadHackathon(eventId: mongoose.Types.ObjectId | string): Promise<HackathonHydratedDocument> {
  return HackathonModel.findOneAndUpdate(
    { eventId },
    { $setOnInsert: { eventId } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ) as Promise<HackathonHydratedDocument>;
}

/** COORDINATOR+ of the host or an accepted co-host community. */
export async function canManageHackathon(event: HackathonEvent, userId?: string) {
  if (!userId) return false;
  const memberships = await findEventMemberships(event, userId);
  return Boolean(membershipWith(memberships, 'COORDINATOR'));
}

export async function requireHackathonManager(idOrSlug: string, actorId: string) {
  const event = await findHackathonEvent(idOrSlug);
  if (!(await canManageHackathon(event, actorId))) throw new Error('Insufficient permissions');
  return { event, hackathon: await loadHackathon(event._id) };
}

/** Only confirmed registrants (not pending, waitlisted or cancelled) can build. */
export async function requireParticipant(eventId: mongoose.Types.ObjectId | string, userId: string) {
  const registration = await EventRegistrationModel.findOne({ eventId, userId, status: { $in: PARTICIPANT_STATUSES } }).select('_id').lean();
  if (!registration) throw new Error('Register for this hackathon first — only confirmed attendees can join a team');
}

export function assertSubmissionsOpen(hackathon: HackathonDocument) {
  const window = submissionWindow(hackathon);
  if (!window.open) throw new Error(window.reason);
}

export function assertTeamsUnlocked(hackathon: HackathonDocument) {
  if (teamsLocked(hackathon)) {
    throw new Error(hackathon.resultsPublishedAt ? 'Results have been published — teams are locked' : 'The submission deadline has passed — teams are locked');
  }
}

export type PublicMember = { id: string; fullName: string; username: string; avatar: string };

export async function publicMembers(ids: Array<mongoose.Types.ObjectId | string>): Promise<PublicMember[]> {
  const users = await Promise.all(ids.map((id) => authStore.getPublicUserById(id.toString()).catch(() => null)));
  return users.map((user, i) => ({
    id: ids[i].toString(),
    fullName: user?.fullName ?? 'GuildOS member',
    username: user?.profile?.username ?? '',
    avatar: user?.profile?.avatar ?? '',
  }));
}

/** Settings everyone may see — judges' private links are never included. */
export function serializeSettings(h: HackathonDocument) {
  const window = submissionWindow(h);
  return {
    teamSizeMin: h.teamSizeMin,
    teamSizeMax: h.teamSizeMax,
    submissionOpensAt: h.submissionOpensAt,
    submissionDeadline: h.submissionDeadline,
    tracks: h.tracks,
    criteria: h.criteria,
    judgeCount: h.judges.length,
    resultsPublishedAt: h.resultsPublishedAt,
    submissionsOpen: window.open,
    submissionsClosedReason: window.reason,
    teamsLocked: teamsLocked(h),
  };
}

export async function serializeTeam(team: WithId<HackathonTeamDocument>, options: { includeInviteCode: boolean }) {
  return {
    id: team._id.toString(),
    name: team.name,
    captainId: team.captainId.toString(),
    members: await publicMembers(team.memberIds),
    inviteCode: options.includeInviteCode ? team.inviteCode : undefined,
  };
}

export function serializeSubmission(s: WithId<HackathonSubmissionDocument>) {
  return {
    id: s._id.toString(),
    teamId: s.teamId.toString(),
    title: s.title,
    tagline: s.tagline,
    description: s.description,
    repoUrl: s.repoUrl,
    demoUrl: s.demoUrl,
    videoUrl: s.videoUrl,
    images: s.images,
    techStack: s.techStack,
    trackKeys: s.trackKeys,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

export function serializeAwards(h: HackathonDocument) {
  return h.awards.map((a) => ({ id: a._id.toString(), submissionId: a.submissionId.toString(), place: a.place, trackKey: a.trackKey, label: a.label }));
}
