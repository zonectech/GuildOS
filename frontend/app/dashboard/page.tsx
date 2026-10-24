'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Award, BadgeCheck, BarChart3, Building2, CalendarDays, CalendarPlus, CheckCircle2, CircleDot, FileEdit, Flag, ImagePlus, Mail, Megaphone, Pencil, ScanLine, Ticket, UserPlus, Users, Wallet } from 'lucide-react';

import { getCurrentUser } from '../../components/guildos/auth-api';
import { navigateBack } from '../../components/guildos/back-navigation';
import { DashboardShell } from '../../components/guildos/dashboard-shell';
import { Tour, type TourStep } from '../../components/guildos/ui/tour';
import { DashboardSidebar } from '../../components/guildos/dashboard-sidebar';
import { DashboardTopbar } from '../../components/guildos/dashboard-topbar';
import { DashboardStatCard } from '../../components/guildos/dashboard-stat-card';
import { DashboardUpcomingEvents, type DashboardEventItem } from '../../components/guildos/dashboard-upcoming-events';
import { DashboardActivityFeed, type DashboardActivityItem } from '../../components/guildos/dashboard-activity-feed';
import { DashboardSkeleton } from '../../components/guildos/dashboard-skeleton';
import { SectionHeader } from '../../components/guildos/ui/section-header';
import { AttentionPanel, ManagedCommunitiesPanel, QuickActions, type AttentionItem, type QuickAction } from '../../components/guildos/dashboard/organizer-panels';
import { statusShareHref } from '../../components/guildos/status-store';
import { getManagedCommunities, getCommunityActivity, getCommunityJoinRequests, getCommunityMemberAnalytics, getCommunityModerationReports, getCommunityWallet, type CommunitySummary } from '../../components/guildos/community-list-api';
import { listManagedEvents, type EventSummary } from '../../components/guildos/event-api';
import { getMyCommunityAccess, requestCommunityAccess, sendSchoolEmailCode, verifySchoolEmailCode } from '../../components/guildos/community-access-api';

