'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Briefcase, Flag, BarChart3, RefreshCw, Building2, Loader2, ArrowRight, AlertTriangle, UsersRound } from 'lucide-react';

import { getCurrentUser } from '../../../components/guildos/auth-api';
import { DashboardShell } from '../../../components/guildos/dashboard-shell';
import { DashboardSidebar } from '../../../components/guildos/dashboard-sidebar';
import { DashboardTopbar } from '../../../components/guildos/dashboard-topbar';
import { SectionHeader } from '../../../components/guildos/ui/section-header';
import { getPendingCommunities, type PendingCommunity } from '../../../components/guildos/admin-api';
import { getPendingRecruiters, type PendingRecruiter } from '../../../components/guildos/recruiter-api';
import { getModerationQueue, syncOpportunities, type ModerationOpportunity } from '../../../components/guildos/opportunity-api';
import { seedDemoData } from '../../../components/guildos/admin-api';

type Queues = {
  communities: PendingCommunity[];
  recruiters: PendingRecruiter[];
  opportunities: ModerationOpportunity[];
};

export default function AdminConsolePage() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'denied' | 'ready'>('loading');
  const [adminName, setAdminName] = useState('');
  const [queues, setQueues] = useState<Queues>({ communities: [], recruiters: [], opportunities: [] });
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
      });
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
    if (!window.confirm('Seed demo communities, events, a recruiter, opportunities, and posts? Safe to run once.')) return;
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
    return (
      <DashboardShell sidebar={<DashboardSidebar />} topbar={<DashboardTopbar />}>
        <div className="flex items-center justify-center rounded-3xl border border-slate-200 bg-white p-16 shadow-sm">
          <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
        </div>
      </DashboardShell>
    );
  }

  if (status === 'denied') {
    return (
      <DashboardShell sidebar={<DashboardSidebar />} topbar={<DashboardTopbar />}>
        <div className="mx-auto max-w-md rounded-3xl border border-amber-200 bg-amber-50 p-8 text-center shadow-sm">
          <AlertTriangle className="mx-auto h-8 w-8 text-amber-600" />
          <h2 className="mt-3 text-lg font-semibold text-amber-900">Admins only</h2>
          <p className="mt-1 text-sm text-amber-800">You don&apos;t have permission to view the admin console.</p>
          <Link href="/dashboard" className="mt-4 inline-block rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">Back to dashboard</Link>
        </div>
      </DashboardShell>
    );
  }

  const pendingOpps = queues.opportunities.filter((o) => (o.moderationStatus ?? 'PENDING_REVIEW') === 'PENDING_REVIEW');

  const stats = [
    { label: 'Pending communities', value: queues.communities.length, href: '/dashboard/verification', icon: <Building2 className="h-5 w-5" />, tone: 'indigo' },
    { label: 'Pending recruiters', value: queues.recruiters.length, href: '/dashboard/recruiters', icon: <Briefcase className="h-5 w-5" />, tone: 'sky' },
    { label: 'Opportunities to review', value: pendingOpps.length, href: '/dashboard/moderation', icon: <Flag className="h-5 w-5" />, tone: 'amber' },
    { label: 'Open review items', value: queues.communities.length + queues.recruiters.length + pendingOpps.length, href: '#queues', icon: <ShieldCheck className="h-5 w-5" />, tone: 'emerald' },
  ];

  const toneRing: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-600 ring-indigo-100',
    sky: 'bg-sky-50 text-sky-600 ring-sky-100',
    amber: 'bg-amber-50 text-amber-600 ring-amber-100',
    emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
  };

  const tools = [
    { title: 'Community verification', desc: 'Review and approve/reject communities awaiting verification.', href: '/dashboard/verification', icon: <Building2 className="h-5 w-5" />, count: queues.communities.length },
    { title: 'Recruiter verification', desc: 'Approve recruiter accounts and company details.', href: '/dashboard/recruiters', icon: <Briefcase className="h-5 w-5" />, count: queues.recruiters.length },
    { title: 'Opportunity moderation', desc: 'Verify, flag, or archive opportunity listings.', href: '/dashboard/moderation', icon: <Flag className="h-5 w-5" />, count: pendingOpps.length },
    { title: 'Users & roles', desc: 'Search accounts and assign Student, Leader, Recruiter, or Admin roles.', href: '/dashboard/admin/users', icon: <UsersRound className="h-5 w-5" />, count: null },
    { title: 'Reports & analytics', desc: 'Platform-wide trends across attendance, events, and growth.', href: '/dashboard/reports', icon: <BarChart3 className="h-5 w-5" />, count: null },
  ];

  return (
    <DashboardShell sidebar={<DashboardSidebar />} topbar={<DashboardTopbar />}>
      <section className="grid gap-6">
        <SectionHeader
          eyebrow="Admin Console"
          title={`Platform administration`}
          subtitle={`Welcome, ${adminName}. Review verification queues, moderate listings, and manage platform operations.`}
          action={
            <div className="flex flex-wrap gap-2">
              <button onClick={() => void runSeed()} disabled={seeding} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60">
                {seeding ? 'Seeding…' : 'Seed demo data'}
              </button>
              <button onClick={() => void runSync()} disabled={syncing} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60">
                <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} /> {syncing ? 'Syncing…' : 'Sync opportunities'}
              </button>
            </div>
          }
        />

        {syncNote ? <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm">{syncNote}</div> : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {stats.map((s) => (
            <Link key={s.label} href={s.href} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-500">{s.label}</p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{s.value}</p>
                </div>
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ring-1 ring-inset ${toneRing[s.tone]}`}>{s.icon}</div>
              </div>
            </Link>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {tools.map((t) => (
            <Link key={t.title} href={t.href} className="group flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-300">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">{t.icon}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-slate-950">{t.title}</h3>
                  {t.count ? <span className="shrink-0 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">{t.count} pending</span> : null}
                </div>
                <p className="mt-1 text-sm text-slate-500">{t.desc}</p>
              </div>
              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-indigo-500" />
            </Link>
          ))}
        </div>

        <div id="queues" className="grid gap-6 xl:grid-cols-3">
          <QueueCard title="Communities" href="/dashboard/verification" empty="No communities awaiting verification.">
            {queues.communities.slice(0, 5).map((c) => (
              <QueueRow key={c._id} primary={c.name} secondary={`${c.university || '—'} · ${c.category || '—'}`} />
            ))}
          </QueueCard>

          <QueueCard title="Recruiters" href="/dashboard/recruiters" empty="No recruiters awaiting verification.">
            {queues.recruiters.slice(0, 5).map((r) => (
              <QueueRow key={r.userId} primary={r.fullName} secondary={[r.company, r.position].filter(Boolean).join(' · ') || r.email} />
            ))}
          </QueueCard>

          <QueueCard title="Opportunities" href="/dashboard/moderation" empty="No opportunities to review.">
            {pendingOpps.slice(0, 5).map((o) => (
              <QueueRow key={o.id} primary={o.title} secondary={[o.organization, o.source].filter(Boolean).join(' · ')} />
            ))}
          </QueueCard>
        </div>
      </section>
    </DashboardShell>
  );
}

function QueueCard({ title, href, empty, children }: { title: string; href: string; empty: string; children: React.ReactNode }) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children;
  const isEmpty = Array.isArray(items) ? items.length === 0 : !items;
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
        <Link href={href} className="text-xs font-medium text-indigo-600 hover:underline">Open</Link>
      </div>
      <div className="mt-3 space-y-2">
        {isEmpty ? <p className="text-sm text-slate-500">{empty}</p> : items}
      </div>
    </section>
  );
}

function QueueRow({ primary, secondary }: { primary: string; secondary: string }) {
  return (
    <div className="rounded-xl border border-slate-100 px-3 py-2">
      <p className="truncate text-sm font-medium text-slate-900">{primary}</p>
      <p className="truncate text-xs text-slate-500">{secondary}</p>
    </div>
  );
}
