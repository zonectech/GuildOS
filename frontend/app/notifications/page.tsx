'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck } from 'lucide-react';

import { getCurrentUser } from '../../components/guildos/auth-api';
import { StudentNav } from '../../components/guildos/student-nav';
import { getNotifications, markAllNotificationsRead, resolveNotifAvatar, type AppNotification } from '../../components/guildos/notification-api';

function icon(type: AppNotification['type']) {
  switch (type) {
    case 'POST_LIKE':
      return '❤️';
    case 'POST_COMMENT':
      return '💬';
    case 'COMMUNITY_FOLLOW':
      return '👥';
    case 'CERTIFICATE_EARNED':
      return '🎓';
    case 'JOIN_APPROVED':
      return '✅';
    default:
      return '🔔';
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

        {loading ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-white" />)}</div>
        ) : items.length ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <ul className="divide-y divide-slate-100">
              {items.map((n) => (
                <li key={n.id}>
                  <Link href={n.link || '#'} className={`flex items-start gap-3 px-4 py-3.5 hover:bg-slate-50 ${n.read ? '' : 'bg-indigo-50/40'}`}>
                    {n.actor?.avatar ? (
                      <img src={resolveNotifAvatar(n.actor.avatar)} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
                    ) : (
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-100 text-lg">{icon(n.type)}</span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-800">{n.title}</p>
                      {n.body ? <p className="truncate text-xs text-slate-500">{n.body}</p> : null}
                      <p className="mt-0.5 text-[11px] text-slate-400">{timeAgo(n.createdAt)}</p>
                    </div>
                    {!n.read ? <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-indigo-500" /> : null}
                  </Link>
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
