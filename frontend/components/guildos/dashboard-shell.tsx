'use client';

import type { ReactNode } from 'react';

type DashboardShellProps = {
  sidebar: ReactNode;
  topbar: ReactNode;
  children: ReactNode;
};

export function DashboardShell({ sidebar, topbar, children }: DashboardShellProps) {
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-950 dark:text-white antialiased lg:bg-[#F8FAFC]">
      <div className="flex min-h-screen">
        <div className="hidden self-start lg:sticky lg:top-0 lg:block lg:h-screen">{sidebar}</div>
        <div className="flex min-w-0 flex-1 flex-col">
          {topbar}
          <main className="min-w-0 flex-1 px-4 pb-24 pt-6 sm:px-6 sm:pb-28 lg:px-8 lg:pt-8 lg:pb-28">
            <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 sm:gap-7">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}