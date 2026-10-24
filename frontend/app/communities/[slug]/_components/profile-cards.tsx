'use client';

import { BadgeCheck, BookOpen, Building2, CalendarDays, GraduationCap, Handshake, ShieldCheck } from 'lucide-react';

import type { CommunitySummary } from '../../../../components/guildos/community-list-api';
import { resolveEventImageUrl, type CommunitySponsorEntry, type EventSummary } from '../../../../components/guildos/event-api';
import { CommunityEventCard } from './community-event-card';

const CARD_CLASS = 'rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm';

function AboutFact({ icon: Icon, label, value }: { icon: typeof BookOpen; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 rounded-2xl bg-slate-50 dark:bg-slate-900 px-4 py-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</p>
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{value}</p>
      </div>
    </div>
  );
}

/** About + Community Rules. */
export function CommunityAboutCards({ community }: { community: CommunitySummary }) {
  return (
    <>
      <div className={CARD_CLASS}>
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-950 dark:text-white">
          <BookOpen className="h-4 w-4 text-indigo-500" /> About
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{community.description || 'No description provided.'}</p>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {community.university && <AboutFact icon={GraduationCap} label="University" value={community.university} />}
          {community.faculty && <AboutFact icon={Building2} label="Faculty" value={community.faculty} />}
          {community.department && <AboutFact icon={BookOpen} label="Department" value={community.department} />}
          <AboutFact icon={CalendarDays} label="Founded" value={new Date(community.createdAt).toLocaleDateString('en-NG', { year: 'numeric', month: 'long' })} />
        </div>
      </div>

      {(community.rules?.length ?? 0) > 0 && (
        <div className={CARD_CLASS}>
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-950 dark:text-white">
            <ShieldCheck className="h-4 w-4 text-indigo-500" /> Community Rules
          </h2>
          <ol className="mt-4 space-y-2">
            {community.rules!.map((rule, i) => (
              <li key={i} className="flex items-start gap-3 rounded-2xl bg-slate-50 dark:bg-slate-900 px-4 py-3">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-indigo-100 text-[11px] font-bold text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300">{i + 1}</span>
                <p className="text-sm text-slate-700 dark:text-slate-300">{rule}</p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </>
  );
}

export function CommunityEventsCard({ events }: { events: EventSummary[] }) {
  return (
    <div className={CARD_CLASS}>
      <h2 className="flex items-center gap-2 text-base font-bold text-slate-950 dark:text-white">
        <CalendarDays className="h-4 w-4 text-indigo-500" /> Events
        {events.length > 0 && (
          <span className="ml-auto rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
            {events.length}
          </span>
        )}
      </h2>
      {events.length > 0 ? (
        <div className="mt-4 space-y-3">
          {events.map((event) => (
            <CommunityEventCard key={event._id} event={event} />
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No public events yet.</p>
      )}
    </div>
  );
}

/** Who has backed this community's events (social proof). */
export function CommunitySponsorsCard({ roster }: { roster: { sponsors: CommunitySponsorEntry[]; totalSponsors: number; eventsSponsored: number } }) {
  return (
    <div className={CARD_CLASS}>
      <h2 className="flex items-center gap-2 text-base font-bold text-slate-950 dark:text-white">
        <Handshake className="h-4 w-4 text-indigo-500" /> Sponsors
        <span className="ml-auto rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
          {roster.totalSponsors} sponsor{roster.totalSponsors === 1 ? '' : 's'} · {roster.eventsSponsored} event{roster.eventsSponsored === 1 ? '' : 's'}
        </span>
      </h2>
      <div className="mt-4 space-y-3">
        {roster.sponsors.map((s) => (
          <div key={s.name} className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
            {s.logo ? (
              <img src={resolveEventImageUrl(s.logo)} alt={s.name} className="h-8 w-auto max-w-[96px] object-contain" />
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                {s.name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                {s.website ? (
                  <a href={s.website} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600">{s.name}</a>
                ) : (
                  s.name
                )}
                {s.paidViaPlatform && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" title="Paid through GuildOS — verified and refund-protected">
                    <BadgeCheck className="h-3 w-3" /> Paid via GuildOS
                  </span>
                )}
              </p>
              <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                {s.events.map((e) => e.title).join(' · ')}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
