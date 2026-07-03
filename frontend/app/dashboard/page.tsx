'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Award, Building2, CalendarDays, Users } from 'lucide-react';

import { getCurrentUser } from '../../components/guildos/auth-api';
import { getProfileCompletion } from '../../components/guildos/profile-completion';
import { ProfileDashboardHeader } from '../../components/guildos/profile-dashboard-header';
import { DashboardShell } from '../../components/guildos/dashboard-shell';
import { DashboardSidebar } from '../../components/guildos/dashboard-sidebar';
import { DashboardTopbar } from '../../components/guildos/dashboard-topbar';
import { DashboardStatCard } from '../../components/guildos/dashboard-stat-card';
import { DashboardUpcomingEvents, type DashboardEventItem } from '../../components/guildos/dashboard-upcoming-events';
import { DashboardActivityFeed, type DashboardActivityItem } from '../../components/guildos/dashboard-activity-feed';
import { DashboardCommunityHealth, type HealthMetric } from '../../components/guildos/dashboard-community-health';
import { DashboardSkeleton } from '../../components/guildos/dashboard-skeleton';
import { SectionHeader } from '../../components/guildos/ui/section-header';
import { getCommunities, getCommunityActivity, getUserMemberships, resolveAvatarUrl, type CommunitySummary } from '../../components/guildos/community-list-api';
import { listManagedEvents, type EventSummary } from '../../components/guildos/event-api';
import { getReputationSummary } from '../../components/guildos/reputation-api';

