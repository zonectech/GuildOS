'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowRight, Lightbulb, Search, ShieldCheck } from 'lucide-react';

import { getCurrentUser } from '../../../components/guildos/api/auth-api';
import { DashboardShell } from '../../../components/guildos/dashboard/dashboard-shell';
import { DashboardSidebar } from '../../../components/guildos/dashboard/dashboard-sidebar';
import { DashboardTopbar } from '../../../components/guildos/dashboard/dashboard-topbar';
import { SectionHeader } from '../../../components/guildos/ui/section-header';
import { PLAYBOOK, type PlaybookBlock, type PlaybookChapter } from '../../../components/guildos/playbook/playbook-content';

const CHECKS_KEY = 'guildos.playbook.checks';

/** Every piece of text in a chapter, lower-cased, for the search box. */
function chapterText(chapter: PlaybookChapter) {
  const parts: string[] = [chapter.title, chapter.summary];
  for (const section of chapter.sections) {
    parts.push(section.heading);
    for (const b of section.blocks) {
      if (b.kind === 'text' || b.kind === 'tip' || b.kind === 'warn') parts.push(b.text);
      else if (b.kind === 'steps' || b.kind === 'list' || b.kind === 'checklist') parts.push(...b.items);
      else if (b.kind === 'table') parts.push(...b.rows.flat());
      else if (b.kind === 'links') parts.push(...b.items.map((l) => l.label));
    }
  }
  return parts.join(' ').toLowerCase();
}

function Block({ block, checks, onToggle }: { block: PlaybookBlock; checks: Record<string, boolean>; onToggle: (key: string) => void }) {
  switch (block.kind) {
    case 'text':
      return <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">{block.text}</p>;
    case 'steps':
      return (
        <ol className="space-y-2">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-indigo-600 text-[11px] font-bold text-white">{i + 1}</span>
              <span>{item}</span>
            </li>
          ))}
        </ol>
      );
    case 'list':
      return (
        <ul className="space-y-1.5">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      );
    case 'tip':
      return (
        <p className="flex gap-2.5 rounded-lg bg-emerald-50 px-4 py-3 text-sm leading-relaxed text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" /> <span>{block.text}</span>
        </p>
      );
    case 'warn':
      return (
        <p className="flex gap-2.5 rounded-lg bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{block.text}</span>
        </p>
      );
    case 'table':
      return (
        <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th className="w-1/3 px-4 py-2.5 font-semibold">{block.head[0]}</th>
                <th className="px-4 py-2.5 font-semibold">{block.head[1]}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {block.rows.map(([a, b], i) => (
                <tr key={i} className="align-top">
                  <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-slate-100">{a}</td>
                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'checklist': {
      const done = block.items.filter((item) => checks[`${block.title}::${item}`]).length;
      return (
        <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-4 dark:border-indigo-500/20 dark:bg-indigo-500/5">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{block.title}</p>
            <span className="text-xs font-medium text-indigo-700 dark:text-indigo-300">{done}/{block.items.length} done</span>
          </div>
          <ul className="space-y-1.5">
            {block.items.map((item) => {
              const key = `${block.title}::${item}`;
              return (
                <li key={key}>
                  <label className="flex cursor-pointer gap-2.5 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                    <input type="checkbox" checked={Boolean(checks[key])} onChange={() => onToggle(key)} className="mt-1 h-4 w-4 shrink-0 accent-indigo-600" />
                    <span className={checks[key] ? 'text-slate-400 line-through dark:text-slate-500' : ''}>{item}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      );
    }
    case 'links':
      return (
        <div className="flex flex-wrap gap-2">
          {block.items.map((l) => (
            <Link key={l.href} href={l.href} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-indigo-700 hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-900 dark:text-indigo-300">
              {l.label} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ))}
        </div>
      );
  }
}

export default function LeaderPlaybookPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [checks, setChecks] = useState<Record<string, boolean>>({});

  useEffect(() => {
    void getCurrentUser().then((user) => {
      if (!user) router.replace('/login?next=/dashboard/playbook');
    });
    try {
      const saved = window.localStorage.getItem(CHECKS_KEY);
      if (saved) setChecks(JSON.parse(saved) as Record<string, boolean>);
    } catch {
      /* checklists simply start empty */
    }
  }, [router]);

  function toggle(key: string) {
    setChecks((current) => {
      const next = { ...current, [key]: !current[key] };
      try {
        window.localStorage.setItem(CHECKS_KEY, JSON.stringify(next));
      } catch {
        /* progress is a convenience; ignore storage errors */
      }
      return next;
    });
  }

  const index = useMemo(() => PLAYBOOK.map((chapter) => ({ chapter, text: chapterText(chapter) })), []);
  const q = query.trim().toLowerCase();
  const visible = q ? index.filter((entry) => q.split(/\s+/).every((word) => entry.text.includes(word))).map((e) => e.chapter) : PLAYBOOK;

  return (
    <DashboardShell sidebar={<DashboardSidebar />} topbar={<DashboardTopbar />}>
      <SectionHeader
        eyebrow="Community mode"
        title="Leader playbook"
        subtitle="Everything you need to run your community on GuildOS: setup, roles, events in person and online, certificates, money and the fixes for common problems."
        toolbar={
          <label className="relative w-full sm:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search the playbook, e.g. certificate"
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </label>
        }
      />

      {/* Phones: chapters as a scrolling row of chips. */}
      <nav className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1 lg:hidden" aria-label="Chapters">
        {visible.map((c, i) => (
          <a key={c.id} href={`#${c.id}`} className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            {PLAYBOOK.indexOf(c) + 1 || i + 1}. {c.title}
          </a>
        ))}
      </nav>

      <div className="mt-6 grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <nav className="sticky top-24 space-y-0.5" aria-label="Chapters">
            <p className="mb-2 px-3 text-[10px] font-semibold tracking-wide text-slate-500">Chapters</p>
            {visible.map((c) => {
              const Icon = c.icon;
              return (
                <a key={c.id} href={`#${c.id}`} className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-white hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white">
                  <Icon className="h-4 w-4 shrink-0 text-indigo-500" />
                  <span className="truncate">{PLAYBOOK.indexOf(c) + 1}. {c.title}</span>
                </a>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0 space-y-6">
          {visible.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              Nothing matches &ldquo;{query}&rdquo;. Try a shorter word, or ask Guild Captain.
            </p>
          ) : null}
          {visible.map((chapter) => {
            const Icon = chapter.icon;
            return (
              <article key={chapter.id} id={chapter.id} className="guild-surface scroll-mt-24 rounded-xl border p-5 shadow-sm sm:p-6">
                <header className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold tracking-wide text-slate-400">Chapter {PLAYBOOK.indexOf(chapter) + 1}</p>
                    <h2 className="text-xl font-semibold tracking-tight text-slate-950 dark:text-white">{chapter.title}</h2>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{chapter.summary}</p>
                  </div>
                  {chapter.who ? (
                    <span className="hidden shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300 sm:inline-flex" title="Lowest role that can do most of this">
                      <ShieldCheck className="h-3.5 w-3.5" /> {chapter.who}+
                    </span>
                  ) : null}
                </header>
                <div className="mt-5 space-y-6">
                  {chapter.sections.map((section) => (
                    <section key={section.heading} className="space-y-3">
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{section.heading}</h3>
                      {section.blocks.map((block, i) => (
                        <Block key={i} block={block} checks={checks} onToggle={toggle} />
                      ))}
                    </section>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </DashboardShell>
  );
}
