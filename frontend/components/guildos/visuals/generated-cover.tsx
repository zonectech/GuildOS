import type { LucideIcon } from 'lucide-react';
import { Award, BookOpen, Bus, Code2, Coffee, Flag, HandHeart, Laptop, Lightbulb, MapPin, Megaphone, Mic, PenTool, Rocket, Star, Trophy, Users, Wifi, Zap } from 'lucide-react';

/**
 * The cover an event or community gets until someone uploads one: a campus-poster
 * look (bold colour, a pattern, a few laptop-style stickers and a big type word).
 * Everything comes from the seed, so the same event looks the same on every page.
 */

type Palette = { bg: string; ink: string; accent: string; sticker: string };
const PALETTES: Palette[] = [
  { bg: '#F25C3B', ink: '#FFF4E6', accent: '#FFD23F', sticker: '#FFF4E6' },
  { bg: '#1F6F50', ink: '#F3FBEF', accent: '#B8F35D', sticker: '#F3FBEF' },
  { bg: '#13315C', ink: '#F5F1E8', accent: '#F4A259', sticker: '#F5F1E8' },
  { bg: '#0E7C86', ink: '#FFF8F0', accent: '#FFB4A2', sticker: '#FFF8F0' },
  { bg: '#FFD23F', ink: '#1D1D1B', accent: '#F25C3B', sticker: '#FFFFFF' },
  { bg: '#F6E7D8', ink: '#2B2118', accent: '#E4572E', sticker: '#FFFFFF' },
  { bg: '#1D1D1B', ink: '#F7F7F2', accent: '#7BDFF2', sticker: '#F7F7F2' },
  { bg: '#C8E6C9', ink: '#17301C', accent: '#2E7D32', sticker: '#FFFFFF' },
];

const STICKERS: Record<string, LucideIcon[]> = {
  HACKATHON: [Code2, Zap, Trophy, Laptop],
  COMPETITION: [Trophy, Flag, Zap, Star],
  WORKSHOP: [PenTool, Lightbulb, Laptop, Coffee],
  TRAINING: [BookOpen, Lightbulb, Award, Laptop],
  BOOTCAMP: [Rocket, Code2, Coffee, Zap],
  SEMINAR: [Mic, BookOpen, Lightbulb, Users],
  WEBINAR: [Wifi, Laptop, Mic, Lightbulb],
  CONFERENCE: [Mic, Megaphone, Users, Star],
  MEETUP: [Coffee, Users, MapPin, Star],
  VOLUNTEER: [HandHeart, Users, Star, Flag],
  FIELD_TRIP: [Bus, MapPin, Flag, Star],
  COMMUNITY: [Users, Megaphone, Star, Flag],
};
const DEFAULT_STICKERS = [Star, Lightbulb, Users, Rocket];

function hash(value: string) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) { h ^= value.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function Pattern({ kind, color, id }: { kind: number; color: string; id: string }) {
  if (kind === 0) return <svg className="absolute inset-0 h-full w-full" aria-hidden><defs><pattern id={id} width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.6" fill={color} /></pattern></defs><rect width="100%" height="100%" fill={`url(#${id})`} opacity="0.35" /></svg>;
  if (kind === 1) return <svg className="absolute inset-0 h-full w-full" aria-hidden><defs><pattern id={id} width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><rect width="8" height="22" fill={color} /></pattern></defs><rect width="100%" height="100%" fill={`url(#${id})`} opacity="0.14" /></svg>;
  return <svg className="absolute -right-[12%] -top-[30%] h-[140%] w-auto" viewBox="0 0 200 200" aria-hidden>{[90, 72, 54, 36, 18].map((r) => <circle key={r} cx="100" cy="100" r={r} fill="none" stroke={color} strokeWidth="7" opacity="0.22" />)}</svg>;
}

export function GeneratedCover({ seed, type, label, className = '' }: {
  /** What picks the look: the event or community name works well. */
  seed: string;
  /** Event type (HACKATHON, WORKSHOP…) or COMMUNITY; picks the stickers and the big word. */
  type?: string;
  /** Overrides the big word; defaults to the type. */
  label?: string;
  className?: string;
}) {
  const h = hash(seed.trim().toLowerCase() || 'guild');
  const p = PALETTES[h % PALETTES.length];
  const icons = STICKERS[type || ''] || DEFAULT_STICKERS;
  const word = (label ?? (type && type !== 'OTHER' ? type.replace(/_/g, ' ') : 'Event')).toUpperCase();
  // Three stickers, each with its own spot and tilt, all drawn from the seed.
  const spots = [{ top: '12%', right: '8%' }, { top: '42%', right: '24%' }, { top: '18%', right: '38%' }];
  const first = (h >>> 3) % icons.length;
  const stickers = spots.map((spot, i) => ({ Icon: icons[(first + i) % icons.length], spot, tilt: ((h >>> (i * 5)) % 31) - 15 }));
  // Shrink long words so they stay in the left ~60% and clear any badges in the corners.
  const wordSize = Math.min(12, 58 / (0.68 * Math.max(word.length, 1)));
  // Callers that pass absolute/fixed position it themselves; adding relative too would win and collapse it.
  const positioned = /\b(absolute|fixed)\b/.test(className);
  return (
    <div className={`overflow-hidden ${positioned ? '' : 'relative'} ${className}`} style={{ backgroundColor: p.bg, containerType: 'inline-size' }} aria-hidden>
      <Pattern kind={(h >>> 7) % 3} color={p.ink} id={`cover-pattern-${h}`} />
      {stickers.map(({ Icon, spot, tilt }, i) => (
        <span key={i} className="absolute grid place-items-center rounded-[22%] shadow-[0_2px_0_rgba(0,0,0,0.18)]"
          style={{ ...spot, width: '13cqw', height: '13cqw', backgroundColor: i === 1 ? p.accent : p.sticker, color: i === 1 ? p.bg : p.bg === '#FFD23F' || p.bg === '#F6E7D8' || p.bg === '#C8E6C9' ? p.ink : p.bg, transform: `rotate(${tilt}deg)`, border: `0.6cqw solid ${p.ink}` }}>
          <Icon style={{ width: '55%', height: '55%' }} strokeWidth={2.4} />
        </span>
      ))}
      <span className="absolute bottom-[8%] left-[6%] max-w-[64%] font-black leading-[0.9] tracking-tight" style={{ color: p.ink, fontSize: wordSize + 'cqw' }}>{word}</span>
      <span className="absolute bottom-[8%] right-[6%] h-[3cqw] w-[3cqw] rounded-full" style={{ backgroundColor: p.accent }} />
    </div>
  );
}
