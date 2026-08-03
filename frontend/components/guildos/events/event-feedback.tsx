'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import { getEvent, submitEventFeedback, type EventFeedbackSummary } from '../event-api';

/**
 * Attendee star-rating widget (checked-in attendees, once the event is over).
 * Owns its own form state; re-submitting updates the earlier rating.
 */
export function RateEventCard({
  eventId,
  slug,
  initial,
  onSummary,
  onError,
}: {
  eventId: string;
  slug: string;
  initial: { rating: number; comment: string } | null;
  onSummary: (summary: { average: number; count: number }) => void;
  onError: (message: string) => void;
}) {
  const [myRating, setMyRating] = useState(initial?.rating ?? 0);
  const [myComment, setMyComment] = useState(initial?.comment ?? '');
  const [ratingSaved, setRatingSaved] = useState(Boolean(initial));
  const [ratingBusy, setRatingBusy] = useState(false);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">{ratingSaved ? 'Your rating' : 'How was the event?'}</h2>
      <p className="mt-1 text-xs text-slate-500">Your feedback helps the organizers improve — and future attendees decide.</p>
      <div className="mt-3 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button key={star} onClick={() => { setMyRating(star); setRatingSaved(false); }} aria-label={`${star} star${star > 1 ? 's' : ''}`} className="transition">
            <Star className={`h-8 w-8 ${star <= myRating ? 'fill-amber-400 text-amber-400' : 'text-slate-200 hover:text-amber-200'}`} />
          </button>
        ))}
      </div>
      <textarea
        className="mt-3 min-h-20 w-full rounded-2xl border border-slate-200 px-3.5 py-2.5 text-sm"
        placeholder="Anything the organizers should know? (optional)"
        value={myComment}
        onChange={(e) => { setMyComment(e.target.value.slice(0, 500)); setRatingSaved(false); }}
      />
      <div className="mt-3 flex items-center gap-3">
        <button
          disabled={ratingBusy || myRating < 1 || ratingSaved}
          onClick={() => {
            void (async () => {
              try {
                setRatingBusy(true);
                await submitEventFeedback(eventId, { rating: myRating, comment: myComment });
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
    </section>
  );
}

/** Organizer-only feedback summary: average, 1–5 star distribution bars, and named comments. */
export function ManagerFeedbackCard({ feedback }: { feedback: EventFeedbackSummary }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">Attendee feedback <span className="text-sm font-normal text-slate-400">(organizers only)</span></h2>
      <div className="mt-3 flex items-center gap-4">
        <p className="text-3xl font-bold text-slate-950">{feedback.average}<span className="text-base font-normal text-slate-400">/5</span></p>
        <div className="flex-1 space-y-1">
          {[5, 4, 3, 2, 1].map((star) => {
            const n = feedback.distribution[star - 1] ?? 0;
            const pct = feedback.count ? Math.round((n / feedback.count) * 100) : 0;
            return (
              <div key={star} className="flex items-center gap-2 text-xs text-slate-500">
                <span className="inline-flex w-8 items-center gap-0.5">{star}<Star className="h-3 w-3 fill-amber-400 text-amber-400" /></span>
                <div className="h-1.5 flex-1 rounded-full bg-slate-100"><div className="h-1.5 rounded-full bg-amber-400" style={{ width: `${pct}%` }} /></div>
                <span className="w-6 text-right">{n}</span>
              </div>
            );
          })}
        </div>
      </div>
      {feedback.comments.length ? (
        <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
          {feedback.comments.slice(0, 10).map((c, i) => (
            <div key={i} className="rounded-2xl bg-slate-50 px-4 py-2.5">
              <p className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
                {Array.from({ length: c.rating }, (_, s) => <Star key={s} className="h-3 w-3 fill-amber-400 text-amber-400" />)}
                <span className="ml-1 text-slate-400">· {c.name}</span>
              </p>
              <p className="mt-0.5 text-sm text-slate-700">{c.comment}</p>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
