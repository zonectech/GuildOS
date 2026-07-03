'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getCurrentUser, logout } from './auth-api';

const navItems = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Communities', href: '/dashboard/communities' },
  { label: 'Events', href: '/dashboard/events' },
  { label: 'Members', href: '/dashboard/members' },
  { label: 'Certificates', href: '/dashboard/certificates' },
  { label: 'Verification', href: '/dashboard/verification' },
  { label: 'Reports', href: '/dashboard/reports' },
  { label: 'Settings', href: '/dashboard/settings' },
];

const adminNavItems = [
  { label: 'Admin Console', href: '/dashboard/admin' },
  { label: 'Users & Roles', href: '/dashboard/admin/users' },
  { label: 'Recruiter Verification', href: '/dashboard/recruiters' },
  { label: 'Opportunity Moderation', href: '/dashboard/moderation' },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const [userName, setUserName] = useState('Workspace user');
  const [userRole, setUserRole] = useState('Student');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const user = await getCurrentUser();
      if (!user || cancelled) return;

      setUserName(user.fullName);
      setIsAdmin(user.role === 'ADMIN');
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
    <aside className="hidden w-[292px] shrink-0 border-r border-slate-800/90 bg-[#0F172A] px-4 py-5 text-slate-100 lg:flex lg:flex-col">
      <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/5 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 text-indigo-200 ring-1 ring-inset ring-indigo-400/20">
          G
        </div>
        <div>
          <p className="text-sm font-semibold tracking-tight text-white">GuildOS</p>
          <p className="text-xs text-slate-400">Campus operations</p>
        </div>
      </div>

      <nav className="mt-5 flex-1 space-y-1.5">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${isActive ? 'bg-white/10 text-white ring-1 ring-inset ring-white/10' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}
            >
              {item.label}
            </Link>
          );
        })}

        {isAdmin ? (
          <div className="pt-4">
            <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Administration</p>
            {adminNavItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${isActive ? 'bg-indigo-500/20 text-white ring-1 ring-inset ring-indigo-400/30' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        ) : null}
      </nav>

      <div className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div>
          <p className="text-sm font-medium text-white">{userName}</p>
          <p className="text-xs text-slate-400">{userRole}</p>
        </div>
        <button className="w-full rounded-xl border border-white/10 px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-white/10">
          Switch workspace
        </button>
        <button onClick={handleLogout} className="w-full rounded-xl border border-white/10 px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-white/10">
          Logout
        </button>
      </div>
    </aside>
  );
}