/**
 * Live test — Hackathon mode (teams, submissions, judging, results).
 *
 * Exercises against the LIVE backend API (http://localhost:3001):
 *   participants-only teams → invite codes + size cap → submissions + validation →
 *   token-link judging → weighted leaderboard → publish results (award + participation
 *   certificates, Guild Score) → everything locks → Knowledge Hub archive → organizer
 *   playbook (idempotent) → hackathon projects on the CV.
 *
 * Run:  npx tsx --env-file=.env live-test-hackathon.ts
 */
import './src/config';
import crypto from 'node:crypto';
import { connectDatabase } from './src/db';
import { createToken } from './src/utils/token';
import { UserModel } from './src/models/user.model';
import { CommunityModel } from './src/models/community.model';
import { MembershipModel } from './src/models/membership.model';
import { EventModel } from './src/models/event.model';
import { EventRegistrationModel } from './src/models/event-registration.model';
import { CertificateModel } from './src/models/certificate.model';
import { KnowledgeResourceModel } from './src/models/knowledge-resource.model';
import { ReputationActivityModel } from './src/models/reputation-activity.model';
import { ReputationScoreModel } from './src/models/reputation-score.model';
import { NotificationModel } from './src/models/notification.model';
import { HackathonModel } from './src/models/hackathon.model';
import { HackathonTeamModel } from './src/models/hackathon-team.model';
import { HackathonSubmissionModel } from './src/models/hackathon-submission.model';
import { HackathonScoreModel } from './src/models/hackathon-score.model';
import { listUserHackathonProjects } from './src/services/hackathon/hackathon-profile.service';

const BASE = process.env.SMOKE_BASE ?? 'http://localhost:3001';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    passed += 1;
    console.log(`  \x1b[32mPASS\x1b[0m  ${name}`);
  } else {
    failed += 1;
    failures.push(name);
    console.log(`  \x1b[31mFAIL\x1b[0m  ${name}${detail !== undefined ? `  ->  ${JSON.stringify(detail)}` : ''}`);
  }
}

type ApiResult = { status: number; json: any };
async function api(method: string, path: string, token?: string, body?: unknown): Promise<ApiResult> {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* no body */
  }
  return { status: res.status, json };
}

async function makeUser(fullName: string): Promise<string> {
  const rnd = crypto.randomBytes(6).toString('hex');
  const user = await UserModel.create({
    fullName,
    email: `hk-${rnd}@hktest.local`,
    passwordHash: crypto.randomBytes(16).toString('hex'),
    passwordSalt: crypto.randomBytes(16).toString('hex'),
    role: 'STUDENT',
    status: 'ACTIVE',
    emailVerified: true,
    profile: { username: `hk_${rnd}`, university: 'HK Test University' },
  } as any);
  return user._id.toString();
}

