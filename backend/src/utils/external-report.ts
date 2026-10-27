export type ReportRow = { row: number; email: string; minutes: number | null; day: string };
export function normalizeReportEmail(value: string) { return value.trim().toLowerCase(); }
export function parseDuration(value: string): number | null {
  const s = value.trim().toLowerCase();
  if (!s) return null;
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s);
  const clock = /^(\d+):(\d{2})(?::(\d{2}))?$/.exec(s);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]) + Number(clock[3] || 0) / 60;
  if (/^(?:(?:\d+(?:\.\d+)?)\s*[hms]\s*)+$/.test(s)) {
    return Array.from(s.matchAll(/(\d+(?:\.\d+)?)\s*([hms])/g)).reduce((n, m) => n + Number(m[1]) * ({ h: 60, m: 1, s: 1 / 60 }[m[2]]!), 0);
  }
  throw new Error('Duration must be minutes, HH:MM:SS, or a value such as 1h 20m 10s');
}
/** CSV/TSV with quoted separators, escaped quotes and multiline cells. */
export function parseDelimited(text: string): string[][] {
  if (Buffer.byteLength(text, 'utf8') > 2 * 1024 * 1024) throw new Error('Report must be under 2 MB');
  text = text.replace(/^\uFEFF/, '');
  const first = text.split(/\r?\n/).find(l => /email|e-mail/i.test(l)) || text.split(/\r?\n/)[0];
  const delimiter = first.includes('\t') ? '\t' : first.includes(';') && !first.includes(',') ? ';' : ',';
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted;
    } else if (c === delimiter && !quoted) { row.push(cell); cell = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); if (row.some(v => v.trim())) rows.push(row); row = []; cell = '';
      if (rows.length > 10000) throw new Error('Maximum 10,000 report rows');
    } else cell += c;
  }
  if (quoted) throw new Error('Report contains an unclosed quoted field');
  row.push(cell); if (row.some(v => v.trim())) rows.push(row);
  return rows;
}
export function parseExternalReport(text: string): ReportRow[] {
  const table = parseDelimited(text);
  const key = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const emailHeaders = ['email', 'emailaddress', 'attendeeemail', 'useremail', 'participantemail'];
  const headerIndex = table.findIndex(r => r.some(c => emailHeaders.includes(key(c))));
  if (headerIndex < 0) throw new Error('No email column found. Use a CSV with email, minutes (optional), day (YYYY-MM-DD for multi-day events).');
  const headers = table[headerIndex].map(key);
  const emailIdx = headers.findIndex(c => emailHeaders.includes(c));
  const minuteIdx = headers.findIndex(c => ['minutes', 'duration', 'durationminutes', 'attendanceminutes', 'inmeetingduration', 'timeinsessionminutes', 'timeinmeetingminutes'].includes(c));
  const dayIdx = headers.findIndex(c => ['day', 'date', 'attendancedate'].includes(c));
  const rows: ReportRow[] = [];
  for (let i = headerIndex + 1; i < table.length; i++) {
    const r = table[i];
    // Teams exports can contain a subsequent section, which needs a separate import.
    if (r.length === 1 && /^\d+\./.test(r[0].trim())) break;
    if (emailHeaders.includes(key(r[emailIdx] || ''))) continue;
    const email = normalizeReportEmail(r[emailIdx] || '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Invalid or missing email on report row ' + (i + 1) + '. Remove anonymous/summary rows before importing.');
    let minutes: number | null;
    try { minutes = parseDuration(minuteIdx < 0 ? '' : r[minuteIdx] || ''); } catch (e) { throw new Error('Row ' + (i + 1) + ': ' + (e as Error).message); }
    if (minutes !== null && (!Number.isFinite(minutes) || minutes < 0 || minutes > 1440)) throw new Error('Duration must be between 0 and 1440 minutes on row ' + (i + 1));
    const day = dayIdx < 0 ? '' : (r[dayIdx] || '').trim();
    if (day && (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(day)) || new Date(day).toISOString().slice(0, 10) !== day)) throw new Error('Use YYYY-MM-DD dates on row ' + (i + 1));
    rows.push({ row: i + 1, email, minutes, day });
  }
  if (!rows.length || rows.length > 5000) throw new Error('Import between 1 and 5,000 attendees at a time');
  const seen = new Set<string>();
  for (const r of rows) { const k = r.email + ':' + r.day; if (seen.has(k)) throw new Error('Duplicate email/day on row ' + r.row + '. Combine repeated sessions into one duration per attendee per day first.'); seen.add(k); }
  return rows;
}
