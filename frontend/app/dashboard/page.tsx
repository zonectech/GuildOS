'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Award, Building2, CalendarDays, CheckCircle2, Mail, Users } from 'lucide-react';

import { getCurrentUser } from '../../components/guildos/auth-api';
import { navigateBack } from '../../components/guildos/back-navigation';
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
import { MediaPreviewDialog } from '../../components/guildos/ui/media-preview-dialog';
import { getManagedCommunities, getCommunityActivity, getUserMemberships, resolveAvatarUrl, type CommunitySummary } from '../../components/guildos/community-list-api';
import { listManagedEvents, type EventSummary } from '../../components/guildos/event-api';
import { getReputationSummary } from '../../components/guildos/reputation-api';
import { getMyCommunityAccess, requestCommunityAccess, sendSchoolEmailCode, verifySchoolEmailCode } from '../../components/guildos/community-access-api';

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
  return date.toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short' });
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
  return new Date(value).toLocaleDateString('en-NG');
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
  const [access, setAccess] = useState<{ status: string; hasAccess: boolean; schoolEmail?: string; schoolEmailVerified?: boolean } | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [schoolEmail, setSchoolEmail] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [formError, setFormError] = useState('');
  const [mediaPreview, setMediaPreview] = useState<{ src: string; alt: string } | null>(null);

  useEffect(() => {
    const load = async () => {
      const user = await getCurrentUser();
      if (!user) {
        router.replace('/login');
        return;
      }

      setDisplayName(user.fullName);
      setUserProfile(user);

      const acc = await getMyCommunityAccess().catch(() => ({ status: 'NONE', hasAccess: false, schoolEmail: '', schoolEmailVerified: false }));
      setAccess(acc);
      if (acc.schoolEmail) setSchoolEmail(acc.schoolEmail);
      if (acc.schoolEmailVerified) {
        setEmailVerified(true);
        setCodeSent(true);
      }
      if (!acc.hasAccess) {
        setIsLoading(false);
        return;
      }

      const [summary, membershipsRes, communitiesRes] = await Promise.all([
        getReputationSummary(user.id).catch(() => null),
        getUserMemberships(user.id).catch(() => ({ memberships: [] })),
        getManagedCommunities().catch(() => ({ communities: [] as CommunitySummary[] })),
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
      // The /managed endpoint already returns only the communities this user leads.
      const managed = communitiesRes.communities;
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

  async function sendCode() {
    setFormError('');
    const email = schoolEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFormError('Enter a valid email address.');
      return;
    }
    const domain = email.split('@')[1] ?? '';
    const freeProviders = ['gmail.com', 'googlemail.com', 'yahoo.com', 'ymail.com', 'outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'icloud.com', 'me.com', 'aol.com', 'proton.me', 'protonmail.com', 'gmx.com', 'mail.com', 'zoho.com', 'yandex.com', 'pm.me', 'fastmail.com'];
    if (freeProviders.includes(domain) || !/(^|\.)(edu|ac|sch)(\.[a-z]{2,})?$/.test(domain)) {
      setFormError('Use your official school email (e.g. name@university.edu). Free providers like Gmail or Outlook are not accepted.');
      return;
    }
    try {
      setSending(true);
      await sendSchoolEmailCode(email);
      setCodeSent(true);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to send code.');
    } finally {
      setSending(false);
    }
  }

  async function verifyCode() {
    setFormError('');
    try {
      setVerifying(true);
      await verifySchoolEmailCode(code.trim());
      setEmailVerified(true);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to verify code.');
    } finally {
      setVerifying(false);
    }
  }

  async function requestAccess() {
    setFormError('');
    try {
      setRequesting(true);
      const res = await requestCommunityAccess(note.trim());
      setAccess((a) => (a ? { ...a, status: res.status } : { status: res.status, hasAccess: false }));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to submit request.');
    } finally {
      setRequesting(false);
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-slate-100 dark:bg-slate-950 px-4 py-6 sm:px-6 lg:bg-[#F8FAFC] lg:px-8 lg:py-8">
        <div className="mx-auto max-w-[1600px]">
          <DashboardSkeleton />
        </div>
      </main>
    );
  }

  if (access && !access.hasAccess) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-100 dark:bg-slate-950 px-4 py-10">
        <div className="w-full max-w-lg rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-sm">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-100">
            <Building2 className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-center text-xl font-semibold text-slate-950 dark:text-white">Community Mode is approval-only</h1>
          {access.status === 'PENDING' ? (
            <div className="text-center">
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Your request is <span className="font-semibold text-amber-600">pending review</span>. An admin will verify and approve your access shortly — you&apos;ll get a notification.</p>
              <span className="mt-4 inline-block rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700">Awaiting approval</span>
            </div>
          ) : (
            <>
              <p className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">
                {access.status === 'REJECTED'
                  ? 'Your previous request was not approved. Verify your school email and submit a new request.'
                  : 'To create and manage communities, events, and certificates, verify your school email and request access. An admin will review before enabling Community Mode.'}
              </p>

              <div className="mt-6 space-y-5">
                {/* Step 1: school email */}
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">School email</label>
                  <div className="mt-1.5 flex gap-2">
                    <div className="relative flex-1">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                      <input
                        type="email"
                        value={schoolEmail}
                        onChange={(e) => setSchoolEmail(e.target.value)}
                        disabled={emailVerified}
                        placeholder="you@university.edu"
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-2.5 pl-9 pr-3 text-sm text-slate-900 dark:text-slate-100 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-500"
                      />
                    </div>
                    {!emailVerified && (
                      <button
                        onClick={() => void sendCode()}
                        disabled={sending}
                        className="whitespace-nowrap rounded-xl border border-indigo-200 bg-indigo-50 px-4 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-60"
                      >
                        {sending ? 'Sending…' : codeSent ? 'Resend code' : 'Send code'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Step 2: code */}
                {codeSent && !emailVerified && (
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Verification code</label>
                    <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">We sent a 6-digit code to {schoolEmail}. It expires in 15 minutes.</p>
                    <div className="mt-1.5 flex gap-2">
                      <input
                        inputMode="numeric"
                        maxLength={6}
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                        placeholder="123456"
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm tracking-[0.3em] text-slate-900 dark:text-slate-100 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                      />
                      <button
                        onClick={() => void verifyCode()}
                        disabled={verifying || code.trim().length < 6}
                        className="whitespace-nowrap rounded-xl bg-indigo-600 px-4 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
                      >
                        {verifying ? 'Verifying…' : 'Verify'}
                      </button>
                    </div>
                  </div>
                )}

                {emailVerified && (
                  <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-700 ring-1 ring-inset ring-emerald-100">
                    <CheckCircle2 className="h-4 w-4" /> School email verified · {schoolEmail}
                  </div>
                )}

                {/* Step 3: remaining details */}
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Tell us about your community role</label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    disabled={!emailVerified}
                    placeholder="Which community or club do you lead? What do you plan to organize?"
                    className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50"
                  />
                </div>

                {formError && <p className="text-sm font-medium text-rose-600">{formError}</p>}

                <button
                  onClick={() => void requestAccess()}
                  disabled={!emailVerified || requesting}
                  className="w-full rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
                >
                  {requesting ? 'Submitting…' : 'Submit request'}
                </button>
              </div>
            </>
          )}
          <div className="mt-6 text-center">
            <button onClick={() => navigateBack(router, '/home')} className="text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">← Back to Student Home</button>
          </div>
        </div>
      </div>
    );
  }

  const communityCount = managedCommunities.length;
  const healthMetrics: HealthMetric[] = [
    { label: 'Active Members', value: stats.totalMembers.toLocaleString('en-NG') },
    { label: 'Event Completion', value: `${stats.completionRate}%` },
    { label: 'Certificates Issued', value: stats.certsIssued.toLocaleString('en-NG') },
    { label: 'Verified Communities', value: `${stats.verifiedCount}/${communityCount || 0}` },
  ];
  const healthTone: 'healthy' | 'warning' | 'neutral' = communityCount === 0 ? 'neutral' : stats.verifiedCount === communityCount ? 'healthy' : 'warning';
  const healthStatus = communityCount === 0 ? 'No communities' : stats.verifiedCount === communityCount ? 'Healthy' : 'Needs verification';

  return (
    <DashboardShell sidebar={<DashboardSidebar />} topbar={<DashboardTopbar />}>
      <section className="grid gap-6">
        <SectionHeader
          eyebrow="GuildOS Dashboard"
          title={`${greeting()}, ${displayName}`}
          subtitle="Track members, events, attendance, and certificates across the communities you lead — all in one operational view."
          action={
            <div className="flex flex-wrap gap-3">
              <button onClick={() => navigateBack(router, '/home')} className="inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800">
                ← Student Home
              </button>
              <Link href="/dashboard/communities/create" className="inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800">
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
          <DashboardStatCard title="Total Members" value={stats.totalMembers.toLocaleString('en-NG')} change={`Across ${communityCount} ${communityCount === 1 ? 'community' : 'communities'}`} trend="up" icon={<Users className="h-5 w-5" />} />
          <DashboardStatCard title="Events Hosted" value={String(stats.eventsHosted)} change={`${stats.totalRegistrations.toLocaleString('en-NG')} registrations`} trend="up" icon={<CalendarDays className="h-5 w-5" />} />
          <DashboardStatCard title="Certificates Issued" value={stats.certsIssued.toLocaleString('en-NG')} change={`${stats.completionRate}% completion rate`} trend="up" icon={<Award className="h-5 w-5" />} />
        </div>

        {managedCommunities.length ? (
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold tracking-tight text-slate-950 dark:text-white">Your Communities</h2>
              <Link href="/dashboard/communities" className="text-sm font-medium text-indigo-600 hover:underline">Manage all</Link>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {managedCommunities.map((c) => (
                <Link key={c._id} href={`/communities/${c.slug}`} className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 transition hover:border-indigo-300 hover:bg-slate-50/70">
                  {c.logo ? (
                    <img
                      src={resolveAvatarUrl(c.logo)}
                      alt={c.name}
                      className="h-11 w-11 shrink-0 cursor-zoom-in rounded-xl object-cover"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setMediaPreview({ src: resolveAvatarUrl(c.logo), alt: `${c.name} logo` });
                      }}
                    />
                  ) : (
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-indigo-500 text-sm font-semibold text-white">{c.name.slice(0, 1)}</span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900 dark:text-slate-100">{c.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{c.memberCount} members · {c.eventCount} events{c.verificationStatus === 'VERIFIED' ? ' · ✓ Verified' : ''}</p>
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
        <MediaPreviewDialog preview={mediaPreview} onClose={() => setMediaPreview(null)} />
      </section>
    </DashboardShell>
  );
}
