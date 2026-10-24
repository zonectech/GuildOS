const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    credentials: 'include',
    ...init,
  });
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(payload?.error || 'Request failed');
  return payload;
}

const json = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) });
const base = (event: string) => `/api/hackathons/${encodeURIComponent(event)}`;

export type HackathonTrack = { key: string; name: string; description: string; prize: string };
export type HackathonCriterion = { key: string; name: string; weight: number };

export type HackathonSettings = {
  teamSizeMin: number;
  teamSizeMax: number;
  submissionOpensAt: string | null;
  submissionDeadline: string | null;
  tracks: HackathonTrack[];
  criteria: HackathonCriterion[];
  judgeCount: number;
  resultsPublishedAt: string | null;
  submissionsOpen: boolean;
  submissionsClosedReason: string;
  teamsLocked: boolean;
};

export type HackathonMember = { id: string; fullName: string; username: string; avatar: string };

export type HackathonTeam = {
  id: string;
  name: string;
  captainId: string;
  members: HackathonMember[];
  inviteCode?: string;
};

export type HackathonSubmission = {
  id: string;
  teamId: string;
  title: string;
  tagline: string;
  description: string;
  repoUrl: string;
  demoUrl: string;
  videoUrl: string;
  images: string[];
  techStack: string[];
  trackKeys: string[];
  createdAt: string;
  updatedAt: string;
};

export type GallerySubmission = HackathonSubmission & { teamName: string; members: HackathonMember[] };

export type HackathonAward = { id: string; submissionId: string; place: number | null; trackKey: string; label: string };

export type LeaderboardRow = {
  submissionId: string;
  score: number | null;
  judgeCount: number;
  byCriterion: Record<string, number>;
  rank: number | null;
};

export type HackathonHub = {
  event: { id: string; slug: string; title: string; bannerImage: string; communityId: string; status: string; startDate: string | null; endDate: string | null };
  settings: HackathonSettings;
  teamCount: number;
  submissions: GallerySubmission[];
  awards: HackathonAward[];
  leaderboard: LeaderboardRow[] | null;
  viewer: {
    signedIn: boolean;
    isParticipant: boolean;
    canManage: boolean;
    team: HackathonTeam | null;
    submission: HackathonSubmission | null;
  };
};

export type SubmissionInput = Partial<Pick<HackathonSubmission, 'title' | 'tagline' | 'description' | 'repoUrl' | 'demoUrl' | 'videoUrl' | 'images' | 'techStack' | 'trackKeys'>>;

export function getHackathonHub(event: string) {
  return requestJson<HackathonHub>(base(event));
}

export function createHackathonTeam(event: string, name: string) {
  return requestJson<{ team: HackathonTeam }>(`${base(event)}/teams`, json('POST', { name }));
}

export function joinHackathonTeam(event: string, inviteCode: string) {
  return requestJson<{ team: HackathonTeam }>(`${base(event)}/teams/join`, json('POST', { inviteCode }));
}

export function leaveHackathonTeam(event: string) {
  return requestJson<{ left: boolean; teamDeleted: boolean }>(`${base(event)}/teams/leave`, json('POST'));
}

export function renameHackathonTeam(event: string, name: string) {
  return requestJson<{ team: HackathonTeam }>(`${base(event)}/teams/mine`, json('PATCH', { name }));
}

export function removeHackathonTeamMember(event: string, memberId: string) {
  return requestJson<{ team: HackathonTeam }>(`${base(event)}/teams/mine/remove`, json('POST', { memberId }));
}

export function saveHackathonSubmission(event: string, input: SubmissionInput) {
  return requestJson<{ submission: HackathonSubmission }>(`${base(event)}/submission`, json('PUT', input));
}

// ── Organizers ────────────────────────────────────────────────────────────────

export type HackathonJudge = { id: string; name: string; email: string; hasAccount: boolean; link: string; scoredCount: number };

export type HackathonManage = {
  event: { id: string; slug: string; title: string; status: string };
  community: { name: string; slug: string; verified: boolean };
  settings: HackathonSettings;
  judges: HackathonJudge[];
  teams: Array<{ id: string; name: string; members: HackathonMember[]; submissionId: string | null }>;
  submissions: Array<HackathonSubmission & { teamName: string }>;
  leaderboard: LeaderboardRow[];
  awards: HackathonAward[];
  knowledgeResourceId: string | null;
};

export type SettingsInput = Partial<{
  teamSizeMin: number;
  teamSizeMax: number;
  submissionOpensAt: string | null;
  submissionDeadline: string | null;
  tracks: Array<Partial<HackathonTrack>>;
  criteria: Array<Partial<HackathonCriterion>>;
}>;

export type AwardPick = { submissionId: string; place?: number | null; trackKey?: string };

export function getHackathonManage(event: string) {
  return requestJson<HackathonManage>(`${base(event)}/manage`);
}

export function updateHackathonSettings(event: string, input: SettingsInput) {
  return requestJson<{ settings: HackathonSettings }>(`${base(event)}/settings`, json('PATCH', input));
}

export function addHackathonJudge(event: string, input: { name?: string; email?: string; userId?: string }) {
  return requestJson<{ judge: HackathonJudge }>(`${base(event)}/judges`, json('POST', input));
}

export function removeHackathonJudge(event: string, judgeId: string) {
  return requestJson<{ removed: boolean }>(`${base(event)}/judges/${encodeURIComponent(judgeId)}`, json('DELETE'));
}

export function publishHackathonResults(event: string, input: { awards: AwardPick[]; participantCertificates: boolean }) {
  return requestJson<{ awards: HackathonAward[]; certificates: number; certificatesSkipped: string }>(`${base(event)}/results`, json('POST', input));
}

export function archiveHackathonToKnowledge(event: string) {
  return requestJson<{ resourceId: string }>(`${base(event)}/results/archive`, json('POST'));
}

export function addHackathonPlaybook(event: string) {
  return requestJson<{ created: number; alreadyPresent: number }>(`${base(event)}/playbook`, json('POST'));
}

// ── Judges ────────────────────────────────────────────────────────────────────

export type JudgeSubmission = HackathonSubmission & {
  teamName: string;
  memberCount: number;
  myScores: Record<string, number> | null;
  myComment: string;
};

export type JudgeView = {
  event: { title: string; slug: string; bannerImage: string };
  judge: { name: string };
  criteria: HackathonCriterion[];
  tracks: HackathonTrack[];
  resultsPublished: boolean;
  submissions: JudgeSubmission[];
};

export function getJudgeView(token: string) {
  return requestJson<JudgeView>(`/api/hackathons/judge/${encodeURIComponent(token)}`);
}

export function scoreHackathonSubmission(token: string, submissionId: string, input: { scores: Record<string, number>; comment: string }) {
  return requestJson<{ scores: Record<string, number>; comment: string }>(
    `/api/hackathons/judge/${encodeURIComponent(token)}/scores/${encodeURIComponent(submissionId)}`,
    json('PUT', input),
  );
}

/** "1st Place" → 🥇 etc. Track wins get a trophy. */
export function awardIcon(award: Pick<HackathonAward, 'place'>) {
  return award.place === 1 ? '🥇' : award.place === 2 ? '🥈' : award.place === 3 ? '🥉' : '🏆';
}
