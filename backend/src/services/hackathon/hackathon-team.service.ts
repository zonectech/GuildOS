import { getPublicHackathonJudges } from './hackathon-public.service';
import { EventRegistrationModel } from '../../models/event-registration.model';
import { HackathonTeamModel } from '../../models/hackathon-team.model';
import { HackathonSubmissionModel } from '../../models/hackathon-submission.model';
import { HackathonScoreModel } from '../../models/hackathon-score.model';
import {
  assertSubmissionsOpen, assertTeamsUnlocked, canManageHackathon, findHackathonEvent, loadHackathon,
  publicMembers, requireParticipant, serializeAwards, serializeSettings, serializeSubmission, serializeTeam,
} from './hackathon-shared';
import { PARTICIPANT_STATUSES, cleanUrl, computeLeaderboard, normalizeInviteCode, randomInviteCode } from './hackathon-rules';

const isDuplicateKey = (error: unknown) => (error as { code?: number })?.code === 11000;

async function findMyTeam(eventId: unknown, userId: string) {
  return HackathonTeamModel.findOne({ eventId, memberIds: userId });
}

/**
 * Everything the public hackathon hub shows: settings, published winning projects and
 * results, and — for a signed-in participant — their own team and submission.
 */
export async function getHackathonHub(idOrSlug: string, viewerId?: string) {
  const event = await findHackathonEvent(idOrSlug);
  const canManage = await canManageHackathon(event, viewerId);
  const registration = viewerId
    ? await EventRegistrationModel.findOne({ eventId: event._id, userId: viewerId }).select('status').lean()
    : null;
  const isParticipant = Boolean(registration && PARTICIPANT_STATUSES.includes(registration.status));

  if (event.status === 'DRAFT' && !canManage) throw new Error('Event not found');
  if (event.visibility === 'PRIVATE' && !canManage && !registration) throw new Error('This event is private');

  const hackathon = await loadHackathon(event._id);
  const [teams, submissions] = await Promise.all([
    HackathonTeamModel.find({ eventId: event._id }).lean(),
    HackathonSubmissionModel.find({ eventId: event._id }).sort({ createdAt: 1 }).lean(),
  ]);
  const teamById = new Map(teams.map((t) => [t._id.toString(), t]));

  // Filter before serialization: unpublished and non-winning projects never leave the public API.
  const winningIds = new Set(hackathon.resultsPublishedAt
    ? hackathon.awards.map((a) => a.submissionId.toString()) : []);
  const publicSubmissions = submissions.filter((s) => winningIds.has(s._id.toString()));
  const gallery = await Promise.all(
    publicSubmissions.map(async (s) => {
      const team = teamById.get(s.teamId.toString());
      return { ...serializeSubmission(s), teamName: team?.name ?? 'Team', members: await publicMembers(team?.memberIds ?? []) };
    }),
  );

  let leaderboard = null;
  if (hackathon.resultsPublishedAt) {
    const scores = await HackathonScoreModel.find({ eventId: event._id }).lean();
    leaderboard = computeLeaderboard(
      hackathon.criteria,
      submissions.map((s) => s._id.toString()),
      scores.map((s) => ({ submissionId: s.submissionId.toString(), judgeId: s.judgeId.toString(), scores: s.scores })),
    ).filter((row) => winningIds.has(row.submissionId));
  }

  const myTeamDoc = viewerId ? teams.find((t) => t.memberIds.some((m) => m.toString() === viewerId)) : undefined;
  const mySubmission = myTeamDoc ? submissions.find((s) => s.teamId.toString() === myTeamDoc._id.toString()) : undefined;

  return {
    event: {
      id: event._id.toString(),
      slug: event.slug,
      title: event.title,
      bannerImage: event.bannerImage ?? '',
      communityId: event.communityId.toString(),
      status: event.status,
      startDate: event.startDate,
      endDate: event.endDate,
    },
    settings: serializeSettings(hackathon),
    judges: await getPublicHackathonJudges(String(event._id)),
    teamCount: teams.length,
    submissions: gallery,
    awards: hackathon.resultsPublishedAt ? serializeAwards(hackathon) : [],
    leaderboard,
    viewer: {
      signedIn: Boolean(viewerId),
      isParticipant,
      canManage,
      team: myTeamDoc ? await serializeTeam(myTeamDoc, { includeInviteCode: true }) : null,
      submission: mySubmission ? serializeSubmission(mySubmission) : null,
    },
  };
}

export async function createTeam(idOrSlug: string, userId: string, input: { name?: string }) {
  const event = await findHackathonEvent(idOrSlug);
  const hackathon = await loadHackathon(event._id);
  assertTeamsUnlocked(hackathon);
  await requireParticipant(event._id, userId);
  if (await findMyTeam(event._id, userId)) throw new Error('You are already on a team. Leave it first');

  const name = String(input.name ?? '').trim().slice(0, 60);
  if (!name) throw new Error('Give your team a name');

  // Invite codes are random; retry on the rare collision.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const team = await HackathonTeamModel.create({
        eventId: event._id,
        name,
        inviteCode: randomInviteCode(),
        captainId: userId,
        memberIds: [userId],
      });
      return { team: await serializeTeam(team, { includeInviteCode: true }) };
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
      // A duplicate on memberIds (not the code) means a concurrent create already put them on a team.
      if (await findMyTeam(event._id, userId)) throw new Error('You are already on a team. Leave it first');
    }
  }
  throw new Error('Unable to create the team. Please try again');
}

