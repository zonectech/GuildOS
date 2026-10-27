'use client';

import { createContext, useContext, type ReactNode } from 'react';

const DashboardShellContext = createContext(false);

type DashboardShellProps = {
  sidebar: ReactNode;
  topbar: ReactNode;
  children: ReactNode;
};

export function DashboardShell({ sidebar, topbar, children }: DashboardShellProps) {
  const nested = useContext(DashboardShellContext);
  if (nested) return <>{children}</>;
  return (
    <div className="guild-workspace guild-organizer guild-page relative min-h-screen overflow-x-clip antialiased">
      <div className="relative flex min-h-screen">
        <div className="hidden self-start lg:sticky lg:top-0 lg:block lg:h-screen">{sidebar}</div>
        <div className="flex min-w-0 flex-1 flex-col">
          {topbar}
          <main className="min-w-0 flex-1 px-4 pb-24 pt-6 sm:px-6 sm:pb-28 lg:px-8 lg:pt-6 lg:pb-16">
            <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5 sm:gap-6"><DashboardShellContext.Provider value={true}>{children}</DashboardShellContext.Provider></div>
          </main>
        </div>
      </div>
    </div>
  );
}