import type { ReactNode } from 'react';
import { cx } from './cx';

type SectionHeaderProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  action?: ReactNode;
  /** A row under the title for page-wide controls (e.g. the community picker), so they don't need a card of their own. */
  toolbar?: ReactNode;
  className?: string;
};

export function SectionHeader({ eyebrow, title, subtitle, action, toolbar, className }: SectionHeaderProps) {
  return (
    <div className={cx('relative border-b border-slate-200 pb-5 dark:border-slate-800', className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 basis-64">
          <p className="text-[11px] font-semibold tracking-wide text-slate-500 dark:text-slate-400">{eyebrow}</p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-2xl">{title}</h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">{subtitle}</p>
        </div>
        {action ? <div className="max-w-full shrink-0">{action}</div> : null}
      </div>
      {toolbar ? <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">{toolbar}</div> : null}
    </div>
  );
}
