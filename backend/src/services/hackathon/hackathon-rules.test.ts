import { describe, expect, it } from 'vitest';
import {
  cleanScoreSheet, cleanUrl, computeLeaderboard, keyFromName, normalizeInviteCode,
  randomInviteCode, submissionWindow, teamsLocked, weightedScore,
} from './hackathon-rules';

const criteria = [
  { key: 'innovation', name: 'Innovation', weight: 30 },
  { key: 'technical', name: 'Technical', weight: 30 },
  { key: 'impact', name: 'Impact', weight: 20 },
  { key: 'presentation', name: 'Presentation', weight: 20 },
];
const all = (n: number) => ({ innovation: n, technical: n, impact: n, presentation: n });

describe('weightedScore', () => {
  it('weights criteria and stays on the 1-10 scale', () => {
    expect(weightedScore(criteria, all(7))).toBe(7);
    expect(weightedScore(criteria, { innovation: 10, technical: 10, impact: 0, presentation: 0 })).toBe(6);
  });

  it('returns null when a criterion is missing', () => {
    expect(weightedScore(criteria, { innovation: 9 })).toBeNull();
  });
});

describe('computeLeaderboard', () => {
  it('averages judges equally, ranks ties together and puts unscored last', () => {
    const rows = computeLeaderboard(criteria, ['a', 'b', 'c', 'd'], [
      { submissionId: 'a', judgeId: 'j1', scores: all(8) },
      { submissionId: 'a', judgeId: 'j2', scores: all(6) },
      { submissionId: 'b', judgeId: 'j1', scores: all(7) },
      { submissionId: 'c', judgeId: 'j1', scores: all(9) },
      { submissionId: 'c', judgeId: 'j2', scores: { innovation: 9 } }, // incomplete sheet — ignored
    ]);
    expect(rows.map((r) => r.submissionId)).toEqual(['c', 'a', 'b', 'd']);
    expect(rows[0]).toMatchObject({ score: 9, judgeCount: 1, rank: 1 });
    expect(rows[1]).toMatchObject({ score: 7, rank: 2 });
    expect(rows[2]).toMatchObject({ score: 7, rank: 2 });
    expect(rows[3]).toMatchObject({ score: null, judgeCount: 0, rank: null });
  });
});

describe('cleanScoreSheet', () => {
  it('requires every criterion between 1 and 10', () => {
    expect(cleanScoreSheet(criteria, all(5))).toEqual(all(5));
    expect(() => cleanScoreSheet(criteria, { ...all(5), impact: 11 })).toThrow(/Impact/);
    expect(() => cleanScoreSheet(criteria, { innovation: 5 })).toThrow();
  });
});

describe('submission window', () => {
  const now = new Date('2026-10-24T12:00:00Z');
  const base = { submissionOpensAt: null, submissionDeadline: null, resultsPublishedAt: null };

  it('is open by default and closes after the deadline or results', () => {
    expect(submissionWindow(base, now).open).toBe(true);
    expect(submissionWindow({ ...base, submissionDeadline: new Date('2026-10-24T11:00:00Z') }, now).open).toBe(false);
    expect(submissionWindow({ ...base, submissionOpensAt: new Date('2026-10-24T13:00:00Z') }, now).open).toBe(false);
    expect(submissionWindow({ ...base, resultsPublishedAt: now }, now).open).toBe(false);
  });

  it('lets teams form before submissions open', () => {
    expect(teamsLocked({ ...base, submissionDeadline: new Date('2026-10-25T00:00:00Z') }, now)).toBe(false);
    expect(teamsLocked({ ...base, resultsPublishedAt: now }, now)).toBe(true);
  });
});

describe('helpers', () => {
  it('normalizes invite codes and avoids ambiguous characters', () => {
    expect(normalizeInviteCode(' ab-c 12 ')).toBe('ABC12');
    expect(randomInviteCode()).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
  });

  it('derives unique keys from names', () => {
    const taken = new Set<string>();
    expect(keyFromName('Best use of AI', taken)).toBe('best-use-of-ai');
    expect(keyFromName('Best use of AI!', taken)).toBe('best-use-of-ai-2');
  });

  it('accepts only http(s) links', () => {
    expect(cleanUrl('', 'Repo')).toBe('');
    expect(cleanUrl(' https://github.com/x ', 'Repo')).toBe('https://github.com/x');
    expect(() => cleanUrl('javascript:alert(1)', 'Repo')).toThrow(/Repo/);
  });
});
