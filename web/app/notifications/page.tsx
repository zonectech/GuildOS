'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CalendarDays, Check, Clock, GraduationCap } from 'lucide-react';
import { listNotifications, readAllNotifications, readNotification, type AppNotification } from '@/lib/account';
import { useSession } from '@/lib/session';

/** Old links point at the current site's pages; send them to the matching page here. */
function localLink(link: string) {
  if (!link || /^https?:/.test(link)) return '';
  if (link.startsWith('/dashboard') || link.startsWith('/home') || link.startsWith('/my-events')) return '/me';
  return link;
}
const ICONS: Record<string, React.ReactNode> = { CERTIFICATE_EARNED: <GraduationCap size={18} />, EVENT_REMINDER: <Clock size={18} />, EVENT_PUBLISHED: <CalendarDays size={18} /> };
const when = (iso: string) => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 1)} min ago`;
  if (mins < 1440) return `${Math.round(mins / 60)} h ago`;
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
};

export default function NotificationsPage() {
  const router = useRouter();
  const { user, loading } = useSession();
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async (before?: string) => {
    try {
      const r = await listNotifications(before);
      setItems((current) => (before ? [...(current ?? []), ...r.notifications] : r.notifications));
      setCursor(r.nextCursor);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load notifications'); setItems((c) => c ?? []); }
  }, []);
  useEffect(() => { if (!loading && !user) router.replace('/login?next=/notifications'); if (user) void load(); }, [loading, user, router, load]);

  async function open(n: AppNotification) {
    if (!n.read) void readNotification(n.id).catch(() => undefined);
    const to = localLink(n.link);
    if (to) router.push(to);
    else setItems((list) => (list ?? []).map((x) => (x.id === n.id ? { ...x, read: true } : x)));
  }

  const unread = (items ?? []).some((n) => !n.read);
  return (
    <div className="wrap page" style={{ maxWidth: 760 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>Notifications</h1>
        {unread ? <button type="button" className="btn s sm" onClick={() => readAllNotifications().then(() => setItems((l) => (l ?? []).map((n) => ({ ...n, read: true })))).catch(() => undefined)}><Check size={15} />Mark all read</button> : null}
      </div>
      {error ? <p className="error">{error}</p> : null}
      {items === null ? <p className="empty">Loading…</p> : null}
      {items?.length === 0 ? <p className="empty">Nothing yet. Approvals, reminders and certificates show up here.</p> : null}
      <div className="stack" style={{ gap: 0 }}>
        {(items ?? []).map((n) => (
          <button key={n.id} type="button" className={`note-row${n.read ? '' : ' unread'}`} onClick={() => void open(n)}>
            <span className="ni">{ICONS[n.type] ?? <Bell size={18} />}</span>
            <span className="stack" style={{ gap: 1, textAlign: 'left' }}><b>{n.title}</b><span className="small">{[n.body, when(n.createdAt)].filter(Boolean).join(' · ')}</span></span>
          </button>
        ))}
      </div>
      {cursor ? <button type="button" className="btn s" style={{ alignSelf: 'center' }} onClick={() => void load(cursor)}>Show older</button> : null}
    </div>
  );
}
