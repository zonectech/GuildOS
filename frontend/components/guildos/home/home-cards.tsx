'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CalendarDays, Clock, MapPin, Plus, QrCode } from 'lucide-react';
import type { UpcomingEventEntry } from '../event-api';
import { resolveAvatarUrl, type SuggestedCommunity, type UserMembershipEntry } from '../community-list-api';

const CARD = 'rounded-xl border border-slate-200 bg-white p-4  dark:border-slate-800 dark:bg-slate-900';

function Logo({ src, name, className }: { src: string; name: string; className: string }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return <span className={`grid shrink-0 place-items-center bg-indigo-500 font-semibold text-white ${className}`}>{name.slice(0, 1).toUpperCase()}</span>;
  }
  return <img src={src} alt="" onError={() => setBroken(true)} className={`shrink-0 object-cover ${className}`} />;
}

const INACTIVE_REGISTRATIONS = new Set(['CANCELLED', 'REJECTED', 'NO_SHOW', 'COMPLETED', 'CHECKED_OUT']);

/** The soonest event you're actually going to (skips cancelled/rejected registrations and undated events). */
export function nextEventOf(events: UpcomingEventEntry[]) {
  return events
    .filter((e) => e.startDate && !INACTIVE_REGISTRATIONS.has(e.registrationStatus) && e.status !== 'ARCHIVED')
    .sort((a, b) => new Date(a.startDate!).getTime() - new Date(b.startDate!).getTime())[0] ?? null;
}

/** Whole calendar days from today to the event (0 = today), in the viewer's timezone. */
function daysUntil(value: string) {
  const start = new Date(value);
  const today = new Date();
  const a = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const b = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((a - b) / 86400000);
}

function whenLine(event: UpcomingEventEntry) {
  const days = daysUntil(event.startDate!);
  const time = new Date(event.startDate!).toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' });
  if (new Date(event.startDate!).getTime() <= Date.now()) return { headline: event.title, when: `Started ${new Date(event.startDate!).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })} · ${time}` };
  if (days === 0) return { headline: event.title, when: `Starts ${time}` };
  if (days === 1) return { headline: `Tomorrow: ${event.title}`, when: `Starts ${time}` };
  if (days <= 14) return { headline: `${event.title} is in ${days} days`, when: new Date(event.startDate!).toLocaleDateString('en-NG', { weekday: 'long', month: 'short', day: 'numeric' }) + ` · ${time}` };
  return { headline: `Coming up: ${event.title}`, when: new Date(event.startDate!).toLocaleDateString('en-NG', { month: 'long', day: 'numeric' }) + ` · ${time}` };
}

/**
 * The one thing to do next. Your next event wins (with the door pass on the day itself);
 * without one, a nudge toward finding an event. New students without a community get
 * <FirstCommunityCard> instead, so this returns nothing for them.
 */
