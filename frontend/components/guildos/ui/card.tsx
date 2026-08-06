import type { ReactNode } from 'react';
import { cx } from './cx';

type CardProps = {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
};

export function Card({ children, className = '', interactive = false }: CardProps) {
  return (
    <div
      className={cx(
        'rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm',
        interactive && 'transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md',
        className,
      )}
    >
      {children}
    </div>
  );
}
