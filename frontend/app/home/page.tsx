'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

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
import {
  MobileSearchForm,
  MobileStudentSnapshot,
  StudentCommandPanel,
  StudentDiscoveryRail,
  StudentProfileRail,
} from '../../components/guildos/student-home-command-center';

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
        getPeopleYouMayKnow(6)
          .then((r) => setPeople(r.suggestions))
          .catch((error) => console.error('Failed to load suggested people', error));
        getSuggestedCommunities()
          .then((r) => setCommunities(r.communities))
          .catch((error) => console.error('Failed to load suggested communities', error));
        getTrending()
          .then((r) => {
            setTrendingEvents(r.events);
            setTrendingCommunities(r.communities);
          })
          .catch((error) => console.error('Failed to load trending content', error));
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
    } catch (error) {
      console.error('Failed to join community', error);
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

      <main className="mx-auto grid max-w-7xl gap-5 px-4 py-6 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
        <StudentProfileRail
          user={user}
          reputation={reputation}
          completion={completion}
          firstName={firstName}
          avatar={avatar}
          cover={cover}
          levelTone={LEVEL_TONE}
        >
          <StudentCommandPanel
            guildScore={reputation?.guildScore}
            level={reputation?.level}
            profileCompletion={completion?.completion ?? 0}
            certificatesEarned={certs.length}
            upcomingEvents={events.length}
            communitiesJoined={joinedCommunityCount}
          />

          <StudentProgressPath
            compact
            profileCompletion={completion?.completion ?? 0}
            communitiesJoined={joinedCommunityCount}
            upcomingEvents={events.length}
            certificatesEarned={certs.length}
          />
        </StudentProfileRail>

        <section className="space-y-5">
          <MobileSearchForm
            value={search}
            onChange={setSearch}
            onSubmit={() => {
              const q = search.trim();
              if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
            }}
          />

          <MobileStudentSnapshot
            guildScore={reputation?.guildScore}
            level={reputation?.level}
            profileCompletion={completion?.completion ?? 0}
            certificatesEarned={certs.length}
            upcomingEvents={events.length}
            communitiesJoined={joinedCommunityCount}
          />

          <Feed currentUserId={user?.id} />
        </section>

        <StudentDiscoveryRail
          trendingEvents={trendingEvents}
          trendingCommunities={trendingCommunities}
          communities={communities}
          people={people}
          events={events}
          opportunities={opps}
          certificates={certs}
          reputation={reputation}
          joining={joining}
          onJoinCommunity={(id) => void handleJoinCommunity(id)}
          onConnectPerson={(id) => {
            void sendConnectionRequest(id).catch((error) => console.error('Failed to send connection request', error));
            setPeople((list) => list.filter((person) => person.id !== id));
          }}
          resolveAvatarUrl={resolveAvatarUrl}
          resolvePersonAvatar={resolvePersonAvatar}
          eventDate={eventDate}
        />
      </main>

    </div>
  );
}
