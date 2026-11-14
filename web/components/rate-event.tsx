'use client';
import { useState } from 'react';
import { Star } from 'lucide-react';
import { rateEvent } from '@/lib/api';

const WORDS = ['', 'Poor', 'Not great', 'Okay', 'Good', 'Great'];

/**
 * "How was it?" under the attended seal. One tap on a star saves the rating;
 * a comment is optional afterwards. The organizer sees both.
 */
export function RateEvent({ eventId, initial }: { eventId: string; initial?: { rating: number; comment: string } | null }) {
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState(initial?.comment ?? '');
  const [savedComment, setSavedComment] = useState(initial?.comment ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [justRated, setJustRated] = useState(false);

  async function save(next: number, text = savedComment) {
    setBusy(true); setError('');
    try {
      const r = await rateEvent(eventId, next, text);
      setRating(r.feedback.rating); setSavedComment(r.feedback.comment); setComment(r.feedback.comment);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save your rating'); }
    finally { setBusy(false); }
  }

  const shown = hover || rating;
  return (
    <div className="rate">
      <b>{rating ? 'Your rating' : 'How was it?'}</b>
      <div className="stars" role="radiogroup" aria-label="Rate this event" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n === 1 ? '' : 's'}, ${WORDS[n]}`}
            className={n <= shown ? 'on' : ''} disabled={busy} onMouseEnter={() => setHover(n)}
            onClick={() => { setJustRated(true); void save(n); }}>
            <Star size={28} />
          </button>
        ))}
      </div>
      <span className="small">{shown ? WORDS[shown] : 'One tap. It goes to the organizer.'}</span>
      {rating ? (
        <div className="stack" style={{ gap: 8, width: '100%' }}>
          {justRated && !savedComment ? <span className="small">Thanks! Anything the organizer should know?</span> : null}
          <textarea className="input area" style={{ minHeight: 72 }} rows={2} maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="What went well, what to fix next time (optional)" />
          {comment.trim() !== savedComment ? <button type="button" className="btn s sm" disabled={busy} onClick={() => void save(rating, comment.trim())}>{busy ? 'Saving…' : 'Send comment'}</button>
            : savedComment ? <span className="small">Comment sent. You can change it any time.</span> : null}
        </div>
      ) : null}
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
