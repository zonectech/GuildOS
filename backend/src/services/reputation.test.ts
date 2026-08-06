import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { computeConsistencyBonus, levelForScore, roleReputation, speakerReputation, REPUTATION_POINTS } from './reputation.service';

describe('levelForScore', () => {
  it('starts everyone at Explorer Guild', () => {
    expect(levelForScore(0)).toEqual({ level: 'Explorer Guild', nextLevelAt: 100 });
    expect(levelForScore(99)).toEqual({ level: 'Explorer Guild', nextLevelAt: 100 });
  });

  it('promotes at exact tier boundaries (inclusive lower bound)', () => {
    expect(levelForScore(100)).toEqual({ level: 'Bronze Guild', nextLevelAt: 500 });
    expect(levelForScore(500)).toEqual({ level: 'Silver Guild', nextLevelAt: 1500 });
    expect(levelForScore(1500)).toEqual({ level: 'Gold Guild', nextLevelAt: 5000 });
    expect(levelForScore(5000)).toEqual({ level: 'Platinum Guild', nextLevelAt: 10000 });
    expect(levelForScore(10000)).toEqual({ level: 'Elite Guild', nextLevelAt: null });
  });

  it('stays one tier below the boundary just under it', () => {
    expect(levelForScore(499)).toEqual({ level: 'Bronze Guild', nextLevelAt: 500 });
    expect(levelForScore(1499)).toEqual({ level: 'Silver Guild', nextLevelAt: 1500 });
    expect(levelForScore(4999)).toEqual({ level: 'Gold Guild', nextLevelAt: 5000 });
    expect(levelForScore(9999)).toEqual({ level: 'Platinum Guild', nextLevelAt: 10000 });
  });

  it('has no ceiling at Elite Guild', () => {
    expect(levelForScore(1_000_000)).toEqual({ level: 'Elite Guild', nextLevelAt: null });
  });

  it('never goes negative-tier for a negative score', () => {
    expect(levelForScore(-50)).toEqual({ level: 'Explorer Guild', nextLevelAt: 100 });
  });
});

describe('computeConsistencyBonus', () => {
  // Freeze "now" to the middle of a month so day-offset math below can never accidentally
  // cross a real calendar-month boundary depending on what day the suite happens to run.
  const FIXED_NOW = new Date('2026-01-15T12:00:00Z');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const daysAgo = (days: number) => new Date(FIXED_NOW.getTime() - days * 24 * 60 * 60 * 1000);

  it('awards no bonus with no completed activity', () => {
    expect(computeConsistencyBonus([])).toBe(0);
  });

  it('awards no bonus below the minimum monthly threshold', () => {
    expect(computeConsistencyBonus([daysAgo(1), daysAgo(2)])).toBe(0);
  });

  it('awards the mid-tier bonus at 3 completions this month', () => {
    expect(computeConsistencyBonus([daysAgo(1), daysAgo(2), daysAgo(3)])).toBe(0.1);
  });

  it('awards the top monthly bonus at 5 completions this month', () => {
    expect(computeConsistencyBonus([daysAgo(1), daysAgo(2), daysAgo(3), daysAgo(4), daysAgo(5)])).toBe(0.2);
  });

  it('awards the semester bonus (0.3) once 10 completions land within ~182 days, overriding the monthly tier', () => {
    // Spread 10 dates well outside the current calendar month but inside the 182-day semester window.
    const dates = Array.from({ length: 10 }, (_, i) => daysAgo(40 + i * 10));
    expect(computeConsistencyBonus(dates)).toBe(0.3);
  });

  it('ignores completions older than the semester window', () => {
    const old = daysAgo(400);
    expect(computeConsistencyBonus([old, old, old, old, old, old, old, old, old, old])).toBe(0);
  });

  it('takes the highest applicable bonus, never stacking monthly + semester', () => {
    // 5 completions this month (would be 0.2) AND 10+ total within the semester (would be 0.3) -> 0.3 wins.
    const thisMonth = Array.from({ length: 5 }, (_, i) => daysAgo(i));
    const olderThisSemester = Array.from({ length: 6 }, (_, i) => daysAgo(40 + i * 10));
    expect(computeConsistencyBonus([...thisMonth, ...olderThisSemester])).toBe(0.3);
  });
});

describe('roleReputation', () => {
  it('matches the GuildOS-controlled point table for each leadership role', () => {
    expect(roleReputation('FOUNDER')).toEqual({ category: 'LEADERSHIP', points: REPUTATION_POINTS.ROLE.FOUNDER });
    expect(roleReputation('PRESIDENT')).toEqual({ category: 'LEADERSHIP', points: REPUTATION_POINTS.ROLE.PRESIDENT });
    expect(roleReputation('MEMBER')).toEqual({ category: 'LEADERSHIP', points: 0 });
  });

  it('categorizes VOLUNTEER separately from leadership roles', () => {
    expect(roleReputation('VOLUNTEER')).toEqual({ category: 'VOLUNTEER', points: REPUTATION_POINTS.ROLE.VOLUNTEER });
  });
});

describe('speakerReputation', () => {
  it('awards more points for a workshop than a panel or guest slot', () => {
    expect(speakerReputation('WORKSHOP')).toBe(REPUTATION_POINTS.SPEAKER_WORKSHOP);
    expect(speakerReputation('PANEL')).toBe(REPUTATION_POINTS.SPEAKER_PANEL);
    expect(speakerReputation('GUEST')).toBe(REPUTATION_POINTS.SPEAKER_PANEL);
    expect(speakerReputation('WORKSHOP')).toBeGreaterThan(speakerReputation('PANEL'));
  });
});
