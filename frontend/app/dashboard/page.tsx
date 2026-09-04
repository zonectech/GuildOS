'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Award, BarChart3, Building2, CalendarDays, CheckCircle2, Mail, Ticket, Users, Wallet } from 'lucide-react';

import { getCurrentUser } from '../../components/guildos/auth-api';
import { navigateBack } from '../../components/guildos/back-navigation';
import { getProfileCompletion } from '../../components/guildos/profile-completion';
import { ProfileDashboardHeader } from '../../components/guildos/profile-dashboard-header';
import { DashboardShell } from '../../components/guildos/dashboard-shell';
import { Tour, type TourStep } from '../../components/guildos/ui/tour';
import { DashboardSidebar } from '../../components/guildos/dashboard-sidebar';
import { DashboardTopbar } from '../../components/guildos/dashboard-topbar';
import { DashboardStatCard } from '../../components/guildos/dashboard-stat-card';
import { DashboardUpcomingEvents, type DashboardEventItem } from '../../components/guildos/dashboard-upcoming-events';
import { DashboardActivityFeed, type DashboardActivityItem } from '../../components/guildos/dashboard-activity-feed';
import { DashboardCommunityHealth, type HealthMetric } from '../../components/guildos/dashboard-community-health';
import { DashboardSkeleton } from '../../components/guildos/dashboard-skeleton';
import { SectionHeader } from '../../components/guildos/ui/section-header';
import { MediaPreviewDialog } from '../../components/guildos/ui/media-preview-dialog';
import { getManagedCommunities, getCommunityActivity, getCommunityMemberAnalytics, getCommunityWallet, getUserMemberships, resolveAvatarUrl, type CommunitySummary } from '../../components/guildos/community-list-api';
import { listManagedEvents, type EventSummary } from '../../components/guildos/event-api';
import { getReputationSummary } from '../../components/guildos/reputation-api';
import { getMyCommunityAccess, requestCommunityAccess, sendSchoolEmailCode, verifySchoolEmailCode } from '../../components/guildos/community-access-api';

