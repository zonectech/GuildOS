'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShieldCheck, ShieldAlert, LayoutDashboard, BadgeCheck, KeyRound, Briefcase, UsersRound, Flag, BarChart3, LogOut, ArrowLeft, Archive, MessageSquare, Building2, Megaphone, ScrollText, Handshake } from 'lucide-react';
import { getCurrentUser, logout } from '../auth-api';

const adminNav = [
  { label: 'Console', href: '/dashboard/admin', icon: LayoutDashboard },
  { label: 'Watchtower', href: '/dashboard/admin/watchtower', icon: ShieldAlert },
  { label: 'Community verification', href: '/dashboard/admin/verification', icon: BadgeCheck },
  { label: 'Community access', href: '/dashboard/admin/community-access', icon: KeyRound },
  { label: 'Recruiter verification', href: '/dashboard/admin/recruiters', icon: Briefcase },
  { label: 'Sponsorship pipeline', href: '/dashboard/admin/sponsorship', icon: Handshake },
  { label: 'Users & roles', href: '/dashboard/admin/users', icon: UsersRound },
  { label: 'Opportunity moderation', href: '/dashboard/admin/moderation', icon: Flag },
  { label: 'Content moderation', href: '/dashboard/admin/content', icon: MessageSquare },
  { label: 'Communities', href: '/dashboard/admin/communities', icon: Building2 },
  { label: 'Broadcast', href: '/dashboard/admin/broadcast', icon: Megaphone },
  { label: 'Inactive & removed', href: '/dashboard/admin/inactive', icon: Archive },
  { label: 'Reports & analytics', href: '/dashboard/admin/reports', icon: BarChart3 },
  { label: 'Audit log', href: '/dashboard/admin/audit', icon: ScrollText },
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
    <aside className="hidden w-[292px] shrink-0 border-r border-slate-800/90 bg-[#0B1120] px-4 py-5 text-slate-100 lg:flex lg:flex-col">
      <div className="flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-3 py-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/20 text-rose-200 ring-1 ring-inset ring-rose-400/30">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold tracking-tight text-white">GuildOS</p>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-300">Admin console</p>
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
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${isActive ? 'bg-rose-500/15 text-white ring-1 ring-inset ring-rose-400/30' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}

        <div className="pt-4">
          <Link
            href="/home"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            Exit to student mode
          </Link>
        </div>
      </nav>

      <div className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div>
          <p className="text-sm font-medium text-white">{userName}</p>
          <p className="text-xs text-rose-300">Administrator</p>
        </div>
        <button onClick={handleLogout} className="flex w-full items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-white/10">
          <LogOut className="h-4 w-4" /> Logout
        </button>
      </div>
    </aside>
  );
}
