import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { config } from '../../config';
import { CommunityModel } from '../../models/community.model';
import { EventModel } from '../../models/event.model';
import { HackathonModel, type HackathonDocument } from '../../models/hackathon.model';
import { HackathonTeamModel } from '../../models/hackathon-team.model';
import { HackathonSubmissionModel } from '../../models/hackathon-submission.model';
import { HackathonScoreModel } from '../../models/hackathon-score.model';
import { authStore } from '../../store/auth-store';
import { categoryEmail, sendEmail } from '../../utils/email';
import { createNotification } from '../notification.service';
import { publicMembers, requireHackathonManager, serializeAwards, serializeSettings, serializeSubmission } from './hackathon-shared';
import { cleanScoreSheet, computeLeaderboard, keyFromName } from './hackathon-rules';

const MAX_JUDGES = 20;

export function judgeLink(token: string) {
  return `${config.frontendUrl}/hackathon/judge/${token}`;
}

async function liveLeaderboard(hackathon: HackathonDocument, eventId: mongoose.Types.ObjectId) {
  const [submissions, scores] = await Promise.all([
    HackathonSubmissionModel.find({ eventId }).select('_id').lean(),
    HackathonScoreModel.find({ eventId }).lean(),
  ]);
  return {
    scores,
    leaderboard: computeLeaderboard(
      hackathon.criteria,
      submissions.map((s) => s._id.toString()),
      scores.map((s) => ({ submissionId: s.submissionId.toString(), judgeId: s.judgeId.toString(), scores: s.scores })),
    ),
  };
}

/** The organizer dashboard: settings, judges (with private links), live scores, teams and projects. */
export async function getHackathonManage(idOrSlug: string, actorId: string) {
  const { event, hackathon } = await requireHackathonManager(idOrSlug, actorId);
  const [teams, submissions, community] = await Promise.all([
    HackathonTeamModel.find({ eventId: event._id }).sort({ createdAt: 1 }).lean(),
    HackathonSubmissionModel.find({ eventId: event._id }).sort({ createdAt: 1 }).lean(),
    CommunityModel.findById(event.communityId).select('name slug verificationStatus').lean(),
  ]);
  const { scores, leaderboard } = await liveLeaderboard(hackathon, event._id);
  const submissionByTeam = new Map(submissions.map((s) => [s.teamId.toString(), s]));
  const teamById = new Map(teams.map((t) => [t._id.toString(), t]));

  return {
    event: { id: event._id.toString(), slug: event.slug, title: event.title, status: event.status },
    community: { name: community?.name ?? '', slug: community?.slug ?? '', verified: community?.verificationStatus === 'VERIFIED' },
    settings: serializeSettings(hackathon),
    judges: hackathon.judges.map((j) => ({
      id: j._id.toString(),
      name: j.name,
      email: j.email,
      hasAccount: Boolean(j.userId),
      link: judgeLink(j.token),
      scoredCount: scores.filter((s) => s.judgeId.toString() === j._id.toString()).length,
    })),
    teams: await Promise.all(teams.map(async (t) => ({
      id: t._id.toString(),
      name: t.name,
      members: await publicMembers(t.memberIds),
      submissionId: submissionByTeam.get(t._id.toString())?._id.toString() ?? null,
    }))),
    submissions: submissions.map((s) => ({ ...serializeSubmission(s), teamName: teamById.get(s.teamId.toString())?.name ?? 'Team' })),
    leaderboard,
    awards: serializeAwards(hackathon),
    knowledgeResourceId: hackathon.knowledgeResourceId?.toString() ?? null,
  };
}

export type SettingsInput = Partial<{
  teamSizeMin: number;
  teamSizeMax: number;
  submissionOpensAt: string | null;
  submissionDeadline: string | null;
  tracks: Array<{ key?: string; name?: string; description?: string; prize?: string }>;
  criteria: Array<{ key?: string; name?: string; weight?: number }>;
}>;

function parseDate(value: unknown, label: string) {
  if (value === null || value === '' || value === undefined) return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) throw new Error(`${label} is not a valid date`);
  return d;
}

/** Re-uses submitted keys that already exist (so renames keep scores/entries), mints keys for new rows. */
function keyedRows<T extends { key?: string; name?: string }>(rows: T[], existingKeys: Set<string>) {
  const taken = new Set<string>();
  return rows.map((row) => {
    const name = String(row.name ?? '').trim();
    const key = row.key && existingKeys.has(row.key) && !taken.has(row.key) ? row.key : keyFromName(name, taken);
    taken.add(key);
    return { ...row, key, name };
  });
}

