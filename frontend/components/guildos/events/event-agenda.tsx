'use client';

import { CalendarDays, Check, Clock, MapPin, Mic, Sparkles } from 'lucide-react';
import { resolveEventImageUrl, type EventSpeaker, type EventSummary } from '../event-api';

/** "HH:mm" → locale time, e.g. "09:00" → "9:00 AM". */
export function formatTime(hhmm: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!match) return hhmm;
  const d = new Date();
  d.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return d.toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' });
}

/** Day-by-day agenda: per-day theme/venue/times/facilitators/sessions/features + day-assigned speakers; cancelled days shown struck-through with the reason. */
export function EventAgenda({ event, daySpeakers }: { event: EventSummary; daySpeakers: Record<number, EventSpeaker[]> }) {
  return (
    <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Day-by-day agenda</h2>
      {event.theme ? (
        <p className="mt-1 flex items-center gap-1.5 text-sm italic text-slate-500 dark:text-slate-400">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-500" /> Grand theme: {event.theme}
        </p>
      ) : null}
      <ol className="mt-4 space-y-4">
        {(event.days ?? []).map((day, i) => (
          <li key={i} className={`rounded-2xl border p-4 ${day.cancelled ? 'border-rose-200 bg-rose-50/60' : 'border-slate-200 dark:border-slate-800 bg-slate-50/60'}`}>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${day.cancelled ? 'bg-rose-100 text-rose-700 line-through' : 'bg-indigo-100 text-indigo-700'}`}>Day {i + 1}</span>
              {day.cancelled ? <span className="rounded-full bg-rose-600 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-white">Cancelled</span> : null}
              {day.date ? (
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-200">
                  <CalendarDays className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
                  {new Date(day.date).toLocaleDateString('en-NG', { weekday: 'short', month: 'short', day: 'numeric' })}
                </span>
              ) : null}
              {day.theme ? <span className="text-sm font-medium italic text-slate-600 dark:text-slate-400">{day.theme}</span> : null}
            </div>
            {day.cancelled && day.cancellationNote ? (
              <p className="mt-1.5 text-sm text-rose-700">{day.cancellationNote}</p>
            ) : null}
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
              {day.startTime ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">
                  <Clock className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
                  {formatTime(day.startTime)}{day.endTime ? ` – ${formatTime(day.endTime)}` : ''}
                </span>
              ) : null}
              {day.venue ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500" /> {day.venue}
                </span>
              ) : null}
            </div>
            {(day.facilitators ?? []).length ? (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {(day.facilitators ?? []).map((person, j) => (
                  <span key={j} className="inline-flex items-center gap-1.5 rounded-full border border-indigo-100 bg-indigo-50/70 px-2.5 py-1 text-xs text-indigo-800">
                    <Mic className="h-3 w-3 shrink-0 text-indigo-500" />
                    <span className="font-semibold">{person.name}</span>
                    {person.title ? <span className="text-indigo-500">· {person.title}</span> : null}
                  </span>
                ))}
              </div>
            ) : null}
            {(day.sessions ?? []).length ? (
              <ul className="mt-2.5 space-y-1.5">
                {(day.sessions ?? []).map((session, j) => (
                  <li key={j} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm">
                    {session.time ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold tabular-nums text-indigo-600">
                        <Clock className="h-3 w-3 shrink-0" /> {formatTime(session.time)}
                      </span>
                    ) : null}
                    <span className="font-medium text-slate-800 dark:text-slate-200">{session.title}</span>
                    {session.venue ? (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                        <MapPin className="h-3 w-3 shrink-0" /> {session.venue}
                      </span>
                    ) : null}
                    {session.facilitator ? (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                        <Mic className="h-3 w-3 shrink-0" /> {session.facilitator}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
            {day.features.length ? (
              <ul className="mt-2.5 space-y-1.5">
                {day.features.map((feature, j) => (
                  <li key={j} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-50">
                      <Check className="h-2.5 w-2.5 text-emerald-600" strokeWidth={3} />
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>
            ) : null}
            {(daySpeakers[i + 1] ?? []).length ? (
              <div className="mt-3 border-t border-slate-200/70 pt-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Speaking on Day {i + 1}</p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {(daySpeakers[i + 1] ?? []).map((s) => (
                    <span key={s._id} className="inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-1 pl-1 pr-3 text-xs text-slate-700 dark:text-slate-300">
                      {s.photo ? <img src={resolveEventImageUrl(s.photo)} alt={s.fullName} className="h-6 w-6 rounded-full object-cover" /> : <span className="grid h-6 w-6 place-items-center rounded-full bg-slate-100 dark:bg-slate-950"><Mic className="h-3 w-3 text-slate-400 dark:text-slate-500" /></span>}
                      <span className="font-medium">{s.fullName}</span>
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
