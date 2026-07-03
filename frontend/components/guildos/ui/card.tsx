import type { ReactNode } from 'react';

type CardProps = {
  children: ReactNode;
  className?: string;
};

export function Card({ children, className = '' }: CardProps) {
  return <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`.trim()}>{children}</div>;
}
