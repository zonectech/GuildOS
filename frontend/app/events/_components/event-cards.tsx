'use client';

import Link from 'next/link';
import { CalendarDays, GraduationCap, Layers, MapPin, Users, Video } from 'lucide-react';

import { resolveEventImageUrl, type EventSummary } from '../../../components/guildos/event-api';
import { MODE_LABEL, bucketOf, dateBadge, entryPriceOf, placeLabel, priceLabel, typeLabel, whenLabel } from './event-discovery';

type CardProps = { event: EventSummary; userId: string; myUniversity: string };

const isMyUniversity = (event: EventSummary, myUniversity: string) =>
  Boolean(myUniversity) && (event.communityUniversity ?? '').trim().toLowerCase() === myUniversity.toLowerCase();

/** Lifecycle chip (Live / Cancelled / Ended / Postponed / Coming soon), or null for a plain upcoming event. */
function StatusChip({ event, className = '' }: { event: EventSummary; className?: string }) {
  const bucket = bucketOf(event);
  const chip =
    bucket === 'LIVE' ? ['● Live now', 'bg-emerald-500 text-white']
      : bucket === 'CANCELLED' ? ['Cancelled', 'bg-rose-600 text-white']
        : bucket === 'ENDED' ? ['Ended', 'bg-slate-900/70 text-white backdrop-blur']
          : event.status === 'POSTPONED' ? ['Postponed', 'bg-amber-500 text-white']
            : event.status === 'ANNOUNCED' ? ['Coming soon', 'bg-indigo-500 text-white']
              : null;
  if (!chip) return null;
  return <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${chip[1]} ${className}`}>{chip[0]}</span>;
}

function PriceChip({ event, className = '' }: { event: EventSummary; className?: string }) {
  const free = entryPriceOf(event) === 0;
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${free ? 'bg-emerald-500 text-white' : 'bg-white/95 text-slate-900 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700'} ${className}`}>
      {priceLabel(event)}
    </span>
  );
}

