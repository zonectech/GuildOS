'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarDays, Briefcase, FileText, Award, Flame, LayoutDashboard, Users, ArrowRight, Search } from 'lucide-react';

import { getCurrentUser, type AuthUser } from '../../components/guildos/auth-api';
import { StudentNav } from '../../components/guildos/student-nav';
import { getMyReputation, type Reputation } from '../../components/guildos/reputation-api';
import { getMyUpcomingEvents, getMyCertificates, type UpcomingEventEntry, type CertificateSummary } from '../../components/guildos/event-api';
import { getRecommendedOpportunities, type Opportunity } from '../../components/guildos/opportunity-api';
import { getPeopleYouMayKnow, sendConnectionRequest, resolvePersonAvatar, type SuggestedPerson } from '../../components/guildos/connection-api';
import { getSuggestedCommunities, getUserMemberships, joinCommunity, resolveAvatarUrl, type SuggestedCommunity } from '../../components/guildos/community-list-api';
import { getProfileCompletion } from '../../components/guildos/profile-completion';
import { Feed } from '../../components/guildos/feed/feed';
import { getTrending, type TrendingCommunity, type TrendingEvent } from '../../components/guildos/feed-api';
import { PageLoading } from '../../components/guildos/ui/loading';
import { StudentProgressPath } from '../../components/guildos/student-progress-path';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const LEVEL_TONE: Record<string, string> = {
  'Explorer Guild': 'from-slate-500 to-slate-700',
  'Bronze Guild': 'from-amber-600 to-orange-700',
  'Silver Guild': 'from-slate-400 to-slate-600',
  'Gold Guild': 'from-yellow-400 to-amber-600',
  'Platinum Guild': 'from-cyan-400 to-sky-600',
  'Elite Guild': 'from-fuchsia-500 to-indigo-700',
};

function resolveAvatar(avatar?: string) {
  if (!avatar) return '';
  if (avatar.startsWith('http')) return avatar;
  if (avatar.startsWith('/')) return `${API_BASE_URL}${avatar}`;
  return `${API_BASE_URL}/uploads/${avatar}`;
}