const MANAGER_ROLES = new Set(['COORDINATOR', 'SECRETARY', 'TREASURER', 'VICE_PRESIDENT', 'PRESIDENT', 'FOUNDER']);

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatEventDate(value: string | null) {
  if (!value) return 'Date TBA';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date TBA';
  return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

function statusMeta(status: string): { label: string; tone: DashboardEventItem['statusTone'] } {
  switch (status) {
    case 'CHECK_IN':
    case 'CHECK_OUT':
      return { label: 'Live now', tone: 'live' };
    case 'PUBLISHED':
      return { label: 'Published', tone: 'scheduled' };
    case 'DRAFT':
      return { label: 'Draft', tone: 'draft' };
    case 'COMPLETED':
      return { label: 'Completed', tone: 'scheduled' };
    case 'ARCHIVED':
      return { label: 'Archived', tone: 'draft' };
    default:
      return { label: status, tone: 'scheduled' };
  }
}

function activityLabel(action: string) {
  switch (action) {
    case 'MEMBER_JOINED':
      return 'New member joined';
    case 'MEMBER_LEFT':
      return 'Member left';
    case 'MEMBER_REMOVED':
      return 'Member removed';
    case 'ROLE_ASSIGNED':
      return 'Role assigned';
    case 'ROLE_REMOVED':
      return 'Role removed';
    case 'STATUS_CHANGED':
      return 'Membership status changed';
    default:
      return 'Community activity';
  }
}

function timeAgo(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(value).toLocaleDateString();
}

type HeaderStat = { label: string; value: number };

export default function DashboardPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [displayName, setDisplayName] = useState('Student');
  const [userProfile, setUserProfile] = useState<any>(null);
  const [headerStats, setHeaderStats] = useState<HeaderStat[]>([]);
  const [managedCommunities, setManagedCommunities] = useState<CommunitySummary[]>([]);
  const [stats, setStats] = useState({ totalMembers: 0, eventsHosted: 0, certsIssued: 0, completionRate: 0, verifiedCount: 0, totalRegistrations: 0 });
  const [upcomingEvents, setUpcomingEvents] = useState<DashboardEventItem[]>([]);
  const [activity, setActivity] = useState<DashboardActivityItem[]>([]);

  useEffect(() => {
    const load = async () => {
      const user = await getCurrentUser();
      if (!user) {
        router.replace('/login');
        return;
      }

      setDisplayName(user.fullName);
      setUserProfile(user);

      const [summary, membershipsRes, communitiesRes] = await Promise.all([
        getReputationSummary(user.id).catch(() => null),
        getUserMemberships(user.id).catch(() => ({ memberships: [] })),
        getCommunities().catch(() => ({ communities: [] as CommunitySummary[] })),
      ]);

      if (summary) {
        setHeaderStats([
          { label: 'Events attended', value: summary.stats.eventsCompleted },
          { label: 'Certificates earned', value: summary.stats.certificatesEarned },
          { label: 'Communities joined', value: summary.stats.communitiesJoined },
          { label: 'Leadership roles', value: summary.stats.leadershipRoles },
        ]);
      } else {
        const joined = membershipsRes.memberships.filter((m) => m.community && m.status !== 'REMOVED' && m.status !== 'LEFT').length;
        setHeaderStats([
          { label: 'Events attended', value: 0 },
          { label: 'Certificates earned', value: 0 },
          { label: 'Communities joined', value: joined },
          { label: 'Leadership roles', value: 0 },
        ]);
      }

      const communityById = new Map(communitiesRes.communities.map((c) => [c._id, c] as const));
      const managedIds = new Set(
        membershipsRes.memberships
          .filter((m) => m.community && MANAGER_ROLES.has(m.role) && m.status !== 'REMOVED' && m.status !== 'LEFT')
          .map((m) => m.community!.id),
      );
      const managed = [...managedIds].map((id) => communityById.get(id)).filter((c): c is CommunitySummary => Boolean(c));
      setManagedCommunities(managed);

      const eventLists = await Promise.all(
        managed.slice(0, 6).map((c) => listManagedEvents(c._id).then((r) => r.events).catch(() => [] as EventSummary[])),
      );
      const allEvents = eventLists.flat();

      const totalMembers = managed.reduce((sum, c) => sum + (c.memberCount ?? 0), 0);
      const certsIssued = allEvents.reduce((sum, e) => sum + (e.certificatesIssued ?? 0), 0);
      const totalRegistrations = allEvents.reduce((sum, e) => sum + (e.registrationCount ?? 0), 0);
      const totalCompleted = allEvents.reduce((sum, e) => sum + (e.completedCount ?? 0), 0);
      const completionRate = totalRegistrations ? Math.round((totalCompleted / totalRegistrations) * 100) : 0;
      const verifiedCount = managed.filter((c) => c.verificationStatus === 'VERIFIED').length;
      setStats({ totalMembers, eventsHosted: allEvents.length, certsIssued, completionRate, verifiedCount, totalRegistrations });

      const now = Date.now();
      const upcoming = allEvents
        .filter((e) => e.startDate && new Date(e.startDate).getTime() >= now && e.status !== 'ARCHIVED')
        .sort((a, b) => new Date(a.startDate as string).getTime() - new Date(b.startDate as string).getTime());
      const fallbackRecent = allEvents
        .slice()
        .sort((a, b) => new Date(b.startDate ?? b.createdAt).getTime() - new Date(a.startDate ?? a.createdAt).getTime());
      const eventSource = (upcoming.length ? upcoming : fallbackRecent).slice(0, 4);
      setUpcomingEvents(
        eventSource.map((e) => {
          const meta = statusMeta(e.status);
          return {
            id: e._id,
            title: e.title,
            slug: e.slug,
            communityName: communityById.get(e.communityId)?.name ?? 'Community',
            dateLabel: formatEventDate(e.startDate),
            venue: e.venue,
            registered: e.registrationCount ?? 0,
            statusLabel: meta.label,
            statusTone: meta.tone,
          };
        }),
      );

      const activityLists = await Promise.all(
        managed.slice(0, 4).map((c) =>
          getCommunityActivity(c._id)
            .then((r) => r.activity.map((a) => ({ ...a, communityName: c.name })))
            .catch(() => []),
        ),
      );
      const mergedActivity = activityLists
        .flat()
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 6)
        .map((a) => ({
          id: a.id,
          label: activityLabel(a.action),
          detail: `${a.member?.fullName ?? a.actor?.fullName ?? 'A member'} · ${a.communityName}`,
          time: timeAgo(a.createdAt),
        }));
      setActivity(mergedActivity);

      setIsLoading(false);
    };

    void load();
  }, [router]);

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#F8FAFC] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-[1600px]">
          <DashboardSkeleton />
        </div>
      </main>
    );
  }

  const communityCount = managedCommunities.length;
  const healthMetrics: HealthMetric[] = [
    { label: 'Active Members', value: stats.totalMembers.toLocaleString() },
    { label: 'Event Completion', value: `${stats.completionRate}%` },
    { label: 'Certificates Issued', value: stats.certsIssued.toLocaleString() },
    { label: 'Verified Communities', value: `${stats.verifiedCount}/${communityCount || 0}` },
  ];
  const healthTone: 'healthy' | 'warning' | 'neutral' = communityCount === 0 ? 'neutral' : stats.verifiedCount === communityCount ? 'healthy' : 'warning';
  const healthStatus = communityCount === 0 ? 'No communities' : stats.verifiedCount === communityCount ? 'Healthy' : 'Needs verification';

  return (
    <DashboardShell sidebar={<DashboardSidebar />} topbar={<DashboardTopbar />}>
      <section className="grid gap-6">
        <SectionHeader
          eyebrow="GuildOS Dashboard"
          title={`${greeting()}, ${displayName} 👋`}
          subtitle="Track members, events, attendance, and certificates across the communities you lead — all in one operational view."
          action={
            <div className="flex flex-wrap gap-3">
              <Link href="/home" className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
                ← Student Home
              </Link>
              <Link href="/dashboard/communities/create" className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
                New Community
              </Link>
              <Link href="/dashboard/events/create" className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700">
                Create Event
              </Link>
            </div>
          }
        />

        {userProfile ? (
          <ProfileDashboardHeader
            fullName={userProfile.fullName}
            username={userProfile.profile?.username}
            joinDate={userProfile.createdAt}
            title={userProfile.profile?.department || userProfile.profile?.level}
            avatar={userProfile.profile?.avatar}
            visibility={userProfile.profile?.profileVisibility}
            {...getProfileCompletion({
              fullName: userProfile.fullName,
              username: userProfile.profile?.username,
              avatar: userProfile.profile?.avatar,
              bio: userProfile.profile?.bio,
              location: userProfile.profile?.location,
              socialLinks: userProfile.profile?.socialLinks,
              university: userProfile.profile?.university,
              faculty: userProfile.profile?.faculty,
              department: userProfile.profile?.department,
              level: userProfile.profile?.level,
              interests: userProfile.profile?.interests,
              graduationYear: userProfile.profile?.graduationYear,
            })}
            stats={headerStats}
          />
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DashboardStatCard title="Communities Managed" value={String(communityCount)} change={`${stats.verifiedCount} verified`} trend="up" icon={<Building2 className="h-5 w-5" />} />
          <DashboardStatCard title="Total Members" value={stats.totalMembers.toLocaleString()} change={`Across ${communityCount} ${communityCount === 1 ? 'community' : 'communities'}`} trend="up" icon={<Users className="h-5 w-5" />} />
          <DashboardStatCard title="Events Hosted" value={String(stats.eventsHosted)} change={`${stats.totalRegistrations.toLocaleString()} registrations`} trend="up" icon={<CalendarDays className="h-5 w-5" />} />
          <DashboardStatCard title="Certificates Issued" value={stats.certsIssued.toLocaleString()} change={`${stats.completionRate}% completion rate`} trend="up" icon={<Award className="h-5 w-5" />} />
        </div>

        {managedCommunities.length ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold tracking-tight text-slate-950">Your Communities</h2>
              <Link href="/dashboard/communities" className="text-sm font-medium text-indigo-600 hover:underline">Manage all</Link>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {managedCommunities.map((c) => (
                <Link key={c._id} href={`/communities/${c.slug}`} className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4 transition hover:border-indigo-300 hover:bg-slate-50/70">
                  {c.logo ? (
                    <img src={resolveAvatarUrl(c.logo)} alt={c.name} className="h-11 w-11 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-indigo-500 text-sm font-semibold text-white">{c.name.slice(0, 1)}</span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{c.name}</p>
                    <p className="text-xs text-slate-500">{c.memberCount} members · {c.eventCount} events{c.verificationStatus === 'VERIFIED' ? ' · ✓ Verified' : ''}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
          <DashboardUpcomingEvents events={upcomingEvents} />
          <DashboardActivityFeed activities={activity} />
        </div>

        <DashboardCommunityHealth metrics={healthMetrics} status={healthStatus} tone={healthTone} />
      </section>
    </DashboardShell>
  );
}

