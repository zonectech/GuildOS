// Pure hackathon rules — no database access, so they're unit-testable in isolation.

export type CriterionLike = { key: string; name: string; weight: number };
export type ScoreLike = { submissionId: string; judgeId: string; scores: Record<string, number> };

/** Registration statuses that make someone a real participant (not pending, waitlisted or cancelled). */
export const PARTICIPANT_STATUSES = ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'COMPLETED', 'PARTIAL_ATTENDANCE'];

export const SCORE_MIN = 1;
export const SCORE_MAX = 10;

// No 0/O or 1/I/L — invite codes get read out loud across a hall.
const INVITE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function randomInviteCode(random: () => number = Math.random, length = 6) {
  let code = '';
  for (let i = 0; i < length; i += 1) code += INVITE_ALPHABET[Math.floor(random() * INVITE_ALPHABET.length)];
  return code;
}

/** Normalizes what a participant typed: case-insensitive, ignores spaces and dashes. */
export function normalizeInviteCode(value: unknown) {
  return String(value ?? '').toUpperCase().replace(/[\s-]/g, '');
}

export type SubmissionWindow = { open: boolean; reason: string };

/**
 * Whether teams can change and projects can be (re)submitted right now. Results being
 * published locks everything; otherwise the optional open/deadline times apply.
 */
export function submissionWindow(
  settings: { submissionOpensAt: Date | null; submissionDeadline: Date | null; resultsPublishedAt: Date | null },
  now = new Date(),
): SubmissionWindow {
  if (settings.resultsPublishedAt) return { open: false, reason: 'Results have been published, so submissions are closed' };
  if (settings.submissionDeadline && now > new Date(settings.submissionDeadline)) {
    return { open: false, reason: 'The submission deadline has passed' };
  }
  if (settings.submissionOpensAt && now < new Date(settings.submissionOpensAt)) {
    return { open: false, reason: 'Submissions are not open yet' };
  }
  return { open: true, reason: '' };
}

/** Teams may form before submissions open — only the deadline / results lock them. */
export function teamsLocked(settings: { submissionDeadline: Date | null; resultsPublishedAt: Date | null }, now = new Date()) {
  if (settings.resultsPublishedAt) return true;
  return Boolean(settings.submissionDeadline && now > new Date(settings.submissionDeadline));
}

/** A judge's weighted score for one submission, on the 1–10 scale. Null if any criterion is missing. */
export function weightedScore(criteria: CriterionLike[], scores: Record<string, number>) {
  const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);
  if (!criteria.length || totalWeight <= 0) return null;
  let sum = 0;
  for (const c of criteria) {
    const value = scores[c.key];
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    sum += value * c.weight;
  }
  return sum / totalWeight;
}

export type LeaderboardRow = {
  submissionId: string;
  /** Mean of the judges' weighted scores (1–10), rounded to 2dp; null while unscored. */
  score: number | null;
  judgeCount: number;
  /** Mean per criterion across judges. */
  byCriterion: Record<string, number>;
  rank: number | null;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Ranks submissions by the mean of each judge's weighted score. Every judge counts equally;
 * incomplete score sheets are ignored. Ties share a rank; unscored projects sort last, unranked.
 */
export function computeLeaderboard(criteria: CriterionLike[], submissionIds: string[], scores: ScoreLike[]): LeaderboardRow[] {
  const rows: LeaderboardRow[] = submissionIds.map((submissionId) => {
    const sheets = scores
      .filter((s) => s.submissionId === submissionId)
      .map((s) => ({ s, weighted: weightedScore(criteria, s.scores) }))
      .filter((entry): entry is { s: ScoreLike; weighted: number } => entry.weighted !== null);
    const byCriterion: Record<string, number> = {};
    for (const c of criteria) {
      byCriterion[c.key] = sheets.length ? round2(sheets.reduce((sum, e) => sum + e.s.scores[c.key], 0) / sheets.length) : 0;
    }
    return {
      submissionId,
      score: sheets.length ? round2(sheets.reduce((sum, e) => sum + e.weighted, 0) / sheets.length) : null,
      judgeCount: sheets.length,
      byCriterion,
      rank: null,
    };
  });

  rows.sort((a, b) => {
    if (a.score === null && b.score === null) return 0;
    if (a.score === null) return 1;
    if (b.score === null) return -1;
    return b.score - a.score;
  });

  let previous: number | null = null;
  let previousRank = 0;
  rows.forEach((row, index) => {
    if (row.score === null) return;
    row.rank = row.score === previous ? previousRank : index + 1;
    previous = row.score;
    previousRank = row.rank;
  });
  return rows;
}

/** Validates one judge's score sheet: every criterion, whole numbers 1–10. */
export function cleanScoreSheet(criteria: CriterionLike[], input: unknown): Record<string, number> {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const sheet: Record<string, number> = {};
  for (const c of criteria) {
    const value = Math.round(Number(raw[c.key]));
    if (!Number.isFinite(value) || value < SCORE_MIN || value > SCORE_MAX) {
      throw new Error(`Score "${c.name}" from ${SCORE_MIN} to ${SCORE_MAX}`);
    }
    sheet[c.key] = value;
  }
  return sheet;
}

/** Stable key from a display name ("Best use of AI" → "best-use-of-ai"), unique within `taken`. */
export function keyFromName(name: string, taken: Set<string>) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'item';
  let key = base;
  let n = 2;
  while (taken.has(key)) key = `${base}-${n++}`;
  taken.add(key);
  return key;
}

/** Accepts only http(s) links; returns '' for blank, throws for anything else. */
export function cleanUrl(value: unknown, label: string) {
  const url = String(value ?? '').trim();
  if (!url) return '';
  if (!/^https?:\/\/\S+$/i.test(url) || url.length > 300) throw new Error(`${label} must be a valid http(s) link`);
  return url;
}

export function placeLabel(place: number) {
  return place === 1 ? '1st Place' : place === 2 ? '2nd Place' : place === 3 ? '3rd Place' : `${place}th Place`;
}

/** Result rewards follow community trust and the organizer's certificate switch. */
export function hackathonRewardPolicy(verified: boolean, certificateEnabled: boolean) {
 return { reputation: verified, certificates: verified && certificateEnabled };
}
