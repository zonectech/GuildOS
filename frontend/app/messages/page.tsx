'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { MessageSquare, Send, ArrowLeft, Loader2, MoreVertical, ShieldOff, Flag, ShieldCheck, Reply, Pencil, Trash2, X, Copy, Check, Search } from 'lucide-react';

import { getCurrentUser } from '../../components/guildos/auth-api';
import { StudentNav } from '../../components/guildos/student-nav';
import { Loading, LogoSpinner } from '../../components/guildos/ui/loading';
import { confirmDialog } from '../../components/guildos/ui/confirm-dialog';
import {
  getConversation,
  getConversations,
  resolveMessageAvatar,
  sendMessage,
  editMessage,
  deleteMessage,
  setDisappearingMessages,
  setRecruiterDmPreference,
  setMessageDeleteScopePreference,
  searchMessages,
  blockUser,
  unblockUser,
  reportUser,
  type ChatMessage,
  type ConversationDetail,
  type ConversationSummary,
  type MessageSearchHit,
} from '../../components/guildos/message-api';
import { onRealtime } from '../../components/guildos/realtime';
import { LinkifiedText, MessageLinkPreview, firstPreviewableLink } from '../../components/guildos/message-link-preview';

function Avatar({ person, size = 'h-10 w-10' }: { person: { fullName: string; avatar: string }; size?: string }) {
  const src = resolveMessageAvatar(person.avatar);
  return src ? (
    <img src={src} alt="" className={`${size} shrink-0 rounded-full object-cover`} />
  ) : (
    <span className={`${size} grid shrink-0 place-items-center rounded-full bg-slate-200 text-sm font-semibold text-slate-600 dark:text-slate-400`}>{person.fullName.slice(0, 1)}</span>
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
  return new Date(value).toLocaleDateString('en-NG');
}

/** "Today", "Yesterday", or a readable date — for the separators between message days. */
function dayLabel(value: string) {
  const d = new Date(value);
  const today = new Date();
  const same = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (same(d, today)) return 'Today';
  const yesterday = new Date(today.getTime() - 86400000);
  if (same(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString('en-NG', { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * One chat bubble. Swipe right (touch) or use the hover actions to reply;
 * own messages also get Edit / Delete. Deleted messages keep their slot as a
 * muted placeholder — the record itself survives in the database.
 */
function SwipeableMessage({
  m,
  otherName,
  flash,
  onReply,
  onEdit,
  onDelete,
  onQuoteClick,
}: {
  m: ChatMessage;
  otherName: string;
  flash?: boolean;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onQuoteClick?: (id: string) => void;
}) {
  const [dx, setDx] = useState(0);
  const startX = useRef<number | null>(null);
  const [copied, setCopied] = useState(false);

  function copyText() {
    void navigator.clipboard
      .writeText(m.content)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => undefined);
  }

  return (
    <div className={`group flex items-center gap-1.5 ${m.mine ? 'justify-end' : 'justify-start'}`}>
      {/* Hover actions (desktop) — rendered on the outer side of the bubble. */}
      {m.mine && !m.deleted ? (
        <span className="flex shrink-0 gap-0.5 opacity-0 transition group-hover:opacity-100">
          <button onClick={copyText} title={copied ? 'Copied!' : 'Copy'} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-800">{copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}</button>
          <button onClick={onReply} title="Reply" className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-800"><Reply className="h-3.5 w-3.5" /></button>
          <button onClick={onEdit} title="Edit" className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-800"><Pencil className="h-3.5 w-3.5" /></button>
          <button onClick={onDelete} title="Delete" className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-600 dark:hover:bg-slate-800"><Trash2 className="h-3.5 w-3.5" /></button>
        </span>
      ) : null}
      <div
        className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm shadow-sm transition-shadow ${m.mine ? 'rounded-br-md bg-indigo-600 text-white' : 'rounded-bl-md bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 ring-1 ring-slate-200 dark:ring-slate-800'} ${flash ? 'ring-4 ring-amber-400' : ''}`}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: dx ? 'none' : 'transform 150ms ease' }}
        onTouchStart={(e) => {
          if (!m.deleted) startX.current = e.touches[0].clientX;
        }}
        onTouchMove={(e) => {
          if (startX.current === null) return;
          const delta = e.touches[0].clientX - startX.current;
          setDx(Math.max(0, Math.min(72, delta)));
        }}
        onTouchEnd={() => {
          if (dx > 48) onReply();
          setDx(0);
          startX.current = null;
        }}
      >
        {m.replyTo ? (
          <button
            type="button"
            onClick={() => m.replyTo && onQuoteClick?.(m.replyTo.id)}
            className={`mb-1.5 block w-full rounded-lg border-l-2 px-2 py-1 text-left text-xs ${m.mine ? 'border-indigo-300 bg-indigo-500/40 text-indigo-100' : 'border-indigo-400 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}
            title="Jump to the original message"
          >
            <span className="font-semibold">{m.replyTo.senderId === m.senderId ? (m.mine ? 'You' : otherName.split(' ')[0]) : m.mine ? otherName.split(' ')[0] : 'You'}</span>
            <span className="block truncate">{m.replyTo.deleted || !m.replyTo.content ? 'Message deleted' : m.replyTo.content}</span>
          </button>
        ) : null}
        {m.deleted ? (
          <p className={`italic ${m.mine ? 'text-indigo-200' : 'text-slate-400 dark:text-slate-500'}`}>Message deleted</p>
        ) : (
          <>
            <LinkifiedText content={m.content} mine={m.mine} />
            {(() => {
              const link = firstPreviewableLink(m.content);
              return link ? <MessageLinkPreview path={link.path} /> : null;
            })()}
          </>
        )}
        <p className={`mt-1 text-right text-[10px] ${m.mine ? 'text-indigo-200' : 'text-slate-400 dark:text-slate-500'}`}>
          {m.edited && !m.deleted ? <span className="mr-1">(edited)</span> : null}
          {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
      {!m.mine && !m.deleted ? (
        <span className="flex shrink-0 gap-0.5 opacity-0 transition group-hover:opacity-100">
          <button onClick={onReply} title="Reply" className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-800"><Reply className="h-3.5 w-3.5" /></button>
          <button onClick={copyText} title={copied ? 'Copied!' : 'Copy'} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-800">{copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}</button>
        </span>
      ) : null}
    </div>
  );
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
  // Reply / edit composer modes.
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);
  const [editingId, setEditingId] = useState('');
  // Briefly highlighted message (after tapping a quoted reply).
  const [flashId, setFlashId] = useState('');
  // Delete preference: 'everyone' (default) or 'me' — account-wide, synced via the profile.
  const [deleteScope, setDeleteScope] = useState<'everyone' | 'me'>('everyone');
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [recruiterDmAllowed, setRecruiterDmAllowed] = useState(true);
  // Sidebar search: filters chats by name AND finds messages by content.
  const [searchQ, setSearchQ] = useState('');
  const [searchHits, setSearchHits] = useState<MessageSearchHit[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = searchQ.trim();
    if (q.length < 2) {
      setSearchHits([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      void searchMessages(q)
        .then(({ results }) => setSearchHits(results))
        .catch(() => setSearchHits([]))
        .finally(() => setSearching(false));
    }, 350);
    return () => clearTimeout(t);
  }, [searchQ]);
  // Thread safety menu (Block / Report) + report composer.
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportText, setReportText] = useState('');
  const [safetyBusy, setSafetyBusy] = useState(false);
  const [notice, setNotice] = useState('');
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
      setRecruiterDmAllowed(user.profile?.allowRecruiterMessages ?? true);
      setDeleteScope(user.profile?.messageDeleteScope === 'ME' ? 'me' : 'everyone');
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
      // Edits/deletes from the other side (or another device) update the thread in place.
      if (evt.type === 'message:edit') {
        if (evt.conversationId !== activeIdRef.current) return;
        setDetail((prev) =>
          prev && prev.id === evt.conversationId
            ? { ...prev, messages: prev.messages.map((m) => (m.id === evt.message.id ? { ...m, content: evt.message.content, edited: true } : m)) }
            : prev,
        );
        return;
      }
      if (evt.type === 'message:delete') {
        if (evt.conversationId !== activeIdRef.current) return;
        setDetail((prev) =>
          prev && prev.id === evt.conversationId
            ? { ...prev, messages: prev.messages.map((m) => (m.id === evt.messageId ? { ...m, content: '', deleted: true } : m)) }
            : prev,
        );
        return;
      }
      if (evt.type === 'conversation:settings') {
        if (evt.conversationId !== activeIdRef.current) return;
        setDetail((prev) => (prev && prev.id === evt.conversationId ? { ...prev, disappearAfterHours: evt.disappearAfterHours } : prev));
        return;
      }
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

  async function handleBlockToggle() {
    if (!detail) return;
    setMenuOpen(false);
    if (!detail.blockedByMe) {
      const ok = await confirmDialog({
        title: `Block ${detail.other.fullName}?`,
        message: 'They won\u2019t be able to message you or send connection requests \u2014 and they won\u2019t be told they\u2019ve been blocked.',
        confirmLabel: 'Block',
        tone: 'danger',
      });
      if (!ok) return;
    }
    try {
      setSafetyBusy(true);
      const { blocked } = detail.blockedByMe ? await unblockUser(detail.other.id) : await blockUser(detail.other.id);
      setDetail((d) => (d ? { ...d, blockedByMe: blocked } : d));
      setNotice(blocked ? `${detail.other.fullName} is blocked — they can no longer reach you.` : `${detail.other.fullName} is unblocked.`);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Unable to update block');
    } finally {
      setSafetyBusy(false);
    }
  }

  async function handleReport() {
    if (!detail || !reportText.trim()) return;
    try {
      setSafetyBusy(true);
      await reportUser(detail.other.id, reportText.trim());
      setReportOpen(false);
      setReportText('');
      setNotice('Report sent — the GuildOS team will review it.');
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Unable to send report');
    } finally {
      setSafetyBusy(false);
    }
  }

  async function submit() {
    const text = draft.trim();
    if (!text || !activeId) return;
    setDraft('');
    try {
      setSending(true);
      if (editingId) {
        // Edit in place — the server archives the old version, readers see the newest.
        const { message } = await editMessage(editingId, text);
        setDetail((d) => (d ? { ...d, messages: d.messages.map((m) => (m.id === editingId ? { ...m, content: message.content, edited: true } : m)) } : d));
        setEditingId('');
        return;
      }
      const { message } = await sendMessage(activeId, text, replyTarget?.id);
      setReplyTarget(null);
      // The realtime echo (multi-device sync) may have appended this message
      // already — dedup by id, and always mark our own sends as `mine`.
      setDetail((d) => {
        if (!d) return d;
        if (d.messages.some((m) => m.id === message.id)) return d;
        return { ...d, messages: [...d.messages, { ...message, mine: true }] };
      });
      setConversations((list) => list.map((c) => (c.id === activeId ? { ...c, lastMessage: text, lastMessageAt: message.createdAt } : c)));
    } catch {
      setDraft(text);
    } finally {
      setSending(false);
    }
  }

  async function handleDeleteMessage(messageId: string) {
    const forMe = deleteScope === 'me';
    const ok = await confirmDialog({
      title: forMe ? 'Delete for you?' : 'Delete this message?',
      message: forMe
        ? 'It disappears from YOUR view only — the other person keeps seeing it. (Change this in chat settings.)'
        : 'It will show as “Message deleted” for both of you.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await deleteMessage(messageId, deleteScope);
      setDetail((d) => {
        if (!d) return d;
        return forMe
          ? { ...d, messages: d.messages.filter((m) => m.id !== messageId) }
          : { ...d, messages: d.messages.map((m) => (m.id === messageId ? { ...m, content: '', deleted: true } : m)) };
      });
      if (editingId === messageId) {
        setEditingId('');
        setDraft('');
      }
    } catch {
      /* surface nothing — the message simply stays */
    }
  }

  /** Tap on a quoted reply → scroll to the original and flash it. */
  function jumpToMessage(id: string) {
    const el = document.getElementById(`msg-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setFlashId(id);
    setTimeout(() => setFlashId(''), 1600);
  }

  // Arriving from a search hit (?m=<messageId>): jump once the thread renders.
  const jumpParam = params.get('m') ?? '';
  useEffect(() => {
    if (!jumpParam || !detail) return;
    const t = setTimeout(() => jumpToMessage(jumpParam), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpParam, detail?.id]);

  async function handleDisappearing(hours: number) {
    if (!detail) return;
    try {
      setSettingsBusy(true);
      await setDisappearingMessages(detail.id, hours);
      setDetail((d) => (d ? { ...d, disappearAfterHours: hours } : d));
    } catch {
      /* keep old value */
    } finally {
      setSettingsBusy(false);
    }
  }

  async function handleRecruiterDmToggle() {
    const next = !recruiterDmAllowed;
    setRecruiterDmAllowed(next);
    try {
      await setRecruiterDmPreference(next);
    } catch {
      setRecruiterDmAllowed(!next);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <StudentNav />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <h1 className="mb-4 flex items-center gap-2 text-xl font-semibold text-slate-950 dark:text-white"><MessageSquare className="h-5 w-5" /> Messages</h1>

        <div className="grid h-[calc(100dvh-150px)] min-h-[420px] gap-4 lg:grid-cols-[320px_1fr]">
          {/* Conversation list — scrolls inside its own card. */}
          <aside className={`${activeId ? 'hidden lg:block' : ''} min-w-0 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm`}>
            {/* Search: chats by name + your message history by content. */}
            <div className="sticky top-0 z-10 border-b border-slate-100 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 p-2 backdrop-blur">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  placeholder="Search chats and messages"
                  className="w-full rounded-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 py-1.5 pl-8 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
                {searchQ ? (
                  <button onClick={() => setSearchQ('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800" title="Clear search">
                    <X className="h-3 w-3" />
                  </button>
                ) : null}
              </div>
            </div>
            {searchQ.trim().length >= 2 ? (
              (() => {
                const q = searchQ.trim().toLowerCase();
                const chatMatches = conversations.filter((c) => c.other.fullName.toLowerCase().includes(q) || c.other.username.toLowerCase().includes(q));
                return (
                  <div className="pb-2">
                    {chatMatches.length ? (
                      <>
                        <p className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Chats</p>
                        {chatMatches.map((c) => (
                          <Link key={c.id} href={`/messages?c=${encodeURIComponent(c.id)}`} onClick={() => setSearchQ('')} className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800">
                            <Avatar person={c.other} size="h-8 w-8" />
                            <span className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{c.other.fullName}</span>
                          </Link>
                        ))}
                      </>
                    ) : null}
                    <p className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Messages</p>
                    {searching ? (
                      <p className="px-4 py-3 text-xs text-slate-400 dark:text-slate-500">Searching…</p>
                    ) : searchHits.length ? (
                      searchHits.map((hit) => (
                        <Link
                          key={hit.messageId}
                          href={`/messages?c=${encodeURIComponent(hit.conversationId)}&m=${encodeURIComponent(hit.messageId)}`}
                          onClick={() => setSearchQ('')}
                          className="flex items-start gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          <Avatar person={hit.other} size="h-8 w-8" />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center justify-between gap-2">
                              <span className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">{hit.other.fullName}</span>
                              <span className="shrink-0 text-[10px] text-slate-400 dark:text-slate-500">{timeAgo(hit.createdAt)}</span>
                            </span>
                            <span className="line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{hit.mine ? 'You: ' : ''}{hit.snippet}</span>
                          </span>
                        </Link>
                      ))
                    ) : (
                      <p className="px-4 py-3 text-xs text-slate-400 dark:text-slate-500">No messages match &ldquo;{searchQ.trim()}&rdquo;.</p>
                    )}
                  </div>
                );
              })()
            ) : loading ? (
              <div className="flex items-center justify-center p-10"><LogoSpinner /></div>
            ) : conversations.length ? (
              <ul className="divide-y divide-slate-100">
                {conversations.map((c) => (
                  <li key={c.id}>
                    <Link href={`/messages?c=${encodeURIComponent(c.id)}`} className={`flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 ${c.id === activeId ? 'bg-indigo-50/50' : ''}`}>
                      <Avatar person={c.other} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{c.other.fullName}</p>
                          <span className="shrink-0 text-[11px] text-slate-400 dark:text-slate-500">{timeAgo(c.lastMessageAt)}</span>
                        </div>
                        <p className={`truncate text-xs ${c.unread ? 'font-semibold text-slate-800 dark:text-slate-200' : 'text-slate-500 dark:text-slate-400'}`}>{c.lastMessage || 'No messages yet'}</p>
                      </div>
                      {c.unread ? <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-indigo-600 px-1 text-[10px] font-semibold text-white">{c.unread}</span> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">No conversations yet. Recruiters can message candidates from their profile.</p>
            )}
          </aside>

          {/* Thread — fixed height: messages scroll inside, the page never grows. */}
          <section className={`${activeId ? '' : 'hidden lg:flex'} flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm`}>
            {!activeId ? (
              <div className="flex flex-1 items-center justify-center p-10 text-center text-sm text-slate-400 dark:text-slate-500">Select a conversation to start chatting.</div>
            ) : detailLoading && !detail ? (
              <div className="flex flex-1 items-center justify-center"><LogoSpinner /></div>
            ) : detail ? (
              <>
                <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
                  <Link href="/messages" className="lg:hidden"><ArrowLeft className="h-5 w-5 text-slate-500 dark:text-slate-400" /></Link>
                  <Avatar person={detail.other} size="h-9 w-9" />
                  <div className="min-w-0 flex-1">
                    <Link href={detail.other.username ? `/profile/${encodeURIComponent(detail.other.username)}` : '#'} className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100 hover:underline">{detail.other.fullName}</Link>
                    {detail.other.headline ? <p className="truncate text-xs text-slate-500 dark:text-slate-400">{detail.other.headline}</p> : null}
                  </div>
                  {/* Safety menu: block severs contact both ways (silently); report bells the admins. */}
                  <div className="relative shrink-0">
                    <button onClick={() => setMenuOpen((v) => !v)} className="rounded-lg p-1.5 text-slate-400 dark:text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600" title="Conversation options">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                    {menuOpen ? (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                        <div className="absolute right-0 z-20 mt-1 w-64 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-1 shadow-lg">
                          {/* Chat settings */}
                          <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Disappearing messages</p>
                          <div className="flex gap-1 px-3 pb-2">
                            {[{ v: 0, label: 'Off' }, { v: 24, label: '24 hours' }, { v: 168, label: '7 days' }].map(({ v, label }) => (
                              <button
                                key={v}
                                onClick={() => void handleDisappearing(v)}
                                disabled={settingsBusy}
                                className={`flex-1 rounded-lg border px-2 py-1 text-xs font-medium transition ${(detail.disappearAfterHours ?? 0) === v ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-indigo-300'}`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                          <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">When I delete a message</p>
                          <div className="flex gap-1 px-3 pb-2">
                            {([['everyone', 'For everyone'], ['me', 'Just for me']] as const).map(([v, label]) => (
                              <button
                                key={v}
                                onClick={() => {
                                  setDeleteScope(v);
                                  // Account-wide: follows the user to every device (best-effort save).
                                  void setMessageDeleteScopePreference(v === 'me' ? 'ME' : 'EVERYONE').catch(() => undefined);
                                }}
                                className={`flex-1 rounded-lg border px-2 py-1 text-xs font-medium transition ${deleteScope === v ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-indigo-300'}`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                          <button onClick={() => void handleRecruiterDmToggle()} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
                            <span>Recruiter messages</span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${recruiterDmAllowed ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>{recruiterDmAllowed ? 'Allowed' : 'Blocked'}</span>
                          </button>
                          <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
                          <button onClick={() => void handleBlockToggle()} disabled={safetyBusy} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
                            {detail.blockedByMe ? <><ShieldCheck className="h-4 w-4 text-emerald-500" /> Unblock {detail.other.fullName.split(' ')[0]}</> : <><ShieldOff className="h-4 w-4 text-rose-500" /> Block {detail.other.fullName.split(' ')[0]}</>}
                          </button>
                          <button onClick={() => { setMenuOpen(false); setReportOpen(true); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
                            <Flag className="h-4 w-4 text-amber-500" /> Report to GuildOS
                          </button>
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>

                {notice ? <p className="border-b border-slate-100 bg-indigo-50/60 px-4 py-2 text-xs font-medium text-indigo-700">{notice}</p> : null}
                {(detail.disappearAfterHours ?? 0) > 0 ? (
                  <p className="border-b border-slate-100 dark:border-slate-800 bg-amber-50/70 dark:bg-amber-950/30 px-4 py-1.5 text-center text-[11px] font-medium text-amber-700 dark:text-amber-300">
                    Disappearing messages are on — messages vanish after {detail.disappearAfterHours === 24 ? '24 hours' : '7 days'}.
                  </p>
                ) : null}

                <div className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4">
                  {detail.messages.length ? (
                    detail.messages.map((m, i) => {
                      const prev = detail.messages[i - 1];
                      const newDay = !prev || dayLabel(prev.createdAt) !== dayLabel(m.createdAt);
                      return (
                        <div key={m.id} id={`msg-${m.id}`}>
                          {newDay ? (
                            <div className="my-3 flex items-center gap-3">
                              <span className="h-px flex-1 bg-slate-100 dark:bg-slate-950" />
                              <span className="rounded-full bg-slate-100 dark:bg-slate-950 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{dayLabel(m.createdAt)}</span>
                              <span className="h-px flex-1 bg-slate-100 dark:bg-slate-950" />
                            </div>
                          ) : null}
                          <SwipeableMessage
                            m={m}
                            otherName={detail.other.fullName}
                            flash={flashId === m.id}
                            onQuoteClick={jumpToMessage}
                            onReply={() => {
                              setEditingId('');
                              setReplyTarget(m);
                            }}
                            onEdit={() => {
                              setReplyTarget(null);
                              setEditingId(m.id);
                              setDraft(m.content);
                            }}
                            onDelete={() => void handleDeleteMessage(m.id)}
                          />
                        </div>
                      );
                    })
                  ) : (
                    <div className="pt-10 text-center">
                      <MessageSquare className="mx-auto h-8 w-8 text-slate-300" />
                      <p className="mt-2 text-sm text-slate-400 dark:text-slate-500">Say hello to {detail.other.fullName.split(' ')[0]} 👋</p>
                    </div>
                  )}
                  <div ref={endRef} />
                </div>

                {detail.blockedByMe ? (
                  <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50 dark:bg-slate-900 p-3 text-xs text-slate-500 dark:text-slate-400">
                    <span>You blocked {detail.other.fullName} — messages are off both ways.</span>
                    <button onClick={() => void handleBlockToggle()} disabled={safetyBusy} className="shrink-0 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">Unblock</button>
                  </div>
                ) : (
                  <div className="border-t border-slate-100 dark:border-slate-800">
                    {/* Reply / edit context strip above the composer. */}
                    {replyTarget ? (
                      <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 px-4 py-2">
                        <Reply className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
                        <p className="min-w-0 flex-1 truncate text-xs text-slate-500 dark:text-slate-400">
                          Replying to <span className="font-semibold">{replyTarget.mine ? 'yourself' : detail.other.fullName.split(' ')[0]}</span>: {replyTarget.content}
                        </p>
                        <button onClick={() => setReplyTarget(null)} className="shrink-0 rounded-full p-1 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800" title="Cancel reply"><X className="h-3.5 w-3.5" /></button>
                      </div>
                    ) : editingId ? (
                      <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-2">
                        <Pencil className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                        <p className="min-w-0 flex-1 truncate text-xs text-amber-700 dark:text-amber-300">Editing message — the old version stays in the record.</p>
                        <button onClick={() => { setEditingId(''); setDraft(''); }} className="shrink-0 rounded-full p-1 text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-900/40" title="Cancel edit"><X className="h-3.5 w-3.5" /></button>
                      </div>
                    ) : null}
                    <div className="flex items-center gap-2 p-3">
                      <input
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submit(); } }}
                        placeholder={editingId ? 'Edit your message…' : 'Write a message…'}
                        className="flex-1 rounded-full border border-slate-200 dark:border-slate-800 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      />
                      <button onClick={() => void submit()} disabled={sending || !draft.trim()} className="grid h-10 w-10 place-items-center rounded-full bg-indigo-600 text-white disabled:opacity-50">{editingId ? <Pencil className="h-4 w-4" /> : <Send className="h-4 w-4" />}</button>
                    </div>
                  </div>
                )}

                {reportOpen ? (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => !safetyBusy && setReportOpen(false)}>
                    <div className="w-full max-w-sm rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
                      <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100"><Flag className="h-4 w-4 text-amber-500" /> Report {detail.other.fullName}</h3>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Tell the GuildOS team what happened — they can restrict the account platform-wide. Consider blocking them too.</p>
                      <textarea
                        autoFocus
                        value={reportText}
                        onChange={(e) => setReportText(e.target.value.slice(0, 300))}
                        placeholder="What happened? (required)"
                        className="mt-3 min-h-24 w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm outline-none transition focus:border-indigo-400"
                      />
                      <div className="mt-3 flex justify-end gap-2">
                        <button onClick={() => setReportOpen(false)} disabled={safetyBusy} className="rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800">Cancel</button>
                        <button onClick={() => void handleReport()} disabled={safetyBusy || !reportText.trim()} className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-40">{safetyBusy ? 'Sending…' : 'Send report'}</button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center p-10 text-center text-sm text-slate-400 dark:text-slate-500">Conversation not found.</div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-100 dark:bg-slate-950"><StudentNav /><main className="mx-auto max-w-5xl px-4 py-10"><Loading /></main></div>}>
      <MessagesInner />
    </Suspense>
  );
}