async function main() {
  console.log(`\n=== GuildOS Hackathon live test :: ${BASE} ===\n`);
  await connectDatabase();

  const health = await api('GET', '/api/communities');
  if (health.status !== 200) {
    console.error(`Backend not reachable at ${BASE}. Is the dev server running?`);
    process.exit(1);
  }

  const stamp = Date.now();
  const names = ['Organizer', 'Ada', 'Bayo', 'Chidi', 'Dami', 'Efe', 'Femi', 'Gbenga', 'Outsider'];
  const ids: Record<string, string> = {};
  for (const name of names) ids[name] = await makeUser(`HK ${name}`);
  const userIds = Object.values(ids);
  const tok = Object.fromEntries(
    names.map((n) => [n, createToken({ sub: ids[n], purpose: 'access', jti: `hk-${n}-${stamp}` } as any, 3600_000)]),
  ) as Record<string, string>;

  const community = await CommunityModel.create({
    name: `HK Guild ${stamp}`,
    normalizedName: `hk guild ${stamp}`,
    slug: `hk-guild-${stamp}`,
    shortDescription: 'Hackathon test community.',
    logo: '/uploads/demo-org-logo.svg',
    coverImage: '/uploads/hk-cover.png',
    category: 'TECH',
    university: 'HK Test University',
    visibility: 'PUBLIC',
    verificationStatus: 'VERIFIED',
    verificationMethod: 'MANUAL',
    verifiedBy: ids.Organizer,
    verifiedAt: new Date(),
    founder: ids.Organizer,
    memberCount: 1,
  });
  await MembershipModel.create({ userId: ids.Organizer, communityId: community._id, role: 'FOUNDER', status: 'ACTIVE', assignedBy: ids.Organizer });

  const baseEvent = {
    communityId: community._id,
    createdBy: ids.Organizer,
    status: 'PUBLISHED',
    visibility: 'PUBLIC',
    startDate: new Date(Date.now() - 3600_000),
    endDate: new Date(Date.now() + 86_400_000),
  };
  const event = await EventModel.create({ ...baseEvent, title: `HK Hack ${stamp}`, slug: `hk-hack-${stamp}`, type: 'HACKATHON' });
  const workshop = await EventModel.create({ ...baseEvent, title: `HK Workshop ${stamp}`, slug: `hk-workshop-${stamp}`, type: 'WORKSHOP' });
  const eventId = event._id.toString();
  for (const n of ['Ada', 'Bayo', 'Chidi', 'Dami', 'Efe', 'Femi', 'Gbenga']) {
    await EventRegistrationModel.create({ eventId, userId: ids[n], status: 'CONFIRMED', qrToken: `hk-${n}-${stamp}` });
  }

  const H = `/api/hackathons/${eventId}`;
  try {
    // ── Hub + guards ──────────────────────────────────────────────────────────
    const hub = await api('GET', `/api/hackathons/${event.slug}`);
    check('public hub loads by slug (no login)', hub.status === 200 && hub.json?.settings?.teamSizeMax === 4, hub.json);
    check('default judging criteria are set', hub.json?.settings?.criteria?.length === 4, hub.json?.settings);
    const notHack = await api('GET', `/api/hackathons/${workshop._id}`);
    check('non-hackathon event is rejected', notHack.status === 400, notHack.json);

    const outsiderTeam = await api('POST', `${H}/teams`, tok.Outsider, { name: 'Gatecrashers' });
    check('unregistered user cannot create a team', outsiderTeam.status === 400 && /Register/.test(outsiderTeam.json?.error), outsiderTeam.json);

    const notManager = await api('PATCH', `${H}/settings`, tok.Ada, { teamSizeMax: 2 });
    check('participant cannot change settings -> 403', notManager.status === 403, notManager.json);

    const settings = await api('PATCH', `${H}/settings`, tok.Organizer, {
      teamSizeMin: 1,
      teamSizeMax: 3,
      tracks: [{ name: 'Best use of AI', prize: '₦50,000' }],
    });
    const aiTrack = settings.json?.settings?.tracks?.[0]?.key;
    check('organizer sets team size + a prize track', settings.status === 200 && aiTrack === 'best-use-of-ai', settings.json);
    const badSize = await api('PATCH', `${H}/settings`, tok.Organizer, { teamSizeMin: 4, teamSizeMax: 2 });
    check('min > max team size is rejected', badSize.status === 400, badSize.json);

    // ── Teams ─────────────────────────────────────────────────────────────────
    const created = await api('POST', `${H}/teams`, tok.Ada, { name: 'Lagos Hackers' });
    const code: string = created.json?.team?.inviteCode ?? '';
    check('participant creates a team with an invite code', created.status === 200 && code.length === 6, created.json);
    const twice = await api('POST', `${H}/teams`, tok.Ada, { name: 'Another' });
    check('cannot be on two teams', twice.status === 400, twice.json);

    const joinB = await api('POST', `${H}/teams/join`, tok.Bayo, { inviteCode: ` ${code.slice(0, 3).toLowerCase()}-${code.slice(3)} ` });
    check('invite code is case/space/dash-insensitive', joinB.status === 200 && joinB.json?.team?.members?.length === 2, joinB.json);
    const joinC = await api('POST', `${H}/teams/join`, tok.Chidi, { inviteCode: code });
    check('third member joins', joinC.status === 200 && joinC.json?.team?.members?.length === 3, joinC.json);
    const joinD = await api('POST', `${H}/teams/join`, tok.Dami, { inviteCode: code });
    check('team size cap enforced', joinD.status === 400 && /full/.test(joinD.json?.error), joinD.json);
    const badCode = await api('POST', `${H}/teams/join`, tok.Dami, { inviteCode: 'ZZZZZZ' });
    check('unknown invite code -> 404', badCode.status === 404, badCode.json);
    const notCaptain = await api('POST', `${H}/teams/mine/remove`, tok.Bayo, { memberId: ids.Chidi });
    check('only the captain removes members -> 403', notCaptain.status === 403, notCaptain.json);

    // Dami forms a team and leaves — last member out deletes the team.
    await api('POST', `${H}/teams`, tok.Dami, { name: 'Temporary' });
    const leave = await api('POST', `${H}/teams/leave`, tok.Dami);
    check('last member leaving deletes the team', leave.status === 200 && leave.json?.teamDeleted === true, leave.json);

    // ── Submissions ───────────────────────────────────────────────────────────
    const badUrl = await api('PUT', `${H}/submission`, tok.Bayo, { title: 'FarmLink', repoUrl: 'javascript:alert(1)' });
    check('non-http(s) repo link is rejected', badUrl.status === 400, badUrl.json);
    const submitA = await api('PUT', `${H}/submission`, tok.Bayo, {
      title: 'FarmLink',
      tagline: 'Connecting farmers to buyers',
      description: 'An SMS marketplace for smallholder farmers.',
      repoUrl: 'https://github.com/example/farmlink',
      techStack: ['Node.js', 'Twilio', 'Node.js'],
      trackKeys: [aiTrack, 'not-a-track'],
    });
    check('any team member can submit; tracks and tech stack are cleaned', submitA.status === 200
      && submitA.json?.submission?.techStack?.length === 2 && submitA.json?.submission?.trackKeys?.length === 1, submitA.json);
    const resubmit = await api('PUT', `${H}/submission`, tok.Ada, { title: 'FarmLink v2', repoUrl: 'https://github.com/example/farmlink' });
    check('re-submitting updates the same project', resubmit.status === 200 && resubmit.json?.submission?.id === submitA.json?.submission?.id, resubmit.json);

    await api('POST', `${H}/teams`, tok.Efe, { name: 'Solo Efe' });
    const submitE = await api('PUT', `${H}/submission`, tok.Efe, { title: 'MedAI', trackKeys: [aiTrack], demoUrl: 'https://medai.example.com' });
    check('solo builder submits as a team of one', submitE.status === 200, submitE.json);
    await api('POST', `${H}/teams`, tok.Femi, { name: 'Femi & Gbenga' });
    const femiTeam = await HackathonTeamModel.findOne({ eventId, memberIds: ids.Femi }).lean();
    await api('POST', `${H}/teams/join`, tok.Gbenga, { inviteCode: femiTeam?.inviteCode });
    const submitF = await api('PUT', `${H}/submission`, tok.Gbenga, { title: 'CampusRide' });
    check('third project submitted', submitF.status === 200, submitF.json);
    const projectA = submitA.json?.submission?.id;
    const projectE = submitE.json?.submission?.id;
    const projectF = submitF.json?.submission?.id;

    const gallery = await api('GET', H);
    check('gallery is public right away (3 projects)', gallery.json?.submissions?.length === 3, gallery.json?.submissions?.length);
    const viewer = await api('GET', H, tok.Bayo);
    check('participant sees their own team + invite code', viewer.json?.viewer?.team?.inviteCode === code && viewer.json?.viewer?.submission?.title === 'FarmLink v2', viewer.json?.viewer);
    check('invite codes never leak to the public gallery', !JSON.stringify(gallery.json).includes(code));

    // ── Judging ───────────────────────────────────────────────────────────────
    const j1 = await api('POST', `${H}/judges`, tok.Organizer, { name: 'Judge One' });
    const j2 = await api('POST', `${H}/judges`, tok.Organizer, { name: 'Judge Two' });
    const token1 = String(j1.json?.judge?.link ?? '').split('/').pop() ?? '';
    const token2 = String(j2.json?.judge?.link ?? '').split('/').pop() ?? '';
    check('organizer adds judges with private links', j1.status === 200 && token1.length === 48 && token2.length === 48, j1.json);
    check('judge links are not on the public hub', !JSON.stringify((await api('GET', H)).json).includes(token1));

    const judgeView = await api('GET', `/api/hackathons/judge/${token1}`);
    check('judge page loads from the link alone', judgeView.status === 200 && judgeView.json?.submissions?.length === 3, judgeView.json);
    const badJudge = await api('GET', `/api/hackathons/judge/${'0'.repeat(48)}`);
    check('unknown judge link -> 404', badJudge.status === 404, badJudge.json);

    const sheet = (n: number) => ({ innovation: n, technical: n, impact: n, presentation: n });
    const incomplete = await api('PUT', `/api/hackathons/judge/${token1}/scores/${projectA}`, undefined, { scores: { innovation: 9 } });
    check('incomplete score sheet is rejected', incomplete.status === 400, incomplete.json);
    const outOfRange = await api('PUT', `/api/hackathons/judge/${token1}/scores/${projectA}`, undefined, { scores: { ...sheet(9), impact: 11 } });
    check('scores above 10 are rejected', outOfRange.status === 400, outOfRange.json);
    await api('PUT', `/api/hackathons/judge/${token1}/scores/${projectA}`, undefined, { scores: sheet(9), comment: 'Great demo' });
    await api('PUT', `/api/hackathons/judge/${token2}/scores/${projectA}`, undefined, { scores: sheet(7) });
    await api('PUT', `/api/hackathons/judge/${token1}/scores/${projectE}`, undefined, { scores: sheet(6) });
    const rescore = await api('PUT', `/api/hackathons/judge/${token1}/scores/${projectF}`, undefined, { scores: sheet(3) });
    await api('PUT', `/api/hackathons/judge/${token1}/scores/${projectF}`, undefined, { scores: sheet(5) });
    check('judge can score and re-score', rescore.status === 200, rescore.json);

    const manage = await api('GET', `${H}/manage`, tok.Organizer);
    const board = manage.json?.leaderboard ?? [];
    check('leaderboard ranks by mean weighted score', board[0]?.submissionId === projectA && board[0]?.score === 8 && board[0]?.judgeCount === 2, board);
    check('re-score replaced the old sheet', board.find((r: any) => r.submissionId === projectF)?.score === 5, board);
    check('judge progress is tracked', manage.json?.judges?.find((j: any) => j.name === 'Judge One')?.scoredCount === 3, manage.json?.judges);
    const outsiderManage = await api('GET', `${H}/manage`, tok.Ada);
    check('participants cannot open the organizer dashboard -> 403', outsiderManage.status === 403, outsiderManage.json);

    const addCriterion = await api('PATCH', `${H}/settings`, tok.Organizer, {
      criteria: [...manage.json.settings.criteria, { name: 'Design', weight: 10 }],
    });
    check('cannot add criteria once judging started', addCriterion.status === 400, addCriterion.json);
    const renameCriterion = await api('PATCH', `${H}/settings`, tok.Organizer, {
      criteria: manage.json.settings.criteria.map((c: any) => (c.key === 'impact' ? { ...c, name: 'Social impact' } : c)),
    });
    check('can rename a criterion mid-judging', renameCriterion.status === 200, renameCriterion.json);

    // ── Results (Phase 3) ─────────────────────────────────────────────────────
    const dupPlace = await api('POST', `${H}/results`, tok.Organizer, { awards: [{ submissionId: projectA, place: 1 }, { submissionId: projectE, place: 1 }] });
    check('two projects cannot share 1st place', dupPlace.status === 400, dupPlace.json);
    const publish = await api('POST', `${H}/results`, tok.Organizer, {
      awards: [{ submissionId: projectA, place: 1 }, { submissionId: projectE, trackKey: aiTrack }],
      participantCertificates: true,
    });
    // Team A (3 members, 1st) + Efe (track) + participation for Femi & Gbenga = 6 certificates.
    check('publish issues award + participation certificates', publish.status === 200 && publish.json?.certificates === 6, publish.json);

    const certs = await CertificateModel.find({ userId: { $in: userIds }, communityId: community._id }).lean();
    const adaCert = certs.find((c) => c.userId?.toString() === ids.Ada);
    check('winner certificate says 1st Place', adaCert?.content?.title === 'Certificate of Achievement' && /1st Place/.test(adaCert?.content?.presentation ?? ''), adaCert?.content);
    const femiCert = certs.find((c) => c.userId?.toString() === ids.Femi);
    check('non-winner gets a participation certificate', femiCert?.content?.title === 'Certificate of Participation', femiCert?.content);

    const rep = await ReputationActivityModel.find({ userId: { $in: userIds }, type: { $in: ['HACKATHON_SUBMITTED', 'HACKATHON_WON'] } }).lean();
    check('every builder earns HACKATHON_SUBMITTED (6)', rep.filter((r) => r.type === 'HACKATHON_SUBMITTED').length === 6, rep.length);
    const adaWin = rep.find((r) => r.type === 'HACKATHON_WON' && r.userId.toString() === ids.Ada);
    check('1st place earns 100 Guild Score per member', adaWin?.scoreAwarded === 100, adaWin);
    const efeWin = rep.find((r) => r.type === 'HACKATHON_WON' && r.userId.toString() === ids.Efe);
    check('track win earns 50', efeWin?.scoreAwarded === 50, efeWin);

    const notified = await NotificationModel.countDocuments({ userId: { $in: [ids.Femi, ids.Gbenga] }, title: /Results are out/ });
    check('non-winners are told results are out', notified === 2, notified);

    const publicResults = await api('GET', H);
    check('results + leaderboard are public once published', publicResults.json?.awards?.length === 2 && publicResults.json?.leaderboard?.[0]?.rank === 1, publicResults.json?.awards);

    const again = await api('POST', `${H}/results`, tok.Organizer, { awards: [{ submissionId: projectA, place: 1 }] });
    check('results can only be published once', again.status === 400, again.json);
    const lateSubmit = await api('PUT', `${H}/submission`, tok.Ada, { title: 'Too late' });
    check('submissions lock after results', lateSubmit.status === 400, lateSubmit.json);
    const lateScore = await api('PUT', `/api/hackathons/judge/${token2}/scores/${projectE}`, undefined, { scores: sheet(10) });
    check('scores are final after results', lateScore.status === 400, lateScore.json);
    const lateLeave = await api('POST', `${H}/teams/leave`, tok.Chidi);
    check('teams lock after results', lateLeave.status === 400, lateLeave.json);

    // ── Knowledge Hub + playbook + CV ─────────────────────────────────────────
    const archive = await api('POST', `${H}/results/archive`, tok.Organizer);
    const article = archive.json?.resourceId ? await KnowledgeResourceModel.findById(archive.json.resourceId).lean() : null;
    check('winning projects saved to the Knowledge Hub', archive.status === 200 && /1st Place: FarmLink v2/.test(article?.content ?? ''), archive.json);
    const archiveAgain = await api('POST', `${H}/results/archive`, tok.Organizer);
    check('archive is one-time', archiveAgain.status === 400, archiveAgain.json);

    const playbook = await api('POST', `${H}/playbook`, tok.Organizer);
    check('organizer playbook adds 3 articles', playbook.status === 200 && playbook.json?.created === 3, playbook.json);
    const playbookAgain = await api('POST', `${H}/playbook`, tok.Organizer);
    check('playbook is idempotent', playbookAgain.json?.created === 0 && playbookAgain.json?.alreadyPresent === 3, playbookAgain.json);

    const cvProjects = await listUserHackathonProjects(ids.Chidi);
    check('hackathon project + award appear for the CV', cvProjects[0]?.title === 'FarmLink v2' && cvProjects[0]?.awards?.[0] === '1st Place' && cvProjects[0]?.teamSize === 3, cvProjects);
  } finally {
    await HackathonScoreModel.deleteMany({ eventId });
    await HackathonSubmissionModel.deleteMany({ eventId });
    await HackathonTeamModel.deleteMany({ eventId });
    await HackathonModel.deleteMany({ eventId });
    await EventRegistrationModel.deleteMany({ eventId });
    await EventModel.deleteMany({ _id: { $in: [event._id, workshop._id] } });
    await CertificateModel.deleteMany({ communityId: community._id });
    await KnowledgeResourceModel.deleteMany({ communityId: community._id });
    await MembershipModel.deleteMany({ communityId: community._id });
    await CommunityModel.deleteMany({ _id: community._id });
    await ReputationActivityModel.deleteMany({ userId: { $in: userIds } });
    await ReputationScoreModel.deleteMany({ userId: { $in: userIds } });
    await NotificationModel.deleteMany({ userId: { $in: userIds } });
    await UserModel.deleteMany({ _id: { $in: userIds } });
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) {
    console.log('Failures:\n' + failures.map((f) => `  - ${f}`).join('\n'));
    process.exit(1);
  }
  process.exit(0);
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