export async function updateHackathonSettings(idOrSlug: string, actorId: string, input: SettingsInput) {
  const { event, hackathon } = await requireHackathonManager(idOrSlug, actorId);
  if (hackathon.resultsPublishedAt) throw new Error('Results are published, so settings are locked');

  if (input.teamSizeMin !== undefined || input.teamSizeMax !== undefined) {
    const min = Math.round(Number(input.teamSizeMin ?? hackathon.teamSizeMin));
    const max = Math.round(Number(input.teamSizeMax ?? hackathon.teamSizeMax));
    if (!(min >= 1 && max <= 10 && min <= max)) throw new Error('Team size must be between 1 and 10, with min ≤ max');
    hackathon.teamSizeMin = min;
    hackathon.teamSizeMax = max;
  }

  if (input.submissionOpensAt !== undefined) hackathon.submissionOpensAt = parseDate(input.submissionOpensAt, 'Submission opening time');
  if (input.submissionDeadline !== undefined) hackathon.submissionDeadline = parseDate(input.submissionDeadline, 'Submission deadline');
  if (hackathon.submissionOpensAt && hackathon.submissionDeadline && hackathon.submissionOpensAt >= hackathon.submissionDeadline) {
    throw new Error('Submissions must open before the deadline');
  }

  if (Array.isArray(input.tracks)) {
    if (input.tracks.length > 10) throw new Error('Up to 10 prize tracks');
    hackathon.tracks = keyedRows(input.tracks, new Set(hackathon.tracks.map((t) => t.key)))
      .filter((t) => t.name)
      .map((t) => ({
        key: t.key,
        name: t.name.slice(0, 80),
        description: String(t.description ?? '').trim().slice(0, 300),
        prize: String(t.prize ?? '').trim().slice(0, 120),
      }));
  }

  if (Array.isArray(input.criteria)) {
    const criteria = keyedRows(input.criteria, new Set(hackathon.criteria.map((c) => c.key)))
      .filter((c) => c.name)
      .map((c) => ({ key: c.key, name: c.name.slice(0, 60), weight: Math.round(Number(c.weight)) }));
    if (!criteria.length || criteria.length > 8) throw new Error('Use between 1 and 8 judging criteria');
    if (criteria.some((c) => !(c.weight >= 1 && c.weight <= 100))) throw new Error('Each criterion weight must be 1–100');
    const sameKeys = criteria.map((c) => c.key).sort().join() === hackathon.criteria.map((c) => c.key).sort().join();
    if (!sameKeys && (await HackathonScoreModel.exists({ eventId: event._id }))) {
      throw new Error('Judging has started. You can rename or reweight criteria, but not add or remove them');
    }
    hackathon.criteria = criteria;
  }

  await hackathon.save();
  return { settings: serializeSettings(hackathon) };
}

export async function addJudge(idOrSlug: string, actorId: string, input: { name?: string; email?: string; userId?: string }) {
  const { event, hackathon } = await requireHackathonManager(idOrSlug, actorId);
  if (hackathon.resultsPublishedAt) throw new Error('Results are published, so judging is closed');
  if (hackathon.judges.length >= MAX_JUDGES) throw new Error(`Up to ${MAX_JUDGES} judges`);

  const linkedUser = input.userId && mongoose.Types.ObjectId.isValid(input.userId)
    ? await authStore.getPublicUserById(input.userId).catch(() => null)
    : null;
  const name = String(input.name ?? linkedUser?.fullName ?? '').trim().slice(0, 80);
  if (!name) throw new Error('Judge name is required');
  const email = String(input.email ?? '').trim().toLowerCase().slice(0, 160);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address');
  if (linkedUser && hackathon.judges.some((j) => j.userId?.toString() === linkedUser.id)) throw new Error('That person is already a judge');

  const token = randomBytes(24).toString('hex');
  hackathon.judges.push({ name, email, userId: linkedUser ? new mongoose.Types.ObjectId(linkedUser.id) : null, token, addedAt: new Date() } as never);
  await hackathon.save();
  const link = judgeLink(token);

  // Best-effort delivery — the organizer can always copy the link from the dashboard.
  if (linkedUser) {
    await createNotification({
      userId: linkedUser.id,
      actorId,
      type: 'SYSTEM',
      title: `You're a judge for ${event.title}`,
      body: 'Open your private judging page to score the projects.',
      link: `/hackathon/judge/${token}`,
    });
  }
  const to = email || linkedUser?.email;
  if (to) {
    void sendEmail(to, categoryEmail('CONFIRMATION', {
      name,
      subject: `You're judging ${event.title}`,
      message: `You've been invited to judge the projects at "${event.title}". Your private judging page lists every submission and the scoring criteria. No account needed. Keep this link to yourself: anyone with it can score as you.`,
      ctaLabel: 'Open judging page',
      ctaUrl: link,
    })).catch(() => undefined);
  }

  const judge = hackathon.judges[hackathon.judges.length - 1];
  return { judge: { id: judge._id.toString(), name, email, hasAccount: Boolean(linkedUser), link, scoredCount: 0 } };
}

