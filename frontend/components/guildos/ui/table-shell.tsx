import type { ReactNode } from 'react';
import { cx } from './cx';

type TableShellProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function TableShell({ title, subtitle, action, children, className }: TableShellProps) {
  return (
    <section className={cx('rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm', className)}>
      <div className="flex flex-col gap-4 border-b border-slate-200 dark:border-slate-800 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-950 dark:text-white">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
        </div>
        {action ? <div>{action}</div> : null}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}