/** First-run walkthrough for community leaders — shown once on the dashboard. */
const LEADER_TOUR: TourStep[] = [
  {
    title: 'Welcome to Community Mode',
    body: 'This is your operations dashboard. Everything you need to run a community lives here. Quick tour?',
  },
  {
    target: 'side-communities',
    title: 'Your communities',
    body: 'Create and manage your community pages: profile, verification, leadership roster and premium.',
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
    body: 'Issue beautiful, QR-verifiable certificates to attendees and outgoing leaders. No designer needed.',
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

export default function DashboardPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [firstName, setFirstName] = useState('there');
  const [allEvents, setAllEvents] = useState<EventSummary[]>([]);
  // Pending join requests and open reports per community id (feeds "Needs your attention").
  const [joinRequests, setJoinRequests] = useState<Record<string, number>>({});
  const [reports, setReports] = useState<Record<string, number>>({});
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

  useEffect(() => {
    const load = async () => {
      const user = await getCurrentUser();
      if (!user) {
        router.replace('/login');
        return;
      }

      setFirstName(user.fullName.split(' ')[0] || 'there');

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

      const communitiesRes = await getManagedCommunities().catch(() => ({ communities: [] as CommunitySummary[] }));

      const communityById = new Map(communitiesRes.communities.map((c) => [c._id, c] as const));
      // The /managed endpoint already returns only the communities this user leads.
      const managed = communitiesRes.communities;
      setManagedCommunities(managed);

      const eventLists = await Promise.all(
        managed.slice(0, 6).map((c) => listManagedEvents(c._id).then((r) => r.events).catch(() => [] as EventSummary[])),
      );
      const allEvents = eventLists.flat();
      setAllEvents(allEvents);

      // Requests and reports waiting on the organizer, best-effort per community.
      void Promise.all(managed.slice(0, 6).map((c) => getCommunityJoinRequests(c._id).then((r) => [c._id, r.joinRequests.filter((j) => j.status === 'PENDING').length] as const).catch(() => [c._id, 0] as const)))
        .then((rows) => setJoinRequests(Object.fromEntries(rows)));
      void Promise.all(managed.slice(0, 6).map((c) => getCommunityModerationReports(c._id).then((r) => [c._id, r.posts.length + r.comments.length] as const).catch(() => [c._id, 0] as const)))
        .then((rows) => setReports(Object.fromEntries(rows)));

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
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Your request is <span className="font-semibold text-amber-600">pending review</span>. An admin will verify and approve your access shortly, and you&apos;ll get a notification.</p>
              <span className="mt-4 inline-block rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">Awaiting approval</span>
            </div>
          ) : (
            <>
              <p className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">
                {access.status === 'REJECTED'
                  ? 'Your previous request was not approved. Verify your school email (or explain your role below) and submit a new request.'
                  : 'To create and manage communities, events, and certificates, verify your school email and request access. No school email (ambassadors, organization leaders)? Explain your role in the note instead. An admin reviews every request.'}
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
  const communityName = (id: string) => managedCommunities.find((c) => c._id === id)?.name ?? 'your community';
  const primaryCommunity = managedCommunities[0];

  // Everything the organizer should act on, built from data already on the page.
  const today = new Date().toDateString();
  const isToday = (value: string | null) => Boolean(value) && new Date(value as string).toDateString() === today;
  const liveEvents = allEvents.filter((e) => e.status === 'CHECK_IN' || e.status === 'CHECK_OUT' || (isToday(e.startDate) && e.status === 'PUBLISHED'));
  const nextEvent = liveEvents[0]
    ?? allEvents
      .filter((e) => e.startDate && new Date(e.startDate).getTime() >= Date.now() && e.status !== 'ARCHIVED' && e.status !== 'DRAFT')
      .sort((a, b) => new Date(a.startDate as string).getTime() - new Date(b.startDate as string).getTime())[0];

  const attention: AttentionItem[] = [];
  for (const e of liveEvents) {
    attention.push({ id: `live-${e._id}`, tone: 'urgent', icon: <ScanLine className="h-5 w-5" />, title: `${e.title} is happening today`, detail: `${e.checkedInCount ?? 0} of ${e.registrationCount ?? 0} checked in so far`, href: `/dashboard/events/scanner?eventId=${e._id}`, cta: 'Open scanner' });
  }
  for (const [communityId, count] of Object.entries(joinRequests)) {
    if (count > 0) attention.push({ id: `join-${communityId}`, tone: 'urgent', icon: <UserPlus className="h-5 w-5" />, title: `${count} ${count === 1 ? 'person wants' : 'people want'} to join ${communityName(communityId)}`, detail: 'They can’t see member-only content until you approve them', href: '/dashboard/members', cta: 'Review' });
  }
  for (const [communityId, count] of Object.entries(reports)) {
    if (count > 0) attention.push({ id: `report-${communityId}`, tone: 'urgent', icon: <Flag className="h-5 w-5" />, title: `${count} reported ${count === 1 ? 'post' : 'posts'} in ${communityName(communityId)}`, detail: 'Members flagged these for review', href: '/dashboard/moderation', cta: 'Moderate' });
  }
  for (const e of allEvents) {
    const pendingCerts = (e.completedCount ?? 0) - (e.certificatesIssued ?? 0);
    if (e.certificateEnabled && e.status === 'COMPLETED' && pendingCerts > 0) {
      attention.push({ id: `certs-${e._id}`, tone: 'todo', icon: <Award className="h-5 w-5" />, title: `Send certificates for ${e.title}`, detail: `${pendingCerts} ${pendingCerts === 1 ? 'attendee is' : 'attendees are'} waiting for theirs`, href: '/dashboard/certificates', cta: 'Issue' });
    }
    if (e.status === 'DRAFT') {
      attention.push({ id: `draft-${e._id}`, tone: 'todo', icon: <FileEdit className="h-5 w-5" />, title: `${e.title} is still a draft`, detail: 'Students can’t find or register for it until you publish', href: `/dashboard/events/create?communityId=${e.communityId}&slug=${e.slug}`, cta: 'Finish & publish' });
    }
    const daysOut = e.startDate ? (new Date(e.startDate).getTime() - Date.now()) / 86400000 : -1;
    if (e.status === 'PUBLISHED' && daysOut > 0 && daysOut <= 3 && (e.registrationCount ?? 0) === 0) {
      attention.push({ id: `empty-${e._id}`, tone: 'info', icon: <Megaphone className="h-5 w-5" />, title: `No one has registered for ${e.title} yet`, detail: 'It starts in under 3 days. Share it on status or in your chat groups', href: statusShareHref({ asCommunity: e.communityId, attach: { type: 'EVENT', id: e._id } }), cta: 'Share' });
    }
  }
  for (const c of managedCommunities) {
    if (c.verificationStatus !== 'VERIFIED') {
      attention.push({ id: `verify-${c._id}`, tone: 'todo', icon: <BadgeCheck className="h-5 w-5" />, title: c.verificationStatus === 'PENDING' ? `${c.name} is waiting for verification` : `${c.name} isn’t verified`, detail: c.verificationStatus === 'PENDING' ? 'An admin is reviewing it. You’ll get a notification when it’s done' : 'Until it is, you can’t issue certificates and members don’t earn Guild Score', href: '/dashboard/communities', cta: 'View' });
    }
    if (!c.coverImage || !(c.gallery?.length)) {
      attention.push({ id: `page-${c._id}`, tone: 'info', icon: <ImagePlus className="h-5 w-5" />, title: `Finish ${c.name}’s page`, detail: !c.coverImage ? 'Add a cover image so the community stands out in the directory' : 'Add photos so students see what your community is like', href: `/dashboard/communities/${c.slug}/edit`, cta: 'Edit page' });
    }
  }
  if (money && money.availableNgn > 0) {
    attention.push({ id: 'payout', tone: 'info', icon: <Wallet className="h-5 w-5" />, title: `₦${money.availableNgn.toLocaleString('en-NG')} ready to withdraw`, detail: 'Ticket earnings from events that have taken place', href: '/dashboard/wallet', cta: 'Withdraw' });
  }

  const quickActions: QuickAction[] = [
    { label: 'Create event', hint: 'Workshops, hackathons, meetups', href: '/dashboard/events/create', icon: <CalendarPlus className="h-5 w-5" />, primary: true },
    nextEvent
      ? { label: 'Scan tickets', hint: nextEvent.title, href: `/dashboard/events/scanner?eventId=${nextEvent._id}`, icon: <ScanLine className="h-5 w-5" /> }
      : { label: 'Scan tickets', hint: 'Check people in at the door', href: '/dashboard/events', icon: <ScanLine className="h-5 w-5" /> },
    { label: 'Issue certificates', hint: 'For attendees and leaders', href: '/dashboard/certificates', icon: <Award className="h-5 w-5" /> },
    { label: 'Post a status', hint: primaryCommunity ? `As ${primaryCommunity.name}` : 'Share an update', href: primaryCommunity ? `/status/new?as=${primaryCommunity._id}` : '/status/new', icon: <CircleDot className="h-5 w-5" /> },
    { label: 'Invite members', hint: 'Approve, invite, assign roles', href: '/dashboard/members', icon: <UserPlus className="h-5 w-5" /> },
    primaryCommunity
      ? { label: 'Edit community', hint: 'Logo, cover, photos, links', href: `/dashboard/communities/${primaryCommunity.slug}/edit`, icon: <Pencil className="h-5 w-5" /> }
      : { label: 'New community', hint: 'Start your first one', href: '/dashboard/communities/create', icon: <Building2 className="h-5 w-5" /> },
  ];

  const hasMoney = Boolean(money && (money.earnedNgn > 0 || money.heldNgn > 0 || money.paidOutNgn > 0));
  const hasInsights = attendance.length > 0 || growth.length > 0 || revenueByMonth.length > 0;

  return (
    <DashboardShell sidebar={<DashboardSidebar />} topbar={<DashboardTopbar />}>
      <Tour steps={LEADER_TOUR} storageKey="guildos-tour-leader-v1" />
      <section className="grid min-w-0 grid-cols-1 gap-6">
        <SectionHeader
          eyebrow="Community Mode"
          title={`${greeting()}, ${firstName}`}
          subtitle={communityCount ? `Here’s what’s happening across ${communityCount === 1 ? managedCommunities[0].name : `your ${communityCount} communities`} today.` : 'Start your first community to host events and issue certificates.'}
          action={
            <div className="flex flex-wrap gap-3">
              <Link href="/dashboard/communities/create" className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800">
                New community
              </Link>
              <Link href="/dashboard/events/create" className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700">
                Create event
              </Link>
            </div>
          }
        />

        {communityCount === 0 ? (
          <section className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-6 shadow-sm dark:border-indigo-500/30 dark:from-indigo-950/50 dark:to-slate-900">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Create your community to get started</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-300">Set up your page, get verified with a school email or endorsement letter, then host your first event. Members check in with a QR pass and leave with a verified certificate.</p>
            <Link href="/dashboard/communities/create" className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
              <Building2 className="h-4 w-4" /> Create a community
            </Link>
          </section>
        ) : null}

        <QuickActions actions={quickActions} />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_0.9fr]">
          <AttentionPanel items={attention} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DashboardStatCard title="Members" value={stats.totalMembers.toLocaleString('en-NG')} change={`Across ${communityCount} ${communityCount === 1 ? 'community' : 'communities'}`} trend="up" icon={<Users className="h-5 w-5" />} />
            <DashboardStatCard title="Events" value={String(stats.eventsHosted)} change={`${stats.totalRegistrations.toLocaleString('en-NG')} registered`} trend="up" icon={<CalendarDays className="h-5 w-5" />} />
            <DashboardStatCard title="Checked in" value={stats.totalCheckedIn.toLocaleString('en-NG')} change={stats.totalRegistrations ? `${Math.round((stats.totalCheckedIn / stats.totalRegistrations) * 100)}% of registrations` : 'No registrations yet'} trend="up" icon={<ScanLine className="h-5 w-5" />} />
            <DashboardStatCard title="Certificates" value={stats.certsIssued.toLocaleString('en-NG')} change={`${stats.completionRate}% completion rate`} trend="up" icon={<Award className="h-5 w-5" />} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_0.9fr]">
          <DashboardUpcomingEvents events={upcomingEvents} showingRecent={showingRecentEvents} />
          <div className="grid min-w-0 grid-cols-1 content-start gap-6">
            {communityCount ? <ManagedCommunitiesPanel communities={managedCommunities} /> : null}
            <DashboardActivityFeed activities={activity} />
          </div>
        </div>

        {hasMoney && money ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
                <Ticket className="h-5 w-5 text-indigo-500" /> Ticket revenue
              </h2>
              <Link href="/dashboard/wallet" className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">Open wallet</Link>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: 'Total earned', value: money.earnedNgn, note: `${money.ticketsSold.toLocaleString('en-NG')} ticket${money.ticketsSold === 1 ? '' : 's'} sold`, tone: 'text-slate-950 dark:text-white' },
                { label: 'Available', value: money.availableNgn, note: 'Ready to withdraw', tone: 'text-emerald-600 dark:text-emerald-400' },
                { label: 'On hold', value: money.heldNgn, note: 'Released when events take place', tone: 'text-amber-600 dark:text-amber-400' },
                { label: 'Paid out', value: money.paidOutNgn, note: 'Transferred to your bank', tone: 'text-slate-950 dark:text-white' },
              ].map((m) => (
                <div key={m.label} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{m.label}</p>
                  <p className={`mt-1 text-2xl font-bold tabular-nums ${m.tone}`}>₦{m.value.toLocaleString('en-NG')}</p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{m.note}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {hasInsights ? (
          <>
            <h2 className="-mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <BarChart3 className="h-4 w-4" /> Insights
            </h2>
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              {attendance.length ? (
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
                    <CheckCircle2 className="h-5 w-5 text-indigo-500" /> Event attendance
                  </h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Who registered vs who actually showed up.</p>
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
              {growth.length ? <BarTrend title="Member growth" subtitle="New members per month across the communities you lead." icon={<Users className="h-5 w-5 text-indigo-500" />} bars={growth.map((g) => ({ key: g.month, value: g.count, label: String(g.count) }))} tone="indigo" /> : null}
              {revenueByMonth.length ? <BarTrend title="Revenue trend" subtitle="Your earnings per month from ticket sales (after commission, refunds excluded)." icon={<Wallet className="h-5 w-5 text-emerald-500" />} bars={revenueByMonth.map((r) => ({ key: r.month, value: r.earnedNgn, label: `₦${r.earnedNgn.toLocaleString('en-NG')}` }))} tone="emerald" /> : null}
            </div>
          </>
        ) : null}
      </section>
    </DashboardShell>
  );
}

function BarTrend({ title, subtitle, icon, bars, tone }: { title: string; subtitle: string; icon: ReactNode; bars: { key: string; value: number; label: string }[]; tone: 'indigo' | 'emerald' }) {
  const max = Math.max(...bars.map((b) => b.value), 1);
  const fill = tone === 'indigo' ? 'bg-indigo-500/80 group-hover:bg-indigo-500' : 'bg-emerald-500/80 group-hover:bg-emerald-500';
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-slate-950 dark:text-white">{icon} {title}</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
      <div className="mt-5 flex h-36 items-end gap-1.5">
        {bars.map((b) => (
          <div key={b.key} className="group flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${b.key}: ${b.label}`}>
            <span className="text-[10px] font-semibold tabular-nums text-slate-500 opacity-0 transition group-hover:opacity-100 dark:text-slate-400">{b.label}</span>
            <div className={`w-full rounded-t-md transition ${b.value > 0 ? fill : 'bg-slate-200 dark:bg-slate-800'}`} style={{ height: `${b.value > 0 ? Math.max(10, Math.round((b.value / max) * 82)) : 3}%` }} />
            <span className="text-[10px] text-slate-400 dark:text-slate-500">{b.key.slice(5)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
