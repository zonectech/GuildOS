'use client';
import { useId } from 'react';
import { BRAND_NAME } from '@/lib/brand';

const clock = (v: string | null | undefined, timeZone: string) =>
  v ? new Date(v).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone }) : '';
const fit = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);
// The top ring has about 190 units between the stars; a longer name is squeezed to fit rather than cut short.
const RING = 190;
const squeeze = (text: string) => (text.length * 10.2 > RING ? { textLength: RING, lengthAdjust: 'spacingAndGlyphs' as const } : {});

export type SealKind = 'ATTENDED' | 'HOSTED' | 'CO_HOSTED';
const WORD: Record<SealKind, string> = { ATTENDED: 'ATTENDED', HOSTED: 'HOSTED', CO_HOSTED: 'CO-HOSTED' };

/**
 * The round seal on an event page, pressed like a rubber stamp: the event name curves
 * around the top, our own name around the bottom (the same on every seal, however long a
 * community's name is), and the date sits in the middle with the scan times (ATTENDED) or how many
 * people attended (HOSTED, CO-HOSTED). Hosting seals have a solid ring so they read differently at a glance.
 * The ink is slightly uneven on purpose; it is drawn in the brand green so it works in dark mode too.
 */
export function AttendedSeal({ kind = 'ATTENDED', title, date, checkInAt, checkOutAt, timezone, attendedCount }: {
  kind?: SealKind; title: string; date: string | null | undefined; checkInAt?: string | null; checkOutAt?: string | null; timezone?: string; attendedCount?: number;
}) {
  const hosting = kind !== 'ATTENDED';
  const id = useId().replace(/:/g, '');
  const tz = timezone || 'Africa/Lagos';
  const when = date ? new Date(date) : null;
  const day = when ? when.toLocaleDateString('en-NG', { day: 'numeric', timeZone: tz }) : '';
  const month = when ? when.toLocaleDateString('en-NG', { month: 'short', timeZone: tz }).toUpperCase() : '';
  const year = when ? when.toLocaleDateString('en-NG', { year: 'numeric', timeZone: tz }) : '';
  const top = fit(title.toUpperCase(), 28);
  const inAt = clock(checkInAt, tz);
  const outAt = clock(checkOutAt, tz);
  const detail = hosting ? (attendedCount ? `${attendedCount} ATTENDED` : '') : inAt && outAt ? `${inAt} – ${outAt}` : '';
  const label = `${kind === 'ATTENDED' ? 'Attended' : kind === 'HOSTED' ? 'Hosted' : 'Co-hosted'} ${title}, verified by ${BRAND_NAME}${when ? `, ${day} ${month} ${year}` : ''}${hosting ? (attendedCount ? `, ${attendedCount} attended` : '') : inAt && outAt ? `, in ${inAt}, out ${outAt}` : ''}`;

  return (
    <svg className="seal" viewBox="0 0 220 220" role="img" aria-label={label}>
      <defs>
        {/* Uneven ink: a little edge wobble plus faded patches, like a real rubber stamp. */}
        <filter id={`ink-${id}`} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="grain" />
          <feDisplacementMap in="SourceGraphic" in2="grain" scale="1.6" result="rough" />
          <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="3" result="patches" />
          <feColorMatrix in="patches" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.6 1.55" result="mask" />
          <feComposite in="rough" in2="mask" operator="in" />
        </filter>
        <path id={`top-${id}`} d="M 32 110 A 78 78 0 0 1 188 110" />
        <path id={`bottom-${id}`} d="M 26 110 A 84 84 0 0 0 194 110" />
      </defs>
      <g filter={`url(#ink-${id})`} fill="currentColor" stroke="currentColor">
        {hosting
          ? <circle cx="110" cy="110" r="100.5" fill="none" strokeWidth="9" />
          : <><circle cx="110" cy="110" r="104" fill="none" strokeWidth="4" /><circle cx="110" cy="110" r="97" fill="none" strokeWidth="1.2" /></>}
        <circle cx="110" cy="110" r="64" fill="none" strokeWidth="1.2" />
        <text className="seal-arc" stroke="none"><textPath href={`#top-${id}`} startOffset="50%" textAnchor="middle" {...squeeze(top)}>{top}</textPath></text>
        <text className="seal-arc seal-brand" stroke="none"><textPath href={`#bottom-${id}`} startOffset="50%" textAnchor="middle" dominantBaseline="hanging">VERIFIED BY {BRAND_NAME.toUpperCase()}</textPath></text>
        <text x="21" y="114" className="seal-star" stroke="none" textAnchor="middle">★</text>
        <text x="199" y="114" className="seal-star" stroke="none" textAnchor="middle">★</text>
        <text x="110" y="84" className="seal-word" stroke="none" textAnchor="middle">{WORD[kind]}</text>
        <text x="110" y="122" className="seal-day" stroke="none" textAnchor="middle">{day} {month}</text>
        <text x="110" y="140" className="seal-year" stroke="none" textAnchor="middle">{year}</text>
        {detail ? <text x="110" y="157" className="seal-time" stroke="none" textAnchor="middle">{detail}</text> : null}
      </g>
    </svg>
  );
}
