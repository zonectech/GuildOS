'use client';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Bookmark, GraduationCap, Plus, Search } from 'lucide-react';
import { listEvents, type EventSummary } from '@/lib/api';
import { LEARNING_TYPES, STATUS_FILTERS, bucketOf, isMySchool, recentlyEnded, sortEvents } from '@/lib/events';
import { useSession } from '@/lib/session';
import { EventCard } from '@/components/event-card';
import { Button, Pill } from '@/components/ui';

type Quick = 'All' | 'HACKATHON' | 'LEARNING' | 'CERTIFICATE';

function EventsView() {
  const params = useSearchParams();
  const { user } = useSession();
  const [events, setEvents] = useState<EventSummary[] | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState(params.get('q') ?? '');
  const [quick, setQuick] = useState<Quick>('All');
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>('Upcoming & Live');
  const [where, setWhere] = useState('All');
  const myUniversity = user?.profile?.university ?? '';

  useEffect(() => { listEvents().then((r) => setEvents(r.events)).catch((e: Error) => { setError(e.message); setEvents([]); }); }, []);

  const all = events ?? [];
  const states = useMemo(() => [...new Set(all.filter((e) => e.mode !== 'VIRTUAL' && e.state).map((e) => (e.state ?? '').trim()))].sort(), [all]);
  const hasOnline = all.some((e) => e.mode !== 'PHYSICAL');
  const filtered = sortEvents(all, myUniversity).filter((e) => {
    const bucket = bucketOf(e);
    if (status === 'Upcoming & Live' && bucket !== 'UPCOMING' && bucket !== 'LIVE') return false;
    if (status === 'Ended' && bucket !== 'ENDED') return false;
    if (status === 'Cancelled' && bucket !== 'CANCELLED') return false;
    if (quick === 'HACKATHON' && e.type !== 'HACKATHON') return false;
    if (quick === 'LEARNING' && !LEARNING_TYPES.includes(e.type)) return false;
    if (quick === 'CERTIFICATE' && (e.certificateOffer ?? 'NONE') === 'NONE') return false;
    if (where === 'ONLINE' && e.mode === 'PHYSICAL') return false;
    if (where !== 'All' && where !== 'ONLINE' && (e.state ?? '').trim() !== where) return false;
    const q = search.trim().toLowerCase();
    return !q || [e.title, e.shortDescription, e.venue, e.type, e.communityName, e.communityUniversity, e.state].some((v) => (v ?? '').toLowerCase().includes(q));
  });
  const filtering = Boolean(search.trim()) || quick !== 'All' || status !== 'Upcoming & Live' || where !== 'All';
  const mine = filtering ? [] : filtered.filter((e) => isMySchool(e, myUniversity));
  const rest = filtering ? filtered : filtered.filter((e) => !isMySchool(e, myUniversity));
  const recent = filtered.length || filtering ? [] : recentlyEnded(all);
  const toggle = (q: Quick) => setQuick((current) => (current === q ? 'All' : q));

  return (
    <div className="wrap page">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>Events</h1>
        <div className="row">
          <label className="search"><Search size={18} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search events" aria-label="Search events" /></label>
          {user ? <><Button kind="s" href="/events/saved"><Bookmark size={16} />Saved</Button><Button kind="s" href="/me">My events</Button><Button href="/events/new"><Plus size={16} />Create event</Button></> : null}
        </div>
      </div>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="row" role="group" aria-label="Kind of event">
          <Pill on={quick === 'All'} onClick={() => setQuick('All')}>All</Pill>
          {all.some((e) => e.type === 'HACKATHON') ? <Pill on={quick === 'HACKATHON'} onClick={() => toggle('HACKATHON')}>Hackathons</Pill> : null}
          {all.some((e) => LEARNING_TYPES.includes(e.type)) ? <Pill on={quick === 'LEARNING'} onClick={() => toggle('LEARNING')}>Workshops &amp; trainings</Pill> : null}
          <Pill on={quick === 'CERTIFICATE'} onClick={() => toggle('CERTIFICATE')}><GraduationCap size={14} />Certificate</Pill>
        </div>
        <div className="row">
          <select className="sel" aria-label="When" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            {STATUS_FILTERS.map((s) => <option key={s} value={s}>{s === 'All' ? 'Any status' : s}</option>)}
          </select>
          {states.length || hasOnline ? (
            <select className="sel" aria-label="Where" value={where} onChange={(e) => setWhere(e.target.value)}>
              <option value="All">Everywhere</option>
              {hasOnline ? <option value="ONLINE">Online</option> : null}
              {states.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          ) : null}
        </div>
      </div>
      {error ? <p className="error">{error}</p> : null}
      {events === null ? <p className="empty">Loading events…</p> : null}
      {mine.length ? <><p className="sect">At your school</p><div className="grid">{mine.map((e) => <EventCard key={e._id} event={e} />)}</div></> : null}
      {rest.length ? <>{mine.length ? <p className="sect">Everywhere else</p> : null}<div className="grid">{rest.map((e) => <EventCard key={e._id} event={e} />)}</div></> : null}
      {events !== null && !filtered.length && !filtering && recent.length ? <>
        <p className="empty">Nothing is coming up right now.</p>
        <p className="sect">Recently ended</p><div className="grid">{recent.map((e) => <EventCard key={e._id} event={e} />)}</div>
      </> : events !== null && !filtered.length ? <p className="empty">No events match. Try another filter.</p> : null}
    </div>
  );
}

export default function EventsPage() {
  return <Suspense fallback={<div className="wrap page"><p className="empty">Loading events…</p></div>}><EventsView /></Suspense>;
}
