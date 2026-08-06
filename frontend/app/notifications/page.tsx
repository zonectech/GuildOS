'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AtSign, Award, Bell, BellRing, Calendar, CheckCheck, GraduationCap, Handshake, Heart, Megaphone, MessageCircle, Ticket, UserCheck, Users, type LucideIcon } from 'lucide-react';

import { getCurrentUser } from '../../components/guildos/auth-api';
import { StudentNav } from '../../components/guildos/student-nav';
import { getNotifications, markAllNotificationsRead, resolveNotifAvatar, type AppNotification, type NotificationActor } from '../../components/guildos/notification-api';
import { disablePush, enablePush, getPushState, type PushState } from '../../components/guildos/push-client';

function StackedAvatars({ actors }: { actors: NotificationActor[] }) {
  const shown = actors.slice(0, 5);
  return (
    <div className="flex shrink-0 -space-x-2">
      {shown.map((a) => {
        const src = resolveNotifAvatar(a.avatar);
        const inner = src ? (
          <img src={src} alt={a.fullName} className="h-9 w-9 rounded-full object-cover ring-2 ring-white" />
        ) : (
          <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600 ring-2 ring-white">{a.fullName.slice(0, 1)}</span>
        );
        return a.username ? (
          <Link key={a.id} href={`/profile/${encodeURIComponent(a.username)}`} title={a.fullName} className="transition hover:z-10 hover:-translate-y-0.5">
            {inner}
          </Link>
        ) : (
          <span key={a.id} title={a.fullName}>{inner}</span>
        );
      })}
    </div>
  );
}

type IconMeta = { Icon: LucideIcon; tint: string; iconColor: string };

/**
 * Type-aware icon + tint for a notification. SYSTEM/MENTION notifications don't carry a
 * specific sub-type from the API, so we sniff the title for common patterns (ticket sales,
 * certificate/leadership handover, event reminders) rather than falling back to a flat grey
 * bell for every one of them.
 */
function iconMeta(n: AppNotification): IconMeta {
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
      return { Icon: Megaphone, tint: 'bg-slate-100', iconColor: 'text-slate-500' };
    }
  }
}

function timeAgo(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(value).toLocaleDateString();
}

export default function NotificationsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pushState, setPushState] = useState<PushState>('unsupported');
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState('');

  useEffect(() => {
    void getPushState().then(setPushState).catch(() => undefined);
  }, []);

  async function togglePush() {
    setPushBusy(true);
    setPushError('');
    try {
      setPushState(pushState === 'on' ? await disablePush() : await enablePush());
    } catch (error) {
      setPushError(error instanceof Error ? error.message : 'Unable to update push notifications');
    } finally {
      setPushBusy(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const user = await getCurrentUser();
      if (cancelled) return;
      if (!user) {
        router.replace('/login');
        return;
      }
      try {
        const { notifications, nextCursor } = await getNotifications();
        if (cancelled) return;
        setItems(notifications);
        setCursor(nextCursor);
        if (notifications.some((n) => !n.read)) {
          await markAllNotificationsRead().catch(() => undefined);
          setItems((list) => list.map((n) => ({ ...n, read: true })));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const { notifications, nextCursor } = await getNotifications(cursor);
      setItems((list) => [...list, ...notifications]);
      setCursor(nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <StudentNav />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-5 flex items-center justify-between">
          <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-950"><Bell className="h-5 w-5" /> Notifications</h1>
          {items.some((n) => !n.read) ? (
            <button onClick={() => { void markAllNotificationsRead(); setItems((l) => l.map((n) => ({ ...n, read: true }))); }} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <CheckCheck className="h-4 w-4" /> Mark all read
            </button>
          ) : null}
        </div>

        {pushState !== 'unsupported' ? (
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-indigo-50">
              <BellRing className="h-[18px] w-[18px] text-indigo-600" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-800">Device notifications</p>
              <p className="text-xs text-slate-500">
                {pushState === 'blocked'
                  ? 'Blocked in your browser settings — allow notifications for this site to enable them.'
                  : pushState === 'on'
                    ? 'This device gets a notification even when GuildOS is closed.'
                    : 'Get event reminders and activity alerts on this device, even when GuildOS is closed.'}
              </p>
              {pushError ? <p className="mt-0.5 text-xs text-rose-600">{pushError}</p> : null}
            </div>
            {pushState !== 'blocked' ? (
              <button
                onClick={() => void togglePush()}
                disabled={pushBusy}
                role="switch"
                aria-checked={pushState === 'on'}
                className={`relative h-6 w-11 shrink-0 rounded-full transition ${pushState === 'on' ? 'bg-indigo-600' : 'bg-slate-300'} ${pushBusy ? 'opacity-60' : ''}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${pushState === 'on' ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            ) : null}
          </div>
        ) : null}

        {loading ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-white" />)}</div>
        ) : items.length ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <ul className="divide-y divide-slate-100">
              {items.map((n) => (
                <li key={n.id}>
                  {n.type === 'POST_LIKE' && n.actors.length ? (
                    <div className={`flex items-start gap-3 px-4 py-3.5 ${n.read ? '' : 'bg-indigo-50/40'}`}>
                      <StackedAvatars actors={n.actors} />
                      <Link href={n.link || '#'} className="min-w-0 flex-1 hover:opacity-80">
                        <p className="text-sm text-slate-800">{n.title}</p>
                        {n.body ? <p className="truncate text-xs text-slate-500">{n.body}</p> : null}
                        <p className="mt-0.5 text-[11px] text-slate-400">{timeAgo(n.createdAt)}</p>
                      </Link>
                      {!n.read ? <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-indigo-500" /> : null}
                    </div>
                  ) : (
                    <Link href={n.link || '#'} className={`group relative flex items-start gap-3 px-4 py-3.5 transition hover:bg-slate-50 ${n.read ? '' : 'bg-indigo-50/40'}`}>
                      {!n.read ? <span className="absolute inset-y-0 left-0 w-0.5 bg-indigo-500" /> : null}
                      {n.actor?.avatar ? (
                        <img src={resolveNotifAvatar(n.actor.avatar)} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-black/5" />
                      ) : (
                        (() => {
                          const { Icon, tint, iconColor } = iconMeta(n);
                          return (
                            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${tint} transition group-hover:scale-105`}>
                              <Icon className={`h-[18px] w-[18px] ${iconColor}`} />
                            </span>
                          );
                        })()
                      )}
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm ${n.read ? 'text-slate-800' : 'font-medium text-slate-900'}`}>{n.title}</p>
                        {n.body ? <p className="truncate text-xs text-slate-500">{n.body}</p> : null}
                        <p className="mt-0.5 text-[11px] text-slate-400">{timeAgo(n.createdAt)}</p>
                      </div>
                      {!n.read ? <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-500" /> : null}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
            {cursor ? (
              <button onClick={() => void loadMore()} disabled={loadingMore} className="w-full border-t border-slate-100 py-3 text-sm font-medium text-indigo-600 hover:bg-slate-50 disabled:opacity-60">
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            ) : null}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center">
            <Bell className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm text-slate-500">No notifications yet. Interactions with your posts, communities, and certificates will show up here.</p>
          </div>
        )}
      </main>
    </div>
  );
}