export async function removeJudge(idOrSlug: string, actorId: string, judgeId: string) {
  const { event, hackathon } = await requireHackathonManager(idOrSlug, actorId);
  if (hackathon.resultsPublishedAt) throw new Error('Results are published, so judging is closed');
  const before = hackathon.judges.length;
  hackathon.judges = hackathon.judges.filter((j) => j._id.toString() !== judgeId) as never;
  if (hackathon.judges.length === before) throw new Error('Judge not found');
  await hackathon.save();
  // Their scores no longer count.
  await HackathonScoreModel.deleteMany({ eventId: event._id, judgeId });
  return { removed: true };
}

async function findJudgeByToken(token: string) {
  if (!/^[a-f0-9]{48}$/.test(token)) throw new Error('Judging link not found');
  const hackathon = await HackathonModel.findOne({ 'judges.token': token });
  const judge = hackathon?.judges.find((j) => j.token === token);
  if (!hackathon || !judge) throw new Error('Judging link not found. It may have been revoked');
  const event = await EventModel.findOne({ _id: hackathon.eventId, deletedAt: null }).select('title slug bannerImage').lean();
  if (!event) throw new Error('Event not found');
  return { hackathon, judge, event };
}

/** A judge's private page: every project, the criteria, and their own scores so far. */
export async function getJudgeView(token: string) {
  const { hackathon, judge, event } = await findJudgeByToken(token);
  const [submissions, myScores, teams] = await Promise.all([
    HackathonSubmissionModel.find({ eventId: hackathon.eventId }).sort({ createdAt: 1 }).lean(),
    HackathonScoreModel.find({ eventId: hackathon.eventId, judgeId: judge._id }).lean(),
    HackathonTeamModel.find({ eventId: hackathon.eventId }).select('name memberIds').lean(),
  ]);
  const teamById = new Map(teams.map((t) => [t._id.toString(), t]));
  const scoreBySubmission = new Map(myScores.map((s) => [s.submissionId.toString(), s]));

  return {
    event: { title: event.title, slug: event.slug, bannerImage: event.bannerImage ?? '' },
    judge: { name: judge.name },
    criteria: hackathon.criteria,
    tracks: hackathon.tracks,
    resultsPublished: Boolean(hackathon.resultsPublishedAt),
    submissions: submissions.map((s) => {
      const team = teamById.get(s.teamId.toString());
      const mine = scoreBySubmission.get(s._id.toString());
      return {
        ...serializeSubmission(s),
        teamName: team?.name ?? 'Team',
        memberCount: team?.memberIds.length ?? 0,
        myScores: mine ? mine.scores : null,
        myComment: mine?.comment ?? '',
      };
    }),
  };
}

export async function scoreSubmission(token: string, submissionId: string, input: { scores?: unknown; comment?: string }) {
  const { hackathon, judge } = await findJudgeByToken(token);
  if (hackathon.resultsPublishedAt) throw new Error('Results are published, so scores are final');
  if (!mongoose.Types.ObjectId.isValid(submissionId)) throw new Error('Submission not found');
  const submission = await HackathonSubmissionModel.findOne({ _id: submissionId, eventId: hackathon.eventId }).select('_id').lean();
  if (!submission) throw new Error('Submission not found');

  const scores = cleanScoreSheet(hackathon.criteria, input.scores);
  const comment = String(input.comment ?? '').trim().slice(0, 1000);
  await HackathonScoreModel.findOneAndUpdate(
    { submissionId: submission._id, judgeId: judge._id },
    { $set: { scores, comment }, $setOnInsert: { eventId: hackathon.eventId } },
    { upsert: true, setDefaultsOnInsert: true },
  );
  return { scores, comment };
}
