import type { ReactNode } from 'react';

type ReportsChartCardProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
};

export function ReportsChartCard({ title, subtitle, children }: ReportsChartCardProps) {
  return (
    <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-slate-950 dark:text-white">{title}</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
      </div>
      <div className="mt-5">{children}</div>
    </article>
  );
}
