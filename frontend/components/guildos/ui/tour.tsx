'use client';

/**
 * Product tour — the classic first-run walkthrough: dimmed page, a spotlight on
 * one element at a time, and a tooltip card with Next / Back / Skip. Pure CSS +
 * portals, no dependencies.
 *
 * Usage: mount <Tour steps={STEPS} storageKey="guildos-tour-student-v1" /> on the
 * page. It shows itself once per browser (localStorage flag) and never again after
 * Skip/Done. Steps target elements via [data-tour="<target>"]; a step without a
 * target renders as a centered welcome card. Steps whose target is missing or
 * hidden (e.g. desktop sidebar on mobile) are skipped automatically.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type TourStep = {
  /** data-tour attribute value of the element to spotlight; omit for a centered card. */
  target?: string;
  title: string;
  body: string;
};

type Rect = { top: number; left: number; width: number; height: number };

function findTarget(step: TourStep): HTMLElement | null {
  if (!step.target) return null;
  const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  // Hidden (display:none / collapsed) targets don't count — the step will be skipped.
  if (rect.width < 2 || rect.height < 2) return null;
  return el;
}

/** First presentable step at/after `from` in direction `dir`; -1 when none. */
function resolveStep(steps: TourStep[], from: number, dir: 1 | -1): number {
  for (let i = from; i >= 0 && i < steps.length; i += dir) {
    if (!steps[i].target || findTarget(steps[i])) return i;
  }
  return -1;
}

export function Tour({ steps, storageKey }: { steps: TourStep[]; storageKey: string }) {
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [mounted, setMounted] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Show once per browser, shortly after the page settles so targets exist.
  useEffect(() => {
    setMounted(true);
    if (typeof window === 'undefined' || localStorage.getItem(storageKey)) return;
    const t = setTimeout(() => {
      const first = resolveStep(steps, 0, 1);
      if (first >= 0) {
        setIdx(first);
        setOpen(true);
      }
    }, 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const finish = useCallback(() => {
    try {
      localStorage.setItem(storageKey, '1');
    } catch {
      /* private mode — tour simply reappears next visit */
    }
    setOpen(false);
  }, [storageKey]);

  const measure = useCallback(() => {
    const step = steps[idx];
    if (!step) return;
    const el = findTarget(step);
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [steps, idx]);

  // Keep the spotlight glued to the target through scrolls/resizes.
  useEffect(() => {
    if (!open) return;
    const step = steps[idx];
    const el = step ? findTarget(step) : null;
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [open, idx, steps, measure]);

  // Escape dismisses (counts as done — nobody wants it back by accident).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, finish]);

  if (!mounted || !open || !steps[idx]) return null;

  const step = steps[idx];
  const hasSpot = Boolean(step.target && rect);
  const next = resolveStep(steps, idx + 1, 1);
  const prev = resolveStep(steps, idx - 1, -1);
  const isLast = next < 0;

  // Tooltip placement: below the spotlight when there's room, else above; clamped to the viewport.
  const CARD_W = 320;
  const CARD_H = 190; // generous estimate — only used for flip decision
  const pad = 10;
  let cardStyle: React.CSSProperties;
  if (hasSpot && rect) {
    const below = rect.top + rect.height + CARD_H + 24 < window.innerHeight;
    const left = Math.max(12, Math.min(rect.left + rect.width / 2 - CARD_W / 2, window.innerWidth - CARD_W - 12));
    cardStyle = below
      ? { top: rect.top + rect.height + pad + 8, left }
      : { top: Math.max(12, rect.top - pad - 8 - CARD_H), left };
  } else {
    cardStyle = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  }

  return createPortal(
    <div className="fixed inset-0 z-[120]" role="dialog" aria-modal="true" aria-label="Product tour">
      {/* Click-blocker + dim. The spotlight cutout is drawn by the box-shadow below. */}
      {hasSpot && rect ? (
        <div
          className="pointer-events-none absolute rounded-2xl ring-2 ring-indigo-400/80 transition-all duration-300"
          style={{
            top: rect.top - pad,
            left: rect.left - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            boxShadow: '0 0 0 9999px rgba(2, 6, 23, 0.62)',
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-slate-950/60" />
      )}
      {/* Invisible layer that swallows clicks so the page can't be interacted with mid-tour. */}
      <div className="absolute inset-0" onClick={() => undefined} />

      <div
        ref={cardRef}
        className="absolute w-80 max-w-[calc(100vw-24px)] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        style={cardStyle}
      >
        <p className="text-sm font-semibold text-slate-950 dark:text-white">{step.title}</p>
        <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{step.body}</p>

        <div className="mt-3 flex items-center gap-1">
          {steps.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === idx ? 'w-5 bg-indigo-600' : 'w-1.5 bg-slate-300 dark:bg-slate-700'}`} />
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <button type="button" onClick={finish} className="text-xs font-medium text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300">
            Skip tour
          </button>
          <div className="flex gap-2">
            {prev >= 0 ? (
              <button
                type="button"
                onClick={() => setIdx(prev)}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300"
              >
                Back
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => (isLast ? finish() : setIdx(next))}
              className="rounded-xl bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              {isLast ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
