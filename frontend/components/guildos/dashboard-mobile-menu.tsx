'use client';

import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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
  { label: 'Settings', href: '/dashboard/settings' },
];

export function DashboardMobileMenu() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [userName, setUserName] = useState('Workspace user');
  const [userRole, setUserRole] = useState('Student');
  const [showAdminMode, setShowAdminMode] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const user = await getCurrentUser();
      if (!user || cancelled) return;
      setUserName(user.fullName);
      setShowAdminMode(user.role === 'ADMIN');
      setUserRole(
        user.role.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  const drawer = (
    <div className="fixed inset-0 z-[9999] lg:hidden">
      <button className="absolute inset-0 bg-slate-950/80" aria-label="Close overlay" onClick={() => setOpen(false)} />
      <div
        style={{ backgroundColor: '#0f172a' }}
        className="absolute inset-y-0 left-0 flex h-full w-[86%] max-w-sm flex-col border-r border-white/10 p-4 text-slate-100 shadow-[28px_0_100px_rgba(2,6,23,0.65)]"
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <p className="text-sm font-semibold text-white">GuildOS</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">Navigation</p>
          </div>
          <button
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white"
            onClick={() => setOpen(false)}
            aria-label="Close navigation menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="mt-4 flex-1 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`block rounded-xl px-3 py-3 text-sm font-medium ${isActive ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div>
            <p className="text-sm font-medium text-white">{userName}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">{userRole}</p>
          </div>
          <ModeSwitch active="community" tone="dark" compact showAdmin={showAdminMode} onNavigate={() => setOpen(false)} />
          <button
            onClick={() => void handleLogout()}
            className="w-full rounded-xl border border-white/10 px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-white/10"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800 lg:hidden"
        onClick={() => setOpen(true)}
        aria-label="Open navigation menu"
      >
        <Menu className="h-4 w-4" />
      </button>

      {open && mounted ? createPortal(drawer, document.body) : null}
    </>
  );
}
