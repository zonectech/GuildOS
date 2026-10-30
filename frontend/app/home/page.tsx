'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { getCurrentUser, type AuthUser } from '../../components/guildos/auth-api';
import { StudentNav } from '../../components/guildos/student-nav';
import { Tour, type TourStep } from '../../components/guildos/ui/tour';
import { getMyReputation, type Reputation } from '../../components/guildos/reputation-api';
import { getMyUpcomingEvents, getMyCertificates, type UpcomingEventEntry, type CertificateSummary } from '../../components/guildos/event-api';
import { getRecommendedOpportunities, type Opportunity } from '../../components/guildos/opportunity-api';
import { getPeopleYouMayKnow, sendConnectionRequest, resolvePersonAvatar, type SuggestedPerson } from '../../components/guildos/connection-api';
import { getManagedCommunities, getSuggestedCommunities, getUserMemberships, joinCommunity, resolveAvatarUrl, type SuggestedCommunity, type UserMembershipEntry } from '../../components/guildos/community-list-api';
import { MyCommunitiesStrip, NextUpCard } from '../../components/guildos/home/home-cards';
import { getProfileCompletion } from '../../components/guildos/profile-completion';
import { Feed } from '../../components/guildos/feed/feed';
import { StatusRail, type RailCommunity } from '../../components/guildos/status/status-rail';
import type { GuildStatus } from '../../components/guildos/status/status-types';
import { readStatusStories, type StatusStory } from '../../components/guildos/status-store';
import { getTrending, type TrendingCommunity, type TrendingEvent } from '../../components/guildos/feed-api';
import { PageLoading } from '../../components/guildos/ui/loading';
import {
  MobileCommunitySuggestions,
  MobileSearchForm,
  MobileStudentSnapshot,
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

/** First-run walkthrough for students — shown once, then never again (Skip/Done persists). */
const STUDENT_TOUR: TourStep[] = [
  {
    title: 'Welcome to GuildOS!',
    body: "Here's a 30-second tour of the essentials. You can skip any time, and everything is easy to find later.",
  },
  {
    target: 'composer',
    title: 'Share with your campus',
    body: 'Post progress, wins, questions, photos, even polls. Your feed is where your communities hang out.',
  },
  {
    target: 'nav-events',
    title: 'Discover events',
    body: 'Workshops, hackathons, and meetups from communities across GuildOS. Register in one tap and get a QR pass for the door.',
  },
  {
    target: 'nav-communities',
    title: 'Find your people',
    body: 'Join clubs and societies at your university. Follow their posts, events and knowledge library.',
  },
  {
    target: 'nav-opportunities',
    title: 'Jobs & internships',
    body: 'Opportunities matched to your interests and skills. Each one explains why it fits you.',
  },
  {
    target: 'nav-cv',
    title: 'Your living CV',
    body: 'Generate a verifiable CV from everything you do on GuildOS. It updates as your record grows.',
  },
  {
    target: 'nav-reputation',
    title: 'Your Guild Score',
    body: 'Everything you do (attending events, earning certificates, leading) builds a verified score recruiters can trust.',
  },
  {
    target: 'nav-messages',
    title: 'Messages',
    body: 'Chat directly with your connections. Conversations start from any profile.',
  },
  {
    target: 'nav-bell',
    title: 'Notifications',
    body: "Event reminders, approvals, certificates, and messages land here, so you'll never miss a thing.",
  },
  {
    target: 'guildbot',
    title: 'Meet GuildBot',
    body: 'Stuck? Ask the assistant anything. It knows the platform, live events, and even your own registrations.',
  },
];

function resolveAvatar(avatar?: string) {
  if (!avatar) return '';
  if (avatar.startsWith('http')) return avatar;
  if (avatar.startsWith('/')) return `${API_BASE_URL}${avatar}`;
  return `${API_BASE_URL}/uploads/${avatar}`;
}

function eventDate(value: string | null) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-NG', { month: 'short', day: 'numeric' });
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
  const [memberships, setMemberships] = useState<UserMembershipEntry[]>([]);
  // Keep the next-event prompt neutral until memberships have loaded.
  const [membershipsLoaded, setMembershipsLoaded] = useState(false);
  const [statusStories, setStatusStories] = useState<StatusStory[]>([]);
  const [managedCommunities, setManagedCommunities] = useState<RailCommunity[]>([]);
  // Upcoming events, memberships, trending and suggestions decide the page's shape; until they
  // answer, those slots show placeholders instead of empty-state prompts that then swap out.
  const [homeDataLoaded, setHomeDataLoaded] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const current = await getCurrentUser();
        if (!current) {
          router.replace('/login');
          return;
        }
        setUser(current);
        setLoading(false);
        void getMyReputation().then((r) => setReputation(r.reputation)).catch(() => undefined);
        const upcomingRequest = getMyUpcomingEvents().then((r) => setEvents(r.events)).catch(() => undefined);
        void getRecommendedOpportunities()
          .then((r) => setOpps([...r.recommended, ...r.stretch].slice(0, 4)))
          .catch(() => undefined);
        void getMyCertificates().then((r) => setCerts(r.certificates)).catch(() => undefined);
        void getManagedCommunities()
          .then((r) => setManagedCommunities(r.communities.map((c) => ({ id: c._id, name: c.name, logo: c.logo }))))
          .catch(() => undefined);
        void readStatusStories().then((stories) => setStatusStories(stories)).catch(() => setStatusStories([]));
        const membershipsRequest = getUserMemberships(current.id)
          .then((r) => {
            setMemberships(r.memberships);
            setMembershipsLoaded(true);
          })
          .catch(() => undefined);
        getPeopleYouMayKnow(6)
          .then((r) => setPeople(r.suggestions))
          .catch((error) => console.error('Failed to load suggested people', error));
        const suggestedRequest = getSuggestedCommunities()
          .then((r) => setCommunities(r.communities))
          .catch((error) => console.error('Failed to load suggested communities', error));
        const trendingRequest = getTrending()
          .then((r) => {
            setTrendingEvents(r.events);
            setTrendingCommunities(r.communities);
          })
          .catch((error) => console.error('Failed to load trending content', error));
        void Promise.allSettled([upcomingRequest, membershipsRequest, suggestedRequest, trendingRequest]).then(() => setHomeDataLoaded(true));
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
  const statusRailItems = statusStories;
  const currentStatusUser: GuildStatus = { id: user?.id ?? '', name: user?.fullName || 'You', avatar: avatar || undefined };
  const joinedCommunityCount = memberships.filter((membership) => membership.community && membership.status === 'ACTIVE').length;

  async function handleJoinCommunity(id: string) {
    setJoining(id);
    try {
      await joinCommunity(id);
      setCommunities((list) => list.filter((c) => c._id !== id));
      // Refresh the joined-community strip (approval-based joins stay pending).
      if (user) void getUserMemberships(user.id).then((r) => setMemberships(r.memberships)).catch(() => undefined);
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
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <StudentNav active="/home" />
      <Tour steps={STUDENT_TOUR} storageKey="guildos-tour-student-v1" />

      <main className="mx-auto grid max-w-7xl gap-5 px-4 py-6 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
        <StudentProfileRail
          user={user}
          reputation={reputation}
          completion={completion}
          firstName={firstName}
          avatar={avatar}
          cover={cover}
          levelTone={LEVEL_TONE}
        />

        <section className="min-w-0 space-y-5">
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

          <NextUpCard events={events} joinedCount={membershipsLoaded ? joinedCommunityCount : 1} loading={!homeDataLoaded} />

          <MyCommunitiesStrip memberships={memberships} />

          <MobileCommunitySuggestions
            communities={communities}
            joining={joining}
            onJoinCommunity={(id) => void handleJoinCommunity(id)}
            resolveAvatarUrl={resolveAvatarUrl}
          />

          <StatusRail items={statusRailItems} currentUser={currentStatusUser} managedCommunities={managedCommunities} />

          <Feed currentUserId={user?.id} currentUserAvatar={avatar} currentUserName={user?.fullName} quietPosts />
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
          loading={!homeDataLoaded}
        />
      </main>
    </div>
  );
}
