import Image from 'next/image';
import { Check } from 'lucide-react';

// Generated avatars use the brand palette, with a text colour that keeps AA contrast on each.
const PALETTE: [string, string][] = [['#0A7A50', '#FFFFFF'], ['#FFC233', '#111714'], ['#F2603A', '#111714'], ['#C9A2FF', '#111714'], ['#9ED8FF', '#111714'], ['#163A2D', '#FAFAF7']];
const pick = (seed: string) => { let h = 0; for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0; return PALETTE[Math.abs(h) % PALETTE.length]; };
const initials = (name: string) => name.replace(/^A student from /, '').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '·';

/** A round photo with a thin ring, or initials on a brand colour. Checked-in guests get a green ring and a tick. */
export function Avatar({ name, src, size = 40, ring = true, checked, stamped, className = '' }: {
  name: string; src?: string; size?: number; ring?: boolean; checked?: boolean; stamped?: boolean; className?: string;
}) {
  const [bg, fg] = pick(name);
  const box = checked ? '0 0 0 2px var(--paper), 0 0 0 4px var(--green-text)' : ring ? '0 0 0 2px var(--paper)' : undefined;
  return (
    <span className={`relative inline-grid shrink-0 place-items-center rounded-full ${className}`} style={{ width: size, height: size, boxShadow: box }}>
      {src ? (
        // Avatars come in two sizes only (48 and 96), to keep downloads light.
        <Image src={src} alt="" width={size <= 48 ? 48 : 96} height={size <= 48 ? 48 : 96} sizes={`${size}px`} className="size-full rounded-full object-cover" />
      ) : (
        <span aria-hidden="true" className="grid size-full place-items-center rounded-full font-display font-extrabold" style={{ background: bg, color: fg, fontSize: Math.max(10, Math.round(size * 0.38)), letterSpacing: '-.02em' }}>{initials(name)}</span>
      )}
      {checked ? <span className="absolute -right-0.5 -bottom-0.5 grid size-[38%] min-h-3.5 min-w-3.5 place-items-center rounded-full bg-green text-white ring-2 ring-paper"><Check size={Math.max(8, size * 0.22)} strokeWidth={3.5} /></span> : null}
      {stamped ? <span className="absolute -right-1 -bottom-1"><MiniStamp size={Math.max(14, size * 0.42)} /></span> : null}
    </span>
  );
}

/** The tiny stamp used for stamp-count badges and attended avatars (instead of an emoji). */
export function MiniStamp({ size = 14, className = '' }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className={`shrink-0 -rotate-12 text-green-text ${className}`}>
      <circle cx="12" cy="12" r="10.5" fill="var(--paper)" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="1.6 1.6" />
      <path d="M8.2 12.2l2.6 2.6 5-5.3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
