// Date fields in the event form are typed in the event's timezone, not the phone's.
export const EVENT_TZ = 'Africa/Lagos';

/** Minutes the zone is ahead of UTC at that moment (Lagos is +60, all year). */
function offsetMinutes(timeZone: string, at: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(at).map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
  return Math.round((asUtc - at.getTime()) / 60000);
}

/** "2026-11-14T10:00" typed in the zone, as a real instant. */
export function zonedToIso(local: string, timeZone = EVENT_TZ) {
  if (!local) return '';
  const guess = Date.parse(`${local.length === 10 ? `${local}T00:00` : local}:00Z`);
  if (Number.isNaN(guess)) return '';
  return new Date(guess - offsetMinutes(timeZone, new Date(guess)) * 60000).toISOString();
}

/** A stored instant, shown as "2026-11-14T10:00" in the zone for a datetime-local field. */
export function isoToZoned(iso?: string | null, timeZone = EVENT_TZ) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Date(d.getTime() + offsetMinutes(timeZone, d) * 60000).toISOString().slice(0, 16);
}