/** First-run walkthrough for community leaders — shown once on the dashboard. */
const LEADER_TOUR: TourStep[] = [
  {
    title: 'Welcome to Community Mode',
    body: 'This is your operations dashboard — everything you need to run a community lives here. Quick tour?',
  },
  {
    target: 'side-communities',
    title: 'Your communities',
    body: 'Create and manage your community pages — profile, verification, leadership roster, and premium.',
  },
  {
    target: 'side-events',
    title: 'Run events end-to-end',
    body: 'Create events with the wizard (agenda, tickets, certificates), open check-in, scan QR passes at the door, and download attendance reports.',
  },
  {
    target: 'side-members',
    title: 'Members & roles',
    body: 'Approve join requests, assign leadership roles, and invite members by email.',
  },
  {
    target: 'side-certificates',
    title: 'Verified certificates',
    body: 'Issue beautiful, QR-verifiable certificates to attendees and outgoing leaders — no designer needed.',
  },
  {
    target: 'side-wallet',
    title: 'Ticket money',
    body: 'When you sell tickets, earnings land here. Request payouts to your bank once each event takes place.',
  },
  {
    target: 'side-moderation',
    title: 'Keep it healthy',
    body: 'Review reported posts and comments across the communities you manage.',
  },
];

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
      return { label: 'Completed', tone: 'done' };
    case 'ARCHIVED':
      return { label: 'Cancelled', tone: 'done' };
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
  const [stats, setStats] = useState({ totalMembers: 0, eventsHosted: 0, certsIssued: 0, completionRate: 0, verifiedCount: 0, totalRegistrations: 0, totalCheckedIn: 0 });
  const [money, setMoney] = useState<{ earnedNgn: number; availableNgn: number; heldNgn: number; paidOutNgn: number; ticketsSold: number } | null>(null);
  const [growth, setGrowth] = useState<{ month: string; count: number }[]>([]);
  const [revenueByMonth, setRevenueByMonth] = useState<{ month: string; earnedNgn: number }[]>([]);
  const [attendance, setAttendance] = useState<{ id: string; title: string; registered: number; checkedIn: number; rate: number }[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<DashboardEventItem[]>([]);
  const [showingRecentEvents, setShowingRecentEvents] = useState(false);
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

      // Leadership roles: the reputation stat only counts formal LeadershipRole records,
      // which misses founders — derive from live memberships and take the larger.
      const LEADER_ROLES = ['FOUNDER', 'PRESIDENT', 'VICE_PRESIDENT', 'SECRETARY', 'TREASURER', 'ORGANIZER', 'COORDINATOR'];
      const activeLeaderships = membershipsRes.memberships.filter(
        (m) => m.community && m.status === 'ACTIVE' && LEADER_ROLES.includes(m.role),
      ).length;

      if (summary) {
        setHeaderStats([
          { label: 'Events attended', value: summary.stats.eventsCompleted },
          { label: 'Certificates earned', value: summary.stats.certificatesEarned },
          { label: 'Communities joined', value: summary.stats.communitiesJoined },
          { label: 'Leadership roles', value: Math.max(summary.stats.leadershipRoles, activeLeaderships) },
        ]);
      } else {
        const joined = membershipsRes.memberships.filter((m) => m.community && m.status !== 'REMOVED' && m.status !== 'LEFT').length;
        setHeaderStats([
          { label: 'Events attended', value: 0 },
          { label: 'Certificates earned', value: 0 },
          { label: 'Communities joined', value: joined },
          { label: 'Leadership roles', value: activeLeaderships },
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

      // Money + member-growth analytics — fire in parallel, each community best-effort.
      void Promise.all(managed.slice(0, 6).map((c) => getCommunityWallet(c._id).then((r) => r.wallet).catch(() => null))).then((wallets) => {
        const got = wallets.filter((w): w is NonNullable<typeof w> => Boolean(w));
        if (!got.length) return;
        setMoney({
          earnedNgn: got.reduce((s, w) => s + w.earnedNgn, 0),
          availableNgn: got.reduce((s, w) => s + w.availableNgn, 0),
          heldNgn: got.reduce((s, w) => s + w.heldNgn, 0),
          paidOutNgn: got.reduce((s, w) => s + w.paidOutNgn, 0),
          ticketsSold: got.reduce((s, w) => s + w.ticketsSold, 0),
        });
        // Revenue trend: bucket the (already-fetched) sales ledgers by month, refunds excluded.
        const byMonth = new Map<string, number>();
        for (const w of got) {
          for (const s of w.sales) {
            if (s.refunded || !s.paidAt) continue;
            const month = s.paidAt.slice(0, 7);
            byMonth.set(month, (byMonth.get(month) ?? 0) + s.earnedNgn);
          }
        }
        const trend = [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-8).map(([month, earnedNgn]) => ({ month, earnedNgn }));
        if (trend.length) setRevenueByMonth(trend);
      });
      void Promise.all(managed.slice(0, 6).map((c) => getCommunityMemberAnalytics(c._id).then((r) => r.analytics).catch(() => null))).then((lists) => {
        const byMonth = new Map<string, number>();
        for (const a of lists) {
          for (const row of a?.joinsByMonth ?? []) byMonth.set(row.month, (byMonth.get(row.month) ?? 0) + row.count);
        }
        const merged = [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([month, count]) => ({ month, count }));
        if (merged.length) setGrowth(merged);
      });

      const totalMembers = managed.reduce((sum, c) => sum + (c.memberCount ?? 0), 0);
      const certsIssued = allEvents.reduce((sum, e) => sum + (e.certificatesIssued ?? 0), 0);
      const totalRegistrations = allEvents.reduce((sum, e) => sum + (e.registrationCount ?? 0), 0);
      const totalCheckedIn = allEvents.reduce((sum, e) => sum + (e.checkedInCount ?? 0), 0);
      const totalCompleted = allEvents.reduce((sum, e) => sum + (e.completedCount ?? 0), 0);
      const completionRate = totalRegistrations ? Math.round((totalCompleted / totalRegistrations) * 100) : 0;
      const verifiedCount = managed.filter((c) => c.verificationStatus === 'VERIFIED').length;
      setStats({ totalMembers, eventsHosted: allEvents.length, certsIssued, completionRate, verifiedCount, totalRegistrations, totalCheckedIn });

      // Per-event attendance: last 8 events that had any registrations, oldest → newest.
      setAttendance(
        allEvents
          .filter((e) => (e.registrationCount ?? 0) > 0)
          .sort((a, b) => new Date(a.startDate ?? a.createdAt).getTime() - new Date(b.startDate ?? b.createdAt).getTime())
          .slice(-8)
          .map((e) => ({
            id: e._id,
            title: e.title,
            registered: e.registrationCount ?? 0,
            checkedIn: e.checkedInCount ?? 0,
            rate: e.registrationCount ? Math.round(((e.checkedInCount ?? 0) / e.registrationCount) * 100) : 0,
          })),
      );

      const now = Date.now();
      const upcoming = allEvents
        .filter((e) => e.startDate && new Date(e.startDate).getTime() >= now && e.status !== 'ARCHIVED')
        .sort((a, b) => new Date(a.startDate as string).getTime() - new Date(b.startDate as string).getTime());
      const fallbackRecent = allEvents
        .slice()
        .sort((a, b) => new Date(b.startDate ?? b.createdAt).getTime() - new Date(a.startDate ?? a.createdAt).getTime());
      const eventSource = (upcoming.length ? upcoming : fallbackRecent).slice(0, 4);
      setShowingRecentEvents(!upcoming.length && fallbackRecent.length > 0);
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
            finished: e.status === 'COMPLETED' || e.status === 'ARCHIVED',
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
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-100 dark:bg-indigo-500/15 dark:text-indigo-300 dark:ring-indigo-500/30">
            <Building2 className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-center text-xl font-semibold text-slate-950 dark:text-white">Community Mode is approval-only</h1>
          {access.status === 'PENDING' ? (
            <div className="text-center">
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Your request is <span className="font-semibold text-amber-600">pending review</span>. An admin will verify and approve your access shortly — you&apos;ll get a notification.</p>
              <span className="mt-4 inline-block rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">Awaiting approval</span>
            </div>
          ) : (
            <>
              <p className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">
                {access.status === 'REJECTED'
                  ? 'Your previous request was not approved. Verify your school email (or explain your role below) and submit a new request.'
                  : 'To create and manage communities, events, and certificates, verify your school email and request access. No school email (ambassadors, organization leaders)? Explain your role in the note instead — an admin reviews every request.'}
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
                        className="whitespace-nowrap rounded-xl border border-indigo-200 bg-indigo-50 px-4 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-60 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20"
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
                  <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-700 ring-1 ring-inset ring-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-500/30">
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
                    placeholder={emailVerified
                      ? 'Which community or club do you lead? What do you plan to organize?'
                      : 'No school email? Tell us your role (e.g. student ambassador, organization leader), which community you represent, and how we can confirm it.'}
                    className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                  {!emailVerified ? (
                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Without a verified school email, a detailed note (at least 30 characters) is required for admin review.</p>
                  ) : null}
                </div>

                {formError && <p className="text-sm font-medium text-rose-600">{formError}</p>}

                <button
                  onClick={() => void requestAccess()}
                  disabled={requesting || (!emailVerified && note.trim().length < 30)}
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
      <Tour steps={LEADER_TOUR} storageKey="guildos-tour-leader-v1" />
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
          <DashboardStatCard title="Events Hosted" value={String(stats.eventsHosted)} change={`${stats.totalRegistrations.toLocaleString('en-NG')} registered · ${stats.totalCheckedIn.toLocaleString('en-NG')} checked in`} trend="up" icon={<CalendarDays className="h-5 w-5" />} />
          <DashboardStatCard title="Certificates Issued" value={stats.certsIssued.toLocaleString('en-NG')} change={`${stats.completionRate}% completion rate`} trend="up" icon={<Award className="h-5 w-5" />} />
        </div>

        {money ? (
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
                <Ticket className="h-5 w-5 text-indigo-500" /> Ticket Revenue
              </h2>
              <Link href="/dashboard/wallet" className="text-sm font-medium text-indigo-600 hover:underline">Open wallet</Link>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Total earned</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-slate-950 dark:text-white">₦{money.earnedNgn.toLocaleString('en-NG')}</p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{money.ticketsSold.toLocaleString('en-NG')} ticket{money.ticketsSold === 1 ? '' : 's'} sold</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Available</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">₦{money.availableNgn.toLocaleString('en-NG')}</p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Ready to withdraw</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">On hold</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">₦{money.heldNgn.toLocaleString('en-NG')}</p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Released when events take place</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Paid out</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-slate-950 dark:text-white">₦{money.paidOutNgn.toLocaleString('en-NG')}</p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Transferred to your bank</p>
              </div>
            </div>
          </section>
        ) : null}

        {managedCommunities.length ? (
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold tracking-tight text-slate-950 dark:text-white">Your Communities</h2>
              <Link href="/dashboard/communities" className="text-sm font-medium text-indigo-600 hover:underline">Manage all</Link>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {managedCommunities.map((c) => (
                <Link key={c._id} href={`/communities/${c.slug}`} className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 transition hover:border-indigo-300 hover:bg-slate-50/70 dark:hover:border-indigo-500/50 dark:hover:bg-slate-800/50">
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
          <DashboardUpcomingEvents events={upcomingEvents} showingRecent={showingRecentEvents} />
          <DashboardActivityFeed activities={activity} />
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          {revenueByMonth.length ? (
            <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
              <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
                <Wallet className="h-5 w-5 text-emerald-500" /> Revenue Trend
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Your earnings per month from ticket sales (after commission, refunds excluded).</p>
              <div className="mt-5 flex h-36 items-end gap-1.5">
                {revenueByMonth.map((r) => {
                  const max = Math.max(...revenueByMonth.map((x) => x.earnedNgn), 1);
                  return (
                    <div key={r.month} className="group flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${r.month}: ₦${r.earnedNgn.toLocaleString('en-NG')}`}>
                      <span className="text-[10px] font-semibold tabular-nums text-slate-500 opacity-0 transition group-hover:opacity-100 dark:text-slate-400">₦{r.earnedNgn.toLocaleString('en-NG')}</span>
                      <div
                        className={`w-full rounded-t-md transition ${r.earnedNgn > 0 ? 'bg-emerald-500/80 group-hover:bg-emerald-500' : 'bg-slate-200 dark:bg-slate-800'}`}
                        style={{ height: `${r.earnedNgn > 0 ? Math.max(10, Math.round((r.earnedNgn / max) * 82)) : 3}%` }}
                      />
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">{r.month.slice(5)}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}
          {attendance.length ? (
            <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
              <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
                <CheckCircle2 className="h-5 w-5 text-indigo-500" /> Event Attendance
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Check-in rate per event — who registered vs who actually showed up.</p>
              <div className="mt-4 space-y-3">
                {attendance.map((a) => (
                  <div key={a.id} title={`${a.title}: ${a.checkedIn} of ${a.registered} checked in`}>
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="truncate font-medium text-slate-700 dark:text-slate-300">{a.title}</span>
                      <span className="shrink-0 tabular-nums text-slate-500 dark:text-slate-400">{a.checkedIn}/{a.registered} · {a.rate}%</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className={`h-full rounded-full ${a.rate >= 60 ? 'bg-emerald-500' : a.rate >= 30 ? 'bg-amber-500' : 'bg-rose-400'}`} style={{ width: `${Math.max(a.rate, 2)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          {growth.length ? (
            <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
              <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
                <BarChart3 className="h-5 w-5 text-indigo-500" /> Member Growth
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">New members per month across the communities you lead.</p>
              <div className="mt-5 flex h-36 items-end gap-1.5">
                {growth.map((g) => {
                  const max = Math.max(...growth.map((x) => x.count), 1);
                  return (
                    <div key={g.month} className="group flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${g.month}: ${g.count} joined`}>
                      <span className="text-[10px] font-semibold tabular-nums text-slate-500 opacity-0 transition group-hover:opacity-100 dark:text-slate-400">{g.count}</span>
                      <div
                        className={`w-full rounded-t-md transition ${g.count > 0 ? 'bg-indigo-500/80 group-hover:bg-indigo-500' : 'bg-slate-200 dark:bg-slate-800'}`}
                        style={{ height: `${g.count > 0 ? Math.max(10, Math.round((g.count / max) * 82)) : 3}%` }}
                      />
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">{g.month.slice(5)}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}
          <DashboardCommunityHealth metrics={healthMetrics} status={healthStatus} tone={healthTone} />
        </div>
        <MediaPreviewDialog preview={mediaPreview} onClose={() => setMediaPreview(null)} />
      </section>
    </DashboardShell>
  );
}
