'use client';

import type { ReactNode } from 'react';

type DashboardShellProps = {
  sidebar: ReactNode;
  topbar: ReactNode;
  children: ReactNode;
};

export function DashboardShell({ sidebar, topbar, children }: DashboardShellProps) {
  return (
    <div className="guild-page relative min-h-screen overflow-x-clip antialiased">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-20 top-0 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl dark:bg-indigo-500/15" />
        <div className="absolute right-0 top-32 h-96 w-96 rounded-full bg-violet-500/10 blur-3xl dark:bg-violet-500/10" />
        <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-slate-100/90 to-transparent dark:from-slate-950/90" />
      </div>
      <div className="relative flex min-h-screen">
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