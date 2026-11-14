'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import * as m from 'motion/react-m';
import { useReducedMotion } from 'motion/react';
import { press, spring } from '@/lib/motion';
import { dateTile } from '@/lib/events';

/** Calendar tile: month on top, a big day below. */
export function DateTile({ value, tz, size = 'md', className = '' }: { value: string | null; tz?: string; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const d = dateTile(value, tz);
  if (!d) return null;
  const s = { sm: ['w-10', 'text-[9px]', 'text-[17px]'], md: ['w-12', 'text-[10px]', 'text-[21px]'], lg: ['w-14', 'text-[11px]', 'text-[25px]'] }[size];
  return (
    <span aria-label={`${d.day} ${d.month}`} className={`inline-flex ${s[0]} shrink-0 flex-col overflow-hidden rounded-xl border border-line bg-surface text-center shadow-card ${className}`}>
      <i className={`bg-coral py-[3px] font-bold not-italic uppercase tracking-[.12em] text-[#111714] ${s[1]}`}>{d.month}</i>
      <b className={`font-display font-extrabold leading-[1.15] tracking-tight tabular-nums ${s[2]} py-0.5`}>{d.day}</b>
    </span>
  );
}

/** A number whose digits roll like an odometer when it changes. */
export function Odometer({ value, className = '' }: { value: number; className?: string }) {
  const reduce = useReducedMotion();
  const digits = String(Math.max(0, Math.round(value))).split('');
  return (
    <span aria-label={String(value)} className={`inline-flex overflow-hidden tabular-nums ${className}`}>
      {digits.map((d, i) => (
        <span key={digits.length - i} aria-hidden="true" className="relative inline-block h-[1em] w-[.62em] overflow-hidden leading-none">
          <m.span className="absolute inset-x-0 top-0 flex flex-col" animate={{ y: `${-Number(d)}em` }} initial={false} transition={reduce ? { duration: 0 } : spring.soft}>
            {Array.from({ length: 10 }, (_, n) => <span key={n} className="block h-[1em] text-center leading-none">{n}</span>)}
          </m.span>
        </span>
      ))}
    </span>
  );
}

/** Counts up from 0 the first time it is on screen. */
export function CountUp({ to, className = '' }: { to: number; className?: string }) {
  const [n, setN] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) { setN(to); return; }
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const step = (t: number) => { const p = Math.min(1, (t - start) / 900); setN(Math.round(to * (1 - Math.pow(1 - p, 3)))); if (p < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [to, reduce]);
  return <span ref={ref} className={`tabular-nums ${className}`}>{n}</span>;
}

type BtnKind = 'primary' | 'secondary' | 'ghost' | 'gold';
const KIND: Record<BtnKind, string> = {
  primary: 'bg-green text-white shadow-[0_6px_18px_-6px_rgb(10_122_80/.55)] hover:shadow-[0_10px_24px_-8px_rgb(10_122_80/.6)] dark:shadow-[0_0_24px_-4px_var(--glow)]',
  secondary: 'bg-surface text-ink border border-line hover:border-[color-mix(in_srgb,var(--ink)_25%,var(--line))]',
  ghost: 'text-ink hover:bg-mist',
  gold: 'bg-gold text-[#111714] shadow-[0_6px_18px_-6px_rgb(255_194_51/.6)]',
};
const base = 'inline-flex select-none items-center justify-center gap-2 rounded-2xl font-bold transition-[box-shadow,border-color,background-color] disabled:opacity-50 disabled:pointer-events-none';
const SIZE = { sm: 'h-9 px-3.5 text-[14px] rounded-xl', md: 'h-11 px-5 text-[15px]', lg: 'h-14 px-6 text-[16px]' };

/** Buttons squish on press (scale .96). */
export function Btn({ kind = 'primary', size = 'md', wide, href, className = '', children, ...rest }: {
  kind?: BtnKind; size?: keyof typeof SIZE; wide?: boolean; href?: string; className?: string; children: React.ReactNode;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onAnimationStart' | 'onDrag' | 'onDragStart' | 'onDragEnd' | 'style'>) {
  const cls = `${base} ${SIZE[size]} ${KIND[kind]} ${wide ? 'w-full' : ''} ${className}`;
  if (href) {
    const external = /^https?:\/\//.test(href);
    return (
      <m.span whileTap={press} transition={spring.snap} className={wide ? 'block w-full' : 'inline-block'}>
        {external ? <a href={href} className={cls}>{children}</a> : <Link href={href} className={cls}>{children}</Link>}
      </m.span>
    );
  }
  return <m.button whileTap={press} transition={spring.snap} className={cls} {...rest}>{children}</m.button>;
}

/** Placeholder card while content loads: a shimmer sweep, never a spinner. */
export function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-[22px] border border-line bg-surface">
      <div className="shimmer aspect-[16/10]" />
      <div className="space-y-2.5 p-4"><div className="shimmer h-4 w-3/4 rounded" /><div className="shimmer h-3 w-1/2 rounded" /><div className="shimmer h-7 w-28 rounded-full" /></div>
    </div>
  );
}

export function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <m.button type="button" aria-pressed={on} onClick={onClick} whileTap={{ scale: 0.92 }} animate={{ scale: on ? [1, 1.08, 1] : 1 }} transition={{ duration: 0.28, ease: "easeOut" }}
      className={`h-9 shrink-0 rounded-full border px-3.5 text-[14px] font-semibold transition-colors ${on ? 'border-transparent bg-ink text-paper' : 'border-line bg-surface text-muted hover:text-ink'}`}>
      {children}
    </m.button>
  );
}
