'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { eventLifecycle, eventDateLabel } from '../../../../components/guildos/events/event-lifecycle';
import { Award, CalendarDays, Radio, Users } from 'lucide-react';
import { resolveEventImageUrl, type EventSummary } from '../../../../components/guildos/event-api';

export function CommunityEventCard({ event }: { event: EventSummary }) {
  const start = event.startDate ? new Date(event.startDate) : null;
  const [now,setNow]=useState(()=>Date.now());
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(timer);},[]);
  const lifecycle=eventLifecycle(event,now);
  const isLive=lifecycle==='LIVE';
  const isCancelled=lifecycle==='CANCELLED';
  const isAnnounced=lifecycle==='ANNOUNCED';
  const isPostponed=lifecycle==='POSTPONED';
  const isPast=lifecycle==='ENDED';
  const banner = event.bannerImage ? resolveEventImageUrl(event.bannerImage) : '';
  const sponsors = event.sponsors ?? [];
  const speakers = event.speakers ?? [];

  return (
    <Link href={`/events/${event.slug}`} className="block overflow-hidden rounded-lg border border-slate-100 bg-slate-50/60 transition hover:border-slate-200 hover:bg-white dark:border-slate-800 dark:bg-slate-950/60 dark:hover:bg-slate-800 hover:shadow-sm">
      <div className={`flex gap-3 p-4 sm:flex-row sm:gap-4 ${banner ? "flex-col" : "flex-row items-center"}`}>
        {banner ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={banner} alt="" className="aspect-[2/1] w-full rounded-xl object-cover sm:h-20 sm:w-40 sm:shrink-0" />
        ) : (
          <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-indigo-50 text-center dark:bg-indigo-500/10">
            {start ? (
              <>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-rose-500">{start.toLocaleDateString('en-NG', { month: 'short' })}</span>
                <span className="text-xl font-bold leading-none text-slate-900 dark:text-slate-100">{start.getDate()}</span>
              </>
            ) : (
              <CalendarDays className="h-6 w-6 text-indigo-300" />
            )}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-semibold text-slate-900 dark:text-slate-100">{event.title}</p>
            {isLive ? (
              <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-600 ring-1 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30">Live now</span>
            ) : isCancelled ? (
              <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-600 ring-1 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30">Cancelled</span>
            ) : isPostponed ? (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30">Postponed</span>
            ) : isAnnounced ? (
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-600 ring-1 ring-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:ring-indigo-500/30">Coming soon</span>
            ) : isPast ? (
              <span className="rounded-full bg-slate-100 dark:bg-slate-950 px-2 py-0.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">Past</span>
            ) : (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 ring-1 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30">Upcoming</span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {eventDateLabel(event)}
            {' · '}
            {event.mode === 'VIRTUAL' ? 'Virtual' : event.venue || (event.mode === 'HYBRID' ? 'Hybrid' : 'In person')}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            {event.registrationCount > 0 && (
              <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {event.registrationCount} registered</span>
            )}
            {speakers.length > 0 && (
              <span className="inline-flex items-center gap-1"><Radio className="h-3.5 w-3.5" /> {speakers.length} speaker{speakers.length === 1 ? '' : 's'}</span>
            )}
            {event.certificateEnabled && (
              <span className="inline-flex items-center gap-1"><Award className="h-3.5 w-3.5" /> Certificate</span>
            )}
            {event.sponsorshipOpen && !isCancelled && !isPast && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30">Sponsorship open</span>
            )}
          </div>
        </div>
      </div>
      {sponsors.length > 0 && !isCancelled && (
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 px-4 py-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Sponsored by</span>
          {sponsors.map((sponsor) => (
            <span key={sponsor._id} className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 dark:bg-slate-900 px-2.5 py-1 ring-1 ring-slate-200 dark:ring-slate-800">
              {sponsor.logo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={resolveEventImageUrl(sponsor.logo)} alt="" className="h-4 w-4 rounded-full object-cover" />
              )}
              <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">{sponsor.name}</span>
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
