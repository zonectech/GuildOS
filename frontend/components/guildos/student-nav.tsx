'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Home, CalendarDays, Briefcase, FileText, Trophy, Users, LogOut, Settings, User, ChevronDown, Bell, Search, MessageSquare, AtSign, Award, Calendar, GraduationCap, Handshake, Heart, Megaphone, MessageCircle, Ticket, UserCheck, type LucideIcon } from 'lucide-react';

import { getCurrentUser, logout, searchPeople, type AuthUser, type PersonResult } from './auth-api';
import { getNotifications, getUnreadCount, markAllNotificationsRead, resolveNotifAvatar, type AppNotification, type NotificationActor } from './notification-api';
import { getUnreadMessageCount } from './message-api';
import { ThemeToggle } from './theme-toggle';
import { getCommunities, type CommunitySummary } from './community-list-api';
import { listEvents, type EventSummary } from './event-api';
import { onRealtime } from './realtime';
import { ModeSwitch } from './mode-switch';
import { studentRailItems } from './student-nav-rail';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function resolveAvatar(avatar?: string) {
  if (!avatar) return '';
  if (avatar.startsWith('http')) return avatar;
  if (avatar.startsWith('/')) return `${API_BASE_URL}${avatar}`;
  return `${API_BASE_URL}/uploads/${avatar}`;
}

const LINKS = [
  { href: '/home', label: 'Home', icon: Home },
  { href: '/communities', label: 'Communities', icon: Users },
  { href: '/events', label: 'Events', icon: CalendarDays },
  { href: '/opportunities', label: 'Jobs', icon: Briefcase },
  { href: '/cv', label: 'CV', icon: FileText },
  { href: '/reputation', label: 'Guild Score', icon: Trophy },
];

