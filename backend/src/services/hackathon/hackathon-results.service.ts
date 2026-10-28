import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { CertificateModel } from '../../models/certificate.model';
import { CommunityModel } from '../../models/community.model';
import { DEFAULT_CERTIFICATE_CONTENT, DEFAULT_CERTIFICATE_THEME } from '../../models/event.model';
import { type HackathonAward, type HackathonHydratedDocument } from '../../models/hackathon.model';
import { HackathonTeamModel } from '../../models/hackathon-team.model';
import { HackathonSubmissionModel, type HackathonSubmissionHydratedDocument } from '../../models/hackathon-submission.model';
import { KnowledgeResourceModel } from '../../models/knowledge-resource.model';
import { authStore } from '../../store/auth-store';
import { certificateEarnedEmail, sendEmail } from '../../utils/email';
import { certificateVerificationUrl, generateCertificateSerial } from '../event/event-certificate.service';
import { createKnowledgeResource } from '../knowledge.service';
import { createNotification } from '../notification.service';
import { REPUTATION_POINTS, awardReputation } from '../reputation.service';
import { publicMembers, requireHackathonManager, serializeAwards, type HackathonEvent } from './hackathon-shared';
import { hackathonRewardPolicy, placeLabel } from './hackathon-rules';

type AwardInput = { submissionId?: string; place?: number | null; trackKey?: string };

function buildAwards(hackathon: HackathonHydratedDocument, input: AwardInput[], submissionIds: Set<string>) {
  if (!Array.isArray(input) || !input.length) throw new Error('Pick at least one winner');
  const places = new Set<number>();
  const trackKeys = new Set<string>();
  const placedSubmissions = new Set<string>();

  return input.map((entry) => {
    const submissionId = String(entry.submissionId ?? '');
    if (!submissionIds.has(submissionId)) throw new Error('Each winner must be a submitted project');
    const place = entry.place === null || entry.place === undefined ? null : Math.round(Number(entry.place));
    const trackKey = String(entry.trackKey ?? '');

    if (place !== null) {
      if (![1, 2, 3].includes(place)) throw new Error('Overall places are 1st, 2nd and 3rd');
      if (places.has(place)) throw new Error(`Only one project can take ${placeLabel(place)}`);
      if (placedSubmissions.has(submissionId)) throw new Error('A project can hold only one overall place');
      places.add(place);
      placedSubmissions.add(submissionId);
      return { _id: new mongoose.Types.ObjectId(), submissionId: new mongoose.Types.ObjectId(submissionId), place, trackKey: '', label: placeLabel(place) };
    }
    const track = hackathon.tracks.find((t) => t.key === trackKey);
    if (!track) throw new Error('Each award needs a place (1–3) or a prize track');
    if (trackKeys.has(trackKey)) throw new Error(`Only one winner for "${track.name}"`);
    trackKeys.add(trackKey);
    return { _id: new mongoose.Types.ObjectId(), submissionId: new mongoose.Types.ObjectId(submissionId), place: null, trackKey, label: `Winner: ${track.name}` };
  });
}

type RewardContext = {
  event: HackathonEvent;
  community: { _id: mongoose.Types.ObjectId; name: string; verificationStatus: string };
  actorId: string;
};

