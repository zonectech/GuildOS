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
        'overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900',
        interactive && 'transition duration-200 hover:border-slate-300 dark:hover:border-slate-600',
        className,
      )}
    >
      {children}
    </div>
  );
}
