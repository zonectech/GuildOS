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
    <div className={cx('rounded-3xl border border-slate-200 bg-white p-6 shadow-sm', className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Badge tone="indigo">{eyebrow}</Badge>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">{title}</h1>
          <p className="mt-3 max-w-2xl text-base text-slate-600">{subtitle}</p>
        </div>
        {action ? <div>{action}</div> : null}
      </div>
    </div>
  );
}
