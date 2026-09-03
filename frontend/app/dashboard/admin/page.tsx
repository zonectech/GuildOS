'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Briefcase, Flag, BarChart3, RefreshCw, Building2, Loader2, ArrowRight, AlertTriangle, UsersRound } from 'lucide-react';

import { getCurrentUser } from '../../../components/guildos/auth-api';
import { navigateBack } from '../../../components/guildos/back-navigation';
import { SectionHeader } from '../../../components/guildos/ui/section-header';
import { getPendingCommunities, type PendingCommunity, getAdminLoginTrafficSummary, type LoginTrafficSummary } from '../../../components/guildos/admin-api';
import { getPendingRecruiters, type PendingRecruiter } from '../../../components/guildos/recruiter-api';
import { getModerationQueue, syncOpportunities, type ModerationOpportunity } from '../../../components/guildos/opportunity-api';
import { seedDemoData } from '../../../components/guildos/admin-api';
import { getPendingCommunityAccess, type CommunityAccessRequest } from '../../../components/guildos/community-access-api';
import { confirmDialog } from '../../../components/guildos/ui/confirm-dialog';
import { Loading } from '../../../components/guildos/ui/loading';
import { getWatchtowerSummary, type WatchtowerSummary } from '../../../components/guildos/admin-watchtower-api';

type Queues = {
  communities: PendingCommunity[];
  recruiters: PendingRecruiter[];
  opportunities: ModerationOpportunity[];
  access: CommunityAccessRequest[];
};

