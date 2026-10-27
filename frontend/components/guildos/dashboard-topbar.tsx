'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, Search } from 'lucide-react';
import { DashboardMobileMenu } from './dashboard-mobile-menu';
import { useCurrentUser } from './use-current-user';
import { UserAvatar } from './user-avatar';
import { getUnreadCount } from './notification-api';
import { ModeSwitch } from './mode-switch';

export function DashboardTopbar() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [unread, setUnread] = useState(0);
  const user = useCurrentUser();
  const profileHref = user?.profile?.username ? '/u/' + encodeURIComponent(user.profile.username) : '/home';
  const showAdminMode = user?.role === 'ADMIN';

  useEffect(() => {
    let cancelled = false;
    const load = () => getUnreadCount().then(({ count }) => !cancelled && setUnread(count)).catch(() => undefined);
    void load();
    const timer = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <header className="guild-overlay sticky top-0 z-20 border-b backdrop-blur-xl">
      <div className="flex items-center gap-4 px-4 py-4 sm:px-6 lg:px-8 lg:py-3">
        <DashboardMobileMenu />

        <div className="flex flex-1 items-center gap-3">
          <form onSubmit={onSearch} className="relative max-w-2xl flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search communities, events, people..."
              className="guild-field h-11 w-full rounded-lg border pl-10 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-400"
            />
          </form>
          <Link
            href="/notifications"
            aria-label="Notifications"
            className="guild-surface relative flex h-11 w-11 items-center justify-center rounded-lg border text-slate-600 transition hover:bg-white hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <Bell className="h-4 w-4" />
            {unread > 0 ? (
              <span className="absolute -right-1 -top-1 grid h-5 min-w-[1.25rem] place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
                {unread > 99 ? '99+' : unread}
              </span>
            ) : null}
          </Link>
        </div>

        <div className="hidden md:block">
          <ModeSwitch active="community" showAdmin={showAdminMode} />
        </div>

        <Link
          href={profileHref}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white  ring-2 ring-white dark:ring-slate-950"
        >
          <UserAvatar avatar={user?.profile?.avatar} name={user?.fullName ?? 'You'} className="grid h-11 w-11 place-items-center rounded-full" />
        </Link>
      </div>
    </header>
  );
}