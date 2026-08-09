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
        'overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900',
        interactive && 'transition duration-200 hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md',
        className,
      )}
    >
      {children}
    </div>
  );
}
