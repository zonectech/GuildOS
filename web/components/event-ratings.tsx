'use client';
import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { getEventRatings, type EventRatings as Ratings } from '@/lib/api';

/** What attendees said, for the people running the event. Shown once the event is over. */
export function EventRatings({ eventId }: { eventId: string }) {
  const [data, setData] = useState<Ratings | null>(null);
  const [all, setAll] = useState(false);
  useEffect(() => { getEventRatings(eventId).then((r) => setData(r.feedback)).catch(() => setData(null)); }, [eventId]);

  if (!data) return null;
  if (!data.count) return <p className="small dim">No ratings yet. Attendees are asked how it went in their thank-you email and on this page.</p>;
  const comments = all ? data.comments : data.comments.slice(0, 3);
  return (
    <div className="stack ratings" style={{ gap: 8 }}>
      <span className="row" style={{ gap: 6 }}><Star size={16} className="gold" /><b>{data.average.toFixed(1)}</b><span className="small">from {data.count} rating{data.count === 1 ? '' : 's'}</span></span>
      {comments.map((c, i) => (
        <div key={i} className="stack" style={{ gap: 2 }}>
          <span className="small"><b>{'★'.repeat(c.rating)}</b> {c.name}</span>
          <span className="small">“{c.comment}”</span>
        </div>
      ))}
      {data.comments.length > 3 ? <button type="button" className="linkb" onClick={() => setAll(!all)}>{all ? 'Show fewer' : `Show all ${data.comments.length} comments`}</button> : null}
    </div>
  );
}
