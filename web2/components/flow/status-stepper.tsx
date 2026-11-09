'use client';
import * as m from 'motion/react-m';
import { Check, MessageCircleQuestion, X } from 'lucide-react';
import type { RequestStatus } from '@/lib/api/review';
import { spring } from '@/lib/motion';

type Stage = { label: string; sub?: string; state: 'done' | 'current' | 'waiting' | 'approved' | 'declined' | 'info' };

/** Submitted → In review → Decision, from where a request stands. */
export function stagesFor(status: RequestStatus, submittedAt: string, decidedAt: string | null): Stage[] {
  const when = (v: string | null) => (v ? new Date(v).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' }) : undefined);
  const decided = status === 'APPROVED' || status === 'DECLINED';
  return [
    { label: 'Submitted', sub: when(submittedAt), state: 'done' },
    { label: status === 'MORE_INFO' ? 'More info needed' : status === 'UPDATED' ? 'Back in review' : 'In review', state: decided ? 'done' : status === 'MORE_INFO' ? 'info' : 'current' },
    { label: status === 'APPROVED' ? 'Approved' : status === 'DECLINED' ? 'Declined' : 'Decision', sub: decided ? when(decidedAt) : undefined, state: status === 'APPROVED' ? 'approved' : status === 'DECLINED' ? 'declined' : 'waiting' },
  ];
}

const DOT: Record<Stage['state'], string> = {
  done: 'bg-green text-white', current: 'bg-ink text-paper', waiting: 'bg-mist text-muted border border-line',
  approved: 'bg-green text-white', declined: 'bg-coral text-[#111714]', info: 'bg-gold text-[#111714]',
};

/** Horizontal on wide screens, vertical on phones. The step in progress pulses softly. */
export function StatusStepper({ stages }: { stages: Stage[] }) {
  return (
    <ol className="flex flex-col gap-0 sm:flex-row sm:items-start" aria-label="Request progress">
      {stages.map((s, i) => {
        const active = s.state === 'current' || s.state === 'info';
        const last = i === stages.length - 1;
        return (
          <li key={s.label} className="relative flex gap-3 pb-5 last:pb-0 sm:flex-1 sm:flex-col sm:items-center sm:gap-2 sm:pb-0 sm:text-center" aria-current={active ? 'step' : undefined}>
            {!last ? <span aria-hidden="true" className={`absolute top-8 left-[15px] h-[calc(100%-28px)] w-0.5 sm:top-[15px] sm:left-[calc(50%+20px)] sm:h-0.5 sm:w-[calc(100%-40px)] ${s.state === 'done' ? 'bg-green-text' : 'bg-line'}`} /> : null}
            <span className="relative">
              {active ? <m.span aria-hidden="true" className={`absolute inset-0 rounded-full ${s.state === 'info' ? 'bg-gold' : 'bg-ink'}`} animate={{ scale: [1, 1.7], opacity: [0.35, 0] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }} /> : null}
              <m.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ ...spring.bouncy, delay: i * 0.08 }}
                className={`relative grid size-8 place-items-center rounded-full text-[13px] font-extrabold ${DOT[s.state]}`}>
                {s.state === 'done' || s.state === 'approved' ? <Check size={16} strokeWidth={3} /> : s.state === 'declined' ? <X size={16} strokeWidth={3} /> : s.state === 'info' ? <MessageCircleQuestion size={16} /> : i + 1}
              </m.span>
            </span>
            <span className="flex flex-col pt-1 sm:pt-0">
              <b className="text-[14.5px]">{s.label}</b>
              {s.sub ? <small className="text-[12.5px] text-muted">{s.sub}</small> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
