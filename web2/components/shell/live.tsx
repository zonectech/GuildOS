'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Award, BellRing, MessageCircle } from 'lucide-react';
import { myChats, unread as inboxUnread } from '@/lib/api/inbox';
import { notifications, unreadCount, web2LinkFor, type Notice } from '@/lib/api/session';
import { classic } from '@/lib/api/client';
import { usePoll } from '@/lib/poll';
import { Stamp } from '@/components/brand/stamp';
import { CommunityLogo } from '@/components/communities/bits';
import { fmtWhen } from '@/lib/format';
import { useToast } from '@/components/ui/toast';

/** Which pop-up alerts a student wants (per device; the server only knows about emails). */
export type AlertPrefs = { chats: boolean; eventUpdates: boolean; stamps: boolean };
const PREFS_KEY = 'otr-alerts';
export function readAlertPrefs(): AlertPrefs {
  try { return { chats: true, eventUpdates: true, stamps: true, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') }; }
  catch { return { chats: true, eventUpdates: true, stamps: true }; }
}
export function saveAlertPrefs(p: AlertPrefs) { try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* storage blocked */ } }
/** How every unread count is written (nav badges and the tab title): 1 to 9, then "9+". */
export const capCount = (n: number) => (n > 9 ? '9+' : String(n));
/** Ask the shell to refresh the counts now (e.g. after "Mark all as read"). */
export const refreshLive = () => window.dispatchEvent(new Event('live:refresh'));

export interface LiveCounts { notifications: number; chats: number; team: number; announcements: number }
/** The one store every badge reads (sidebar, phone bar, page headers, tab title), so numbers always match. */
export const LiveContext = createContext<LiveCounts>({ notifications: 0, chats: 0, team: 0, announcements: 0 });
export const useLiveCounts = () => useContext(LiveContext);

/**
 * Unread counts for the nav badges and the tab title, checked every 15 s while the tab is visible.
 * Routing: chat replies toast unless you're looking at that chat; event updates, stamps and
 * certificates toast; announcements only show a dot; everything else just counts on the bell.
 */
export function useLive(on: boolean): LiveCounts {
  const router = useRouter();
  const path = usePathname();
  const toast = useToast();
  const [counts, setCounts] = useState<LiveCounts>({ notifications: 0, chats: 0, team: 0, announcements: 0 });
  const seenChat = useRef<Map<string, string> | null>(null);
  const seenNoticeAt = useRef<string | null>(null);
  const prev = useRef(counts);

  const open = useCallback((link: string) => {
    if (/^https?:\/\//.test(link)) window.location.href = link;
    else if (web2LinkFor(link)) router.push(web2LinkFor(link) as string);
    else window.location.href = classic(link);
  }, [router]);

  const busy = useRef(false);
  const tick = useCallback(async () => {
    // One check at a time: overlapping checks would toast the same message twice.
    if (busy.current) return false;
    busy.current = true;
    try { return await check(); } finally { busy.current = false; }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, router, toast]);

  const check = useCallback(async () => {
    const [n, inbox] = await Promise.all([unreadCount().catch(() => ({ count: prev.current.notifications })), inboxUnread().catch(() => null)]);
    const next: LiveCounts = { notifications: n.count, chats: inbox?.chats ?? prev.current.chats, team: inbox?.team ?? prev.current.team, announcements: inbox?.announcements ?? prev.current.announcements };
    const first = seenChat.current === null;
    const prefs = readAlertPrefs();

    // Chat replies: toast only if you're not already looking at that conversation.
    if (first || next.chats > prev.current.chats) {
      const chats = await myChats().catch(() => []);
      const seen = seenChat.current ?? new Map<string, string>();
      if (!first && prefs.chats) {
        const viewing = window.location.pathname === '/inbox' ? new URLSearchParams(window.location.search).get('chat') : null;
        for (const c of chats) {
          if (!c.unread || !c.lastFromTeam || c.id === viewing || seen.get(c.id) === c.lastMessageAt) continue;
          // Community on the first line, "Sender · Title" on the second, then the message. Opening the chat marks it read.
          toast(c.lastMessage, c.community ? <CommunityLogo c={c.community} size={36} /> : <MessageCircle size={18} className="text-green-text" />, {
            key: `chat:${c.id}`, title: c.community?.name ?? 'Message', subtitle: [c.repliedBy, c.repliedByTitle].filter(Boolean).join(' · '),
            onClick: () => { router.push(`/inbox?chat=${c.id}`); setTimeout(refreshLive, 1500); },
          });
        }
      }
      seenChat.current = new Map(chats.map((c) => [c.id, c.lastMessageAt]));
    }

    // Notifications: event updates (urgent), stamps and certificates pop a toast.
    if (first || next.notifications > prev.current.notifications) {
      const list = await notifications().then((r) => r.items).catch(() => [] as Notice[]);
      const since = seenNoticeAt.current;
      if (!first && since) {
        for (const x of list.filter((y) => !y.read && y.createdAt > since).slice(0, 3)) {
          if (x.category === 'EVENT_UPDATE' && prefs.eventUpdates) toast(x.body || x.title, <BellRing size={18} className="text-coral-text" />, { key: `notice:${x.id}`, title: x.title, subtitle: x.eventStart ? fmtWhen(x.eventStart, x.eventTimezone) : undefined, onClick: () => open(x.link) });
          else if (x.category === 'STAMP' && prefs.stamps) toast(x.title, <Stamp size={30} tilt={-8} label="Stamped" />, { key: `notice:${x.id}`, title: 'Stamp added', onClick: () => router.push('/me') });
          else if (x.category === 'CERTIFICATE' && prefs.stamps) toast(x.title, <Award size={18} className="text-[var(--stamp-gold)]" />, { key: `notice:${x.id}`, title: 'Certificate ready', onClick: () => open(x.link) });
        }
      }
      seenNoticeAt.current = list[0]?.createdAt ?? since ?? new Date(0).toISOString();
    }

    const changed = JSON.stringify(next) !== JSON.stringify(prev.current);
    prev.current = next;
    setCounts(next);
    return changed;
  }, [open, router, toast]);

  useEffect(() => { if (on) void tick(); }, [on, path, tick]);
  useEffect(() => {
    if (!on) return;
    const f = () => void tick();
    window.addEventListener('live:refresh', f);
    return () => window.removeEventListener('live:refresh', f);
  }, [on, tick]);
  usePoll(tick, 15_000, on);

  // "(3) OnTheRoll" in the browser tab while something is unread.
  const total = counts.notifications + counts.chats + counts.team;
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\+?\)\s*/, '');
    document.title = on && total ? `(${capCount(total)}) ${base}` : base;
  }, [total, on, path]);
  return on ? counts : { notifications: 0, chats: 0, team: 0, announcements: 0 };
}