/** The roomy grid card — banner, date badge, price and the full details list. */
export function EventGridCard({ event, userId, myUniversity }: CardProps) {
  const badge = dateBadge(event.startDate);
  const spotsLeft = event.capacity > 0 ? Math.max(0, event.capacity - event.registrationCount) : null;
  const dayCount = (event.days ?? []).length;
  const trackCount = (event.sections ?? []).length;
  const myUni = isMyUniversity(event, myUniversity);

  return (
    <Link
      href={`/events/${event.slug}`}
      className="group flex flex-col overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
    >
      <div className="relative aspect-[2/1] bg-gradient-to-br from-indigo-600 to-sky-500">
        {event.bannerImage ? <img src={resolveEventImageUrl(event.bannerImage)} alt={event.title} className="h-full w-full object-cover" /> : null}
        {badge ? (
          <div className="absolute left-3 top-3 grid place-items-center rounded-xl bg-white/95 px-2.5 py-1 text-center shadow-sm backdrop-blur dark:bg-slate-900/90">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-rose-500">{badge.month}</span>
            <span className="text-lg font-bold leading-none text-slate-900 dark:text-slate-100">{badge.day}</span>
          </div>
        ) : null}
        <span className="absolute right-3 top-3 rounded-full bg-black/40 px-2.5 py-0.5 text-[11px] font-medium text-white backdrop-blur">{MODE_LABEL[event.mode] ?? event.mode}</span>
        {/* Price at a glance — free events wear it proudly, paid ones show the entry price. */}
        <PriceChip event={event} className="absolute bottom-3 right-3 backdrop-blur" />
        <StatusChip event={event} className="absolute bottom-3 left-3" />
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">{typeLabel(event.type)}</p>
          {userId && event.createdBy === userId ? (
            /* Your own event reads "Organized by you" — you're the host, not an attendee. */
            <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:ring-indigo-500/30">Organized by you</span>
          ) : null}
        </div>
        <h3 className="mt-1 line-clamp-1 font-semibold text-slate-950 dark:text-white">{event.title}</h3>
        <p className="mt-1 line-clamp-2 flex-1 text-sm text-slate-500 dark:text-slate-400">{event.shortDescription}</p>
        <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <p className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{whenLabel(event.startDate)}</span></p>
          <p className="flex items-center gap-1.5">
            {event.mode === 'VIRTUAL' ? <Video className="h-3.5 w-3.5 shrink-0" /> : <MapPin className="h-3.5 w-3.5 shrink-0" />}
            <span className="truncate">{placeLabel(event)}</span>
          </p>
          {event.communityUniversity ? (
            <p className={`flex items-center gap-1.5 ${myUni ? 'font-medium text-indigo-600 dark:text-indigo-400' : ''}`}>
              <GraduationCap className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{event.communityUniversity}{myUni ? ' · Your university' : ''}</span>
            </p>
          ) : null}
          <p className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5 shrink-0" /> {event.registrationCount} registered{spotsLeft !== null ? ` · ${spotsLeft === 0 ? 'Full' : `${spotsLeft} spots left`}` : ''}</p>
          {dayCount > 1 || trackCount > 0 ? (
            <p className="flex items-center gap-1.5 font-medium text-indigo-600 dark:text-indigo-400">
              <Layers className="h-3.5 w-3.5 shrink-0" />
              {[dayCount > 1 ? `${dayCount} days` : '', trackCount > 0 ? `${trackCount} track${trackCount === 1 ? '' : 's'} — pick yours` : ''].filter(Boolean).join(' · ')}
            </p>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

/** Compact list row (Cerebral Valley-style): scan ten events without scrolling. */
export function EventListRow({ event, myUniversity }: CardProps) {
  const badge = dateBadge(event.startDate);
  const myUni = isMyUniversity(event, myUniversity);

  return (
    <Link
      href={`/events/${event.slug}`}
      className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 transition hover:border-indigo-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="grid w-12 shrink-0 place-items-center rounded-xl bg-slate-50 py-1.5 text-center dark:bg-slate-950">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-rose-500">{badge?.month ?? 'TBA'}</span>
        <span className="text-lg font-bold leading-none text-slate-900 dark:text-slate-100">{badge?.day ?? '–'}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate font-semibold text-slate-950 group-hover:text-indigo-700 dark:text-white dark:group-hover:text-indigo-300">{event.title}</h3>
          <StatusChip event={event} />
        </div>
        <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
          {typeLabel(event.type)} · {whenLabel(event.startDate)} · {placeLabel(event)}
          {event.communityUniversity ? <span className={myUni ? 'font-medium text-indigo-600 dark:text-indigo-400' : ''}> · {event.communityUniversity}</span> : null}
        </p>
      </div>
      <div className="hidden shrink-0 items-center gap-2 sm:flex">
        <span className="text-xs text-slate-500 dark:text-slate-400">{event.registrationCount} going</span>
        <PriceChip event={event} />
      </div>
    </Link>
  );
}

/** Big showcase card for the Featured row. */
export function FeaturedEventCard({ event }: { event: EventSummary }) {
  return (
    <Link
      href={`/events/${event.slug}`}
      className="group relative block aspect-[16/9] w-[85%] shrink-0 snap-start overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 to-sky-500 shadow-sm sm:w-auto"
    >
      {event.bannerImage ? (
        <img src={resolveEventImageUrl(event.bannerImage)} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" aria-hidden />
      <div className="absolute left-3 top-3 flex gap-2">
        <StatusChip event={event} />
        <PriceChip event={event} />
      </div>
      <div className="absolute inset-x-0 bottom-0 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-white/80">{typeLabel(event.type)}</p>
        <h3 className="mt-0.5 line-clamp-2 text-lg font-bold leading-tight text-white">{event.title}</h3>
        <p className="mt-1 truncate text-xs text-white/80">{whenLabel(event.startDate)} · {placeLabel(event)}</p>
      </div>
    </Link>
  );
}
