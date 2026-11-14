'use client';
import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import { Check } from 'lucide-react';
import { spring } from '@/lib/motion';

/**
 * A multi-step flow: step labels with a progress bar that fills with a spring, and the current step
 * sliding out as the next slides in (direction follows forward or back).
 */
export function StepFlow({ steps, current, direction, children }: { steps: string[]; current: number; direction: 1 | -1; children: React.ReactNode }) {
  const pct = steps.length > 1 ? current / (steps.length - 1) : 1;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <ol className="flex items-center justify-between gap-2" aria-label="Steps">
          {steps.map((s, i) => (
            <li key={s} aria-current={i === current ? 'step' : undefined} className={`flex min-w-0 items-center gap-2 text-[13.5px] font-semibold ${i <= current ? 'text-ink' : 'text-muted'}`}>
              <m.span animate={{ scale: i === current ? 1.08 : 1 }} transition={spring.snap}
                className={`grid size-7 shrink-0 place-items-center rounded-full text-[12.5px] font-extrabold ${i < current ? 'bg-green text-white' : i === current ? 'bg-ink text-paper' : 'bg-mist text-muted'}`}>
                {i < current ? <Check size={14} strokeWidth={3} /> : i + 1}
              </m.span>
              <span className={`truncate ${i === current ? '' : 'hidden sm:inline'}`}>{s}</span>
            </li>
          ))}
        </ol>
        <div className="h-1.5 overflow-hidden rounded-full bg-mist" role="progressbar" aria-valuenow={current + 1} aria-valuemin={1} aria-valuemax={steps.length} aria-label="Progress">
          <m.div className="h-full origin-left rounded-full bg-green-text" initial={false} animate={{ scaleX: Math.max(0.04, pct) }} transition={spring.soft} />
        </div>
      </div>
      <div className="relative">
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <m.div key={current} custom={direction}
            variants={{ enter: (d: number) => ({ x: d * 48, opacity: 0 }), center: { x: 0, opacity: 1 }, exit: (d: number) => ({ x: d * -48, opacity: 0 }) }}
            initial="enter" animate="center" exit="exit" transition={spring.soft}>
            {children}
          </m.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
