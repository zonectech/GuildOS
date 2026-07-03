'use client';

import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { getCurrentUser } from './auth-api';

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

export function DashboardMobileMenu() {
  const [open, setOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const user = await getCurrentUser();
      if (!cancelled && user) setIsAdmin(user.role === 'ADMIN');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <button
        className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 lg:hidden"
        onClick={() => setOpen(true)}
        aria-label="Open navigation menu"
      >
        <Menu className="h-4 w-4" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-[100] lg:hidden">
          <div className="absolute inset-0 bg-slate-950/90" />
          <div className="absolute inset-y-0 left-0 flex h-full w-[86%] max-w-sm flex-col border-r border-white/10 bg-[#0B1120] p-4 text-slate-100 shadow-[28px_0_100px_rgba(2,6,23,0.65)]">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <p className="text-sm font-semibold text-white">GuildOS</p>
                <p className="text-xs text-slate-400">Navigation</p>
              </div>
              <button
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white"
                onClick={() => setOpen(false)}
                aria-label="Close navigation menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <nav className="mt-4 space-y-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={`block rounded-xl px-3 py-3 text-sm font-medium ${isActive ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}
                  >
                    {item.label}
                  </Link>
                );
              })}

              {isAdmin ? (
                <div className="pt-3">
                  <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Administration</p>
                  {adminNavItems.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                    return (
                      <Link
                        key={item.label}
                        href={item.href}
                        className={`block rounded-xl px-3 py-3 text-sm font-medium ${isActive ? 'bg-indigo-500/20 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}
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
                <p className="text-sm font-medium text-white">Taye Mensah</p>
                <p className="text-xs text-slate-400">Workspace admin</p>
              </div>
              <button className="w-full rounded-xl border border-white/10 px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-white/5">
                Switch workspace
              </button>
              <button className="w-full rounded-xl border border-white/10 px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-white/5">
                Logout
              </button>
            </div>
          </div>

          <button className="absolute inset-0" aria-label="Close overlay" onClick={() => setOpen(false)} />
        </div>
      ) : null}
    </>
  );
}
