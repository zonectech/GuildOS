import mongoose from 'mongoose';
import { EventSpeakerModel } from '../../models/event-speaker.model';
import { EventSponsorModel } from '../../models/event-sponsor.model';
import { EventVolunteerModel } from '../../models/event-volunteer.model';
import { authStore } from '../../store/auth-store';
import { awardReputation, speakerReputation } from '../reputation.service';
import { ensureNonEmpty, normalizeSpeakerDay, normalizeSectionKey } from './event-shared';
import { requireEditableEvent } from './event-core.service';

/** Speaker links render as clickable hrefs on the public event page — http(s) only. */
function safeHttpUrl(value?: string): string {
  const v = value?.trim() ?? '';
  return /^https?:\/\//i.test(v) ? v : '';
}

export async function addEventSpeaker(
  eventId: string,
  actorId: string,
  input: { fullName?: string; title?: string; organization?: string; bio?: string; photo?: string; linkedinUrl?: string; userId?: string | null; speakerType?: string; day?: number | null; sectionKey?: string | null },
) {
  const event = await requireEditableEvent(eventId, actorId);
  ensureNonEmpty(input.fullName, 'Speaker name');

  let userId: string | null = null;
  if (input.userId) {
    const linked = await authStore.getPublicUserById(input.userId);
    if (!linked) throw new Error('Linked GuildOS user not found');
    userId = input.userId;
  }
  const speakerType = ['WORKSHOP', 'PANEL', 'GUEST', 'TRAINER'].includes(input.speakerType ?? '') ? input.speakerType : 'GUEST';

  return EventSpeakerModel.create({
    eventId,
    userId,
    speakerType,
    day: normalizeSpeakerDay(input.day),
    sectionKey: normalizeSectionKey(event, input.sectionKey),
    fullName: input.fullName!.trim(),
    title: input.title?.trim() ?? '',
    organization: input.organization?.trim() ?? '',
    bio: input.bio?.trim() ?? '',
    photo: input.photo?.trim() ?? '',
    linkedinUrl: safeHttpUrl(input.linkedinUrl),
  });
}

export async function updateEventSpeaker(
  eventId: string,
  speakerId: string,
  actorId: string,
  input: { fullName?: string; title?: string; organization?: string; bio?: string; photo?: string; linkedinUrl?: string; userId?: string | null; speakerType?: string; day?: number | null; sectionKey?: string | null },
) {
  const event = await requireEditableEvent(eventId, actorId);
  const speaker = await EventSpeakerModel.findOne({ _id: speakerId, eventId });
  if (!speaker) {
    throw new Error('Speaker not found');
  }

  if (input.day !== undefined) speaker.day = normalizeSpeakerDay(input.day);
  if (input.sectionKey !== undefined) speaker.sectionKey = normalizeSectionKey(event, input.sectionKey);
  if (input.fullName !== undefined) {
    ensureNonEmpty(input.fullName, 'Speaker name');
    speaker.fullName = input.fullName.trim();
  }
  if (input.title !== undefined) speaker.title = input.title.trim();
  if (input.organization !== undefined) speaker.organization = input.organization.trim();
  if (input.bio !== undefined) speaker.bio = input.bio.trim();
  if (input.photo !== undefined) speaker.photo = input.photo.trim();
  if (input.linkedinUrl !== undefined) speaker.linkedinUrl = safeHttpUrl(input.linkedinUrl);
  if (input.speakerType !== undefined && ['WORKSHOP', 'PANEL', 'GUEST', 'TRAINER'].includes(input.speakerType)) {
    speaker.speakerType = input.speakerType as 'WORKSHOP' | 'PANEL' | 'GUEST' | 'TRAINER';
  }
  if (input.userId !== undefined) {
    if (input.userId === null || input.userId === '') {
      speaker.userId = null;
    } else {
      const linked = await authStore.getPublicUserById(input.userId);
      if (!linked) throw new Error('Linked GuildOS user not found');
      speaker.userId = new mongoose.Types.ObjectId(input.userId);
    }
  }

  await speaker.save();
  // Late tagging: if the event is already finalized, award the newly linked speaker now.
  if (speaker.userId && (event.status === 'COMPLETED' || event.attendanceFinalizedAt)) {
    await awardEventSpeaker(speaker, event);
  }
  return speaker;
}

export async function searchSpeakerUsers(eventId: string, actorId: string, query: string) {
  await requireEditableEvent(eventId, actorId);
  return authStore.searchPublicUsers(query, 10);
}