export async function joinTeam(idOrSlug: string, userId: string, input: { inviteCode?: string }) {
  const event = await findHackathonEvent(idOrSlug);
  const hackathon = await loadHackathon(event._id);
  assertTeamsUnlocked(hackathon);
  await requireParticipant(event._id, userId);
  if (await findMyTeam(event._id, userId)) throw new Error('You are already on a team. Leave it first');

  const inviteCode = normalizeInviteCode(input.inviteCode);
  const team = await HackathonTeamModel.findOne({ eventId: event._id, inviteCode });
  if (!team) throw new Error('Team not found. Check the invite code');

  try {
    // Atomic size check: only add while the (max-1)th slot is still empty.
    const updated = await HackathonTeamModel.findOneAndUpdate(
      { _id: team._id, [`memberIds.${hackathon.teamSizeMax - 1}`]: { $exists: false } },
      { $addToSet: { memberIds: userId } },
      { new: true },
    );
    if (!updated) throw new Error(`This team is full (max ${hackathon.teamSizeMax})`);
    return { team: await serializeTeam(updated, { includeInviteCode: true }) };
  } catch (error) {
    if (isDuplicateKey(error)) throw new Error('You are already on a team. Leave it first');
    throw error;
  }
}

/** Leaving as the last member deletes the team and its project; a leaving captain hands over. */
export async function leaveTeam(idOrSlug: string, userId: string) {
  const event = await findHackathonEvent(idOrSlug);
  const hackathon = await loadHackathon(event._id);
  assertTeamsUnlocked(hackathon);
  const team = await findMyTeam(event._id, userId);
  if (!team) throw new Error('You are not on a team');

  team.memberIds = team.memberIds.filter((m) => m.toString() !== userId);
  if (!team.memberIds.length) {
    const submission = await HackathonSubmissionModel.findOneAndDelete({ teamId: team._id });
    if (submission) await HackathonScoreModel.deleteMany({ submissionId: submission._id });
    await team.deleteOne();
    return { left: true, teamDeleted: true };
  }
  if (team.captainId.toString() === userId) team.captainId = team.memberIds[0];
  await team.save();
  return { left: true, teamDeleted: false };
}

async function requireCaptainTeam(idOrSlug: string, userId: string) {
  const event = await findHackathonEvent(idOrSlug);
  const hackathon = await loadHackathon(event._id);
  const team = await findMyTeam(event._id, userId);
  if (!team) throw new Error('You are not on a team');
  if (team.captainId.toString() !== userId) throw new Error('Only the team captain can do that');
  return { event, hackathon, team };
}

export async function renameTeam(idOrSlug: string, userId: string, input: { name?: string }) {
  const { hackathon, team } = await requireCaptainTeam(idOrSlug, userId);
  assertTeamsUnlocked(hackathon);
  const name = String(input.name ?? '').trim().slice(0, 60);
  if (!name) throw new Error('Give your team a name');
  team.name = name;
  await team.save();
  return { team: await serializeTeam(team, { includeInviteCode: true }) };
}

export async function removeTeamMember(idOrSlug: string, userId: string, memberId: string) {
  const { hackathon, team } = await requireCaptainTeam(idOrSlug, userId);
  assertTeamsUnlocked(hackathon);
  if (memberId === userId) throw new Error('Use "Leave team" to remove yourself');
  if (!team.memberIds.some((m) => m.toString() === memberId)) throw new Error('That person is not on your team');
  team.memberIds = team.memberIds.filter((m) => m.toString() !== memberId);
  await team.save();
  return { team: await serializeTeam(team, { includeInviteCode: true }) };
}

export type SubmissionInput = Partial<{
  title: string;
  tagline: string;
  description: string;
  repoUrl: string;
  demoUrl: string;
  videoUrl: string;
  images: string[];
  techStack: string[];
  trackKeys: string[];
}>;

/** Create or update the viewer's team project. Any member can edit it while submissions are open. */
export async function saveSubmission(idOrSlug: string, userId: string, input: SubmissionInput) {
  const event = await findHackathonEvent(idOrSlug);
  const hackathon = await loadHackathon(event._id);
  assertSubmissionsOpen(hackathon);
  const team = await findMyTeam(event._id, userId);
  if (!team) throw new Error('Create or join a team first. Solo builders can be a team of one');
  if (team.memberIds.length < hackathon.teamSizeMin) {
    throw new Error(`Teams need at least ${hackathon.teamSizeMin} members to submit`);
  }

  const title = String(input.title ?? '').trim().slice(0, 100);
  if (!title) throw new Error('Give your project a name');
  const validTracks = new Set(hackathon.tracks.map((t) => t.key));
  const images = (Array.isArray(input.images) ? input.images : [])
    .map((src) => String(src).trim())
    .filter((src) => src.startsWith('/uploads/') || /^https:\/\/\S+$/i.test(src))
    .slice(0, 6);

  const fields = {
    title,
    tagline: String(input.tagline ?? '').trim().slice(0, 160),
    description: String(input.description ?? '').trim().slice(0, 5000),
    repoUrl: cleanUrl(input.repoUrl, 'Repository link'),
    demoUrl: cleanUrl(input.demoUrl, 'Demo link'),
    videoUrl: cleanUrl(input.videoUrl, 'Video link'),
    images,
    techStack: [...new Set((Array.isArray(input.techStack) ? input.techStack : []).map((t) => String(t).trim().slice(0, 30)).filter(Boolean))].slice(0, 12),
    trackKeys: [...new Set((Array.isArray(input.trackKeys) ? input.trackKeys : []).map(String).filter((k) => validTracks.has(k)))],
  };

  const submission = await HackathonSubmissionModel.findOneAndUpdate(
    { teamId: team._id },
    { $set: fields, $setOnInsert: { eventId: event._id, teamId: team._id, submittedBy: userId } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();
  return { submission: serializeSubmission(submission!) };
}
