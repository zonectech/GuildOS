'use client';
import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import * as m from 'motion/react-m';
import { AnimatePresence } from 'motion/react';
import { BellRing, MessageCircle } from 'lucide-react';
import { announcements as loadAnnouncements, blockedList, eventUpdates, markAnnouncementsSeen, myChats, unblockCommunity, unread, type Announcement, type Conversation, type Unread } from '@/lib/api/inbox';
import { markRead, type Notice } from '@/lib/api/session';
import { usePoll } from '@/lib/poll';
import { spring } from '@/lib/motion';
import { useLoginGate, useSession } from '@/lib/session';
import { ChatPane } from '@/components/inbox/chat';
import { refreshLive, useLiveCounts } from '@/components/shell/live';
import { AnnouncementCard } from '@/components/inbox/announcement';
import { CommunityLogo } from '@/components/communities/bits';
import { Stamp } from '@/components/brand/stamp';
import { Btn } from '@/components/ui/bits';
import { ErrorState } from '@/components/ui/error-state';
import { useToast } from '@/components/ui/toast';
import { fmtAgo, fmtWhen } from '@/lib/format';

type Tab = 'chats' | 'announcements' | 'updates';
const ago = (iso: string) => fmtAgo(iso);
const Empty = ({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) => (
  <div className="flex flex-col items-center gap-3 rounded-[28px] border border-dashed border-line px-6 py-14 text-center"><Stamp state="empty" size={100} tilt={-6} /><b className="text-[18px]">{title}</b><p className="max-w-sm text-muted">{body}</p>{action}</div>
);

/** The student inbox: chats with communities, announcements, and updates about events you registered for. */
function Inbox() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const { user, loading } = useSession();
  // Same numbers as the nav badges (one shared store).
  const live = useLiveCounts();
  const [tab, setTab] = useState<Tab>((params.get('tab') as Tab) || (params.get('chat') ? 'chats' : 'chats'));
  const [chatId, setChatId] = useState<string | null>(params.get('chat'));
  const [counts, setCounts] = useState<Unread | null>(null);
  const [chats, setChats] = useState<Conversation[] | null>(null);
  const [anns, setAnns] = useState<Announcement[] | null>(null);
  const [seenAt, setSeenAt] = useState<string>('');
  const [updates, setUpdates] = useState<Notice[] | null>(null);
  const [blocked, setBlocked] = useState<{ id: string; name: string; slug: string; logo: string }[]>([]);
  const gate = useLoginGate('/inbox');

  const refreshCounts = useCallback(async () => { const c = await unread(); let changed = false; setCounts((cur) => { changed = !cur || cur.total !== c.total; return c; }); return changed; }, []);
  // Failed loads are kept apart from empty ones: an error shows Try again, never "no messages".
  const [failed, setFailed] = useState<{ chats?: unknown; anns?: unknown; updates?: unknown }>({});
  const [attempt, setAttempt] = useState(0);
  const retry = () => { setFailed({}); setAttempt((n) => n + 1); };
  const refreshChats = useCallback(() => myChats().then((c) => { setChats(c); setFailed((x) => ({ ...x, chats: undefined })); }).catch((e) => setFailed((x) => ({ ...x, chats: e }))), []);
  useEffect(() => { if (user) { void refreshCounts().catch(() => undefined); void refreshChats(); } }, [user, refreshCounts, refreshChats, attempt]);
  usePoll(async () => { const changed = await refreshCounts(); if (changed) void refreshChats(); return changed; }, 10_000, Boolean(user));

  useEffect(() => {
    if (!user) return;
    if (tab === 'announcements' && anns === null) {
      loadAnnouncements().then((r) => { setAnns(r.items); setSeenAt(r.seenAt); void markAnnouncementsSeen().then(refreshCounts).then(refreshLive); }).catch((e) => setFailed((x) => ({ ...x, anns: e })));
      blockedList().then(setBlocked).catch(() => undefined);
    }
    if (tab === 'updates' && updates === null) eventUpdates().then(setUpdates).catch((e) => setFailed((x) => ({ ...x, updates: e })));
  }, [tab, user, anns, updates, refreshCounts, attempt]);

  const go = (t: Tab) => { setTab(t); router.replace(`/inbox?tab=${t}`, { scroll: false }); };
  const openChat = (id: string) => { setChatId(id); router.replace(`/inbox?chat=${id}`, { scroll: false }); };
  if (!user) return gate;
  const badge = (n?: number) => (n ? <m.span key={n} initial={{ scale: 0.3 }} animate={{ scale: 1 }} transition={spring.bouncy} className="ml-1.5 inline-grid h-5 min-w-5 place-items-center rounded-full bg-coral px-1.5 text-[11.5px] font-bold text-[#111714] tabular-nums">{n > 99 ? '99+' : n}</m.span> : null);
  const tabs: [Tab, string, number | undefined][] = [['chats', 'Chats', live.chats], ['announcements', 'Announcements', live.announcements], ['updates', 'Event updates', undefined]];

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-5 px-4 pt-6 pb-24 sm:px-6 lg:px-8 lg:pt-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-[40px] font-extrabold">Inbox</h1>
        {live.team ? <Btn kind="secondary" size="sm" href="/inbox/team"><MessageCircle size={15} />Your community inbox{badge(live.team)}</Btn> : null}
      </header>
      <nav aria-label="Inbox" className="no-bar flex gap-7 overflow-x-auto border-b border-line">
        {tabs.map(([v, label, n]) => (
          <button key={v} type="button" onClick={() => go(v)} aria-pressed={tab === v} className={`relative flex items-center whitespace-nowrap pb-3 text-[15px] font-semibold ${tab === v ? 'text-ink' : 'text-muted hover:text-ink'}`}>
            {label}{badge(n)}{tab === v ? <m.span layoutId="inbox-tab" className="absolute inset-x-0 -bottom-px h-[2.5px] rounded-full bg-ink" transition={spring.snap} /> : null}
          </button>
        ))}
      </nav>

      {tab === 'chats' ? (
        <div className="grid min-h-[560px] overflow-hidden rounded-[24px] border border-line bg-surface lg:grid-cols-[340px_minmax(0,1fr)]">
          <ul className={`flex flex-col divide-y divide-line overflow-y-auto border-line lg:border-r ${chatId ? 'hidden lg:flex' : ''}`}>
            {failed.chats && chats === null ? <li className="p-3"><ErrorState compact error={failed.chats} onRetry={retry} /></li> : chats === null ? [0, 1, 2].map((i) => <li key={i} className="p-4"><div className="shimmer h-12 rounded-xl" /></li>)
              : chats.length ? chats.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => openChat(c.id)} className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-mist ${chatId === c.id ? 'bg-mist' : ''}`}>
                    {c.community ? <CommunityLogo c={c.community} size={44} /> : null}
                    <span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><b className={`truncate text-[15px] ${c.unread ? 'font-extrabold' : ''}`}>{c.community?.name}</b><small className="shrink-0 text-[12px] text-muted">{ago(c.lastMessageAt)}</small></span>
                      <span className="flex items-center gap-2"><span className={`truncate text-[13.5px] ${c.unread ? 'font-semibold text-ink' : 'text-muted'}`}>{c.lastFromTeam ? '' : 'You: '}{c.lastMessage}</span>{c.unread ? <span className="ml-auto size-2.5 shrink-0 rounded-full bg-coral" /> : null}</span></span>
                  </button>
                </li>
              )) : <li className="p-6"><Empty title="No chats yet" body="Use “Contact the host” on any event or community page to ask a question." action={<Btn href="/events">Find an event</Btn>} /></li>}
          </ul>
          <section className={`min-h-[560px] flex-col ${chatId ? 'flex' : 'hidden lg:flex'}`} aria-label="Conversation">
            {chatId ? <ChatPane key={chatId} chatId={chatId} onBack={() => { setChatId(null); router.replace('/inbox?tab=chats', { scroll: false }); }} onChanged={() => { void refreshChats(); void refreshCounts(); refreshLive(); }} />
              : <div className="grid flex-1 place-items-center p-8 text-center text-muted"><span className="flex flex-col items-center gap-2"><MessageCircle size={30} />Pick a conversation</span></div>}
          </section>
        </div>
      ) : tab === 'announcements' ? (
        <div className="flex max-w-[640px] flex-col gap-4">
          {failed.anns && anns === null ? <ErrorState compact error={failed.anns} onRetry={retry} /> : anns === null ? [0, 1].map((i) => <div key={i} className="shimmer h-40 rounded-[22px]" />)
            : anns.length ? (
              <AnimatePresence initial={false}>{anns.map((a, i) => (
                <m.div key={a.id} layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ ...spring.soft, delay: Math.min(i, 8) * 0.05 }}>
                  <AnnouncementCard a={a} isNew={Boolean(seenAt && new Date(a.createdAt) > new Date(seenAt))} onChange={(next) => setAnns((l) => l?.map((x) => (x.id === next.id ? next : x)) ?? l)}
                    onBlocked={(cid) => { setAnns((l) => l?.filter((x) => x.community?.id !== cid) ?? l); void blockedList().then(setBlocked); }} />
                </m.div>
              ))}</AnimatePresence>
            ) : <Empty title="No announcements yet" body="Communities you join post updates here, like a channel." action={<Btn href="/communities">Find communities</Btn>} />}
          {blocked.length ? (
            <section className="flex flex-col gap-2 rounded-2xl bg-mist p-4 text-[14px]"><b>Paused communities</b>
              {blocked.map((c) => <span key={c.id} className="flex items-center gap-2"><CommunityLogo c={c} size={26} /><span className="flex-1">{c.name}</span><button type="button" onClick={() => void unblockCommunity(c.id).then(() => { setBlocked((l) => l.filter((x) => x.id !== c.id)); setAnns(null); toast(`${c.name} unpaused`); })} className="font-semibold text-green-text hover:underline">Unpause</button></span>)}
            </section>
          ) : null}
        </div>
      ) : (
        <ul className="flex max-w-[640px] flex-col divide-y divide-line overflow-hidden rounded-[22px] border border-line bg-surface">
          {failed.updates && updates === null ? <li className="p-3"><ErrorState compact error={failed.updates} onRetry={retry} /></li> : updates === null ? <li className="p-4"><div className="shimmer h-12 rounded-xl" /></li>
            : updates.length ? updates.map((n) => (
              <li key={n.id}><Link href={n.link} onClick={() => { if (!n.read) void markRead(n.id); }} className={`flex items-start gap-3 px-4 py-3.5 hover:bg-mist ${n.read ? '' : 'bg-[color-mix(in_srgb,var(--tint)_55%,transparent)]'}`}>
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-mist"><BellRing size={18} className="text-green-text" /></span>
                <span className="min-w-0 flex-1"><b className="block text-[15px]">{n.title}</b>{n.body ? <span className="line-clamp-2 text-[14px] text-muted">{n.body}</span> : null}{n.eventStart ? <span className="block text-[13px] font-semibold">{fmtWhen(n.eventStart, n.eventTimezone)}</span> : null}<small className="text-[12.5px] text-muted">{ago(n.createdAt)}</small></span>
              </Link></li>
            )) : <li className="p-6"><Empty title="No event updates" body="Venue changes, reminders and cancellations for events you registered for show up here." /></li>}
        </ul>
      )}
    </div>
  );
}
export default function InboxPage() { return <Suspense fallback={null}><Inbox /></Suspense>; }
