import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { assertValidSessionLabel } from './community/community-leader.service';
import { sanitizeNamePlacement } from './community/community-leader-certificate.service';

/**
 * Leadership-stack unit tests (backlog: "Test coverage for the leadership/certificate
 * stack"). Pure-function coverage — the DB-touching flows (dissolve → issue → revoke)
 * are exercised end-to-end by live-test-engagement.ts.
 */

describe('assertValidSessionLabel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Mid-academic-year reference point: October 2026.
    vi.setSystemTime(new Date('2026-10-15T12:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('accepts the current academic session', () => {
    expect(() => assertValidSessionLabel('2026/2027')).not.toThrow();
  });

  it('accepts future sessions', () => {
    expect(() => assertValidSessionLabel('2027/2028')).not.toThrow();
  });

  it('trims surrounding whitespace', () => {
    expect(() => assertValidSessionLabel('  2026/2027  ')).not.toThrow();
  });

  it('rejects malformed labels', () => {
    for (const bad of ['2026', '2026-2027', '26/27', 'freshman year', '2026/27']) {
      expect(() => assertValidSessionLabel(bad)).toThrow(/two consecutive years/);
    }
  });

  it('rejects non-consecutive years', () => {
    expect(() => assertValidSessionLabel('2026/2028')).toThrow(/consecutive/);
  });

  it('rejects reversed years', () => {
    expect(() => assertValidSessionLabel('2027/2026')).toThrow(/consecutive/);
  });

  it('rejects backdated sessions', () => {
    expect(() => assertValidSessionLabel('2024/2025')).toThrow(/dissolve the old session/);
    expect(() => assertValidSessionLabel('2025/2026')).toThrow(/dissolve the old session/);
  });

  it('grace window: last year\u2019s label is still valid through January/February', () => {
    vi.setSystemTime(new Date('2027-01-20T12:00:00Z'));
    expect(() => assertValidSessionLabel('2026/2027')).not.toThrow();
    // …but not from March onward.
    vi.setSystemTime(new Date('2027-03-05T12:00:00Z'));
    expect(() => assertValidSessionLabel('2026/2027')).toThrow(/dissolve the old session/);
  });
});

describe('sanitizeNamePlacement', () => {
  it('returns the event-certificate defaults when nothing is provided', () => {
    expect(sanitizeNamePlacement(undefined)).toEqual({ x: 50, y: 55, fontSize: 6, color: '#111111', align: 'center' });
  });

  it('passes through valid values untouched', () => {
    expect(sanitizeNamePlacement({ x: 30, y: 72, fontSize: 8, color: '#8b0000', align: 'left' })).toEqual({ x: 30, y: 72, fontSize: 8, color: '#8b0000', align: 'left' });
  });

  it('clamps out-of-range coordinates and font size', () => {
    const result = sanitizeNamePlacement({ x: 999, y: -5, fontSize: 100 });
    expect(result.x).toBe(100);
    expect(result.y).toBe(0);
    expect(result.fontSize).toBe(20);
    const tiny = sanitizeNamePlacement({ fontSize: 0.5 });
    expect(tiny.fontSize).toBe(2);
  });

  it('rejects non-hex colours (XSS-ish payloads fall back to default ink)', () => {
    for (const bad of ['javascript:alert(1)', 'red', 'url(evil)', '#zzz', '']) {
      expect(sanitizeNamePlacement({ color: bad }).color).toBe('#111111');
    }
    expect(sanitizeNamePlacement({ color: '#abc' }).color).toBe('#abc');
    expect(sanitizeNamePlacement({ color: '#AABBCCDD' }).color).toBe('#AABBCCDD');
  });

  it('whitelists alignment', () => {
    expect(sanitizeNamePlacement({ align: 'left' }).align).toBe('left');
    expect(sanitizeNamePlacement({ align: 'right' }).align).toBe('right');
    expect(sanitizeNamePlacement({ align: 'diagonal' as never }).align).toBe('center');
  });

  it('treats NaN and non-numeric input as the defaults', () => {
    const result = sanitizeNamePlacement({ x: Number.NaN, y: 'abc' as never, fontSize: undefined });
    expect(result).toEqual({ x: 50, y: 55, fontSize: 6, color: '#111111', align: 'center' });
  });
});
