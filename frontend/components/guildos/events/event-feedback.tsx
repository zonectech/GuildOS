'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import { getEvent, submitEventFeedback, type EventFeedbackSummary } from '../event-api';

/** One star-rating form (whole event or a single day). Re-submitting updates. */
function RatingForm({
  eventId,
  slug,
  day,
  heading,
  hint,
  initial,
  onSummary,
  onError,
}: {
  eventId: string;
  slug: string;
  /** 0 = whole event; 1..N = that day of a multi-day event. */
  day: number;
  heading: string;
  hint: string;
  initial: { rating: number; comment: string } | null;
  onSummary: (summary: { average: number; count: number }) => void;
  onError: (message: string) => void;
}) {
  const [myRating, setMyRating] = useState(initial?.rating ?? 0);
  const [myComment, setMyComment] = useState(initial?.comment ?? '');
  const [ratingSaved, setRatingSaved] = useState(Boolean(initial));
  const [ratingBusy, setRatingBusy] = useState(false);

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <h3 className="font-semibold text-slate-950 dark:text-white">{ratingSaved ? `${heading} — your rating` : heading}</h3>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{hint}</p>
      <div className="mt-2 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button key={star} onClick={() => { setMyRating(star); setRatingSaved(false); }} aria-label={`${star} star${star > 1 ? 's' : ''}`} className="transition">
            <Star className={`h-7 w-7 ${star <= myRating ? 'fill-amber-400 text-amber-400' : 'text-slate-200 hover:text-amber-200'}`} />
          </button>
        ))}
      </div>
      <textarea
        className="mt-2 min-h-16 w-full rounded-2xl border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 text-sm"
        placeholder="Anything the organizers should know? (optional)"
        value={myComment}
        onChange={(e) => { setMyComment(e.target.value.slice(0, 500)); setRatingSaved(false); }}
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          disabled={ratingBusy || myRating < 1 || ratingSaved}
          onClick={() => {
            void (async () => {
              try {
                setRatingBusy(true);
                await submitEventFeedback(eventId, { rating: myRating, comment: myComment, day: day || undefined });
                setRatingSaved(true);
                const detail = await getEvent(slug);
                onSummary(detail.feedback ?? { average: 0, count: 0 });
              } catch (err) {
                onError(err instanceof Error ? err.message : 'Unable to submit feedback');
              } finally {
                setRatingBusy(false);
              }
            })();
          }}
          className="rounded-2xl bg-slate-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {ratingBusy ? 'Saving…' : ratingSaved ? 'Saved ✓' : 'Submit rating'}
        </button>
        {ratingSaved ? <span className="text-xs text-emerald-600">Thanks for the feedback!</span> : null}
      </div>
    </div>
  );
}

/**
 * Attendee rating widget. Single-day events: one rating once the event is over.
 * Multi-day events: a rating block appears automatically for EVERY day the
 * attendee checked in on, as soon as that day ends — so organizers can fix
 * issues before the next morning.
 */