export function NextUpCard({ events, joinedCount }: { events: UpcomingEventEntry[]; joinedCount: number }) {
  const next = nextEventOf(events);

  if (!next) {
    if (joinedCount === 0) return null;
    return (
      <section className={CARD}>
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
            <CalendarDays className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold tracking-wide text-slate-500 dark:text-slate-400">Next up</p>
            <h2 className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">Find your next event</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Workshops, hackathons and meetups happen every week. Each one you attend adds to your verified record.</p>
            <Link href="/events" className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700">
              Browse events <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const start = new Date(next.startDate!);
  const isToday = daysUntil(next.startDate!) <= 0;
  const isOngoing = start.getTime() <= Date.now();
  const { headline, when } = whenLine(next);
  const pending = next.registrationStatus === 'PENDING_APPROVAL';
  const waitlisted = next.registrationStatus === 'WAITLISTED';
  const place = next.venue || (next.mode === 'VIRTUAL' ? 'Online' : '');

  return (
    <section className={`${CARD} overflow-hidden ${isToday ? 'border-indigo-300 dark:border-indigo-500/40' : ''}`}>
      <div className="flex items-start gap-4">
        <div className="grid w-14 shrink-0 place-items-center rounded-lg bg-indigo-600 py-2 text-center text-white shadow-sm">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-indigo-100">{start.toLocaleDateString('en-NG', { month: 'short' })}</span>
          <span className="text-2xl font-bold leading-none">{start.getDate()}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold tracking-wide text-indigo-600 dark:text-indigo-400">{isOngoing ? 'Ongoing event' : isToday ? 'Starts today' : 'Next up'}</p>
          <h2 className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">{headline}</h2>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {when}</span>
            {place ? <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {place}</span> : null}
          </p>
          {pending || waitlisted ? (
            <p className="mt-2 rounded-xl bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              {pending ? 'The organizers are reviewing your registration. You’ll get a notification once you’re in.' : 'You’re on the waitlist. We’ll let you know if a spot opens.'}
            </p>
          ) : isToday ? (
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Open event details for attendance instructions and certificate requirements.</p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {!pending && !waitlisted ? (
              <Link href={next.mode === 'VIRTUAL' ? `/events/${encodeURIComponent(next.slug)}` : `/events/${encodeURIComponent(next.slug)}#checkin-pass`} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700">
                <QrCode className="h-4 w-4" /> {isToday ? 'Show my pass' : 'View my ticket'}
              </Link>
            ) : null}
            <Link href={`/events/${encodeURIComponent(next.slug)}`} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              Event details <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Quick jump into the communities you belong to, plus a way to find more. */
export function MyCommunitiesStrip({ memberships }: { memberships: UserMembershipEntry[] }) {
  const mine = memberships.filter((m) => m.community && m.status === 'ACTIVE');
  if (!mine.length) return null;

  return (
    <section className={CARD} aria-label="Your communities">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Your communities</h2>
        <Link href="/communities" className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">Find more</Link>
      </div>
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
        {mine.map((m) => (
          <Link key={m.membershipId} href={`/communities/${encodeURIComponent(m.community!.slug)}`} className="group flex w-20 shrink-0 flex-col items-center gap-1.5 text-center">
            <Logo src={resolveAvatarUrl(m.community!.logo)} name={m.community!.name} className="h-14 w-14 rounded-lg text-lg ring-2 ring-transparent transition group-hover:ring-indigo-300" />
            <span className="line-clamp-2 text-[11px] font-medium leading-tight text-slate-700 dark:text-slate-300">{m.community!.name}</span>
          </Link>
        ))}
        <Link href="/communities" className="group flex w-20 shrink-0 flex-col items-center gap-1.5 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-lg border-2 border-dashed border-slate-300 text-slate-400 transition group-hover:border-indigo-400 group-hover:text-indigo-500 dark:border-slate-700">
            <Plus className="h-5 w-5" />
          </span>
          <span className="text-[11px] font-medium leading-tight text-slate-500 dark:text-slate-400">Join another</span>
        </Link>
      </div>
    </section>
  );
}

/**
 * First-run welcome for a student who hasn't joined anything yet. Belonging is the
 * whole point of GuildOS, so this leads the page until they join their first community.
 */
export function FirstCommunityCard({
  firstName,
  university,
  suggestions,
  joining,
  onJoin,
}: {
  firstName: string;
  university: string;
  suggestions: SuggestedCommunity[];
  joining: string | null;
  onJoin: (id: string) => void;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white p-5  dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-lg font-semibold tracking-tight text-slate-950 dark:text-white">Find your community, {firstName}</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
        Join a community to see its events, posts and members right here.
        {university ? ` Start with one at ${university}.` : ' Most students start with one from their own university.'}
      </p>

      {suggestions.length ? (
        <ul className="mt-4 space-y-2">
          {suggestions.slice(0, 3).map((c) => (
            <li key={c._id} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white/80 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900/80">
              <Logo src={resolveAvatarUrl(c.logo)} name={c.name} className="h-10 w-10 rounded-xl text-sm" />
              <div className="min-w-0 flex-1">
                <Link href={`/communities/${encodeURIComponent(c.slug)}`} className="block truncate text-sm font-semibold text-slate-900 hover:underline dark:text-slate-100">{c.name}</Link>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">{[c.reason, c.memberCount ? `${c.memberCount} members` : ''].filter(Boolean).join(' · ')}</p>
              </div>
              <button
                type="button"
                onClick={() => onJoin(c._id)}
                disabled={joining === c._id}
                className="shrink-0 rounded-full bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
              >
                {joining === c._id ? 'Joining…' : 'Join'}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link href="/communities" className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100">
          Browse all communities <ArrowRight className="h-4 w-4" />
        </Link>
        <Link href="/dashboard/communities/create" className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
          Can’t find yours? Start it
        </Link>
      </div>
    </section>
  );
}
