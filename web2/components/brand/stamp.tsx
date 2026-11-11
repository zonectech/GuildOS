import { useId } from 'react';
import { BRAND } from '@/lib/brand';

export type StampState = 'empty' | 'pending' | 'stamped' | 'locked';
export type StampInk = 'green' | 'gold' | 'coral' | 'ink';

const INK: Record<StampInk, string> = { green: 'var(--green-text)', gold: 'var(--stamp-gold)', coral: 'var(--coral-text)', ink: 'var(--ink)' };

/**
 * The OnTheRoll seal: a round rubber stamp with the event name on the top arc and
 * "VERIFIED BY ONTHEROLL" on the bottom. Slightly tilted and ink-textured, like the real thing.
 */
export function Stamp({ label = 'Your next stamp', date, center, ink = 'green', tilt = -8, state = 'stamped', size = 120, className = '', title }: {
  label?: string; date?: { day: string; month: string } | null; center?: React.ReactNode; ink?: StampInk; tilt?: number;
  state?: StampState; size?: number; className?: string; title?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const color = state === 'locked' ? 'var(--muted)' : state === 'empty' ? 'var(--line)' : INK[ink];
  const top = (state === 'empty' ? 'Your next stamp' : state === 'locked' ? 'Locked' : label).toUpperCase().slice(0, 30);
  const squeeze = top.length > 20;
  const dashed = state === 'empty' || state === 'pending';
  const textured = state === 'stamped';

  return (
    <svg viewBox="0 0 200 200" width={size} height={size} role="img" aria-label={title ?? `${state === 'stamped' ? 'Stamp' : `${state} stamp`}: ${label}`}
      className={`shrink-0 select-none ${className}`} style={{ transform: `rotate(${tilt}deg)`, color }}>
      <defs>
        {/* Rubber-stamp ink: wobbly edges plus specks where the ink did not take. */}
        <filter id={`ink${uid}`} x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="2.4" result="d" />
          <feTurbulence type="fractalNoise" baseFrequency="2.4" numOctaves="1" seed="3" result="s" />
          <feColorMatrix in="s" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.4 1.85" result="m" />
          <feComposite in="d" in2="m" operator="in" />
        </filter>
        <path id={`t${uid}`} d="M 34,100 A 66,66 0 1,1 166,100" />
        <path id={`b${uid}`} d="M 27,100 A 73,73 0 0,0 173,100" />
      </defs>

      <g filter={textured ? `url(#ink${uid})` : undefined} fill="none" stroke="currentColor" opacity={state === 'locked' ? 0.55 : 0.94}>
        <g className={state === 'pending' ? 'origin-center animate-[spin_14s_linear_infinite] motion-reduce:animate-none' : ''} style={{ transformBox: 'fill-box' }}>
          <circle cx="100" cy="100" r="93" strokeWidth="6" strokeDasharray={dashed ? '10 8' : undefined} />
        </g>
        <circle cx="100" cy="100" r="80" strokeWidth="1.6" strokeDasharray={state === 'empty' ? '3 5' : undefined} />
        <circle cx="100" cy="100" r="47" strokeWidth="1.6" opacity={state === 'empty' ? 0.6 : 1} />

        <g fill="currentColor" stroke="none" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '.08em' }}>
          <text fontSize="14.5"><textPath href={`#t${uid}`} startOffset="50%" textAnchor="middle" {...(squeeze ? { textLength: 196, lengthAdjust: 'spacingAndGlyphs' } : {})}>{top}</textPath></text>
          <text fontSize="11" letterSpacing=".2em"><textPath href={`#b${uid}`} startOffset="50%" textAnchor="middle">{`VERIFIED BY ${BRAND.toUpperCase()}`}</textPath></text>
          {/* Small stars between the two arcs. */}
          <path d="M18 100 l3 -2 l3 2 l-3 2z M176 100 l3 -2 l3 2 l-3 2z" />

          {center ?? (state === 'locked' ? (
            <path d="M88 96 v-8 a12 12 0 0 1 24 0 v8 M84 96 h32 v20 h-32z" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
          ) : state === 'empty' ? (
            <path d="M100 86 v28 M86 100 h28" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
          ) : state === 'pending' ? (
            <text x="100" y="105" textAnchor="middle" fontSize="13" letterSpacing=".14em">PENDING</text>
          ) : date ? (
            <>
              <text x="100" y="94" textAnchor="middle" fontSize="13" letterSpacing=".2em">{date.month.toUpperCase()}</text>
              <text x="100" y="124" textAnchor="middle" fontSize="34" letterSpacing="-.02em">{date.day}</text>
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