export function RateEventCard({
  eventId,
  slug,
  initial,
  ratableDays = [],
  dayFeedback = [],
  dayThemes = {},
  onSummary,
  onError,
}: {
  eventId: string;
  slug: string;
  initial: { rating: number; comment: string } | null;
  /** Multi-day: 1-based days the viewer can rate now ([] for single-day events). */
  ratableDays?: number[];
  /** Multi-day: ratings the viewer already gave. */
  dayFeedback?: { day: number; rating: number; comment: string }[];
  /** Optional day themes for nicer headings ({2: 'Hackathon day'}). */
  dayThemes?: Record<number, string>;
  onSummary: (summary: { average: number; count: number }) => void;
  onError: (message: string) => void;
}) {
  const multiDay = ratableDays.length > 0 || dayFeedback.length > 0;
  const givenByDay = new Map(dayFeedback.map((f) => [f.day, f]));
  const days = [...new Set([...ratableDays, ...dayFeedback.map((f) => f.day)])].sort((a, b) => a - b);
  const pending = ratableDays.filter((d) => !givenByDay.has(d)).length;

  return (
    <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
        {multiDay ? 'Rate each day' : initial ? 'Your rating' : 'How was the event?'}
        {multiDay && pending > 0 ? <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">{pending} day{pending === 1 ? '' : 's'} waiting</span> : null}
      </h2>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        {multiDay
          ? 'Your day-by-day feedback reaches the organizers immediately — it helps them improve the very next day.'
          : 'Your feedback helps the organizers improve — and future attendees decide.'}
      </p>
      <div className="mt-4 space-y-3">
        {multiDay ? (
          days.map((day) => (
            <RatingForm
              key={day}
              eventId={eventId}
              slug={slug}
              day={day}
              heading={`Day ${day}${dayThemes[day] ? ` — ${dayThemes[day]}` : ''}`}
              hint={givenByDay.has(day) ? 'You can update your rating any time.' : 'This day has ended — how did it go?'}
              initial={givenByDay.get(day) ?? null}
              onSummary={onSummary}
              onError={onError}
            />
          ))
        ) : (
          <RatingForm
            eventId={eventId}
            slug={slug}
            day={0}
            heading="Overall"
            hint="Rate the event from 1 to 5 stars."
            initial={initial}
            onSummary={onSummary}
            onError={onError}
          />
        )}
      </div>
    </section>
  );
}

/** Organizer-only feedback summary: average, 1–5 star distribution bars, and named comments. */
export function ManagerFeedbackCard({ feedback }: { feedback: EventFeedbackSummary }) {
  return (
    <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Attendee feedback <span className="text-sm font-normal text-slate-400 dark:text-slate-500">(organizers only)</span></h2>
      <div className="mt-3 flex items-center gap-4">
        <p className="text-3xl font-bold text-slate-950 dark:text-white">{feedback.average}<span className="text-base font-normal text-slate-400 dark:text-slate-500">/5</span></p>
        <div className="flex-1 space-y-1">
          {[5, 4, 3, 2, 1].map((star) => {
            const n = feedback.distribution[star - 1] ?? 0;
            const pct = feedback.count ? Math.round((n / feedback.count) * 100) : 0;
            return (
              <div key={star} className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="inline-flex w-8 items-center gap-0.5">{star}<Star className="h-3 w-3 fill-amber-400 text-amber-400" /></span>
                <div className="h-1.5 flex-1 rounded-full bg-slate-100 dark:bg-slate-950"><div className="h-1.5 rounded-full bg-amber-400" style={{ width: `${pct}%` }} /></div>
                <span className="w-6 text-right">{n}</span>
              </div>
            );
          })}
        </div>
      </div>
      {feedback.byDay?.length ? (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 dark:border-slate-800 pt-4">
          {feedback.byDay.map((d) => (
            <span key={d.day} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${d.average >= 4 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : d.average >= 3 ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' : 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'}`}>
              Day {d.day} · {d.average.toFixed(1)}<Star className="h-3 w-3 fill-current" /> ({d.count})
            </span>
          ))}
        </div>
      ) : null}
      {feedback.comments.length ? (
        <div className="mt-4 space-y-2 border-t border-slate-100 dark:border-slate-800 pt-4">
          {feedback.comments.slice(0, 10).map((c, i) => (
            <div key={i} className="rounded-2xl bg-slate-50 dark:bg-slate-900 px-4 py-2.5">
              <p className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
                {Array.from({ length: c.rating }, (_, s) => <Star key={s} className="h-3 w-3 fill-amber-400 text-amber-400" />)}
                <span className="ml-1 text-slate-400 dark:text-slate-500">· {c.name}{c.day ? ` · Day ${c.day}` : ''}</span>
              </p>
              <p className="mt-0.5 text-sm text-slate-700 dark:text-slate-300">{c.comment}</p>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
