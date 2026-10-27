'use client';

import { Menu, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { getCurrentUser, logout } from './auth-api';
import { ModeSwitch } from './mode-switch';
import { DashboardNavList } from './dashboard-nav';

export function DashboardMobileMenu() {
  const [open, setOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);
  const [userName, setUserName] = useState('Workspace user');
  const [userRole, setUserRole] = useState('Organizer');
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
      setUserRole(user.role === 'ADMIN' ? 'Admin' : 'Organizer');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const panel = drawerRef.current;
    const controls = () => Array.from(panel?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled])') ?? []);
    controls()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setOpen(false); }
      if (event.key !== 'Tab') return;
      const items = controls();
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
      triggerRef.current?.focus();
    };
  }, [open]);

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  const drawer = (
    <div className="fixed inset-0 z-[9999] lg:hidden">
      <button className="absolute inset-0 bg-slate-950/80" aria-label="Close overlay" onClick={() => setOpen(false)} />
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Community navigation"
        className="absolute inset-y-0 left-0 flex h-full w-[86%] max-w-sm flex-col border-r border-slate-200 bg-slate-50 p-4 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 shadow-[28px_0_100px_rgba(2,6,23,0.65)]"
      >
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-4">
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">GuildOS</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">Navigation</p>
          </div>
          <button
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white/5 text-slate-900 dark:text-white"
            onClick={() => setOpen(false)}
            aria-label="Close navigation menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex-1 overflow-y-auto">
          <DashboardNavList pathname={pathname} onNavigate={() => setOpen(false)} />
        </div>

        <div className="mt-4 space-y-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/5 p-4">
          <div>
            <p className="text-sm font-medium text-slate-900 dark:text-white">{userName}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">{userRole}</p>
          </div>
          <ModeSwitch active="community" compact showAdmin={showAdminMode} onNavigate={() => setOpen(false)} />
          <button
            onClick={() => void handleLogout()}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-left text-sm text-slate-600 dark:text-slate-300 transition hover:bg-slate-200 dark:hover:bg-slate-800"
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
        ref={triggerRef}
        aria-expanded={open}
        aria-label="Open navigation menu"
      >
        <Menu className="h-4 w-4" />
      </button>

      {open && mounted ? createPortal(drawer, document.body) : null}
    </>
  );
}
