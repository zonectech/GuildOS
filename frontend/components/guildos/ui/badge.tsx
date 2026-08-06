import type { ReactNode } from 'react';
import { cx } from './cx';

type BadgeProps = {
  children: ReactNode;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'indigo';
  className?: string;
};

export function Badge({ children, tone = 'default', className }: BadgeProps) {
  const tones = {
    default: 'bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    danger: 'bg-rose-50 text-rose-700 border-rose-200',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  };

  return (
    <span className={cx('inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium', tones[tone], className)}>
      {children}
    </span>
  );
}
