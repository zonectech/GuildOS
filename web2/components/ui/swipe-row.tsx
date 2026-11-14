'use client';
import { useState } from 'react';
import * as m from 'motion/react-m';
import { useMotionValue, useTransform } from 'motion/react';
import { Check, X } from 'lucide-react';

/**
 * A row you can swipe on touch screens: right to approve, left to decline. A swipe only asks;
 * the caller confirms (and asks for a reason where one is required). Buttons remain the fallback.
 */
export function SwipeRow({ onApprove, onDecline, children }: { onApprove: () => void; onDecline: () => void; children: React.ReactNode }) {
  const x = useMotionValue(0);
  const approveOpacity = useTransform(x, [20, 90], [0, 1]);
  const declineOpacity = useTransform(x, [-90, -20], [1, 0]);
  const [touch] = useState(() => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches);
  if (!touch) return <>{children}</>;
  return (
    <div className="relative overflow-hidden rounded-[20px]">
      <m.div aria-hidden="true" style={{ opacity: approveOpacity }} className="absolute inset-0 flex items-center gap-2 bg-green pl-5 font-bold text-white"><Check size={20} />Approve</m.div>
      <m.div aria-hidden="true" style={{ opacity: declineOpacity }} className="absolute inset-0 flex items-center justify-end gap-2 bg-coral pr-5 font-bold text-[#111714]">Decline<X size={20} /></m.div>
      <m.div drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.6} style={{ x }} className="relative"
        onDragEnd={(_, i) => { if (i.offset.x > 110) onApprove(); else if (i.offset.x < -110) onDecline(); }}>
        {children}
      </m.div>
    </div>
  );
}
