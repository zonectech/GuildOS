import type { ReactNode } from 'react';
import { Badge } from './badge';
import { cx } from './cx';

type SectionHeaderProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  action?: ReactNode;
  className?: string;
};

export function SectionHeader({ eyebrow, title, subtitle, action, className }: SectionHeaderProps) {
  return (
    <div className={cx('relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900', className)}>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-sky-500" />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Badge tone="indigo" className="shadow-sm">{eyebrow}</Badge>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-[2rem]">{title}</h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-600 dark:text-slate-400">{subtitle}</p>
        </div>
        {action ? <div>{action}</div> : null}
      </div>
    </div>
  );
}
