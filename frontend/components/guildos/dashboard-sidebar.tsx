'use client';

import { useCurrentUser } from './use-current-user';
import { UserAvatar } from './user-avatar';
import { usePathname } from 'next/navigation';
import { logout } from './auth-api';
import { DashboardNavList } from './dashboard-nav';

export function DashboardSidebar() {
  const pathname = usePathname();
  const user = useCurrentUser();
  const userName = user?.fullName ?? 'Workspace user';
  const userRole = user?.role === 'ADMIN' ? 'Admin' : 'Organizer';

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  return (
    <aside className="hidden h-full w-[224px] shrink-0 overflow-y-auto border-r border-slate-200/80 bg-slate-50 dark:bg-slate-900 px-3 py-4 text-slate-700 dark:text-slate-200 lg:flex lg:flex-col">
      <div className="shrink-0 border-b border-slate-200 px-2 pb-5 dark:border-slate-800">
        <div className="relative flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
            G
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">GuildOS</p>
            <p className="truncate text-xs text-slate-400">Community Mode</p>
          </div>
        </div>
      </div>

      <div className="mt-5 flex-1">
        <DashboardNavList pathname={pathname} />
      </div>

      <div className="mt-6 shrink-0 space-y-3 border-t border-slate-200 px-2 pt-4 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <UserAvatar avatar={user?.profile?.avatar} name={userName} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-600 text-sm font-semibold text-white shadow-sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{userName}</p>
            <p className="truncate text-xs text-slate-400">{userRole}</p>
          </div>
        </div>
        <button onClick={handleLogout} className="w-full rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 px-3.5 py-2.5 text-left text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700">
          Logout
        </button>
      </div>
    </aside>
  );
}