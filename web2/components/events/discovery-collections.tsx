'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Globe2, GraduationCap, LayoutGrid, Sprout } from 'lucide-react';
import type { Event } from '@/lib/api/types';
import { listCommunities, suggestedCommunities, type CommunityCard } from '@/lib/api/communities';
import { schoolKey, type DiscoveryCollection } from '@/lib/discovery-collections';
import { CommunityLogo } from '@/components/communities/bits';
import { Btn } from '@/components/ui/bits';
import { rememberList } from '@/lib/back';

export function DiscoveryCollections({ collections, value, onChange, school, signedIn }: {
  collections: Record<DiscoveryCollection, Event[]>; value: DiscoveryCollection;
  onChange: (value: DiscoveryCollection) => void; school: string; signedIn: boolean;
}) {
  const picks = [
    { id: 'all' as const, title: 'All events', description: 'Explore the full event list', Icon: LayoutGrid },
    { id: 'school' as const, title: 'From your school', description: school ? 'Live or starting in the next 7 days' : 'Add your school to see local picks', Icon: GraduationCap },
    { id: 'beginners' as const, title: 'For beginners', description: 'Based on organizer descriptions', Icon: Sprout },
    { id: 'online' as const, title: 'Join online', description: 'Virtual events and hybrid options', Icon: Globe2 },
  ];
  return <section aria-labelledby="collections-title" className="flex flex-col gap-3">
    <div><h2 id="collections-title" className="text-[20px] font-extrabold">Find a good place to start</h2><p className="mt-1 text-[13px] text-muted">A few ways to explore. Search and filters still work within your selection.</p></div>
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">{picks.map(({ id, title, description, Icon }) => {
      const count = collections[id].length;
      const cls = `flex min-w-0 flex-col gap-2 rounded-[20px] border p-3.5 text-left transition-colors sm:p-4 ${value === id ? 'border-green-text bg-tint' : 'border-line bg-surface hover:bg-mist'}`;
      const body = <><div className="flex w-full items-center justify-between gap-2"><Icon size={19} className="text-green-text" />{id === 'school' && !school ? <ArrowRight size={16} className="text-muted" /> : <span className="rounded-full bg-mist px-2 py-0.5 text-[12px] font-bold tabular-nums">{count}</span>}</div><b className="text-[14px] leading-snug">{title}</b><span className="text-[12px] leading-snug text-muted">{description}</span></>;
      return id === 'school' && !school ? <Link key={id} href={signedIn ? '/me/edit' : '/signup'} className={cls}>{body}</Link>
        : <button key={id} type="button" aria-pressed={value === id} aria-label={`${title}, ${count} events`} onClick={() => onChange(id)} className={cls}>{body}</button>;
    })}</div>
  </section>;
}

type Suggestion = CommunityCard & { reason?: string };
export function DiscoveryCommunities({ userId, school }: { userId?: string; school: string }) {
  const [rows, setRows] = useState<Suggestion[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const load = useCallback(() => {
    let active = true;
    setFailed(false); setRows(null);
    const request = userId ? suggestedCommunities() : listCommunities();
    request.then((communities) => {
      if (!active) return;
      const publicCommunities = communities.filter((c) => c.verified && c.visibility === 'PUBLIC');
      if (!userId) publicCommunities.sort((a, b) => Number(Boolean(school) && schoolKey(b.school) === schoolKey(school)) - Number(Boolean(school) && schoolKey(a.school) === schoolKey(school)) || b.eventCount - a.eventCount || a.name.localeCompare(b.name));
      setRows(publicCommunities.slice(0, 3));
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [userId, school]);
  useEffect(() => load(), [load, attempt]);
  return <section aria-labelledby="explore-communities" className="flex flex-col gap-3 border-t border-line pt-6">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 id="explore-communities" className="text-[22px] font-extrabold">Communities to explore</h2><Link href="/communities" className="inline-flex items-center gap-1 text-[13px] font-bold text-green-text hover:underline">See all communities<ArrowRight size={14} /></Link></div>
    <p className="text-[13px] text-muted">Find a community you can come back to beyond one event.</p>
    {failed ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line p-4"><p className="text-[14px] text-muted">We couldn’t load community suggestions.</p><Btn size="sm" kind="secondary" onClick={() => setAttempt((n) => n + 1)}>Try again</Btn></div>
      : rows === null ? <div aria-label="Loading communities" aria-busy="true" className="grid gap-3 sm:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="shimmer h-40 rounded-[20px]" />)}</div>
      : rows.length ? <div className="grid gap-3 sm:grid-cols-3">{rows.map((c) => <Link key={c.id} href={`/communities/${c.slug}`} onClick={rememberList} className="flex min-w-0 flex-col gap-3 rounded-[20px] border border-line bg-surface p-4 shadow-card transition-colors hover:bg-mist"><div className="flex min-w-0 items-center gap-3"><CommunityLogo c={c} size={38} /><div className="min-w-0"><b className="block truncate text-[15px]">{c.name}</b><span className="text-[12px] font-semibold text-green-text">Verified community</span></div></div><p className="line-clamp-2 text-[13px] text-muted">{c.summary || c.description || 'Meet people, join events and learn together.'}</p>{c.reason ? <p className="text-[12px] font-semibold text-green-text">{c.reason}</p> : c.school ? <p className="truncate text-[12px] text-muted">{c.school}</p> : null}<span className="inline-flex items-center gap-1 text-[13px] font-bold text-green-text">Explore community<ArrowRight size={14} /></span></Link>)}</div>
        : <div className="rounded-2xl border border-dashed border-line p-4 text-[14px] text-muted">No suggestions right now. <Link href="/communities" className="font-semibold text-green-text hover:underline">Browse communities</Link></div>}
  </section>;
}
