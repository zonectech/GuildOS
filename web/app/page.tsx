'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { listEvents, type EventSummary } from '@/lib/api';
import { bucketOf, recentlyEnded, sortEvents } from '@/lib/events';
import { useSession } from '@/lib/session';
import { EventCard } from '@/components/event-card';

/** Home for visitors. Signed-in people go straight to Events. */
export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useSession();
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => { if (!loading && user) router.replace('/events'); }, [loading, user, router]);
  useEffect(() => { listEvents().then((r) => setEvents(r.events)).catch(() => setEvents([])); }, []);

  const coming = sortEvents(events, '').filter((e) => ['LIVE', 'UPCOMING'].includes(bucketOf(e))).slice(0, 6);
  // A quiet week should still show what the communities have been running.
  const recent = coming.length ? [] : recentlyEnded(events);
  const find = (e: React.FormEvent) => { e.preventDefault(); router.push(query.trim() ? `/events?q=${encodeURIComponent(query.trim())}` : '/events'); };

  return (
    <div className="wrap">
      <section className="hero">
        <h1>See what is happening at your school.</h1>
        <p className="lead">Every event and community that matters to you, in one place. When a certificate is offered, you get it the moment you check out.</p>
        <form className="row" onSubmit={find}>
          <label className="search" style={{ flex: 1 }}><Search size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search events" aria-label="Search events" /></label>
          <button type="submit" className="btn p">Find events</button>
        </form>
        <p className="small">Run a student community? <Link className="lk" href="/communities/new">Create one</Link>. Get verified once, then run events with no more approval.</p>
      </section>
      <section className="page">
        {coming.length ? <><p className="sect">Coming up</p><div className="grid">{coming.map((e) => <EventCard key={e._id} event={e} />)}</div></> : null}
        {recent.length ? <><p className="sect">Recently ended</p><p className="small">Nothing is coming up right now. Here is what communities ran lately.</p><div className="grid">{recent.map((e) => <EventCard key={e._id} event={e} />)}</div></> : null}
        {!coming.length && !recent.length ? <p className="empty">No events yet.</p> : null}
      </section>
    </div>
  );
}
