'use client';
import { useEffect, useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { listCommunities, type Community } from '@/lib/api';
import { useSession } from '@/lib/session';
import { CommunityRow } from '@/components/community-row';
import { Button, Pill } from '@/components/ui';

const catKey = (category?: string) => (category ?? '').trim().toLowerCase();

export default function CommunitiesPage() {
  const { user } = useSession();
  const [communities, setCommunities] = useState<Community[] | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const school = (user?.profile?.university ?? '').trim().toLowerCase();

  useEffect(() => { listCommunities().then((r) => setCommunities(r.communities)).catch((e: Error) => { setError(e.message); setCommunities([]); }); }, []);

  const all = communities ?? [];
  // Categories are typed freely ("TECH", "Tech"), so group them ignoring case and show them tidily.
  const categories = useMemo(() => [...new Set(all.map((c) => catKey(c.category)).filter(Boolean))].sort().slice(0, 6), [all]);
  const atSchool = (c: Community) => Boolean(school) && c.university.trim().toLowerCase() === school;
  const shown = all.filter((c) => {
    if (filter === 'MINE' && !atSchool(c)) return false;
    if (filter !== 'All' && filter !== 'MINE' && catKey(c.category) !== filter) return false;
    const q = search.trim().toLowerCase();
    return !q || [c.name, c.shortDescription, c.university, c.category].some((v) => (v ?? '').toLowerCase().includes(q));
  }).sort((a, b) => Number(atSchool(b)) - Number(atSchool(a)) || b.memberCount - a.memberCount);
  const mine = filter === 'All' && !search ? shown.filter(atSchool) : [];
  const rest = mine.length ? shown.filter((c) => !atSchool(c)) : shown;

  return (
    <div className="wrap page">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>Communities</h1>
        <div className="row">
          <label className="search"><Search size={18} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search communities" aria-label="Search communities" /></label>
          <Button href={user ? '/communities/new' : '/login?next=/communities/new'}><Plus size={16} />Create community</Button>
        </div>
      </div>
      <div className="row" role="group" aria-label="Filter communities">
        <Pill on={filter === 'All'} onClick={() => setFilter('All')}>All</Pill>
        {school ? <Pill on={filter === 'MINE'} onClick={() => setFilter('MINE')}>My school</Pill> : null}
        {categories.map((c) => <Pill key={c} on={filter === c} onClick={() => setFilter(c)}>{c.charAt(0).toUpperCase() + c.slice(1)}</Pill>)}
      </div>
      {error ? <p className="error">{error}</p> : null}
      {communities === null ? <p className="empty">Loading communities…</p> : null}
      {mine.length ? <><p className="sect">At your school</p><div className="cgrid">{mine.map((c) => <CommunityRow key={c._id} community={c} />)}</div></> : null}
      {rest.length ? <>{mine.length ? <p className="sect">Everywhere else</p> : null}<div className="cgrid">{rest.map((c) => <CommunityRow key={c._id} community={c} />)}</div></> : null}
      {communities !== null && !shown.length ? <p className="empty">No communities match.</p> : null}
    </div>
  );
}
