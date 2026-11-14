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

/** A title without test markers like "[DEMO]", cut short so a caption never runs long. */
export function shortTitle(t: string, max = 46) {
  const clean = t.replace(/^\[(DEMO|TEST)\]\s*/i, '').trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

/**
 * The event's photo, or a generated pattern in the type's colours. No big type word and no seal:
 * the type label sits under the cover, and the seal is reserved for events the student attended.
 * `caption` adds a short version of the title over the pattern, with safe padding on every side.
 */
export function EventCover({ src, title, type, sizes, priority, caption, className = '' }: {
  src?: string; title: string; type: string; sizes: string; priority?: boolean; caption?: string; className?: string;
}) {
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
    <span className={`absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      <svg viewBox="0 0 640 380" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full">
        <rect width="640" height="380" fill={st.bg} />
        <Pattern kind={st.pattern} color={st.accent} seed={seed} />
      </svg>
      {caption ? (
        <span className="absolute inset-0 flex items-end p-[7%]">
          <span className="line-clamp-2 max-w-[85%] font-display text-[clamp(22px,4.2vw,46px)] leading-[1.04] font-extrabold tracking-[-.03em]" style={{ color: st.fg }}>{shortTitle(caption)}</span>
        </span>
      ) : null}
    </span>
  );
}