export function StudentNav({ active }: { active?: string }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState<AppNotification[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [unreadMsgs, setUnreadMsgs] = useState(0);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PersonResult[]>([]);
  const [communityResults, setCommunityResults] = useState<CommunitySummary[]>([]);
  const [eventResults, setEventResults] = useState<EventSummary[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const notifRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLDivElement | null>(null);

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
    const refreshCounts = () => {
      void getUnreadCount().then(({ count }) => { if (!cancelled) setUnread(count); }).catch(() => undefined);
      void getUnreadMessageCount().then(({ count }) => { if (!cancelled) setUnreadMsgs(count); }).catch(() => undefined);
    };
    refreshCounts();
    const timer = setInterval(refreshCounts, 60000);
    const off = onRealtime((evt) => {
      if (evt.type === 'notification' || evt.type === 'message') {
        refreshCounts();
      }
    });
    // Pages fire this after they mark things read (e.g. opening a chat) so the
    // badges clear immediately instead of waiting for the next poll.
    window.addEventListener('guildos:refresh-counts', refreshCounts);
    return () => {
      cancelled = true;
      clearInterval(timer);
      off();
      window.removeEventListener('guildos:refresh-counts', refreshCounts);
    };
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setCommunityResults([]);
      setEventResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    let cancelled = false;
    const timer = setTimeout(() => {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      void Promise.allSettled([searchPeople(q), getCommunities(), listEvents()])
        .then(([p, c, e]) => {
          if (cancelled) return;
          setResults(p.status === 'fulfilled' ? p.value.people : []);
          setCommunityResults(
            c.status === 'fulfilled'
              ? c.value.communities.filter((x) => rx.test(x.name) || rx.test(x.shortDescription ?? '')).slice(0, 4)
              : [],
          );
          setEventResults(
            e.status === 'fulfilled'
              ? e.value.events.filter((x) => rx.test(x.title) || rx.test(x.shortDescription ?? '')).slice(0, 4)
              : [],
          );
          setSearchOpen(true);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

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

  /**
   * Type-aware icon + tint for the notification dropdown. SYSTEM/MENTION notifications don't
   * carry a specific sub-type from the API, so we sniff the title for common patterns (ticket
   * sales, certificate/leadership handover, event reminders) instead of a flat grey bell.
   */
  function notifIcon(n: AppNotification): { Icon: LucideIcon; tint: string; iconColor: string } {
    switch (n.type) {
      case 'POST_LIKE':
        return { Icon: Heart, tint: 'bg-rose-50', iconColor: 'text-rose-500' };
      case 'POST_COMMENT':
      case 'MESSAGE':
        return { Icon: MessageCircle, tint: 'bg-indigo-50', iconColor: 'text-indigo-500' };
      case 'COMMUNITY_FOLLOW':
        return { Icon: Users, tint: 'bg-indigo-50', iconColor: 'text-indigo-500' };
      case 'CERTIFICATE_EARNED':
        return { Icon: GraduationCap, tint: 'bg-amber-50', iconColor: 'text-amber-600' };
      case 'JOIN_APPROVED':
        return { Icon: UserCheck, tint: 'bg-emerald-50', iconColor: 'text-emerald-600' };
      case 'CONNECTION_REQUEST':
      case 'CONNECTION_ACCEPTED':
        return { Icon: Handshake, tint: 'bg-emerald-50', iconColor: 'text-emerald-600' };
      case 'MENTION':
        return { Icon: AtSign, tint: 'bg-sky-50', iconColor: 'text-sky-600' };
      default: {
        const title = n.title.toLowerCase();
        if (title.includes('ticket')) return { Icon: Ticket, tint: 'bg-emerald-50', iconColor: 'text-emerald-600' };
        if (title.includes('certificate') || title.includes('dissolve') || title.includes('leadership') || title.includes('handover')) {
          return { Icon: Award, tint: 'bg-amber-50', iconColor: 'text-amber-600' };
        }
        if (title.includes('event') || title.includes('reminder') || title.includes('starts')) {
          return { Icon: Calendar, tint: 'bg-sky-50', iconColor: 'text-sky-600' };
        }
        return { Icon: Megaphone, tint: 'bg-slate-100 dark:bg-slate-950', iconColor: 'text-slate-500 dark:text-slate-400' };
      }
    }
  }

  function onSearch(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q) {
      setSearchOpen(false);
      router.push(`/search?q=${encodeURIComponent(q)}`);
    }
  }

  function goToPerson(username: string) {
    setSearchOpen(false);
    setQuery('');
    router.push(`/u/${encodeURIComponent(username)}`);
  }

  function goTo(path: string) {
    setSearchOpen(false);
    setQuery('');
    router.push(path);
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
    <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2">
        <Link href="/home" className="flex shrink-0 items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-600 text-sm font-bold text-white">G</span>
        </Link>

        <div ref={searchRef} className="relative hidden shrink-0 sm:block">
          <form onSubmit={onSearch} className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => {
                if (results.length || communityResults.length || eventResults.length) setSearchOpen(true);
              }}
              placeholder="Search people, communities, events"
              className="w-36 rounded-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-1.5 pl-8 pr-3 text-sm text-slate-700 dark:text-slate-300 focus:w-64 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </form>

          {searchOpen && query.trim().length >= 2 ? (
            <div className="absolute left-0 top-full z-50 mt-1 max-h-[70vh] w-80 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg">
              {searching && !results.length && !communityResults.length && !eventResults.length ? (
                <p className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">Searching…</p>
              ) : results.length || communityResults.length || eventResults.length ? (
                <>
                  {results.length ? (
                    <div className="py-1">
                      <p className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">People</p>
                      {results.slice(0, 5).map((p) => {
                        const src = resolveAvatar(p.avatar);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => goToPerson(p.username)}
                            className="flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800"
                          >
                            {src ? (
                              <img src={src} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                            ) : (
                              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 dark:bg-slate-950 text-xs font-semibold text-slate-500 dark:text-slate-400">{p.fullName.slice(0, 1)}</span>
                            )}
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium text-slate-900 dark:text-slate-100">{p.fullName}</span>
                              <span className="block truncate text-xs text-slate-400 dark:text-slate-500">@{p.username}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}

                  {communityResults.length ? (
                    <div className="border-t border-slate-100 py-1">
                      <p className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Communities</p>
                      {communityResults.map((c) => {
                        const src = resolveAvatar(c.logo);
                        return (
                          <button
                            key={c._id}
                            type="button"
                            onClick={() => goTo(`/communities/${c.slug}`)}
                            className="flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800"
                          >
                            {src ? (
                              <img src={src} alt="" className="h-8 w-8 shrink-0 rounded-lg object-cover" />
                            ) : (
                              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 dark:bg-slate-950 text-xs font-semibold text-slate-500 dark:text-slate-400">{c.name.slice(0, 1)}</span>
                            )}
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium text-slate-900 dark:text-slate-100">{c.name}</span>
                              <span className="block truncate text-xs text-slate-400 dark:text-slate-500">{c.category || 'Community'}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}

                  {eventResults.length ? (
                    <div className="border-t border-slate-100 py-1">
                      <p className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Events</p>
                      {eventResults.map((ev) => (
                        <button
                          key={ev._id}
                          type="button"
                          onClick={() => goTo(`/events/${ev.slug}`)}
                          className="flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-500 dark:bg-indigo-500/15 dark:text-indigo-300">
                            <CalendarDays className="h-4 w-4" />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-slate-900 dark:text-slate-100">{ev.title}</span>
                            {ev.shortDescription ? <span className="block truncate text-xs text-slate-400 dark:text-slate-500">{ev.shortDescription}</span> : null}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => {
                      setSearchOpen(false);
                      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
                    }}
                    className="block w-full border-t border-slate-100 px-4 py-2 text-left text-xs font-medium text-indigo-600 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    See all results
                  </button>
                </>
              ) : (
                <p className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">No matches for &ldquo;{query.trim()}&rdquo;.</p>
              )}
            </div>
          ) : null}
        </div>

        {/* Scrollable icon row: the w-max inner wrapper + mx-auto centers the icons
            when there's room, and start-aligns them when they overflow — so the Home
            icon is never clipped off the unreachable left edge (works everywhere,
            unlike `justify-content: safe center` which Safari lacks for flexbox).
            Scrollbar hidden — swipe/scroll still works. */}
        <nav className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="mx-auto flex w-max items-center gap-1 pb-1.5 sm:gap-2">
            {LINKS.map((l) => {
              const Icon = l.icon;
              const isActive = active === l.href;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  data-tour={`nav-${l.href.slice(1)}`}
                  className={`relative flex shrink-0 flex-col items-center rounded-lg px-2 py-1 text-[11px] font-medium transition sm:px-3 ${isActive ? 'text-indigo-600' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="hidden whitespace-nowrap sm:block">{l.label}</span>
                  {isActive ? <span className="absolute -bottom-1.5 h-0.5 w-full rounded-full bg-indigo-600" /> : null}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="flex shrink-0 items-center gap-1">
          <ThemeToggle />
          <Link href="/messages" data-tour="nav-messages" className="relative rounded-full p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" title="Messages">
            <MessageSquare className="h-5 w-5" />
            {unreadMsgs > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">{unreadMsgs > 9 ? '9+' : unreadMsgs}</span>
            ) : null}
          </Link>
          <div className="relative" ref={notifRef}>
            <button onClick={() => void loadNotifs()} data-tour="nav-bell" className="relative rounded-full p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" title="Notifications">
              <Bell className="h-5 w-5" />
              {unread > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">{unread > 9 ? '9+' : unread}</span>
              ) : null}
            </button>
            {notifOpen ? (
              <div className="absolute right-0 top-11 w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Notifications</p>
                  <Link href="/notifications" onClick={() => setNotifOpen(false)} className="text-xs font-medium text-indigo-600 hover:underline">See all</Link>
                </div>
                {notifs === null ? (
                  <p className="px-4 py-4 text-sm text-slate-400 dark:text-slate-500">Loading…</p>
                ) : notifs.length ? (
                  <div className="max-h-96 overflow-y-auto">
                    {notifs.slice(0, 8).map((n) => (
                      n.type === 'POST_LIKE' && n.actors.length ? (
                        <div key={n.id} className="flex items-start gap-3 px-4 py-3 text-sm">
                          <NotifStackedAvatars actors={n.actors} onNavigate={() => setNotifOpen(false)} />
                          <Link href={n.link || '/notifications'} onClick={() => setNotifOpen(false)} className="min-w-0 hover:opacity-80">
                            <p className="text-slate-800 dark:text-slate-200">{n.title}</p>
                            {n.body ? <p className="truncate text-xs text-slate-500 dark:text-slate-400">{n.body}</p> : null}
                            <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">{new Date(n.createdAt).toLocaleDateString('en-NG')}</p>
                          </Link>
                        </div>
                      ) : (
                        <Link key={n.id} href={n.link || '/notifications'} onClick={() => setNotifOpen(false)} className="flex items-start gap-3 px-4 py-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
                          {n.actor?.avatar ? (
                            <img src={resolveNotifAvatar(n.actor.avatar)} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-black/5" />
                          ) : (
                            (() => {
                              const { Icon, tint, iconColor } = notifIcon(n);
                              return (
                                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${tint}`}>
                                  <Icon className={`h-4 w-4 ${iconColor}`} />
                                </span>
                              );
                            })()
                          )}
                          <div className="min-w-0">
                            <p className="text-slate-800 dark:text-slate-200">{n.title}</p>
                            {n.body ? <p className="truncate text-xs text-slate-500 dark:text-slate-400">{n.body}</p> : null}
                            <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">{new Date(n.createdAt).toLocaleDateString('en-NG')}</p>
                          </div>
                        </Link>
                      )
                    ))}
                  </div>
                ) : (
                  <p className="px-4 py-4 text-sm text-slate-400 dark:text-slate-500">You&apos;re all caught up</p>
                )}
              </div>
            ) : null}
          </div>

          <div className="hidden lg:block">
            <ModeSwitch active="student" showAdmin={user?.role === 'ADMIN'} />
          </div>

          <div className="relative" ref={menuRef}>
            <button onClick={() => setMenuOpen((o) => !o)} className="flex items-center gap-1 rounded-full p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800">
              {avatar ? (
                <img src={avatar} alt="You" className="h-8 w-8 rounded-full object-cover" />
              ) : (
                <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600 dark:text-slate-400">{initial}</span>
              )}
              <ChevronDown className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
            </button>

            {menuOpen ? (
              <div className="absolute right-0 top-11 w-56 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg">
                <Link href={profileHref} onClick={() => setMenuOpen(false)} className="block border-b border-slate-100 dark:border-slate-800 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800">
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{user?.fullName ?? 'You'}</p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user?.profile?.username ? `@${user.profile.username}` : user?.email}</p>
                  <p className="mt-0.5 text-xs font-medium text-indigo-600 dark:text-indigo-400">View profile</p>
                </Link>
                <MenuItem href="/account" icon={<Settings className="h-4 w-4" />} label="Settings & availability" />
                <div className="border-t border-slate-100 dark:border-slate-800 lg:hidden">
                  {studentRailItems(profileHref)
                    .filter((item) => item.label !== 'Profile' && item.label !== 'Settings')
                    .map(({ href, label, Icon }) => (
                      <Link key={label} href={href} onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
                        <Icon className="h-4 w-4 text-slate-400 dark:text-slate-500" /> {label}
                      </Link>
                    ))}
                </div>
                <div className="border-t border-slate-100 px-3 py-3">
                  <ModeSwitch active="student" compact showAdmin={user?.role === 'ADMIN'} onNavigate={() => setMenuOpen(false)} />
                </div>
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
    <Link href={href} className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
      <span className="text-slate-400 dark:text-slate-500">{icon}</span>{label}
    </Link>
  );
}

function NotifStackedAvatars({ actors, onNavigate }: { actors: NotificationActor[]; onNavigate: () => void }) {
  const shown = actors.slice(0, 4);
  return (
    <div className="flex shrink-0 -space-x-2">
      {shown.map((a) => {
        const src = resolveNotifAvatar(a.avatar);
        const inner = src ? (
          <img src={src} alt={a.fullName} className="h-8 w-8 rounded-full object-cover ring-2 ring-white" />
        ) : (
          <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600 dark:text-slate-400 ring-2 ring-white">{a.fullName.slice(0, 1)}</span>
        );
        return a.username ? (
          <Link key={a.id} href={`/profile/${encodeURIComponent(a.username)}`} onClick={onNavigate} title={a.fullName} className="transition hover:z-10 hover:-translate-y-0.5">
            {inner}
          </Link>
        ) : (
          <span key={a.id} title={a.fullName}>{inner}</span>
        );
      })}
    </div>
  );
}
