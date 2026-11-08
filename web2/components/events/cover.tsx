import Image from 'next/image';
import { typeStyle } from '@/lib/events';

/** A seeded number so each event keeps the same generated cover. */
const seedOf = (s: string) => { let h = 0; for (const c of s) h = (h * 33 + c.charCodeAt(0)) | 0; return Math.abs(h); };

function Pattern({ kind, color, seed }: { kind: ReturnType<typeof typeStyle>['pattern']; color: string; seed: number }) {
  const o = 0.32;
  switch (kind) {
    case 'rings':
      return <g fill="none" stroke={color} strokeWidth="14" opacity={o}>{[60, 110, 160, 210, 260].map((r) => <circle key={r} cx={420 + (seed % 60)} cy={60} r={r} />)}</g>;
    case 'dots':
      return <g fill={color} opacity={o}>{Array.from({ length: 70 }, (_, i) => <circle key={i} cx={(i % 10) * 56 + 20} cy={Math.floor(i / 10) * 56 + 20} r={i % 3 === seed % 3 ? 9 : 4} />)}</g>;
    case 'stripes':
      return <g stroke={color} strokeWidth="22" opacity={o}>{Array.from({ length: 14 }, (_, i) => <line key={i} x1={i * 60 - 200} y1={-20} x2={i * 60 + 100} y2={400} />)}</g>;
    case 'grid':
      return <g stroke={color} strokeWidth="1.5" opacity={o + 0.1}>{Array.from({ length: 16 }, (_, i) => <line key={`v${i}`} x1={i * 40} y1={0} x2={i * 40} y2={380} />)}{Array.from({ length: 10 }, (_, i) => <line key={`h${i}`} x1={0} y1={i * 40} x2={640} y2={i * 40} />)}<circle cx={460} cy={120} r={70} fill={color} opacity=".55" stroke="none" /></g>;
    case 'waves':
      return <g fill="none" stroke={color} strokeWidth="16" opacity={o}>{[0, 1, 2, 3, 4, 5].map((i) => <path key={i} d={`M-20 ${60 + i * 60} q 80 -50 160 0 t 160 0 t 160 0 t 160 0 t 160 0`} />)}</g>;
    default:
      return <g fill={color} opacity={o}>{Array.from({ length: 18 }, (_, i) => { const a = (i / 18) * Math.PI * 2; const r = (n: number) => n.toFixed(1); return <path key={i} d={`M480 110 L${r(480 + Math.cos(a) * 420)} ${r(110 + Math.sin(a) * 420)} L${r(480 + Math.cos(a + 0.09) * 420)} ${r(110 + Math.sin(a + 0.09) * 420)}Z`} />; })}</g>;
  }
}

/** The event's photo, or a generated poster in the type's colours with a stamp motif. */
export function EventCover({ src, title, type, sizes, priority, label = true, className = '' }: { src?: string; title: string; type: string; sizes: string; priority?: boolean; label?: boolean; className?: string }) {
  if (src) {
    // Show the whole photo, never cropped. Space around it is filled with a soft, blurred copy
    // (a tiny version of the same image, so it costs almost nothing to load).
    return (
      <span className={`absolute inset-0 overflow-hidden bg-mist ${className}`}>
        <Image src={src} alt="" fill sizes="48px" aria-hidden="true" className="scale-125 object-cover opacity-80 blur-2xl saturate-150" />
        <Image src={src} alt="" fill sizes={sizes} preload={priority} className="object-contain" />
      </span>
    );
  }
  const st = typeStyle(type);
  const seed = seedOf(title);
  return (
    <svg viewBox="0 0 640 380" preserveAspectRatio="xMidYMid slice" aria-hidden="true" className={`absolute inset-0 size-full ${className}`}>
      <rect width="640" height="380" fill={st.bg} />
      <Pattern kind={st.pattern} color={st.accent} seed={seed} />
      {/* A big faint seal in the corner: the brand motif on every cover. */}
      <g transform={`translate(${520 - (seed % 40)} ${270}) rotate(${-14 + (seed % 12)})`} fill="none" stroke={st.fg} opacity=".22">
        <circle r="92" strokeWidth="9" /><circle r="74" strokeWidth="2.5" strokeDasharray="5 6" /><path d="M-30 2 l20 20 l42 -44" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      {label ? <text x="34" y="338" fill={st.fg} style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-.04em' }} fontSize="78">{st.label.toUpperCase()}</text> : null}
    </svg>
  );
}
