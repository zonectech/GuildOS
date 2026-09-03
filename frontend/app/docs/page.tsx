'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, BookOpen, ChevronRight, GraduationCap, LifeBuoy, Search, Users } from 'lucide-react';

import { renderMarkdown } from '../../components/guildos/markdown';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type DocTopic = {
  area: string;
  path: string | null;
  detail: string;
  guide: string | null;
};

type DocsPayload = {
  mission: string;
  student: DocTopic[];
  leader: DocTopic[];
};

type TopicRef = { group: 'student' | 'leader'; index: number };

/**
 * Turn bare GuildOS paths in guide text (e.g. "/my-events") into markdown links so
 * they render as clickable navigation. Skips example placeholders like
 * /u/your-username and paths already inside markdown link syntax.
 */
function linkifyPaths(md: string): string {
  return md.replace(
    /(^|\s|(?<!\])\()(\/[a-z][a-z0-9-]*(?:\/[a-z][a-z0-9-]*)*)(?=$|[\s).,;:!?])/gm,
    (full, before: string, path: string) => (path.includes('your-') ? full : `${before}[${path}](${path})`),
  );
}

export default function DocsPage() {
  const [docs, setDocs] = useState<DocsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [active, setActive] = useState<TopicRef>({ group: 'student', index: 0 });
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/docs`);
        if (!response.ok) throw new Error('Request failed');
        const payload = (await response.json()) as DocsPayload;
        if (!cancelled) setDocs(payload);
      } catch {
        if (!cancelled) setError('The documentation is not available right now. Please try again later.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const matches = (t: DocTopic) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return `${t.area} ${t.detail} ${t.guide ?? ''}`.toLowerCase().includes(q);
  };

  const groups = useMemo(
    () =>
      docs
        ? ([
            { key: 'student' as const, label: 'For students', Icon: GraduationCap, topics: docs.student },
            { key: 'leader' as const, label: 'For community leaders', Icon: Users, topics: docs.leader },
          ])
        : [],
    [docs],
  );

  const activeTopic = docs ? docs[active.group][active.index] : null;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <header className="bg-gradient-to-br from-indigo-700 to-sky-600 px-4 py-14 text-white">
        <div className="mx-auto max-w-6xl">
          <div>
            <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-100 hover:text-white">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to GuildOS
            </Link>
          </div>
          <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide backdrop-blur">
            <BookOpen className="h-4 w-4" /> Documentation
          </p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Learn how GuildOS works</h1>
          <p className="mt-3 max-w-2xl text-sm text-indigo-100 sm:text-base">
            {docs?.mission ?? 'Guides for students and community leaders — events, certificates, communities, reputation, and more.'}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 pb-24">
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            Loading documentation…
          </div>
        ) : null}
        {error ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/50 dark:text-amber-300">{error}</div>
        ) : null}

        {docs ? (
          <div className="grid gap-6 lg:grid-cols-[280px,1fr]">
            {/* Topic navigation — dropdown on phones, sidebar on desktop */}
            <aside className="lg:sticky lg:top-6 lg:self-start">
              <div className="space-y-4 lg:hidden">
                {groups.map(({ key, label, Icon, topics }) => (
                  <div key={key}>
                    <label
                      className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400"
                      htmlFor={`docs-topic-${key}`}
                    >
                      <Icon className="h-3.5 w-3.5" /> {label}
                    </label>
                    <select
                      id={`docs-topic-${key}`}
                      value={active.group === key ? String(active.index) : ''}
                      onChange={(e) => {
                        if (e.target.value === '') return;
                        setActive({ group: key, index: Number(e.target.value) });
                      }}
                      className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-indigo-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                    >
                      <option value="" disabled>
                        Choose a topic…
                      </option>
                      {topics.map((t, i) => (
                        <option key={t.area} value={String(i)}>
                          {t.area}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div className="hidden lg:block">
                <div className="relative mb-4">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search topics…"
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-indigo-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
                <nav className="space-y-5">
                  {groups.map(({ key, label, Icon, topics }) => {
                    const visible = topics.map((t, i) => ({ t, i })).filter(({ t }) => matches(t));
                    if (!visible.length) return null;
                    return (
                      <div key={key}>
                        <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                          <Icon className="h-3.5 w-3.5" /> {label}
                        </p>
                        <ul className="space-y-0.5">
                          {visible.map(({ t, i }) => {
                            const isActive = active.group === key && active.index === i;
                            return (
                              <li key={t.area}>
                                <button
                                  type="button"
                                  onClick={() => setActive({ group: key, index: i })}
                                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-left text-sm ${
                                    isActive
                                      ? 'bg-indigo-600 font-semibold text-white'
                                      : 'text-slate-600 hover:bg-slate-200/70 dark:text-slate-300 dark:hover:bg-slate-800'
                                  }`}
                                >
                                  <span>{t.area}</span>
                                  {isActive ? <ChevronRight className="h-4 w-4 shrink-0" /> : null}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    );
                  })}
                </nav>
              </div>
            </aside>

            {/* Article */}
            <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 sm:p-8">
              {activeTopic ? (
                <>
                  <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">
                    {active.group === 'student' ? 'For students' : 'For community leaders'}
                  </p>
                  <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 dark:text-white">{activeTopic.area}</h2>
                  {activeTopic.path ? (
                    <Link
                      href={activeTopic.path}
                      className="mt-2 inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300"
                    >
                      Open {activeTopic.path} <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  ) : null}
                  <div className="prose-sm mt-5 space-y-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300 [&_h2]:mt-6 [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-slate-950 dark:[&_h2]:text-white">
                    {renderMarkdown(linkifyPaths(activeTopic.guide ?? activeTopic.detail))}
                  </div>
                </>
              ) : null}
            </article>
          </div>
        ) : null}

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          <p className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
            <LifeBuoy className="h-4 w-4 text-indigo-600" /> Can&apos;t find what you need?
          </p>
          <p className="mt-1">
            Visit the <Link href="/support" className="font-semibold text-indigo-600 hover:underline">Support page</Link> or ask GuildBot,
            the in-app assistant, once you&apos;re logged in. Communities also publish their own guides in their Knowledge tabs.
          </p>
        </div>
      </main>
    </div>
  );
}
