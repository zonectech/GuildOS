'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Home, CalendarDays, Briefcase, FileText, Trophy, Users, LayoutDashboard, LogOut, Settings, User, ChevronDown, Bell, Search } from 'lucide-react';

import { getCurrentUser, logout, type AuthUser } from './auth-api';
import { getNotifications, getUnreadCount, markAllNotificationsRead, resolveNotifAvatar, type AppNotification } from './notification-api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function resolveAvatar(avatar?: string) {
  if (!avatar) return '';
  if (avatar.startsWith('http')) return avatar;
  if (avatar.startsWith('/')) return `${API_BASE_URL}${avatar}`;
  return `${API_BASE_URL}/uploads/${avatar}`;
}

const LINKS = [
  { href: '/home', label: 'Home', icon: Home },
  { href: '/events', label: 'Events', icon: CalendarDays },
  { href: '/opportunities', label: 'Jobs', icon: Briefcase },
  { href: '/cv', label: 'CV', icon: FileText },
  { href: '/reputation', label: 'Guild Score', icon: Trophy },
  { href: '/communities', label: 'Communities', icon: Users },
];

export function StudentNav({ active }: { active?: string }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState<AppNotification[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [query, setQuery] = useState('');
  const menuRef = useRef<HTMLDivElement | null>(null);
  const notifRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setUser(await getCurrentUser());
      } catch {
        setUser(null);
      }
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { count } = await getUnreadCount();
        if (!cancelled) setUnread(count);
      } catch {
        /* ignore */
      }
    })();
    const timer = setInterval(() => {
      void getUnreadCount().then(({ count }) => setUnread(count)).catch(() => undefined);
    }, 60000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  async function loadNotifs() {
    const next = !notifOpen;
    setNotifOpen(next);
    if (!next) return;
    try {
      const { notifications } = await getNotifications();
      setNotifs(notifications);
      if (notifications.some((n) => !n.read)) {
        await markAllNotificationsRead().catch(() => undefined);
        setUnread(0);
        setNotifs((list) => (list ? list.map((n) => ({ ...n, read: true })) : list));
      }
    } catch {
      setNotifs([]);
    }
  }

  function notifIcon(type: AppNotification['type']) {
    switch (type) {
      case 'POST_LIKE':
        return '\u2764\uFE0F';
      case 'POST_COMMENT':
        return '\uD83D\uDCAC';
      case 'COMMUNITY_FOLLOW':
        return '\uD83D\uDC65';
      case 'CERTIFICATE_EARNED':
        return '\uD83C\uDF93';
      case 'JOIN_APPROVED':
        return '\u2705';
      default:
        return '\uD83D\uDD14';
    }
  }

  function onSearch(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  async function handleLogout() {
    try {
      await logout();
    } catch {
      /* ignore */
    }
    router.replace('/login');
  }

  const avatar = resolveAvatar(user?.profile?.avatar);
  const initial = (user?.fullName ?? 'U').slice(0, 1).toUpperCase();
  const profileHref = user?.profile?.username ? `/u/${encodeURIComponent(user.profile.username)}` : '/profile';

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2">
        <Link href="/home" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-600 text-sm font-bold text-white">G</span>
        </Link>

        <form onSubmit={onSearch} className="relative hidden sm:block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="w-36 rounded-full border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-sm text-slate-700 focus:w-52 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </form>

        <nav className="flex flex-1 items-center justify-center gap-1 sm:gap-2">
          {LINKS.map((l) => {
            const Icon = l.icon;
            const isActive = active === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`relative flex flex-col items-center rounded-lg px-2 py-1 text-[11px] font-medium transition sm:px-3 ${isActive ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-900'}`}
              >
                <Icon className="h-5 w-5" />
                <span className="hidden sm:block">{l.label}</span>
                {isActive ? <span className="absolute -bottom-2 h-0.5 w-full rounded-full bg-indigo-600" /> : null}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-1">
          <div className="relative" ref={notifRef}>
            <button onClick={() => void loadNotifs()} className="relative rounded-full p-2 text-slate-500 hover:bg-slate-100" title="Notifications">
              <Bell className="h-5 w-5" />
              {unread > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">{unread > 9 ? '9+' : unread}</span>
              ) : null}
            </button>
            {notifOpen ? (
              <div className="absolute right-0 top-11 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notifications</p>
                  <Link href="/notifications" onClick={() => setNotifOpen(false)} className="text-xs font-medium text-indigo-600 hover:underline">See all</Link>
                </div>
                {notifs === null ? (
                  <p className="px-4 py-4 text-sm text-slate-400">Loading…</p>
                ) : notifs.length ? (
                  <div className="max-h-96 overflow-y-auto">
                    {notifs.slice(0, 8).map((n) => (
                      <Link key={n.id} href={n.link || '/notifications'} onClick={() => setNotifOpen(false)} className="flex items-start gap-3 px-4 py-3 text-sm hover:bg-slate-50">
                        {n.actor?.avatar ? (
                          <img src={resolveNotifAvatar(n.actor.avatar)} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                        ) : (
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-base">{notifIcon(n.type)}</span>
                        )}
                        <div className="min-w-0">
                          <p className="text-slate-800">{n.title}</p>
                          {n.body ? <p className="truncate text-xs text-slate-500">{n.body}</p> : null}
                          <p className="mt-0.5 text-[11px] text-slate-400">{new Date(n.createdAt).toLocaleDateString()}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="px-4 py-4 text-sm text-slate-400">You&apos;re all caught up 🎉</p>
                )}
              </div>
            ) : null}
          </div>

          <Link
            href="/dashboard"
            className="hidden items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 lg:flex"
            title="Switch to Community Mode"
          >
            <LayoutDashboard className="h-4 w-4" /> Community Mode
          </Link>

          <div className="relative" ref={menuRef}>
            <button onClick={() => setMenuOpen((o) => !o)} className="flex items-center gap-1 rounded-full p-0.5 hover:bg-slate-100">
              {avatar ? (
                <img src={avatar} alt="You" className="h-8 w-8 rounded-full object-cover" />
              ) : (
                <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">{initial}</span>
              )}
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>

            {menuOpen ? (
              <div className="absolute right-0 top-11 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
                <div className="border-b border-slate-100 px-4 py-3">
                  <p className="truncate text-sm font-semibold text-slate-900">{user?.fullName ?? 'You'}</p>
                  <p className="truncate text-xs text-slate-500">{user?.profile?.username ? `@${user.profile.username}` : user?.email}</p>
                </div>
                <MenuItem href={profileHref} icon={<User className="h-4 w-4" />} label="View profile" />
                <MenuItem href="/account" icon={<Settings className="h-4 w-4" />} label="Settings & availability" />
                <MenuItem href="/dashboard" icon={<LayoutDashboard className="h-4 w-4" />} label="Community Mode" />
                <button onClick={() => void handleLogout()} className="flex w-full items-center gap-2 border-t border-slate-100 px-4 py-2.5 text-left text-sm text-rose-600 hover:bg-rose-50">
                  <LogOut className="h-4 w-4" /> Log out
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}

function MenuItem({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
      <span className="text-slate-400">{icon}</span>{label}
    </Link>
  );
}
