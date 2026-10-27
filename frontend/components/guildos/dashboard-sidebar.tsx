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
    <aside className="hidden h-full w-[280px] shrink-0 overflow-y-auto border-r border-slate-200/80 bg-[#0F172A] px-4 py-5 text-slate-100 shadow-[0_0_0_1px_rgba(15,23,42,0.25)] lg:flex lg:flex-col">
      <div className="relative shrink-0 overflow-hidden rounded-3xl border border-white/10 bg-white/5 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-indigo-500/10 to-transparent" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 text-indigo-100 ring-1 ring-inset ring-indigo-400/20">
            G
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight text-white">GuildOS</p>
            <p className="truncate text-xs text-slate-400">Community Mode</p>
          </div>
          <span className="ml-auto rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
            Live
          </span>
        </div>
      </div>

      <div className="mt-5 flex-1">
        <DashboardNavList pathname={pathname} />
      </div>

      <div className="mt-6 shrink-0 space-y-3 rounded-3xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center gap-3">
          <UserAvatar avatar={user?.profile?.avatar} name={userName} className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-semibold text-white shadow-sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{userName}</p>
            <p className="truncate text-xs text-slate-400">{userRole}</p>
          </div>
        </div>
        <button onClick={handleLogout} className="w-full rounded-2xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-left text-sm font-medium text-slate-200 transition hover:bg-white/10">
          Logout
        </button>
      </div>
    </aside>
  );
}