'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getCurrentUser, logout } from './auth-api';
import { ModeSwitch } from './mode-switch';

const navItems = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Communities', href: '/dashboard/communities' },
  { label: 'Events', href: '/dashboard/events' },
  { label: 'Members', href: '/dashboard/members' },
  { label: 'Certificates', href: '/dashboard/certificates' },
  { label: 'Wallet', href: '/dashboard/wallet' },
  { label: 'Moderation', href: '/dashboard/moderation' },
  { label: 'Settings', href: '/dashboard/settings' },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const [userName, setUserName] = useState('Workspace user');
  const [userRole, setUserRole] = useState('Student');
  const [showAdminMode, setShowAdminMode] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const user = await getCurrentUser();
      if (!user || cancelled) return;

      setUserName(user.fullName);
      setShowAdminMode(user.role === 'ADMIN');
      const prettyRole = user.role
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase());
      setUserRole(prettyRole);
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
    <aside className="hidden w-[300px] shrink-0 border-r border-slate-200/80 bg-[#0F172A] px-4 py-5 text-slate-100 shadow-[0_0_0_1px_rgba(15,23,42,0.25)] lg:flex lg:flex-col">
      <div className="relative overflow-hidden rounded-3xl border border-white/8 bg-white/5 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-indigo-500/10 to-transparent" />
        <div className="relative flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 text-indigo-100 ring-1 ring-inset ring-indigo-400/20">
          G
        </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight text-white">GuildOS</p>
            <p className="truncate text-xs text-slate-400">Campus operations workspace</p>
          </div>
          <span className="ml-auto rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
            Live
          </span>
        </div>
      </div>

      <nav className="mt-5 flex-1 space-y-1.5">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.label}
              href={item.href}
              className={`group relative flex items-center rounded-2xl px-3.5 py-2.75 text-sm font-medium transition-all duration-200 ${isActive ? 'bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}
            >
              <span className={`absolute inset-y-2 left-0 w-1 rounded-r-full transition-opacity ${isActive ? 'bg-indigo-400 opacity-100' : 'bg-transparent opacity-0 group-hover:opacity-50'}`} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-6 space-y-4 rounded-3xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-semibold text-white shadow-sm">
            {userName.slice(0, 1)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{userName}</p>
            <p className="truncate text-xs text-slate-400">{userRole}</p>
          </div>
        </div>
        <ModeSwitch active="community" tone="dark" compact showAdmin={showAdminMode} />
        <button onClick={handleLogout} className="w-full rounded-2xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-left text-sm font-medium text-slate-200 transition hover:bg-white/10">
          Logout
        </button>
      </div>
    </aside>
  );
}