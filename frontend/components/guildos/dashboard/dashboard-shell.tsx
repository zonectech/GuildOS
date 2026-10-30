'use client';

import { createContext, useContext, type ReactNode } from 'react';
import Link from 'next/link';

const DashboardShellContext = createContext(false);

type DashboardShellProps = {
  sidebar: ReactNode;
  topbar: ReactNode;
  children: ReactNode;
  focused?: boolean;
};

export function DashboardShell({ sidebar, topbar, children, focused = false }: DashboardShellProps) {
  const nested = useContext(DashboardShellContext);
  if (nested) return <>{children}</>;
  return (
    <div className="guild-workspace guild-organizer guild-page relative min-h-screen overflow-x-clip antialiased">
      {focused ? <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"><div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4"><Link href="/dashboard" className="text-sm font-semibold">GuildOS <span className="ml-2 font-normal text-slate-500">Create workspace</span></Link><Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white">Back to workspace</Link></div></header> : null}
      <div className={focused ? "relative flex min-h-[calc(100vh-65px)]" : "relative flex min-h-screen"}>
        {!focused ? <div className="hidden self-start lg:sticky lg:top-0 lg:block lg:h-screen">{sidebar}</div> : null}
        <div className="flex min-w-0 flex-1 flex-col">
          {!focused ? topbar : null}
          <main className={focused ? "min-w-0 flex-1 px-4 pt-6 sm:px-6 lg:px-8" : "min-w-0 flex-1 px-4 pb-24 pt-6 sm:px-6 sm:pb-28 lg:px-8 lg:pt-6 lg:pb-16"}>
            <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5 sm:gap-6"><DashboardShellContext.Provider value={true}>{children}</DashboardShellContext.Provider></div>
          </main>
        </div>
      </div>
    </div>
  );
}