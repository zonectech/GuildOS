'use client';
import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import { Avatar } from './avatar';
import { spring, stagger } from '@/lib/motion';

export type StackPerson = { id: string; name: string; avatar?: string; checked?: boolean; stamped?: boolean };

/**
 * Overlapping faces. On first show they cascade in one after another; someone new pops in with a bounce.
 * `blurred` is for signed-out visitors: they see that people are going, not who.
 */
export function AvatarStack({ people, total, max = 5, size = 32, label, blurred, cascade = true, className = '' }: {
  people: StackPerson[]; total: number; max?: number; size?: number; label: string; blurred?: boolean; cascade?: boolean; className?: string;
}) {
  const shown = people.slice(0, max);
  const extra = Math.max(0, total - shown.length);
  return (
    <span role="img" aria-label={label} className={`inline-flex items-center ${className}`}>
      <span className={`flex ${blurred ? 'blur-[3px] saturate-50' : ''}`} style={{ paddingLeft: size * 0.3 }}>
        <AnimatePresence initial={cascade}>
          {shown.map((p, i) => (
            <m.span key={p.id} layout initial={{ opacity: 0, scale: 0.4, x: -8 }} animate={{ opacity: 1, scale: 1, x: 0, transition: { ...spring.bouncy, delay: cascade ? i * stagger.avatars : 0 } }}
              exit={{ opacity: 0, scale: 0.4 }} style={{ marginLeft: -size * 0.3, zIndex: max - i }} className="inline-flex">
              <Avatar name={p.name} src={blurred ? undefined : p.avatar} size={size} checked={p.checked} stamped={p.stamped} />
            </m.span>
          ))}
        </AnimatePresence>
      </span>
      {extra > 0 ? (
        <span className="ml-1.5 inline-grid place-items-center rounded-full bg-mist px-2 font-bold text-muted tabular-nums" style={{ height: size, fontSize: Math.max(11, size * 0.36) }}>+{extra > 999 ? `${Math.floor(extra / 100) / 10}k` : extra}</span>
      ) : null}
    </span>
  );
}
