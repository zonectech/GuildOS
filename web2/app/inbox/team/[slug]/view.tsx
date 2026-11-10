'use client';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import * as m from 'motion/react-m';
import { ArrowLeft, CalendarDays, ImagePlus, Megaphone, MessageCircle, Send, X } from 'lucide-react';
import type { Event } from '@/lib/api/types';
import { audienceCount, communityAnnouncements, postAnnouncement, teamChats, type Announcement, type Audience, type Conversation } from '@/lib/api/inbox';
import { canManage, getCommunity, members, ROLE_LABEL, type CommunityPage } from '@/lib/api/communities';
import { hostedEvents } from '@/lib/api/events';
import { uploadImages } from '@/lib/api/review';
import { mediaUrl } from '@/lib/api/client';
import { phaseOf } from '@/lib/events';
import { usePoll } from '@/lib/poll';
import { spring } from '@/lib/motion';
import { useSession } from '@/lib/session';
import { ChatPane } from '@/components/inbox/chat';
import { AnnouncementCard } from '@/components/inbox/announcement';
import { CommunityLogo } from '@/components/communities/bits';
import { Avatar } from '@/components/ui/avatar';
import { Btn, Chip } from '@/components/ui/bits';
import { useToast } from '@/components/ui/toast';

const ago = (iso: string) => { const s = (Date.now() - new Date(iso).getTime()) / 1000; return s < 60 ? 'now' : s < 3600 ? `${Math.floor(s / 60)}m` : s < 86400 ? `${Math.floor(s / 3600)}h` : new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' }); };

/** The community's shared inbox (Owner and Admins), and announcements. */
function Team({ slug }: { slug: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const { user, loading } = useSession();
  const [ctx, setCtx] = useState<CommunityPage | null>(null);
  const [tab, setTab] = useState<'chats' | 'announcements'>(params.get('tab') === 'announcements' ? 'announcements' : 'chats');
  const [status, setStatus] = useState<'OPEN' | 'RESOLVED'>('OPEN');
  const [chats, setChats] = useState<Conversation[] | null>(null);
  const [chatId, setChatId] = useState<string | null>(params.get('chat'));
  useEffect(() => { if (!loading && !user) router.replace(`/login?next=/inbox/team/${slug}`); }, [loading, user, router, slug]);
  useEffect(() => { if (user) getCommunity(slug).then(setCtx).catch(() => undefined); }, [user, slug]);
  const cid = ctx?.community.id;
  const load = useCallback(async () => {
    if (!cid) return false;
    const next = await teamChats(cid, status);
    let changed = false;
    setChats((cur) => { changed = JSON.stringify(cur?.map((c) => [c.id, c.lastMessageAt, c.unread])) !== JSON.stringify(next.map((c) => [c.id, c.lastMessageAt, c.unread])); return next; });
    return changed;
  }, [cid, status]);
  useEffect(() => { setChats(null); void load().catch(() => setChats([])); }, [load]);
  usePoll(load, 10_000, Boolean(cid) && tab === 'chats');

  if (!user || !ctx) return <div className="mx-auto max-w-[1100px] px-4 pt-10"><div className="shimmer h-[520px] rounded-[24px]" /></div>;
  if (!canManage(ctx.viewerRole)) return <div className="mx-auto max-w-lg px-6 py-24 text-center"><h1 className="text-[28px] font-extrabold">Owners and admins only</h1><p className="mt-2 text-muted">The community inbox is for its leaders.</p></div>;
  const c = ctx.community;
  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-5 px-4 pt-6 pb-24 sm:px-6 lg:px-8 lg:pt-10">
      <Link href={`/communities/${slug}/manage`} className="inline-flex w-fit items-center gap-1.5 text-[14.5px] font-semibold text-muted hover:text-ink"><ArrowLeft size={17} />Manage {c.name}</Link>
      <header className="flex items-center gap-3"><CommunityLogo c={c} size={52} /><div><p className="text-[13px] font-bold tracking-[.1em] text-green-text uppercase">Community inbox</p><h1 className="text-[30px] font-extrabold">{c.name}</h1></div></header>
      <nav aria-label="Inbox" className="no-bar flex gap-7 overflow-x-auto border-b border-line">
        {([['chats', 'Messages', MessageCircle], ['announcements', 'Announcements', Megaphone]] as const).map(([v, label, Icon]) => (
          <button key={v} type="button" onClick={() => setTab(v)} aria-pressed={tab === v} className={`relative flex items-center gap-1.5 pb-3 text-[15px] font-semibold ${tab === v ? 'text-ink' : 'text-muted hover:text-ink'}`}>
            <Icon size={16} />{label}{tab === v ? <m.span layoutId="team-tab" className="absolute inset-x-0 -bottom-px h-[2.5px] rounded-full bg-ink" transition={spring.snap} /> : null}
          </button>
        ))}
      </nav>

      {tab === 'chats' ? (
        <div className="grid min-h-[560px] overflow-hidden rounded-[24px] border border-line bg-surface lg:grid-cols-[340px_minmax(0,1fr)]">
          <div className={`flex flex-col border-line lg:border-r ${chatId ? 'hidden lg:flex' : ''}`}>
            <div className="flex gap-2 border-b border-line p-3">{(['OPEN', 'RESOLVED'] as const).map((s) => <Chip key={s} on={status === s} onClick={() => setStatus(s)}>{s === 'OPEN' ? 'Open' : 'Resolved'}</Chip>)}</div>
            <ul className="flex flex-col divide-y divide-line overflow-y-auto">
              {chats === null ? [0, 1, 2].map((i) => <li key={i} className="p-4"><div className="shimmer h-12 rounded-xl" /></li>)
                : chats.length ? chats.map((t) => (
                  <li key={t.id}><button type="button" onClick={() => setChatId(t.id)} className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-mist ${chatId === t.id ? 'bg-mist' : ''}`}>
                    <Avatar name={t.student?.name ?? 'Student'} src={t.student?.avatar} size={42} ring={false} />
                    <span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><b className={`truncate text-[15px] ${t.unread ? 'font-extrabold' : ''}`}>{t.student?.name}</b><small className="shrink-0 text-[12px] text-muted">{ago(t.lastMessageAt)}</small></span>
                      <span className="flex items-center gap-2"><span className={`truncate text-[13.5px] ${t.unread ? 'font-semibold' : 'text-muted'}`}>{t.lastMessage}</span>{t.unread ? <span className="ml-auto grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-coral px-1 text-[11px] font-bold text-[#111714]">{t.unread}</span> : null}</span>
                      <span className="flex flex-wrap items-center gap-1.5 text-[11.5px]">{t.repliedBy ? <span className="text-muted">Replied by <b className="font-semibold text-ink">{t.repliedBy}</b></span> : <span className="font-semibold text-coral-text">Not replied yet</span>}{t.viewing.length ? <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--gold)_25%,var(--surface))] px-1.5 font-semibold"><span className="size-1.5 animate-pulse rounded-full bg-[var(--stamp-gold)]" />{t.viewing[0]} is viewing</span> : null}</span></span>
                  </button></li>
                )) : <li className="p-8 text-center text-muted">{status === 'OPEN' ? 'No open messages. Students reach you with “Contact the host”.' : 'Nothing resolved yet.'}</li>}
            </ul>
          </div>
          <section className={`min-h-[560px] flex-col ${chatId ? 'flex' : 'hidden lg:flex'}`} aria-label="Conversation">
            {chatId ? <ChatPane key={chatId} chatId={chatId} onBack={() => setChatId(null)} onChanged={() => void load()} />
              : <div className="grid flex-1 place-items-center p-8 text-center text-muted"><span className="flex flex-col items-center gap-2"><MessageCircle size={30} />Pick a conversation. Every admin sees the same inbox, and replies show who answered.</span></div>}
          </section>
        </div>
      ) : <Announcements ctx={ctx} />}
    </div>
  );
}

/** Compose an announcement: audience, text, optional image or event card, preview, send. */
function Announcements({ ctx }: { ctx: CommunityPage }) {
  const toast = useToast();
  const c = ctx.community;
  const [events, setEvents] = useState<Event[]>([]);
  const [sent, setSent] = useState<Announcement[] | null>(null);
  const [aud, setAud] = useState<'ALL' | 'REGISTERED' | 'ATTENDED'>('ALL');
  const [audEvent, setAudEvent] = useState('');
  const [text, setText] = useState('');
  const [image, setImage] = useState('');
  const [imagePath, setImagePath] = useState('');
  const [attach, setAttach] = useState('');
  const [reach, setReach] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [delivered, setDelivered] = useState<number | null>(null);
  // The preview is signed the way the real post will be: your name and your team title.
  const { user: me } = useSession();
  const [myTitle, setMyTitle] = useState('');
  useEffect(() => {
    if (!me) return;
    members(c.id, { q: me.fullName }).then((r) => { const p = r.people.find((x) => x.id === me.id); if (p) setMyTitle(p.title || ROLE_LABEL[p.role]); }).catch(() => undefined);
  }, [c.id, me]);
  useEffect(() => { hostedEvents().then((l) => setEvents(l.filter((e) => e.community.id === c.id && e.status !== 'DRAFT'))).catch(() => undefined); communityAnnouncements(c.id).then(setSent).catch(() => setSent([])); }, [c.id]);
  const audience: Audience | null = aud === 'ALL' ? { kind: 'ALL' } : audEvent ? { kind: aud, eventId: audEvent } : null;
  useEffect(() => { setReach(null); if (audience) audienceCount(c.id, audience).then(setReach).catch(() => setReach(null)); }, [c.id, aud, audEvent]); // eslint-disable-line react-hooks/exhaustive-deps
  const eventFor = (id: string) => events.find((e) => e.id === id);
  const preview = useMemo<Announcement>(() => {
    const e = eventFor(attach);
    return { sender: { name: me?.fullName ?? '', pronouns: '', avatar: '', title: myTitle, former: false }, id: 'preview', text: text || 'Your announcement', image, createdAt: new Date().toISOString(), deliveredCount: 0, audience: { kind: aud }, reactions: [], community: { id: c.id, name: c.name, slug: c.slug, logo: c.logo, verified: c.verified }, event: e ? { id: e.id, title: e.title, slug: e.slug, startDate: e.startDate, venue: e.venue, cover: e.cover, type: e.type } : null };
  }, [text, image, attach, aud, c, events]); // eslint-disable-line react-hooks/exhaustive-deps

  async function pick(f: File | null) {
    if (!f) return;
    try { const r = await uploadImages(null, f); setImagePath(r.coverImage); setImage(mediaUrl(r.coverImage)); } catch (e) { toast(e instanceof Error ? e.message : 'Upload failed'); }
  }
  async function send() {
    if (!audience) return;
    setBusy(true);
    try {
      const r = await postAnnouncement(c.id, { text: text.trim(), image: imagePath || undefined, eventId: attach || undefined, audience });
      setDelivered(r.deliveredCount); setText(''); setImage(''); setImagePath(''); setAttach('');
      setSent(await communityAnnouncements(c.id).catch(() => sent ?? []));
    } catch (e) { toast(e instanceof Error ? e.message : 'Unable to send'); } finally { setBusy(false); }
  }
  const pastEvents = events.filter((e) => phaseOf(e) === 'AFTER');
  const field = 'w-full rounded-2xl border border-line bg-surface px-4 py-3 text-[15.5px] outline-none focus:border-green-text';
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
      <section className="flex flex-col gap-4 rounded-[22px] border border-line bg-surface p-5">
        <h2 className="text-[20px] font-extrabold">New announcement</h2>
        <div className="flex flex-col gap-2"><span className="text-[14px] font-semibold">Send to</span>
          <div role="radiogroup" aria-label="Send to" className="grid gap-2 sm:grid-cols-3">
            {([['ALL', 'All members'], ['REGISTERED', 'Registered for…'], ['ATTENDED', 'Attended…']] as const).map(([v, t]) => (
              <button key={v} type="button" role="radio" aria-checked={aud === v} onClick={() => { setAud(v); setAudEvent(''); }} className={`rounded-2xl border-2 p-3 text-[14px] font-semibold ${aud === v ? 'border-green-text bg-tint' : 'border-line'}`}>{t}</button>
            ))}
          </div>
          {aud !== 'ALL' ? (
            <select aria-label="Event" value={audEvent} onChange={(e) => setAudEvent(e.target.value)} className={field}>
              <option value="">Choose an event</option>
              {(aud === 'ATTENDED' ? pastEvents : events).map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
            </select>
          ) : null}
          <small className="text-[13px] text-muted">{reach === null ? ' ' : `Reaches ${reach} ${reach === 1 ? 'person' : 'people'}. People who paused your community are left out.`}</small>
        </div>
        <label className="flex flex-col gap-1.5"><span className="text-[14px] font-semibold">Message</span><textarea className={`${field} min-h-[130px]`} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. The workshop moves to LT 3 tomorrow. Bring your laptop!" /></label>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-line px-3.5 py-2 text-[14px] font-semibold hover:bg-mist"><ImagePlus size={16} className="text-green-text" />{image ? 'Change image' : 'Add an image'}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => void pick(e.target.files?.[0] ?? null)} /></label>
          {image ? <button type="button" onClick={() => { setImage(''); setImagePath(''); }} className="inline-flex items-center gap-1 text-[13.5px] font-semibold text-muted"><X size={14} />Remove image</button> : null}
          <label className="inline-flex items-center gap-2 rounded-2xl border border-line px-3 py-1.5 text-[14px] font-semibold"><CalendarDays size={16} className="text-green-text" /><select aria-label="Attach an event" value={attach} onChange={(e) => setAttach(e.target.value)} className="bg-transparent outline-none"><option value="">Attach an event</option>{events.filter((e) => phaseOf(e) !== 'AFTER').map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}</select></label>
        </div>
        <Btn size="lg" onClick={() => void send()} disabled={busy || text.trim().length < 3 || !audience} className="self-start"><Send size={17} />{busy ? 'Sending…' : 'Send announcement'}</Btn>
        {delivered !== null ? <m.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={spring.bouncy} className="rounded-2xl bg-tint px-4 py-3 font-semibold text-green-text">Delivered to {delivered} {delivered === 1 ? 'member' : 'members'}</m.p> : null}
        <p className="text-[12.5px] text-muted">Limit: one announcement every 10 minutes, 10 a day.</p>
      </section>
      <aside className="flex flex-col gap-4">
        <p className="text-[13px] font-bold tracking-[.08em] text-muted uppercase">Preview</p>
        <AnnouncementCard a={preview} preview />
        <h2 className="mt-2 text-[18px] font-extrabold">Sent</h2>
        {sent === null ? <div className="shimmer h-28 rounded-2xl" /> : sent.length ? sent.slice(0, 10).map((a) => (
          <div key={a.id} className="rounded-2xl border border-line bg-surface p-3 text-[14px]"><p className="line-clamp-2">{a.text}</p><small className="text-muted">{new Date(a.createdAt).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} · delivered to {a.deliveredCount} · {a.reactions.reduce((n, r) => n + r.count, 0)} reactions</small></div>
        )) : <p className="text-[14px] text-muted">Nothing sent yet.</p>}
      </aside>
    </div>
  );
}

export function TeamInbox({ slug }: { slug: string }) {
  return <Suspense fallback={null}><Team slug={slug} /></Suspense>;
}
