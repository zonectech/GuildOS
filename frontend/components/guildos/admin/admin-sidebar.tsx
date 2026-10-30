'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShieldCheck, LayoutDashboard, BadgeCheck, KeyRound, Briefcase, UsersRound, Flag, BarChart3, LogOut, ArrowLeft, Archive, Ticket, Building2 } from 'lucide-react';
import { getCurrentUser, logout } from '../api/auth-api';

const adminNav = [
  { label: 'Console', href: '/dashboard/admin', icon: LayoutDashboard },
  { label: 'Community verification', href: '/dashboard/admin/verification', icon: BadgeCheck },
  { label: 'All communities', href: '/dashboard/admin/communities', icon: Building2 },
  { label: 'Community access', href: '/dashboard/admin/community-access', icon: KeyRound },
  { label: 'Recruiter verification', href: '/dashboard/admin/recruiters', icon: Briefcase },
  { label: 'Users & roles', href: '/dashboard/admin/users', icon: UsersRound },
  { label: 'Job review', href: '/dashboard/admin/moderation', icon: Flag },
  { label: 'Inactive & removed', href: '/dashboard/admin/inactive', icon: Archive },
  { label: 'Ticket sales', href: '/dashboard/admin/tickets', icon: Ticket },
  { label: 'Reports & analytics', href: '/dashboard/admin/reports', icon: BarChart3 },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [userName, setUserName] = useState('Administrator');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const user = await getCurrentUser();
      if (!user || cancelled) return;
      setUserName(user.fullName);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  return (
    <aside className="hidden h-full w-[248px] shrink-0 overflow-y-auto border-r border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900 px-4 py-5 text-slate-700 dark:text-slate-200 lg:flex lg:flex-col">
      <div className="flex items-center gap-3 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/20 text-rose-600 dark:text-rose-300 ring-1 ring-inset ring-rose-400/30">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">GuildOS</p>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Admin console</p>
        </div>
      </div>

      <nav className="mt-5 flex-1 space-y-1.5">
        {adminNav.map((item) => {
          const isActive = item.href === '/dashboard/admin' ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${isActive ? 'bg-slate-200/70 text-slate-950 dark:bg-slate-800 dark:text-white' : 'text-slate-600 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:bg-slate-800'}`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}

        <div className="pt-4">
          <Link
            href="/home"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 dark:text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-900 dark:text-white"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            Exit to student mode
          </Link>
        </div>
      </nav>

      <div className="mt-6 space-y-3 rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-4">
        <div>
          <p className="text-sm font-medium text-slate-900 dark:text-white">{userName}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Administrator</p>
        </div>
        <button onClick={handleLogout} className="flex w-full items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-left text-sm text-slate-600 dark:text-slate-300 transition hover:bg-slate-200 dark:hover:bg-slate-800">
          <LogOut className="h-4 w-4" /> Logout
        </button>
      </div>
    </aside>
  );
}
