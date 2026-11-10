'use client';
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import * as m from 'motion/react-m';
import { Ban, CalendarDays, Flag, MoreHorizontal, Users } from 'lucide-react';
import { blockCommunity, reactTo, reportAnnouncement, type Announcement } from '@/lib/api/inbox';
import { spring } from '@/lib/motion';
import { CommunityLogo, VerifiedTick } from '@/components/communities/bits';
import { useToast } from '@/components/ui/toast';

const when = (iso: string) => new Date(iso).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/** A community post, like a WhatsApp Channel update: logo, text, optional image or event card, a few reactions. */
export function AnnouncementCard({ a, onChange, onBlocked, preview, isNew }: { a: Announcement; onChange?: (a: Announcement) => void; onBlocked?: (communityId: string) => void; preview?: boolean; isNew?: boolean }) {
  const toast = useToast();
  const [menu, setMenu] = useState(false);
  async function tap(emoji: string) {
    if (preview || !onChange) return;
    const optimistic = { ...a, reactions: a.reactions.map((r) => (r.emoji === emoji ? { ...r, mine: !r.mine, count: r.count + (r.mine ? -1 : 1) } : r)) };
    onChange(optimistic);
    try { onChange(await reactTo(a.id, emoji)); } catch { onChange(a); }
  }
  async function report() {
    setMenu(false);
    const reason = window.prompt('What is wrong with this announcement? (It goes to the OnTheRoll moderators.)');
    if (reason === null) return;
    try { await reportAnnouncement(a.id, reason); toast('Reported. Thank you'); } catch (e) { toast(e instanceof Error ? e.message : 'Unable to report'); }
  }
  async function block() {
    setMenu(false);
    if (!a.community || !window.confirm(`Stop messages and announcements from ${a.community.name}? You stay a member and can undo this.`)) return;
    try { await blockCommunity(a.community.id); toast(`Paused ${a.community.name}`); onBlocked?.(a.community.id); } catch (e) { toast(e instanceof Error ? e.message : 'Unable to block'); }
  }
  return (
    <article className={`relative flex flex-col gap-3 rounded-[22px] border bg-surface p-4 shadow-card ${isNew ? 'border-green-text/50' : 'border-line'}`}>
      <header className="flex items-center gap-3">
        {a.community ? <CommunityLogo c={a.community} size={40} /> : null}
        <span className="min-w-0 flex-1">
          <b className="flex items-center gap-1 truncate text-[15px]">{a.community?.name}{a.community?.verified ? <VerifiedTick size={14} /> : null}</b>
          <small className="flex items-center gap-1 text-[12.5px] text-muted">{preview ? 'Preview' : when(a.createdAt)}{a.audience.kind !== 'ALL' ? <><span>·</span><Users size={11} />{a.audience.kind === 'REGISTERED' ? 'to people registered' : 'to people who attended'}</> : null}{isNew ? <span className="ml-1 rounded-full bg-coral px-1.5 text-[10.5px] font-bold text-[#111714]">NEW</span> : null}</small>
        </span>
        {!preview ? (
          <span className="relative">
            <button type="button" onClick={() => setMenu(!menu)} aria-label="More" aria-expanded={menu} className="grid size-8 place-items-center rounded-full text-muted hover:bg-mist"><MoreHorizontal size={18} /></button>
            {menu ? (
              <span className="absolute top-9 right-0 z-10 flex w-[220px] flex-col rounded-2xl border border-line bg-raised p-1.5 shadow-lift">
                <button type="button" onClick={() => void report()} className="flex items-center gap-2 rounded-xl px-3 py-2 text-left text-[14px] font-semibold hover:bg-mist"><Flag size={15} />Report</button>
                <button type="button" onClick={() => void block()} className="flex items-center gap-2 rounded-xl px-3 py-2 text-left text-[14px] font-semibold text-coral-text hover:bg-mist"><Ban size={15} />Pause this community</button>
              </span>
            ) : null}
          </span>
        ) : null}
      </header>
      {a.sender && (a.sender.name || a.sender.title) ? (
        <p className="-mt-1 flex flex-wrap items-center gap-1 text-[12.5px] text-muted">
          {a.sender.name ? <b className="font-semibold text-ink">{a.sender.name}</b> : null}
          {a.sender.name && a.sender.pronouns ? <span>({a.sender.pronouns})</span> : null}
          {a.sender.name && a.sender.title ? <span aria-hidden>·</span> : null}
          {a.sender.title ? <span className="rounded-full bg-tint px-1.5 py-px font-bold text-green-text">{a.sender.title}</span> : null}
          {a.sender.former ? <span className="rounded-full bg-mist px-1.5 py-px font-bold" title="No longer holds this role">former</span> : null}
        </p>
      ) : null}
      <p className="text-[15.5px] leading-relaxed whitespace-pre-wrap">{a.text}</p>
      {a.image ? <span className="relative block aspect-[16/10] overflow-hidden rounded-2xl bg-mist"><Image src={a.image} alt="" fill sizes="(min-width: 768px) 560px, 92vw" className="object-cover" /></span> : null}
      {a.event ? (
        <Link href={`/events/${a.event.slug}`} className="flex items-center gap-3 rounded-2xl border border-line p-3 hover:bg-mist">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-tint text-green-text"><CalendarDays size={20} /></span>
          <span className="min-w-0"><b className="block truncate text-[14.5px]">{a.event.title}</b><small className="text-[12.5px] text-muted">{a.event.startDate ? new Date(a.event.startDate).toLocaleString('en-NG', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Lagos' }) : ''}{a.event.venue ? ` · ${a.event.venue}` : ''}</small></span>
        </Link>
      ) : null}
      <div className="flex flex-wrap gap-1.5">
        {a.reactions.map((r) => (
          <m.button key={r.emoji} type="button" whileTap={{ scale: 0.85 }} onClick={() => void tap(r.emoji)} aria-pressed={r.mine} aria-label={`${r.emoji} ${r.count}`}
            className={`inline-flex h-8 items-center gap-1 rounded-full border px-2.5 text-[14px] ${r.mine ? 'border-green-text bg-tint' : 'border-line hover:bg-mist'}`}>
            <span>{r.emoji}</span>{r.count ? <m.span key={r.count} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={spring.snap} className="text-[12.5px] font-bold tabular-nums">{r.count}</m.span> : null}
          </m.button>
        ))}
      </div>
    </article>
  );
}