export default function AdminConsolePage() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'denied' | 'ready'>('loading');
  const [adminName, setAdminName] = useState('');
  const [queues, setQueues] = useState<Queues>({ communities: [], recruiters: [], opportunities: [], access: [] });
  const [watch, setWatch] = useState<WatchtowerSummary | null>(null);
  const [loginTraffic, setLoginTraffic] = useState<LoginTrafficSummary | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState('');
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const user = await getCurrentUser();
      if (cancelled) return;
      if (!user) {
        router.replace('/login');
        return;
      }
      if (user.role !== 'ADMIN') {
        setStatus('denied');
        return;
      }
      setAdminName(user.fullName);
      const [c, r, o] = await Promise.allSettled([getPendingCommunities(), getPendingRecruiters(), getModerationQueue()]);
      if (cancelled) return;
      setQueues({
        communities: c.status === 'fulfilled' ? c.value.communities : [],
        recruiters: r.status === 'fulfilled' ? r.value.recruiters : [],
        opportunities: o.status === 'fulfilled' ? o.value.opportunities : [],
        access: [],
      });
      getPendingCommunityAccess().then((a) => setQueues((q) => ({ ...q, access: a.requests }))).catch(() => undefined);
      getWatchtowerSummary().then((w) => setWatch(w.summary)).catch(() => undefined);
      getAdminLoginTrafficSummary().then((res) => setLoginTraffic(res.summary)).catch(() => undefined);
      setStatus('ready');
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function runSync() {
    try {
      setSyncing(true);
      setSyncNote('');
      const res = await syncOpportunities();
      setSyncNote(`Sync complete — ${res.created} created, ${res.updated} updated.`);
      const o = await getModerationQueue().catch(() => ({ opportunities: [] as ModerationOpportunity[] }));
      setQueues((q) => ({ ...q, opportunities: o.opportunities }));
    } catch (err) {
      setSyncNote(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  async function runSeed() {
    if (!(await confirmDialog({ title: 'Seed demo data?', message: 'Adds demo communities, events, a recruiter, opportunities, and posts. Safe to run once.', confirmLabel: 'Seed' }))) return;
    try {
      setSeeding(true);
      setSyncNote('');
      const { summary } = await seedDemoData();
      setSyncNote(
        summary.alreadySeeded
          ? 'Demo data already exists — nothing to add.'
          : `Demo data seeded — ${summary.students} students, ${summary.communities} communities, ${summary.events} events, ${summary.opportunities} opportunities, ${summary.posts} posts.`,
      );
    } catch (err) {
      setSyncNote(err instanceof Error ? err.message : 'Seed failed');
    } finally {
      setSeeding(false);
    }
  }

  if (status === 'loading') {
    return <div className="flex items-center justify-center rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-16 shadow-sm"><Loading /></div>;
  }

  if (status === 'denied') {
    return (
      <div className="mx-auto max-w-md rounded-3xl border border-amber-200 bg-amber-50 p-8 text-center shadow-sm dark:border-amber-500/30 dark:bg-amber-950/40">
        <AlertTriangle className="mx-auto h-8 w-8 text-amber-600" />
        <h2 className="mt-3 text-lg font-semibold text-amber-900">Admins only</h2>
        <p className="mt-1 text-sm text-amber-800">You don&apos;t have permission to view the admin console.</p>
        <button onClick={() => navigateBack(router, '/home')} className="mt-4 inline-block rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">Back to Student Home</button>
      </div>
    );
  }

  const pendingOpps = queues.opportunities.filter((o) => (o.moderationStatus ?? 'PENDING_REVIEW') === 'PENDING_REVIEW');

  const stats = [
    { label: 'Pending communities', value: queues.communities.length, href: '/dashboard/admin/verification', icon: <Building2 className="h-5 w-5" />, tone: 'indigo' },
    { label: 'Pending recruiters', value: queues.recruiters.length, href: '/dashboard/admin/recruiters', icon: <Briefcase className="h-5 w-5" />, tone: 'sky' },
    { label: 'Opportunities to review', value: pendingOpps.length, href: '/dashboard/admin/moderation', icon: <Flag className="h-5 w-5" />, tone: 'amber' },
    { label: 'Open review items', value: queues.communities.length + queues.recruiters.length + pendingOpps.length, href: '#queues', icon: <ShieldCheck className="h-5 w-5" />, tone: 'emerald' },
  ];

  const loginStats = [
    { label: 'Logins last 24h', value: loginTraffic?.totalLoginsLast24Hours ?? 0 },
    { label: 'Current active', value: loginTraffic?.activeSessions ?? 0 },
    { label: 'Unique users', value: loginTraffic?.uniqueUsers ?? 0 },
  ];

  const toneRing: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-600 ring-indigo-100 dark:bg-indigo-500/15 dark:text-indigo-300 dark:ring-indigo-500/30',
    sky: 'bg-sky-50 text-sky-600 ring-sky-100 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/30',
    amber: 'bg-amber-50 text-amber-600 ring-amber-100 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30',
    emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30',
  };

  const tools = [
    { title: 'Watchtower', desc: 'Automated trust & safety monitoring — flags suspicious communities, endorsements, and bursts.', href: '/dashboard/admin/watchtower', icon: <AlertTriangle className="h-5 w-5" />, count: watch?.high ?? null },
    { title: 'Community verification', desc: 'Review and approve/reject communities awaiting verification.', href: '/dashboard/admin/verification', icon: <Building2 className="h-5 w-5" />, count: queues.communities.length },
    { title: 'Recruiter verification', desc: 'Approve recruiter accounts and company details.', href: '/dashboard/admin/recruiters', icon: <Briefcase className="h-5 w-5" />, count: queues.recruiters.length },
    { title: 'Opportunity moderation', desc: 'Verify, flag, or archive opportunity listings.', href: '/dashboard/admin/moderation', icon: <Flag className="h-5 w-5" />, count: pendingOpps.length },
    { title: 'Content moderation', desc: 'Review reported posts and comments from the community feed.', href: '/dashboard/admin/content', icon: <Flag className="h-5 w-5" />, count: null },
    { title: 'Community access', desc: 'Approve who can enter Community Mode and manage communities.', href: '/dashboard/admin/community-access', icon: <Building2 className="h-5 w-5" />, count: queues.access.length },
    { title: 'Communities', desc: 'Suspend or restore verified communities across the platform.', href: '/dashboard/admin/communities', icon: <Building2 className="h-5 w-5" />, count: null },
    { title: 'Messages', desc: 'Send notifications and branded emails to everyone, a role, or one specific user.', href: '/dashboard/admin/broadcast', icon: <ShieldCheck className="h-5 w-5" />, count: null },
    { title: 'Users & roles', desc: 'Search accounts and assign Student, Leader, Recruiter, or Admin roles.', href: '/dashboard/admin/users', icon: <UsersRound className="h-5 w-5" />, count: null },
    { title: 'Reports & analytics', desc: 'Platform-wide trends across attendance, events, and growth.', href: '/dashboard/admin/reports', icon: <BarChart3 className="h-5 w-5" />, count: null },
    { title: 'Audit log', desc: 'Full history of every administrator action.', href: '/dashboard/admin/audit', icon: <ShieldCheck className="h-5 w-5" />, count: null },
  ];

  return (
    <section className="grid gap-6">
        <SectionHeader
          eyebrow="Admin Console"
          title={`Platform administration`}
          subtitle={`Welcome, ${adminName}. Review verification queues, moderate listings, and manage platform operations.`}
          action={
            <div className="flex flex-wrap gap-2">
              <button onClick={() => navigateBack(router, '/home')} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800">
                Student Home
              </button>
              <button onClick={() => void runSeed()} disabled={seeding} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60">
                {seeding ? 'Seeding…' : 'Seed demo data'}
              </button>
              <button onClick={() => void runSync()} disabled={syncing} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60">
                <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} /> {syncing ? 'Syncing…' : 'Sync opportunities'}
              </button>
            </div>
          }
        />

        {watch && watch.high > 0 ? (
          <Link href="/dashboard/admin/watchtower" className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 transition hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-950/50 dark:text-rose-300 dark:hover:bg-rose-500/20">
            <span className="flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4" /> Watchtower: {watch.high} high-risk signal{watch.high === 1 ? '' : 's'} need review
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-semibold">Open <ArrowRight className="h-3.5 w-3.5" /></span>
          </Link>
        ) : null}

        {syncNote ? <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2 text-sm text-slate-600 dark:text-slate-400 shadow-sm">{syncNote}</div> : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {stats.map((s) => (
            <Link key={s.label} href={s.href} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition hover:border-slate-300 dark:hover:border-slate-600">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{s.label}</p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">{s.value}</p>
                </div>
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ring-1 ring-inset ${toneRing[s.tone]}`}>{s.icon}</div>
              </div>
            </Link>
          ))}
        </div>

        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-950 dark:text-white">Login traffic</h2>
            <Link href="/dashboard/admin/reports" className="text-xs font-medium text-indigo-600 hover:underline">Open reports</Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {loginStats.map((item) => (
              <div key={item.label} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-4 dark:border-slate-800 dark:bg-slate-950">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{item.label}</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{item.value}</p>
              </div>
            ))}
          </div>
          {loginTraffic && loginTraffic.users.length > 0 ? (
            <div className="mt-4 space-y-2">
              {loginTraffic.users.slice(0, 4).map((user) => (
                <div key={user.userId} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2 dark:border-slate-800">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{user.email || 'Unknown user'}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{user.loginCount} login{user.loginCount === 1 ? '' : 's'} · {user.role}</p>
                  </div>
                  <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : '—'}</span>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          {tools.map((t) => (
            <Link key={t.title} href={t.href} className="group flex items-start gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition hover:border-indigo-300">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300">{t.icon}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-slate-950 dark:text-white">{t.title}</h3>
                  {t.count ? <span className="shrink-0 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">{t.count} pending</span> : null}
                </div>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t.desc}</p>
              </div>
              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-indigo-500" />
            </Link>
          ))}
        </div>

        <div id="queues" className="grid gap-6 xl:grid-cols-3">
          <QueueCard title="Communities" href="/dashboard/admin/verification" empty="No communities awaiting verification.">
            {queues.communities.slice(0, 5).map((c) => (
              <QueueRow key={c._id} primary={c.name} secondary={`${c.university || '—'} · ${c.category || '—'}`} />
            ))}
          </QueueCard>

          <QueueCard title="Recruiters" href="/dashboard/admin/recruiters" empty="No recruiters awaiting verification.">
            {queues.recruiters.slice(0, 5).map((r) => (
              <QueueRow key={r.userId} primary={r.fullName} secondary={[r.company, r.position].filter(Boolean).join(' · ') || r.email} />
            ))}
          </QueueCard>

          <QueueCard title="Opportunities" href="/dashboard/admin/moderation" empty="No opportunities to review.">
            {pendingOpps.slice(0, 5).map((o) => (
              <QueueRow key={o.id} primary={o.title} secondary={[o.organization, o.source].filter(Boolean).join(' · ')} />
            ))}
          </QueueCard>
        </div>
      </section>
  );
}

function QueueCard({ title, href, empty, children }: { title: string; href: string; empty: string; children: React.ReactNode }) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children;
  const isEmpty = Array.isArray(items) ? items.length === 0 : !items;
  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-950 dark:text-white">{title}</h2>
        <Link href={href} className="text-xs font-medium text-indigo-600 hover:underline">Open</Link>
      </div>
      <div className="mt-3 space-y-2">
        {isEmpty ? <p className="text-sm text-slate-500 dark:text-slate-400">{empty}</p> : items}
      </div>
    </section>
  );
}

function QueueRow({ primary, secondary }: { primary: string; secondary: string }) {
  return (
    <div className="rounded-xl border border-slate-100 px-3 py-2">
      <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{primary}</p>
      <p className="truncate text-xs text-slate-500 dark:text-slate-400">{secondary}</p>
    </div>
  );
}
