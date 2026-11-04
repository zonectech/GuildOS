'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { EventSummary } from '@/lib/api';
import { savedEvents } from '@/lib/account';
import { sortEvents } from '@/lib/events';
import { useSession } from '@/lib/session';
import { EventCard } from '@/components/event-card';

export default function SavedEventsPage() {
  const router = useRouter();
  const { user, loading } = useSession();
  const [events, setEvents] = useState<EventSummary[] | null>(null);
  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace('/login?next=/events/saved'); return; }
    savedEvents().then((r) => setEvents(r.events)).catch(() => setEvents([]));
  }, [loading, user, router]);
  return (
    <div className="wrap page">
      <Link href="/events" className="small">‹ All events</Link>
      <h1>Saved events</h1>
      {events === null ? <p className="empty">Loading…</p> : events.length ? <div className="grid">{sortEvents(events, '').map((e) => <EventCard key={e._id} event={e} />)}</div> : <p className="empty">Nothing saved yet. Tap Save on any event to keep it here.</p>}
    </div>
  );
}
