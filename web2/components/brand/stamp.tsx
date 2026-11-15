import { useId } from 'react';
import { BRAND } from '@/lib/brand';

export type StampState = 'empty' | 'pending' | 'stamped' | 'locked';
export type StampInk = 'green' | 'gold' | 'coral' | 'ink';

const INK: Record<StampInk, string> = { green: 'var(--green-text)', gold: 'var(--stamp-gold)', coral: 'var(--coral-text)', ink: 'var(--ink)' };

/**
 * A clean attendance seal. Small sizes use a simplified badge; full seals show
 * the event and status without noise filters or moving rings.
 */
export function Stamp({ label = 'Your next stamp', date, center, ink = 'green', tilt = 0, state = 'stamped', size = 120, className = '', title }: {
  label?: string; date?: { day: string; month: string } | null; center?: React.ReactNode; ink?: StampInk; tilt?: number;
  state?: StampState; size?: number; className?: string; title?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const color = state === 'locked' || state === 'empty' ? 'var(--muted)' : INK[ink];
  const fullLabel = (state === 'empty' ? 'Your next stamp' : state === 'locked' ? 'Locked' : label).toUpperCase();
  const top = fullLabel.length > 30 ? `${fullLabel.slice(0, 29).trimEnd()}…` : fullLabel;
  const squeeze = top.length > 20;
  const dashed = state === 'empty' || state === 'pending';
  const compact = size < 80;
  const status = state === 'stamped' ? `VERIFIED BY ${BRAND.toUpperCase()}` : state === 'pending' ? 'AWAITING CONFIRMATION' : state === 'locked' ? 'ATTENDANCE RECORD' : 'ATTEND · CONNECT · GROW';

  return (
    <svg viewBox="0 0 200 200" width={size} height={size} role="img" aria-label={title ?? `${state === 'stamped' ? 'Stamp' : `${state} stamp`}: ${label}`}
      className={`shrink-0 select-none ${className}`} style={{ transform: `rotate(${tilt}deg)`, color }}>
      <title>{title ?? `${label} — ${state === 'stamped' ? 'verified' : state}`}</title>
      <defs>
        <path id={`t${uid}`} d="M 34,100 A 66,66 0 1,1 166,100" />
        <path id={`b${uid}`} d="M 27,100 A 73,73 0 0,0 173,100" />
      </defs>

      <g fill="none" stroke="currentColor">
        <circle cx="100" cy="100" r="92" fill="currentColor" fillOpacity={state === 'stamped' ? 0.055 : 0.025} strokeWidth={compact ? 6 : 3} strokeDasharray={dashed ? '8 7' : undefined} />
        <circle cx="100" cy="100" r="82" strokeWidth={compact ? 2.5 : 1} />
        {!compact ? <circle cx="100" cy="100" r="47" strokeWidth="1.5" /> : null}

        <g fill="currentColor" stroke="none" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '.08em' }}>
          {!compact ? <><text fontSize="14"><textPath href={`#t${uid}`} startOffset="50%" textAnchor="middle" {...(squeeze ? { textLength: 196, lengthAdjust: 'spacingAndGlyphs' } : {})}>{top}</textPath></text>
          <text fontSize="10.5" letterSpacing=".12em"><textPath href={`#b${uid}`} startOffset="50%" textAnchor="middle">{status}</textPath></text>
          {/* Small stars between the two arcs. */}
          <circle cx="28" cy="100" r="2" /><circle cx="172" cy="100" r="2" /></> : null}
          {center ?? (state === 'locked' ? (
            <path d="M88 96 v-8 a12 12 0 0 1 24 0 v8 M84 96 h32 v20 h-32z" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
          ) : state === 'empty' ? (
            <path d="M100 86 v28 M86 100 h28" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
          ) : state === 'pending' ? (
            <path d="M100 77 v25 l16 10 M124 100 a24 24 0 1 1 -48 0 a24 24 0 1 1 48 0" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          ) : date ? (
            <>
              <text x="100" y={compact ? 85 : 88} textAnchor="middle" fontSize={compact ? 20 : 13} letterSpacing=".12em">{date.month.toUpperCase()}</text>
              <text x="100" y={compact ? 133 : 124} textAnchor="middle" fontSize={compact ? 48 : 38} letterSpacing="-.02em">{date.day}</text>
            </>
          ) : (
            <path d="M84 101 l11 11 l22 -24" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
          ))}
        </g>
      </g>
    </svg>
  );
}

/**
 * A word in the middle of a seal ("VALID", "LIVE", "12"). The inner ring is 94 units wide, so the
 * text shrinks with its length and is never wider than 74: it always sits inside the ring.
 */
export function SealText({ children }: { children: string }) {
  const n = children.length;
  const size = n <= 2 ? 44 : n === 3 ? 34 : n === 4 ? 28 : n === 5 ? 23 : 19;
  return (
    <text x="100" y={100 + size * 0.36} textAnchor="middle" fontSize={size} fontWeight="800"
      {...(n >= 5 ? { textLength: Math.min(74, n * size * 0.66), lengthAdjust: 'spacingAndGlyphs' as const } : {})}>{children}</text>
  );
}
