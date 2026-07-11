'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShieldCheck, ShieldAlert, LayoutDashboard, BadgeCheck, KeyRound, Briefcase, UsersRound, Flag, BarChart3, Archive, MessageSquare, Building2, Megaphone, ScrollText, Handshake } from 'lucide-react';
import { AdminSidebar } from './admin-sidebar';

const mobileNav = [
  { label: 'Console', href: '/dashboard/admin', icon: LayoutDashboard },
  { label: 'Watchtower', href: '/dashboard/admin/watchtower', icon: ShieldAlert },
  { label: 'Verification', href: '/dashboard/admin/verification', icon: BadgeCheck },
  { label: 'Access', href: '/dashboard/admin/community-access', icon: KeyRound },
  { label: 'Recruiters', href: '/dashboard/admin/recruiters', icon: Briefcase },
  { label: 'Sponsorship', href: '/dashboard/admin/sponsorship', icon: Handshake },
  { label: 'Users', href: '/dashboard/admin/users', icon: UsersRound },
  { label: 'Moderation', href: '/dashboard/admin/moderation', icon: Flag },
  { label: 'Content', href: '/dashboard/admin/content', icon: MessageSquare },
  { label: 'Communities', href: '/dashboard/admin/communities', icon: Building2 },
  { label: 'Broadcast', href: '/dashboard/admin/broadcast', icon: Megaphone },
  { label: 'Inactive', href: '/dashboard/admin/inactive', icon: Archive },
  { label: 'Reports', href: '/dashboard/admin/reports', icon: BarChart3 },
  { label: 'Audit', href: '/dashboard/admin/audit', icon: ScrollText },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen bg-slate-100 text-slate-950 antialiased lg:bg-[#F8FAFC]">
      <div className="flex min-h-screen">
        <div className="hidden self-start lg:sticky lg:top-0 lg:block lg:h-screen">
          <AdminSidebar />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
            <div className="flex items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
              <div className="flex items-center gap-2 text-rose-600 lg:hidden">
                <ShieldCheck className="h-5 w-5" />
                <span className="text-sm font-semibold">Admin</span>
              </div>
              <div className="-mx-1 flex flex-1 items-center gap-1 overflow-x-auto lg:hidden">
                {mobileNav.map((item) => {
                  const isActive = item.href === '/dashboard/admin' ? pathname === item.href : pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${isActive ? 'bg-rose-50 text-rose-700' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
              <span className="ml-auto hidden items-center gap-2 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 lg:inline-flex">
                <ShieldCheck className="h-3.5 w-3.5" /> Administrator area
              </span>
            </div>
          </header>
          <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 sm:gap-7">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
