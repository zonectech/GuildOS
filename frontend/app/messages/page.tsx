'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { MessageSquare, Send, ArrowLeft, Loader2 } from 'lucide-react';

import { getCurrentUser } from '../../components/guildos/auth-api';
import { StudentNav } from '../../components/guildos/student-nav';
import { Loading, LogoSpinner } from '../../components/guildos/ui/loading';
import {
  getConversation,
  getConversations,
  resolveMessageAvatar,
  sendMessage,
  type ConversationDetail,
  type ConversationSummary,
} from '../../components/guildos/message-api';
import { onRealtime } from '../../components/guildos/realtime';

function Avatar({ person, size = 'h-10 w-10' }: { person: { fullName: string; avatar: string }; size?: string }) {
  const src = resolveMessageAvatar(person.avatar);
  return src ? (
    <img src={src} alt="" className={`${size} shrink-0 rounded-full object-cover`} />
  ) : (
    <span className={`${size} grid shrink-0 place-items-center rounded-full bg-slate-200 text-sm font-semibold text-slate-600`}>{person.fullName.slice(0, 1)}</span>
  );
}

function timeAgo(value: string | null) {
  if (!value) return '';
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(value).toLocaleDateString();
}

function MessagesInner() {
  const router = useRouter();
  const params = useSearchParams();
  const activeId = params.get('c') ?? '';
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const [meId, setMeId] = useState('');
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;
  const meIdRef = useRef('');
  meIdRef.current = meId;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const user = await getCurrentUser();
      if (cancelled) return;
      if (!user) {
        router.replace('/login');
        return;
      }
      setMeId(user.id);
      try {
        const { conversations: list } = await getConversations();
        if (!cancelled) setConversations(list);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (!activeId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    void (async () => {
      try {
        const { conversation } = await getConversation(activeId);
        if (!cancelled) {
          setDetail(conversation);
          setConversations((list) => list.map((c) => (c.id === activeId ? { ...c, unread: 0 } : c)));
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  // Live updates over WebSocket: new messages arrive instantly (no polling).
  useEffect(() => {
    const off = onRealtime((evt) => {
      if (evt.type !== 'message') return;
      const { conversationId, message } = evt;
      const isActive = conversationId === activeIdRef.current;
      const fromMe = message.senderId === meIdRef.current;

      if (isActive) {
        setDetail((prev) => {
          if (!prev || prev.id !== conversationId) return prev;
          if (prev.messages.some((m) => m.id === message.id)) return prev;
          return { ...prev, messages: [...prev.messages, { ...message, mine: fromMe }] };
        });
      }

      setConversations((list) => {
        const idx = list.findIndex((c) => c.id === conversationId);
        if (idx === -1) {
          void getConversations().then(({ conversations: l }) => setConversations(l)).catch(() => undefined);
          return list;
        }
        const prev = list[idx];
        const updated: ConversationSummary = {
          ...prev,
          lastMessage: message.content,
          lastMessageAt: message.createdAt,
          unread: isActive || fromMe ? (isActive ? 0 : prev.unread) : prev.unread + 1,
        };
        return [updated, ...list.filter((_, i) => i !== idx)];
      });
    });
    return off;
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [detail?.messages.length]);

  async function submit() {
    const text = draft.trim();
    if (!text || !activeId) return;
    setDraft('');
    try {
      setSending(true);
      const { message } = await sendMessage(activeId, text);
      setDetail((d) => (d ? { ...d, messages: [...d.messages, message] } : d));
      setConversations((list) => list.map((c) => (c.id === activeId ? { ...c, lastMessage: text, lastMessageAt: message.createdAt } : c)));
    } catch {
      setDraft(text);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <StudentNav />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <h1 className="mb-4 flex items-center gap-2 text-xl font-semibold text-slate-950"><MessageSquare className="h-5 w-5" /> Messages</h1>

        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          {/* Conversation list */}
          <aside className={`${activeId ? 'hidden lg:block' : ''} rounded-2xl border border-slate-200 bg-white shadow-sm`}>
            {loading ? (
              <div className="flex items-center justify-center p-10"><LogoSpinner /></div>
            ) : conversations.length ? (
              <ul className="divide-y divide-slate-100">
                {conversations.map((c) => (
                  <li key={c.id}>
                    <Link href={`/messages?c=${encodeURIComponent(c.id)}`} className={`flex items-center gap-3 px-4 py-3 hover:bg-slate-50 ${c.id === activeId ? 'bg-indigo-50/50' : ''}`}>
                      <Avatar person={c.other} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-medium text-slate-900">{c.other.fullName}</p>
                          <span className="shrink-0 text-[11px] text-slate-400">{timeAgo(c.lastMessageAt)}</span>
                        </div>
                        <p className={`truncate text-xs ${c.unread ? 'font-semibold text-slate-800' : 'text-slate-500'}`}>{c.lastMessage || 'No messages yet'}</p>
                      </div>
                      {c.unread ? <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-indigo-600 px-1 text-[10px] font-semibold text-white">{c.unread}</span> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-8 text-center text-sm text-slate-500">No conversations yet. Recruiters can message candidates from their profile.</p>
            )}
          </aside>

          {/* Thread */}
          <section className={`${activeId ? '' : 'hidden lg:flex'} flex min-h-[60vh] flex-col rounded-2xl border border-slate-200 bg-white shadow-sm`}>
            {!activeId ? (
              <div className="flex flex-1 items-center justify-center p-10 text-center text-sm text-slate-400">Select a conversation to start chatting.</div>
            ) : detailLoading && !detail ? (
              <div className="flex flex-1 items-center justify-center"><LogoSpinner /></div>
            ) : detail ? (
              <>
                <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
                  <Link href="/messages" className="lg:hidden"><ArrowLeft className="h-5 w-5 text-slate-500" /></Link>
                  <Avatar person={detail.other} size="h-9 w-9" />
                  <div className="min-w-0">
                    <Link href={detail.other.username ? `/profile/${encodeURIComponent(detail.other.username)}` : '#'} className="truncate text-sm font-semibold text-slate-900 hover:underline">{detail.other.fullName}</Link>
                    {detail.other.headline ? <p className="truncate text-xs text-slate-500">{detail.other.headline}</p> : null}
                  </div>
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
                  {detail.messages.length ? (
                    detail.messages.map((m) => (
                      <div key={m.id} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${m.mine ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-800'}`}>
                          <p className="whitespace-pre-line break-words">{m.content}</p>
                          <p className={`mt-1 text-[10px] ${m.mine ? 'text-indigo-100' : 'text-slate-400'}`}>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="pt-8 text-center text-sm text-slate-400">Say hello 👋</p>
                  )}
                  <div ref={endRef} />
                </div>

                <div className="flex items-center gap-2 border-t border-slate-100 p-3">
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submit(); } }}
                    placeholder="Write a message…"
                    className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                  <button onClick={() => void submit()} disabled={sending || !draft.trim()} className="grid h-10 w-10 place-items-center rounded-full bg-indigo-600 text-white disabled:opacity-50"><Send className="h-4 w-4" /></button>
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center p-10 text-center text-sm text-slate-400">Conversation not found.</div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-100"><StudentNav /><main className="mx-auto max-w-5xl px-4 py-10"><Loading /></main></div>}>
      <MessagesInner />
    </Suspense>
  );
}
