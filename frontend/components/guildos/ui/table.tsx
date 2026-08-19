import type { ReactNode } from 'react';

type TableProps = {
  children: ReactNode;
};

export function Table({ children }: TableProps) {
  return (
    <div className="guild-surface overflow-hidden rounded-2xl border shadow-sm">
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}
