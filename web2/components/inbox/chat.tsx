'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import * as m from 'motion/react-m';

import { ArrowLeft, Check, CheckCheck, Flag, RotateCcw, SendHorizontal } from 'lucide-react';
import { openChat, QUICK_REPLIES, reportMessage, sendMessage, setChatStatus, viewing as heartbeat, type ChatDetail, type Message } from '@/lib/api/inbox';
import { TeamSignature } from '@/components/inbox/signature';
import { usePoll } from '@/lib/poll';
import { spring } from '@/lib/motion';
import { CommunityLogo } from '@/components/communities/bits';
import { Avatar } from '@/components/ui/avatar';
import { Btn } from '@/components/ui/bits';
import { useToast } from '@/components/ui/toast';
import { fmtDate, fmtTime } from '@/lib/format';

const time = (iso: string) => fmtTime(iso);
const day = (iso: string) => fmtDate(iso);

/**
 * One conversation. Checks for new messages every 10 s while open (paused when the tab is hidden).
 * New bubbles spring up from the input; your sent messages get a small tick.
 */
export function ChatPane({ chatId, onBack, onChanged }: { chatId: string; onBack?: () => void; onChanged?: () => void }) {
  const toast = useToast();
  const [chat, setChat] = useState<ChatDetail | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const load = useCallback(async () => {
    const next = await openChat(chatId);
    let changed = false;
    // Compare by message ids, so a temporary (sending) message is always swapped for the saved one.
    const key = (c: ChatDetail) => `${c.status}|${c.messages.map((x) => x.id).join(',')}`;
    setChat((cur) => { changed = !cur || key(cur) !== key(next); return changed ? next : cur; });
    return changed;
  }, [chatId]);
  useEffect(() => { setChat(null); void load().then(() => onChanged?.()).catch(() => toast('Unable to open this conversation')); }, [load]); // eslint-disable-line react-hooks/exhaustive-deps
  usePoll(load, 10_000, Boolean(chat));
  // Team side: tell the others this chat is open (every 8 s while visible), and show who else is looking.
  const [others, setOthers] = useState<string[]>([]);
  const teamView = chat?.viewer === 'TEAM';
  useEffect(() => {
    if (!teamView) return;
    const beat = () => { if (document.visibilityState === 'visible') heartbeat(chatId).then(setOthers).catch(() => undefined); };
    beat();
    const t = setInterval(beat, 8000);
    return () => clearInterval(t);
  }, [teamView, chatId]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }); }, [chat?.messages.length]);

  if (!chat) return <div className="flex flex-1 flex-col gap-3 p-5">{[0, 1, 2].map((i) => <div key={i} className={`shimmer h-12 w-2/3 rounded-2xl ${i % 2 ? 'self-end' : ''}`} />)}</div>;
  const team = chat.viewer === 'TEAM';
  const mine = (msg: Message) => msg.fromTeam === team;

  async function send(text = draft) {
    const content = text.trim();
    if (!content || !chat) return;
    const temp: Message = { id: `tmp-${Date.now()}`, fromTeam: team, content, createdAt: new Date().toISOString(), senderName: 'You', senderAvatar: '', senderPronouns: '', senderTitle: '', former: false, pending: true };
    setChat((c) => (c ? { ...c, messages: [...c.messages, temp] } : c));
    setDraft(''); setSending(true);
    try { await sendMessage(chat.id, content); await load(); onChanged?.(); }
    catch (e) { setChat((c) => (c ? { ...c, messages: c.messages.filter((x) => x.id !== temp.id) } : c)); setDraft(content); toast(e instanceof Error ? e.message : 'Not sent'); }
    finally { setSending(false); }
  }
  async function toggleResolved() {
    if (!chat) return;
    const next = chat.status === 'OPEN' ? 'RESOLVED' : 'OPEN';
    try { await setChatStatus(chat.id, next); setChat({ ...chat, status: next }); toast(next === 'RESOLVED' ? 'Marked resolved' : 'Reopened'); onChanged?.(); } catch (e) { toast(e instanceof Error ? e.message : 'Unable to update'); }
  }
  async function report(msg: Message) {
    const reason = window.prompt('What is wrong with this message? (It goes to the OnTheRoll moderators.)');
    if (reason === null) return;
    try { await reportMessage(msg.id, reason); toast('Reported. Thank you'); } catch (e) { toast(e instanceof Error ? e.message : 'Unable to report'); }
  }

  let lastDay = '';
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        {onBack ? <button type="button" onClick={onBack} aria-label="Back to conversations" className="grid size-9 place-items-center rounded-full hover:bg-mist lg:hidden"><ArrowLeft size={18} /></button> : null}
        {team ? <Avatar name={chat.student?.name ?? 'Student'} src={chat.student?.avatar} size={38} ring={false} /> : chat.community ? <CommunityLogo c={chat.community} size={38} /> : null}
        <span className="min-w-0 flex-1"><b className="block truncate">{team ? chat.student?.name : chat.community?.name}</b><small className="text-[12.5px] text-muted">{team ? 'Student' : 'Replies come from the community’s leaders'}</small></span>
        {team ? <Btn size="sm" kind="secondary" onClick={() => void toggleResolved()}>{chat.status === 'OPEN' ? <><CheckCheck size={15} />Mark resolved</> : <><RotateCcw size={15} />Reopen</>}</Btn>
          : chat.community ? <Link href={`/communities/${chat.community.slug}`} className="text-[13px] font-semibold text-green-text hover:underline">Community</Link> : null}
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-4 py-4" aria-live="polite">
        {chat.messages.map((msg) => {
          const d = day(msg.createdAt); const showDay = d !== lastDay; lastDay = d;
          const own = mine(msg);
          return (
            <div key={msg.id} className="flex flex-col">
              {showDay ? <span className="my-2 self-center rounded-full bg-mist px-3 py-0.5 text-[11.5px] font-semibold text-muted">{d}</span> : null}
              <m.div layout initial={{ opacity: 0, y: 24, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={spring.bouncy} className={`group flex max-w-[82%] flex-col ${own ? 'items-end self-end' : 'items-start self-start'}`}>
                {msg.fromTeam && !msg.pending && chat.community ? <TeamSignature community={chat.community} name={msg.senderName} pronouns={msg.senderPronouns} title={msg.senderTitle} former={msg.former} align={own ? 'end' : 'start'} /> : null}
                <span className={`rounded-[20px] px-3.5 py-2 text-[15px] leading-snug whitespace-pre-wrap ${own ? 'rounded-br-md bg-green text-white' : 'rounded-bl-md border border-line bg-surface'}`}>{msg.content}</span>
                <span className="mt-0.5 flex items-center gap-1 px-1 text-[11px] text-muted">{time(msg.createdAt)}
                  {own ? (msg.pending ? <span className="size-3 animate-pulse rounded-full bg-line" aria-label="Sending" /> : <m.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={spring.bouncy} aria-label="Sent"><Check size={12} className="text-green-text" /></m.span>) : null}
                  {!own && !team && !msg.pending ? <button type="button" onClick={() => void report(msg)} className="ml-1 hidden items-center gap-0.5 hover:text-coral-text group-hover:inline-flex"><Flag size={11} />Report</button> : null}
                </span>
              </m.div>
            </div>
          );
        })}
        <div ref={end} />
      </div>

      {team && others.length ? <p role="status" className="flex items-center gap-2 border-t border-line bg-[color-mix(in_srgb,var(--gold)_18%,var(--surface))] px-4 py-2 text-[13px] font-semibold"><span className="size-2 animate-pulse rounded-full bg-[var(--stamp-gold)]" />{others.join(', ')} {others.length === 1 ? 'is' : 'are'} viewing. Check before replying.</p> : null}
      {chat.blocked ? <p className="border-t border-line px-4 py-3 text-[14px] text-muted">{team ? 'This student has paused messages from your community.' : 'You paused messages from this community. Unblock it from Announcements to reply.'}</p> : (
        <div className="border-t border-line p-3">
          {team ? <div className="no-bar -mx-3 mb-2 flex gap-2 overflow-x-auto px-3">{QUICK_REPLIES.map((q) => <button key={q} type="button" onClick={() => void send(q)} className="shrink-0 rounded-full border border-line px-3 py-1 text-[13px] font-semibold hover:bg-mist">{q}</button>)}</div> : null}
          <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="flex items-end gap-2">
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }} rows={1} maxLength={2000} placeholder={team ? 'Reply as the community' : `Message ${chat.community?.name ?? 'the community'}`} aria-label="Message"
              className="max-h-32 min-h-[46px] flex-1 resize-none rounded-[22px] border border-line bg-surface px-4 py-3 text-[15px] outline-none focus:border-green-text" />
            <m.button type="submit" whileTap={{ scale: 0.88 }} disabled={sending || !draft.trim()} aria-label="Send" className="grid size-[46px] shrink-0 place-items-center rounded-full bg-green text-white disabled:opacity-40"><SendHorizontal size={19} /></m.button>
          </form>
        </div>
      )}

    </div>
  );
}