export async function awardEventSpeaker(
  speaker: { _id: mongoose.Types.ObjectId; userId: mongoose.Types.ObjectId | null; speakerType: 'WORKSHOP' | 'PANEL' | 'GUEST' | 'TRAINER' },
  event: { _id: mongoose.Types.ObjectId; title: string; communityId: mongoose.Types.ObjectId },
) {
  if (!speaker.userId) return;
  await awardReputation({
    userId: speaker.userId.toString(),
    category: 'SPEAKER',
    type: 'SPEAKER_CONTRIBUTION',
    referenceId: speaker._id.toString(),
    communityId: event.communityId.toString(),
    scoreAwarded: speakerReputation(speaker.speakerType),
    description: `Spoke at ${event.title}`,
  });
}

export async function listEventVolunteers(eventId: string, actorId: string) {
  await requireEditableEvent(eventId, actorId);
  const volunteers = await EventVolunteerModel.find({ eventId }).sort({ createdAt: 1 }).lean();
  return volunteers.map((v) => ({
    _id: v._id.toString(),
    eventId: v.eventId.toString(),
    userId: v.userId.toString(),
    fullName: v.fullName,
    role: v.role,
    createdAt: v.createdAt,
  }));
}

export async function addEventVolunteer(
  eventId: string,
  actorId: string,
  input: { userId?: string; role?: string },
) {
  const event = await requireEditableEvent(eventId, actorId);
  if (!input.userId) {
    throw new Error('A GuildOS user is required to credit a volunteer');
  }
  const user = await authStore.getPublicUserById(input.userId);
  if (!user) {
    throw new Error('Volunteer user not found');
  }

  const existing = await EventVolunteerModel.findOne({ eventId, userId: input.userId });
  if (existing) {
    throw new Error('This user is already credited as a volunteer for this event');
  }

  const volunteer = await EventVolunteerModel.create({
    eventId,
    userId: input.userId,
    fullName: user.fullName,
    role: input.role?.trim() ?? '',
    addedBy: actorId,
  });

  // Late tagging: if the event already finished, credit the volunteer now.
  if (event.status === 'COMPLETED' || event.attendanceFinalizedAt) {
    await awardEventVolunteer(volunteer, event);
  }

  return {
    _id: volunteer._id.toString(),
    eventId: volunteer.eventId.toString(),
    userId: volunteer.userId.toString(),
    fullName: volunteer.fullName,
    role: volunteer.role,
    createdAt: volunteer.createdAt,
  };
}

export async function removeEventVolunteer(eventId: string, volunteerId: string, actorId: string) {
  await requireEditableEvent(eventId, actorId);
  const volunteer = await EventVolunteerModel.findOne({ _id: volunteerId, eventId });
  if (!volunteer) {
    throw new Error('Volunteer not found');
  }
  await volunteer.deleteOne();
  return { message: 'Volunteer removed' };
}

export async function searchVolunteerUsers(eventId: string, actorId: string, query: string) {
  await requireEditableEvent(eventId, actorId);
  return authStore.searchPublicUsers(query, 10);
}

export async function awardEventVolunteer(
  volunteer: { _id: mongoose.Types.ObjectId; userId: mongoose.Types.ObjectId; role: string },
  event: { _id: mongoose.Types.ObjectId; title: string; communityId: mongoose.Types.ObjectId },
) {
  await awardReputation({
    userId: volunteer.userId.toString(),
    category: 'VOLUNTEER',
    type: 'VOLUNTEER_CONTRIBUTION',
    referenceId: volunteer._id.toString(),
    communityId: event.communityId.toString(),
    scoreAwarded: 20,
    description: volunteer.role ? `Volunteered (${volunteer.role}) at ${event.title}` : `Volunteered at ${event.title}`,
  });
}

export async function addEventSponsor(
  eventId: string,
  actorId: string,
  input: { name?: string; logo?: string; website?: string },
) {
  await requireEditableEvent(eventId, actorId);
  ensureNonEmpty(input.name, 'Sponsor name');

  return EventSponsorModel.create({
    eventId,
    name: input.name!.trim(),
    logo: input.logo?.trim() ?? '',
    website: input.website?.trim() ?? '',
  });
}

export async function removeEventSpeaker(eventId: string, speakerId: string, actorId: string) {
  await requireEditableEvent(eventId, actorId);
  const speaker = await EventSpeakerModel.findOne({ _id: speakerId, eventId });
  if (!speaker) {
    throw new Error('Speaker not found');
  }
  await speaker.deleteOne();
  return { message: 'Speaker removed' };
}

export async function removeEventSponsor(eventId: string, sponsorId: string, actorId: string) {
  await requireEditableEvent(eventId, actorId);
  const sponsor = await EventSponsorModel.findOne({ _id: sponsorId, eventId });
  if (!sponsor) {
    throw new Error('Sponsor not found');
  }
  await sponsor.deleteOne();
  return { message: 'Sponsor removed' };
}
