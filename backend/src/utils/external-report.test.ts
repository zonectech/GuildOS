import { describe, it, expect } from 'vitest';
import { parseExternalReport, parseDuration, parseDelimited } from './external-report';
describe('external report parsing', () => {
  it('matches case-insensitive emails and quoted commas without shifting columns', () => {
    expect(parseExternalReport('Name,Email,Minutes\r\n"Ada, Jane", ADA@SCHOOL.EDU ,65')).toEqual([{ row: 2, email: 'ada@school.edu', minutes: 65, day: '' }]);
  });
  it('reads Teams-style TSV sections and durations', () => {
    const report = '1. Summary\nAttended participants\t1\n2. Participants\nName\tEmail\tIn-meeting duration\nAda\tada@school.edu\t1h 20m 30s\n3. In-Meeting Activities\nanything';
    expect(parseExternalReport(report)[0].minutes).toBe(80.5);
  });
  it('handles BOMs, semicolon CSV, escaped quotes and multiline cells', () => {
    expect(parseExternalReport('\uFEFFName;Email;Minutes;Day\n"Ada ""Jane""\nSmith";ada@school.edu;45;2026-10-20')[0]).toMatchObject({ email: 'ada@school.edu', minutes: 45, day: '2026-10-20' });
  });
  it('keeps missing duration distinct from zero', () => {
    expect(parseExternalReport('email,minutes\na@b.com,')[0].minutes).toBeNull();
    expect(parseExternalReport('email,minutes\na@b.com,0')[0].minutes).toBe(0);
  });
  it('rejects duplicate sessions instead of inflating attendance', () => {
    expect(() => parseExternalReport('Email,Minutes\nA@B.com,20\na@b.com,30')).toThrow(/Duplicate/);
  });
  it('accepts the same member on distinct days', () => {
    expect(parseExternalReport('email,day\na@b.com,2026-10-20\na@b.com,2026-10-21')).toHaveLength(2);
  });
  it.each(['-1', 'NaN', '1441', 'unknown'])('rejects invalid durations: %s', value => {
    expect(() => parseExternalReport('email,minutes\na@b.com,' + value)).toThrow();
  });
  it('rejects invalid dates, missing emails and malformed quoting', () => {
    expect(() => parseExternalReport('email,day\na@b.com,2026-02-30')).toThrow(/YYYY/);
    expect(() => parseExternalReport('Name,Email\nAda,')).toThrow(/email/);
    expect(() => parseDelimited('"unterminated')).toThrow(/unclosed/);
  });
  it('parses hours, minutes and seconds without rounding up eligibility', () => {
    expect(parseDuration('00:59:59')).toBeCloseTo(59.9833, 3);
    expect(parseDuration('20s')).toBeCloseTo(1/3);
  });
});
