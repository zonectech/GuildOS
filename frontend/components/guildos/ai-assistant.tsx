'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sparkles, X, Send, Loader2 } from 'lucide-react';

import { getCurrentUser } from './auth-api';
import { askAssistant, type AssistantMessage, type AssistantMode } from './assistant-api';

const STUDENT_PROMPTS = [
  'How do I earn a certificate?',
  'What is my Guild Score?',
  'Find communities for me',
  'How do I build my CV?',
];

const LEADER_PROMPTS = [
  'How do I verify attendance?',
  'How do I approve members?',
  'Help me create an event',
  'How do I issue certificates?',
];

/** Matches an in-app path (e.g. "/account", "/dashboard/premium") at a word boundary —
 * preceded by whitespace/start/open-paren, so it never matches things like "and/or" or "3/4". */
const PATH_PATTERN = /(^|[\s(])(\/[a-zA-Z][\w-]*(?:\/[\w-]+)*)/g;

/** Renders assistant replies with any in-app path (e.g. "/cv", "/dashboard/premium")
 * turned into a clickable button instead of inert plain text. */
function renderAssistantContent(content: string, onNavigate: (path: string) => void) {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  const re = new RegExp(PATH_PATTERN);
  let match: RegExpExecArray | null;
  while ((match = re.exec(content))) {
    const [full, prefix, path] = match;
    const matchStart = match.index + prefix.length;
    if (matchStart > lastIndex) nodes.push(<span key={key++}>{content.slice(lastIndex, matchStart)}</span>);
    if (prefix) nodes.push(prefix);
    nodes.push(
      <button
        key={key++}
        onClick={() => onNavigate(path)}
        className="mx-0.5 inline-flex items-center rounded-full bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 align-baseline text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-500/20"
      >
        {path}
      </button>,
    );
    lastIndex = match.index + full.length;
  }
  if (lastIndex < content.length) nodes.push(<span key={key++}>{content.slice(lastIndex)}</span>);
  return nodes;
}

export function AiAssistant() {
  const pathname = usePathname();
  const router = useRouter();
  const mode: AssistantMode = pathname?.startsWith('/dashboard') ? 'leader' : 'student';
  const botName = mode === 'leader' ? 'Guild Captain' : 'GuildBot';
  const botTagline = mode === 'leader' ? 'Your community leader assistant' : 'Your GuildOS assistant';
  const quickPrompts = mode === 'leader' ? LEADER_PROMPTS : STUDENT_PROMPTS;

  const [authed, setAuthed] = useState(false);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  function goTo(path: string) {
    setOpen(false);
    router.push(path);
  }

  useEffect(() => {
    let cancelled = false;
    void getCurrentUser()
      .then((u) => {
        if (!cancelled) setAuthed(Boolean(u));
      })
      .catch(() => {
        if (!cancelled) setAuthed(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || loading) return;
    const next: AssistantMessage[] = [...messages, { role: 'user', content: clean }];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const { reply } = await askAssistant(next, mode);
      setMessages((list) => [...list, { role: 'assistant', content: reply }]);
    } catch {
      setMessages((list) => [
        ...list,
        { role: 'assistant', content: 'Sorry, I had trouble responding just now. Please try again in a moment.' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  if (!authed) return null;

  return (
    <>
      {open ? (
        <div className="fixed bottom-24 right-4 z-[90] flex h-[min(32rem,calc(100vh-8rem))] w-[calc(100%-2rem)] max-w-sm flex-col overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 bg-gradient-to-r from-indigo-600 to-sky-500 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-white/20">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold leading-tight">{botName}</p>
                <p className="text-[11px] text-white/80">{botTagline}</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="rounded-full p-1.5 hover:bg-white/20" aria-label="Close assistant">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 dark:bg-slate-900 px-3 py-4">
            {messages.length ? (
              messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2 text-sm ${
                      m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 shadow-sm'
                    }`}
                  >
                    {m.role === 'assistant' ? renderAssistantContent(m.content, goTo) : m.content}
                  </div>
                </div>
              ))
            ) : (
              <div className="px-1">
                <div className="rounded-2xl bg-white dark:bg-slate-900 p-3 text-sm text-slate-700 dark:text-slate-300 shadow-sm">
                  Hi! I&apos;m <span className="font-semibold">{botName}</span>.{' '}
                  {mode === 'leader'
                    ? 'Ask me about approving members, assigning roles, running events, verifying attendance, or issuing certificates.'
                    : 'Ask me anything about events, communities, certificates, your Guild Score, CV, or opportunities.'}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {quickPrompts.map((q) => (
                    <button
                      key={q}
                      onClick={() => void send(q)}
                      className="rounded-full border border-indigo-200 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {loading ? (
              <div className="flex justify-start">
                <div className="inline-flex items-center gap-2 rounded-2xl bg-white dark:bg-slate-900 px-3.5 py-2 text-sm text-slate-500 dark:text-slate-400 shadow-sm">
                  <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
                </div>
              </div>
            ) : null}
            <div ref={endRef} />
          </div>

          {/* Composer */}
          <div className="flex items-center gap-2 border-t border-slate-100 bg-white dark:bg-slate-900 p-3">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              placeholder={`Ask ${botName}…`}
              className="flex-1 rounded-full border border-slate-200 dark:border-slate-800 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
            <button
              onClick={() => void send(input)}
              disabled={loading || !input.trim()}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-indigo-600 text-white disabled:opacity-50"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}

      {/* Floating launcher */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-4 right-4 z-[90] flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-sky-500 text-white shadow-lg transition hover:scale-105 hover:shadow-xl"
        aria-label={open ? 'Close assistant' : 'Open assistant'}
      >
        {open ? <X className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
      </button>
    </>
  );
}