/** Issues one certificate (achievement or participation) unless this submission already recorded it. */
async function issueCertificate(
  ctx: RewardContext,
  submission: HackathonSubmissionHydratedDocument,
  userId: string,
  award: HackathonAward | null,
) {
  const already = submission.certificates.some(
    (c) => c.userId.toString() === userId && (c.awardId?.toString() ?? null) === (award?._id.toString() ?? null),
  );
  if (already) return false;
  const user = await authStore.getPublicUserById(userId).catch(() => null);
  if (!user) return false;

  const { event, community } = ctx;
  const project = submission.title.length > 60 ? `${submission.title.slice(0, 57)}…` : submission.title;
  const baseContent = event.certificateContent ?? DEFAULT_CERTIFICATE_CONTENT;
  // eventId stays null: the one-certificate-per-user-per-event index belongs to the attendance
  // certificate, and a hackathon award is a separate achievement on top of it.
  const certificate = await CertificateModel.create({
    serial: await generateCertificateSerial(),
    verificationToken: randomUUID(),
    eventId: null,
    communityId: community._id,
    userId,
    registrationId: null,
    attendeeName: user.fullName,
    eventTitle: event.title,
    communityName: community.name,
    university: user.profile?.university ?? '',
    type: 'COMPLETION',
    mode: 'STANDARD',
    theme: event.certificateTheme ?? DEFAULT_CERTIFICATE_THEME,
    style: event.certificateStyle ?? 'CLASSIC',
    content: {
      ...baseContent,
      title: award ? 'Certificate of Achievement' : 'Certificate of Participation',
      presentation: !award
        ? `for building "${project}" at`
        : award.place
          ? `for winning ${award.label} with "${project}" at`
          : `for winning the ${award.label.replace(/^Winner: /, '')} track with "${project}" at`,
      message: '',
    },
    eventDate: event.startDate ?? null,
    issuedBy: ctx.actorId,
  });
  submission.certificates.push({ userId: new mongoose.Types.ObjectId(userId), awardId: award?._id ?? null, serial: certificate.serial });

  const headline = award ? `You won ${award.label} at ${event.title}!` : `Your participation certificate for ${event.title} is ready`;
  await createNotification({
    userId,
    type: 'CERTIFICATE_EARNED',
    title: headline,
    body: `${submission.title} · ${community.name}`,
    link: `/certificates/${certificate.serial}`,
  });
  if (user.email) {
    void sendEmail(user.email, certificateEarnedEmail(user.fullName, event.title, community.name, certificateVerificationUrl(certificate.serial))).catch(() => undefined);
  }
  return true;
}

/**
 * Phase 3 rewards: award + (optional) participation certificates, Guild Score for every builder
 * and winner, and a results notification to everyone who submitted. Safe to re-run — certificates
 * are recorded per submission and reputation awards dedupe on (user, type, reference).
 */
async function grantResultRewards(ctx: RewardContext, hackathon: HackathonHydratedDocument, participantCertificates: boolean) {
  const submissions = await HackathonSubmissionModel.find({ eventId: ctx.event._id });
  const teams = await HackathonTeamModel.find({ eventId: ctx.event._id }).select('memberIds').lean();
  const membersByTeam = new Map(teams.map((t) => [t._id.toString(), t.memberIds.map((m) => m.toString())]));
  const rewards = hackathonRewardPolicy(ctx.community.verificationStatus === 'VERIFIED', Boolean(ctx.event.certificateEnabled));
  const certificatesAllowed = rewards.certificates;
  const communityId = ctx.community._id.toString();
  const hubLink = `/events/${ctx.event.slug}/hackathon`;
  let certificates = 0;

  for (const submission of submissions) {
    const members = membersByTeam.get(submission.teamId.toString()) ?? [];
    const awards = hackathon.awards.filter((a) => a.submissionId.toString() === submission._id.toString());

    for (const userId of members) {
      if (rewards.reputation) await awardReputation({
        userId,
        category: 'ATTENDANCE',
        type: 'HACKATHON_SUBMITTED',
        referenceId: submission._id.toString(),
        communityId,
        scoreAwarded: REPUTATION_POINTS.HACKATHON_SUBMITTED,
        description: `Built "${submission.title}" at ${ctx.event.title}`,
      }).catch(() => undefined);

      for (const award of awards) {
        if (rewards.reputation) await awardReputation({
          userId,
          category: 'ATTENDANCE',
          type: 'HACKATHON_WON',
          referenceId: award._id.toString(),
          communityId,
          scoreAwarded: award.place ? (REPUTATION_POINTS.HACKATHON_PLACE[award.place] ?? 0) : REPUTATION_POINTS.HACKATHON_TRACK_WIN,
          description: `${award.label} at ${ctx.event.title} with "${submission.title}"`,
        }).catch(() => undefined);
        if (certificatesAllowed && (await issueCertificate(ctx, submission, userId, award).catch(() => false))) certificates += 1;
      }

      if (certificatesAllowed && participantCertificates && !awards.length) {
        if (await issueCertificate(ctx, submission, userId, null).catch(() => false)) certificates += 1;
      }
      if (!awards.length) {
        await createNotification({
          userId,
          type: 'SYSTEM',
          title: `Results are out for ${ctx.event.title}`,
          body: `Thanks for building "${submission.title}". See the published winners.`,
          link: hubLink,
        });
      }
    }
    if (submission.isModified('certificates')) await submission.save();
  }

  return {
    certificates,
    certificatesSkipped: certificatesAllowed ? '' : !rewards.reputation ? 'Results published without certificates or Guild Score: community verification is required.' : 'Results published without certificates: certificates are switched off for this event.',
  };
}

