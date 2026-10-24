'use client';

// Save as: components/guildos/status/status-avatar.tsx
import { Plus } from 'lucide-react';

type StatusAvatarProps = {
  name: string;
  avatar?: string;
  hasStatus?: boolean;
  /** Single-ring fallback: true once everything has been seen. */
  viewed?: boolean;
  /** One entry per story, oldest first: true = seen. Draws one ring segment per story. */
  segments?: boolean[];
  own?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
};

const sizes = {
  sm: { ring: 'h-10 w-10', image: 'h-8 w-8', plus: 'h-4 w-4' },
  md: { ring: 'h-[68px] w-[68px]', image: 'h-[58px] w-[58px]', plus: 'h-5 w-5' },
  lg: { ring: 'h-[82px] w-[82px]', image: 'h-[70px] w-[70px]', plus: 'h-5 w-5' },
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const RADIUS = 47;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * The ring around the avatar. With several stories it is split into one arc per
 * story, like WhatsApp: unseen arcs are GuildOS indigo, seen arcs turn grey.
 */
function StatusRing({ segments }: { segments: boolean[] }) {
  // No status: a plain, quiet ring.
  if (!segments.length) {
    return (
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
        <circle cx="50" cy="50" r={RADIUS} fill="none" strokeWidth="5" className="stroke-slate-200 dark:stroke-slate-700" />
      </svg>
    );
  }

  const count = segments.length;
  const slot = CIRCUMFERENCE / count;
  // Gaps only when there is more than one arc, kept small so many stories still read.
  const gap = count > 1 ? Math.min(CIRCUMFERENCE * 0.035, slot * 0.4) : 0;
  const length = slot - gap;

  return (
    // -rotate-90: the first arc starts at the top.
    <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden>
      {segments.map((seen, index) => (
        <circle
          key={index}
          cx="50"
          cy="50"
          r={RADIUS}
          fill="none"
          strokeWidth="5"
          strokeDasharray={`${length} ${CIRCUMFERENCE - length}`}
          strokeDashoffset={-(index * slot + gap / 2)}
          className={seen ? 'stroke-slate-300 dark:stroke-slate-600' : 'stroke-indigo-600 dark:stroke-indigo-500'}
        />
      ))}
    </svg>
  );
}

export function StatusAvatar({
  name,
  avatar,
  hasStatus = false,
  viewed = false,
  segments,
  own = false,
  size = 'md',
  onClick,
}: StatusAvatarProps) {
  const s = sizes[size];
  const ringSegments = !hasStatus ? [] : segments && segments.length ? segments : [viewed];
  const src = avatar ? (avatar.startsWith('/') ? `${API_BASE}${avatar}` : avatar) : '';

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex shrink-0 flex-col items-center gap-1.5 outline-none"
      aria-label={`${name}${hasStatus ? ' — view status' : ''}`}
    >
      <span className={`relative flex ${s.ring} items-center justify-center`}>
        <StatusRing segments={ringSegments} />
        <span className={`${s.image} relative flex items-center justify-center overflow-hidden rounded-full bg-white text-xs font-semibold text-slate-600 dark:bg-slate-950 dark:text-slate-300`}>
          {src ? <img src={src} alt={name} className="h-full w-full object-cover" /> : name.slice(0, 1).toUpperCase()}
        </span>
        {own ? (
          <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-indigo-600 text-white dark:border-slate-900">
            <Plus className={s.plus} />
          </span>
        ) : null}
      </span>
      <span className="max-w-[76px] truncate text-[11px] font-medium text-slate-700 group-hover:text-slate-950 dark:text-slate-300 dark:group-hover:text-white">
        {name}
      </span>
    </button>
  );
}