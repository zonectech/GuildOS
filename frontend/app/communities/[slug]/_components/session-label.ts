/**
 * Client-side mirror of the backend's session-label rule (defense in depth + instant feedback):
 * two consecutive 4-digit years ("2026/2027", never "2027/2026"), not starting earlier than the
 * current academic year (with a Jan/Feb grace window for schools still using last year's label).
 */
export function validateSessionLabel(label: string): string | null {
  const trimmed = label.trim();
  if (!trimmed) return null;

  const match = /^(\d{4})\/(\d{4})$/.exec(trimmed);
  if (!match) return 'Session must be two consecutive years, e.g. 2026/2027';

  const y1 = Number(match[1]);
  const y2 = Number(match[2]);
  if (y2 !== y1 + 1) return 'Session years must be consecutive and in order, e.g. 2026/2027 (not 2027/2026)';

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const effectiveYear = currentMonth <= 2 ? currentYear - 1 : currentYear;

  if (y1 < effectiveYear) return `Session can't start before ${effectiveYear}/${effectiveYear + 1}. Dissolve the old session instead of backdating a new one`;

  return null;
}
