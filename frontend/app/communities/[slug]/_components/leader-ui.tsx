'use client';

import { XCircle } from 'lucide-react';
import { resolveAvatarUrl } from '../../../../components/guildos/api/community-list-api';

const AVATAR_SIZES = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-11 w-11 text-sm',
} as const;

export function MemberAvatar({ fullName, avatar, size = 'md' }: { fullName: string; avatar?: string; size?: keyof typeof AVATAR_SIZES }) {
  const url = resolveAvatarUrl(avatar);
  const initials = fullName.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
  const cls = AVATAR_SIZES[size];
  if (url) return <img src={url} alt={fullName} className={`${cls} shrink-0 rounded-full border border-slate-200 dark:border-slate-800 object-cover`} />;
  return (
    <div className={`${cls} flex shrink-0 items-center justify-center rounded-full bg-indigo-100 font-semibold text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300`}>
      {initials || '?'}
    </div>
  );
}

/**
 * A small icon action nested inside a leader card (which is itself a <button>) —
 * a real <button> can't nest inside another, so this is a keyboard-accessible
 * span: clickable, focusable (tabIndex), and Enter/Space triggers it like a button.
 */
export function LeaderCardAction({
  onClick,
  title,
  className,
  children,
}: {
  onClick: (e: React.MouseEvent | React.KeyboardEvent) => void;
  title: string;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <span
      role="button"
      tabIndex={0}
      title={title}
      aria-label={title}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(e);
        }
      }}
      className={className}
    >
      {children}
    </span>
  );
}

/** Full-screen click-to-dismiss image preview. Sits above the other modals (z-60). */
export function ImageLightbox({ src, alt = '', onClose }: { src: string; alt?: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
        aria-label="Close image preview"
      >
        <XCircle className="h-5 w-5" />
      </button>
      <img
        src={src}
        alt={alt}
        className="max-h-[90vh] w-auto max-w-[95vw] rounded-xl object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