export async function publishResults(idOrSlug: string, actorId: string, input: { awards?: AwardInput[]; participantCertificates?: boolean }) {
  const { event, hackathon } = await requireHackathonManager(idOrSlug, actorId);
  if (hackathon.resultsPublishedAt) throw new Error('Results are already published');
  const submissions = await HackathonSubmissionModel.find({ eventId: event._id }).select('_id').lean();
  const awards = buildAwards(hackathon, input.awards ?? [], new Set(submissions.map((s) => s._id.toString())));

  const community = await CommunityModel.findById(event.communityId).select('name verificationStatus').lean();
  if (!community) throw new Error('Community not found');

  hackathon.awards = awards as never;
  hackathon.resultsPublishedAt = new Date();
  await hackathon.save();

  const summary = await grantResultRewards({ event, community, actorId }, hackathon, Boolean(input.participantCertificates));
  return { awards: serializeAwards(hackathon), ...summary };
}

/** Saves the winning projects as an article in the host community's Knowledge Hub. */
export async function archiveResultsToKnowledge(idOrSlug: string, actorId: string) {
  const { event, hackathon } = await requireHackathonManager(idOrSlug, actorId);
  if (!hackathon.resultsPublishedAt) throw new Error('Publish the results first');
  if (hackathon.knowledgeResourceId && (await KnowledgeResourceModel.exists({ _id: hackathon.knowledgeResourceId, deletedAt: null }))) {
    throw new Error('The winning projects are already in the Knowledge Hub');
  }

  const [submissions, teams] = await Promise.all([
    HackathonSubmissionModel.find({ eventId: event._id }).sort({ createdAt: 1 }).lean(),
    HackathonTeamModel.find({ eventId: event._id }).lean(),
  ]);
  const teamById = new Map(teams.map((t) => [t._id.toString(), t]));
  const ordered = [...hackathon.awards].sort((a, b) => (a.place ?? 99) - (b.place ?? 99));
  const medal = (place: number | null) => (place === 1 ? '🥇 ' : place === 2 ? '🥈 ' : place === 3 ? '🥉 ' : '🏆 ');

  // Markdown blocks, joined by blank lines; empty optional blocks are dropped.
  const blocks: string[] = [`# ${event.title}: winning projects`, `Results published ${hackathon.resultsPublishedAt.toDateString()}. ${submissions.length} projects were submitted.`];
  for (const award of ordered) {
    const s = submissions.find((x) => x._id.toString() === award.submissionId.toString());
    if (!s) continue;
    const team = teamById.get(s.teamId.toString());
    const members = await publicMembers(team?.memberIds ?? []);
    blocks.push(
      `## ${medal(award.place)}${award.label}: ${s.title}`,
      s.tagline ? `*${s.tagline}*` : '',
      `**Team:** ${team?.name ?? 'Team'} (${members.map((m) => m.fullName).join(', ')})`,
      s.description ? `${s.description.slice(0, 800)}${s.description.length > 800 ? '…' : ''}` : '',
      s.techStack.length ? `**Built with:** ${s.techStack.join(', ')}` : '',
      [s.repoUrl && `[Code](${s.repoUrl})`, s.demoUrl && `[Live demo](${s.demoUrl})`, s.videoUrl && `[Video](${s.videoUrl})`].filter(Boolean).join(' · '),
    );
  }

  const resource = await createKnowledgeResource(event.communityId.toString(), actorId, {
    type: 'ARTICLE',
    category: 'OTHER',
    title: `${event.title}: winning projects`,
    summary: `The winning projects from ${event.title}. Ideas and code for the next edition.`,
    content: blocks.filter(Boolean).join('\n\n'),
  });
  hackathon.knowledgeResourceId = new mongoose.Types.ObjectId(resource._id);
  await hackathon.save();
  return { resourceId: resource._id };
}