function eventDate(value: string | null) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function StudentHomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [reputation, setReputation] = useState<Reputation | null>(null);
  const [events, setEvents] = useState<UpcomingEventEntry[]>([]);
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [certs, setCerts] = useState<CertificateSummary[]>([]);
  const [people, setPeople] = useState<SuggestedPerson[]>([]);
  const [communities, setCommunities] = useState<SuggestedCommunity[]>([]);
  const [joining, setJoining] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [trendingEvents, setTrendingEvents] = useState<TrendingEvent[]>([]);
  const [trendingCommunities, setTrendingCommunities] = useState<TrendingCommunity[]>([]);
  const [joinedCommunityCount, setJoinedCommunityCount] = useState(0);

  useEffect(() => {
    void (async () => {
      try {
        const current = await getCurrentUser();
        if (!current) {
          router.replace('/login');
          return;
        }
        setUser(current);
        const [rep, ev, rec, ce, memberships] = await Promise.allSettled([
          getMyReputation(),
          getMyUpcomingEvents(),
          getRecommendedOpportunities(),
          getMyCertificates(),
          getUserMemberships(current.id),
        ]);
        if (rep.status === 'fulfilled') setReputation(rep.value.reputation);
        if (ev.status === 'fulfilled') setEvents(ev.value.events);
        if (rec.status === 'fulfilled') setOpps([...rec.value.recommended, ...rec.value.stretch].slice(0, 4));
        if (ce.status === 'fulfilled') setCerts(ce.value.certificates);
        if (memberships.status === 'fulfilled') {
          setJoinedCommunityCount(memberships.value.memberships.filter((membership) => membership.community && membership.status === 'ACTIVE').length);
        }
        getPeopleYouMayKnow(6).then((r) => setPeople(r.suggestions)).catch(() => undefined);
        getSuggestedCommunities().then((r) => setCommunities(r.communities)).catch(() => undefined);
        getTrending().then((r) => { setTrendingEvents(r.events); setTrendingCommunities(r.communities); }).catch(() => undefined);
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const completion = user
    ? getProfileCompletion({
        fullName: user.fullName,
        username: user.profile?.username,
        avatar: user.profile?.avatar,
        bio: user.profile?.bio,
        location: user.profile?.location,
        socialLinks: user.profile?.socialLinks,
        university: user.profile?.university,
        faculty: user.profile?.faculty,
        department: user.profile?.department,
        level: user.profile?.level,
        interests: user.profile?.interests,
        graduationYear: user.profile?.graduationYear,
      })
    : null;

  const avatar = resolveAvatar(user?.profile?.avatar);
  const cover = resolveAvatar(user?.profile?.coverImage);
  const firstName = (user?.fullName ?? 'there').split(' ')[0];

  async function handleJoinCommunity(id: string) {
    setJoining(id);
    try {
      await joinCommunity(id);
      setCommunities((list) => list.filter((c) => c._id !== id));
    } catch {
      /* ignore */
    } finally {
      setJoining(null);
    }
  }

  if (loading) {
    return <PageLoading label="Loading your home…" />;
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <StudentNav active="/home" />

      <main className="mx-auto grid max-w-6xl gap-5 px-4 py-6 lg:grid-cols-[280px_1fr_300px]">
        {/* Left rail — profile card */}
        <aside className="hidden space-y-4 lg:block lg:sticky lg:top-16 lg:self-start lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className={`relative h-16 bg-gradient-to-br ${LEVEL_TONE[reputation?.level ?? 'Explorer Guild'] ?? 'from-slate-500 to-slate-700'}`}>
              {cover ? <img src={cover} alt="" className="h-full w-full object-cover" /> : null}
            </div>
            <div className="relative z-10 px-4 pb-4">
              <div className="-mt-8 flex justify-center">
                {avatar ? (
                  <img src={avatar} alt="You" className="h-16 w-16 rounded-full border-4 border-white object-cover" />
                ) : (
                  <span className="grid h-16 w-16 place-items-center rounded-full border-4 border-white bg-slate-200 text-lg font-semibold text-slate-600">{firstName.slice(0, 1)}</span>
                )}
              </div>
              <p className="mt-2 text-center text-base font-semibold text-slate-900">{user?.fullName}</p>
              <p className="text-center text-xs text-slate-500">{[user?.profile?.department, user?.profile?.university].filter(Boolean).join(' · ') || 'Student'}</p>
              {reputation ? (
                <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                  <span className="text-xs text-slate-500">Guild Score</span>
                  <span className="text-sm font-semibold text-slate-900">{reputation.guildScore.toLocaleString()} · {reputation.level}</span>
                </div>
              ) : null}
              <Link href={user?.profile?.username ? `/u/${encodeURIComponent(user.profile.username)}` : '/profile'} className="mt-3 block rounded-xl border border-slate-200 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-50">View profile</Link>
            </div>
          </div>

          {completion && completion.completion < 100 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-medium text-slate-900">Complete your profile</p>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${completion.completion}%` }} /></div>
              <p className="mt-1 text-xs text-slate-500">{completion.completion}% complete</p>
              <Link href="/account" className="mt-2 inline-block text-xs font-medium text-indigo-600 hover:underline">Finish setup →</Link>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-2">
            <QuickLink href="/cv" icon={<FileText className="h-4 w-4" />} label="Build my CV" />
            <QuickLink href="/reputation" icon={<Award className="h-4 w-4" />} label="My Guild Score" />
          </div>
        </aside>

        {/* Center — feed */}
        <section className="space-y-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const q = search.trim();
              if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
            }}
            className="relative sm:hidden"
          >
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search people, communities, events…"
              className="w-full rounded-full border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </form>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h1 className="text-xl font-semibold text-slate-950">Welcome back, {firstName} 👋</h1>
            <p className="mt-1 text-sm text-slate-500">Here&apos;s what&apos;s happening across your campus network.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/events" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">Discover events</Link>
              <Link href="/opportunities" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Find opportunities</Link>
            </div>
          </div>

          <StudentProgressPath
            profileCompletion={completion?.completion ?? 0}
            communitiesJoined={joinedCommunityCount}
            upcomingEvents={events.length}
            certificatesEarned={certs.length}
          />

          <Feed currentUserId={user?.id} />
        </section>

        {/* Right rail */}
        <aside className="hidden space-y-4 lg:block lg:sticky lg:top-16 lg:self-start lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto">
          {trendingEvents.length || trendingCommunities.length ? (
            <div className="rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50/70 to-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-orange-700"><Flame className="h-4 w-4" /><p className="text-sm font-semibold">Trending this week</p></div>
              {trendingEvents.length ? (
                <div className="mt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Events</p>
                  <ul className="mt-1.5 space-y-1.5">
                    {trendingEvents.map((e) => (
                      <li key={e.id}>
                        <Link href={`/events/${encodeURIComponent(e.slug)}`} className="flex items-center justify-between gap-2 rounded-xl px-2 py-1.5 hover:bg-white">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-900">{e.title}</p>
                            <p className="truncate text-xs text-slate-500">{eventDate(e.startDate)}{e.venue ? ` · ${e.venue}` : e.mode ? ` · ${e.mode}` : ''}</p>
                          </div>
                          <span className="shrink-0 rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-700">{e.registrationCount} going</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {trendingCommunities.length ? (
                <div className="mt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Communities</p>
                  <ul className="mt-1.5 space-y-1.5">
                    {trendingCommunities.map((c) => (
                      <li key={c.id}>
                        <Link href={`/communities/${encodeURIComponent(c.slug)}`} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-white">
                          {resolveAvatarUrl(c.logo) ? (
                            <img src={resolveAvatarUrl(c.logo)} alt="" className="h-8 w-8 shrink-0 rounded-lg object-cover" />
                          ) : (
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-200 text-xs font-semibold text-slate-600">{c.name.slice(0, 1)}</span>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-slate-900">{c.name}</p>
                            <p className="truncate text-xs text-slate-500">{c.memberCount} members</p>
                          </div>
                          <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">+{c.newMembers} this week</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          {communities.length ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-slate-700"><Users className="h-4 w-4" /><p className="text-sm font-semibold">Suggested communities</p></div>
                <Link href="/communities" className="text-xs font-medium text-indigo-600 hover:underline">See all</Link>
              </div>
              <ul className="mt-3 space-y-2">
                {communities.slice(0, 4).map((c) => (
                  <li key={c._id} className="flex items-center gap-2.5">
                    {resolveAvatarUrl(c.logo) ? (
                      <img src={resolveAvatarUrl(c.logo)} alt="" className="h-9 w-9 shrink-0 rounded-xl object-cover" />
                    ) : (
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-200 text-xs font-semibold text-slate-600">{c.name.slice(0, 1)}</span>
                    )}
                    <div className="min-w-0 flex-1">
                      <Link href={`/communities/${encodeURIComponent(c.slug)}`} className="block truncate text-sm font-medium text-slate-900 hover:underline">{c.name}</Link>
                      <p className="truncate text-xs text-slate-500">{c.reason}</p>
                    </div>
                    <button
                      onClick={() => void handleJoinCommunity(c._id)}
                      disabled={joining === c._id}
                      className="shrink-0 rounded-full border border-indigo-200 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-60"
                    >
                      {joining === c._id ? '…' : 'Join'}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {people.length ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-slate-700"><Users className="h-4 w-4" /><p className="text-sm font-semibold">People you may know</p></div>
                <Link href="/connections" className="text-xs font-medium text-indigo-600 hover:underline">See all</Link>
              </div>
              <ul className="mt-3 space-y-2">
                {people.slice(0, 4).map((p) => (
                  <li key={p.id} className="flex items-center gap-2.5">
                    {resolvePersonAvatar(p.avatar) ? (
                      <img src={resolvePersonAvatar(p.avatar)} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
                    ) : (
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">{p.fullName.slice(0, 1)}</span>
                    )}
                    <div className="min-w-0 flex-1">
                      <Link href={`/profile/${encodeURIComponent(p.username)}`} className="block truncate text-sm font-medium text-slate-900 hover:underline">{p.fullName}</Link>
                      <p className="truncate text-xs text-slate-500">{p.reason}</p>
                    </div>
                    <button
                      onClick={() => { void sendConnectionRequest(p.id).catch(() => undefined); setPeople((list) => list.filter((x) => x.id !== p.id)); }}
                      className="shrink-0 rounded-full border border-indigo-200 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                    >
                      Connect
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-indigo-700"><LayoutDashboard className="h-5 w-5" /><p className="text-sm font-semibold">Run a community?</p></div>
            <p className="mt-1 text-xs text-slate-600">Switch to Community Mode to manage members, host events, verify attendance, and issue certificates.</p>
            <Link href="/dashboard" className="mt-3 inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white">Enter Community Mode <ArrowRight className="h-4 w-4" /></Link>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-slate-700"><Award className="h-4 w-4" /><p className="text-sm font-semibold">Certificates</p></div>
            {certs.length ? (
              <ul className="mt-2 space-y-1.5">
                {certs.slice(0, 3).map((c) => (
                  <li key={c.serial}><Link href={`/certificates/${c.serial}`} className="block truncate text-sm text-slate-700 hover:text-indigo-600">{c.eventTitle}</Link></li>
                ))}
              </ul>
            ) : <p className="mt-2 text-xs text-slate-500">Attend and complete events to earn verifiable certificates.</p>}
          </div>

          <FeedCard title="Your upcoming events" icon={<CalendarDays className="h-4 w-4" />} href="/my-events" hrefLabel="See all">
            {events.length ? (
              <ul className="space-y-2">
                {events.slice(0, 3).map((e) => (
                  <li key={e.id}>
                    <Link href={`/events/${e.slug}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2 hover:border-indigo-200">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">{e.title}</p>
                        <p className="truncate text-xs text-slate-500">{[e.venue, e.mode].filter(Boolean).join(' · ')}</p>
                      </div>
                      <span className="shrink-0 text-xs font-medium text-slate-500">{eventDate(e.startDate)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">No upcoming events. <Link href="/events" className="text-indigo-600 hover:underline">Discover →</Link></p>
            )}
          </FeedCard>

          <FeedCard title="Recommended for you" icon={<Briefcase className="h-4 w-4" />} href="/opportunities" hrefLabel="See all">
            {opps.length ? (
              <ul className="space-y-2">
                {opps.slice(0, 3).map((o) => (
                  <li key={o.id}>
                    <Link href={`/opportunities/${o.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2 hover:border-indigo-200">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">{o.title}</p>
                        <p className="truncate text-xs text-slate-500">{[o.organization, o.location].filter(Boolean).join(' · ')}</p>
                      </div>
                      {o.matchScore !== null ? <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">{o.matchScore}%</span> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">Earn certificates to unlock matches.</p>
            )}
          </FeedCard>

          {reputation && reputation.badges.length ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-slate-700"><Users className="h-4 w-4" /><p className="text-sm font-semibold">Your badges</p></div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {reputation.badges.map((b) => <span key={b.code} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{b.icon} {b.label}</span>)}
              </div>
            </div>
          ) : null}
        </aside>
      </main>

      {loading ? null : null}
    </div>
  );
}

function QuickLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm hover:border-indigo-200">
      <span className="text-indigo-600">{icon}</span>{label}
    </Link>
  );
}

function FeedCard({ title, icon, href, hrefLabel, children }: { title: string; icon: React.ReactNode; href: string; hrefLabel: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-800"><span className="text-indigo-600">{icon}</span><h2 className="text-sm font-semibold">{title}</h2></div>
        <Link href={href} className="text-xs font-medium text-indigo-600 hover:underline">{hrefLabel}</Link>
      </div>
      {children}
    </div>
  );
}
