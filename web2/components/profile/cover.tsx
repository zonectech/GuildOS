import type { CSSProperties } from 'react';
import type { CoverPattern } from '@/lib/api/profile';

/** Soft brand-colour cover patterns (CSS only, so they're instant and theme-aware). */
export const COVER_STYLE: Record<CoverPattern, CSSProperties> = {
  waves: { background: 'radial-gradient(120% 140% at 0% 0%, var(--tint), transparent 60%), repeating-radial-gradient(circle at 100% 120%, color-mix(in srgb, var(--green-text) 14%, transparent) 0 2px, transparent 2px 18px), var(--mist)' },
  dots: { background: 'radial-gradient(circle, color-mix(in srgb, var(--green-text) 28%, transparent) 1.6px, transparent 1.8px) 0 0 / 16px 16px, linear-gradient(135deg, var(--tint), var(--mist))' },
  grid: { background: 'linear-gradient(color-mix(in srgb, var(--green-text) 14%, transparent) 1px, transparent 1px) 0 0 / 22px 22px, linear-gradient(90deg, color-mix(in srgb, var(--green-text) 14%, transparent) 1px, transparent 1px) 0 0 / 22px 22px, var(--tint)' },
  rings: { background: 'repeating-radial-gradient(circle at 20% 50%, color-mix(in srgb, var(--gold) 30%, transparent) 0 3px, transparent 3px 22px), linear-gradient(135deg, color-mix(in srgb, var(--gold) 18%, var(--surface)), var(--mist))' },
  confetti: { background: 'radial-gradient(circle at 12% 30%, var(--coral) 0 4px, transparent 5px), radial-gradient(circle at 34% 70%, var(--gold) 0 5px, transparent 6px), radial-gradient(circle at 58% 25%, var(--green-text) 0 4px, transparent 5px), radial-gradient(circle at 80% 65%, var(--coral) 0 3px, transparent 4px), radial-gradient(circle at 92% 20%, var(--gold) 0 4px, transparent 5px), linear-gradient(135deg, var(--tint), var(--mist))' },
  stripes: { background: 'repeating-linear-gradient(-45deg, color-mix(in srgb, var(--green-text) 12%, transparent) 0 10px, transparent 10px 22px), var(--tint)' },
};
