import type { ReactNode } from 'react';
import { Card } from './ui/card';

type DashboardStatCardProps = {
  title: string;
  value: string;
  change: string;
  trend: 'up' | 'down';
  icon: ReactNode;
};

export function DashboardStatCard({ title, value, change, trend, icon }: DashboardStatCardProps) {
  const trendColor = trend === 'up' ? 'text-emerald-600' : 'text-rose-600';

  return (
    <Card className="p-5" interactive>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-100">
          {icon}
        </div>
      </div>
      <div className={`mt-4 text-sm font-medium ${trendColor}`}>{change}</div>
    </Card>
  );
}