'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, ExternalLink, Pencil, Users } from 'lucide-react';
import { resolveAvatarUrl, type CommunitySummary } from '../community-list-api';

export type AttentionItem = {
  id: string;
  /** urgent = happening now / blocking people; todo = needs you soon; info = worth a look. */
  tone: 'urgent' | 'todo' | 'info';
  icon: ReactNode;
  title: string;
  detail: string;
  href: string;
  cta: string;
};

const TONE: Record<AttentionItem['tone'], { dot: string; icon: string }> = {
  urgent: { dot: 'bg-rose-500', icon: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300' },
  todo: { dot: 'bg-amber-500', icon: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300' },
  info: { dot: 'bg-indigo-500', icon: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300' },
};

const PANEL = 'rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900';

/** The organizer's to-do list, most urgent first. Empty means genuinely nothing waiting. */
export function AttentionPanel({ items }: { items: AttentionItem[] }) {
  const order = { urgent: 0, todo: 1, info: 2 } as const;
  const sorted = [...items].sort((a, b) => order[a.tone] - order[b.tone]);

  return (
    <section className={`${PANEL} min-w-0`} aria-label="Needs your attention">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold tracking-tight text-slate-950 dark:text-white">Needs your attention</h2>
        {sorted.length ? <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{sorted.length}</span> : null}
      </div>
      {sorted.length ? (
        <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
          {sorted.map((item) => (
            <li key={item.id} className="py-3 first:pt-0 last:pb-0">
              <Link href={item.href} className="group flex items-center gap-3">
                <span className={`relative grid h-10 w-10 shrink-0 place-items-center rounded-xl ${TONE[item.tone].icon}`}>
                  {item.icon}
                  <span className={`absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-slate-900 ${TONE[item.tone].dot}`} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-900 group-hover:text-indigo-700 dark:text-slate-100 dark:group-hover:text-indigo-300">{item.title}</span>
                  <span className="mt-1 block truncate text-xs text-slate-500 dark:text-slate-400">{item.detail}</span>
                </span>
                <span className="hidden shrink-0 items-center gap-1 text-xs font-semibold text-indigo-600 sm:inline-flex dark:text-indigo-400">
                  {item.cta} <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-4 flex items-center gap-3 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span>You’re all caught up. No requests, reports or certificates waiting.</span>
        </div>
      )}
    </section>
  );
}

export type QuickAction = { label: string; hint: string; href: string; icon: ReactNode; primary?: boolean };

export function QuickActions({ actions }: { actions: QuickAction[] }) {
  return (
    <section aria-label="Quick actions" className="border-b border-slate-200 pb-4 dark:border-slate-800">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Community tools</h2>
      {actions.map((action) => (
        <Link
          key={action.label}
          href={action.href}
          className="group flex items-center gap-3 rounded-md px-2 py-3 transition hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center text-slate-500 dark:text-slate-400">{action.icon}</span>
          <span>
            <span className={`block text-sm font-semibold text-slate-900 dark:text-slate-100`}>{action.label}</span>
            <span className={`block text-xs text-slate-500 dark:text-slate-400`}>{action.hint}</span>
          </span>
        </Link>
      ))}
    </section>
  );
}

function CommunityLogo({ community }: { community: CommunitySummary }) {
  const [broken, setBroken] = useState(false);
  const src = community.logo ? resolveAvatarUrl(community.logo) : '';
  if (!src || broken) return <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-indigo-500 text-sm font-semibold text-white">{community.name.slice(0, 1)}</span>;
  return <img src={src} alt="" onError={() => setBroken(true)} className="h-11 w-11 shrink-0 rounded-xl object-cover" />;
}

/** Each community you run, with the three places you actually go to manage it. */
export function ManagedCommunitiesPanel({ communities }: { communities: CommunitySummary[] }) {
  return (
    <section className={PANEL}>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold tracking-tight text-slate-950 dark:text-white">Your communities</h2>
        <Link href="/dashboard/communities" className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">Manage all</Link>
      </div>
      <ul className="mt-4 space-y-3">
        {communities.map((c) => (
          <li key={c._id} className="border-b border-slate-100 py-4 last:border-0 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <CommunityLogo community={c} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-slate-900 dark:text-slate-100">{c.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {c.memberCount} {c.memberCount === 1 ? 'member' : 'members'} · {c.eventCount} {c.eventCount === 1 ? 'event' : 'events'}
                  {c.verificationStatus === 'VERIFIED' ? <span className="text-emerald-600 dark:text-emerald-400"> · Verified</span> : <span className="text-amber-600 dark:text-amber-400"> · Not verified</span>}
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href={`/communities/${c.slug}`} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                <ExternalLink className="h-3.5 w-3.5" /> View page
              </Link>
              <Link href={`/dashboard/communities/${c.slug}/edit`} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                <Pencil className="h-3.5 w-3.5" /> Edit profile
              </Link>
              <Link href="/dashboard/members" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                <Users className="h-3.5 w-3.5" /> Members
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
