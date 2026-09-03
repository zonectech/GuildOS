'use client';

import { LogoSpinner } from '../../../../components/guildos/ui/loading';

import { useEffect, useMemo, useState } from 'react';
import { ArchiveX, XCircle, ArrowLeft, Search, RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { DashboardShell } from '../../../../components/guildos/dashboard-shell';
import { DashboardSidebar } from '../../../../components/guildos/dashboard-sidebar';
import { DashboardTopbar } from '../../../../components/guildos/dashboard-topbar';
import { SectionHeader } from '../../../../components/guildos/ui/section-header';
import { getCurrentUser } from '../../../../components/guildos/auth-api';
import { navigateBack } from '../../../../components/guildos/back-navigation';
import { getManagedCommunityHistory, reopenCommunity, type CommunitySummary } from '../../../../components/guildos/community-list-api';

function statusMeta(community: CommunitySummary) {
  if (community.archivedAt) {
    return { label: 'Archived', tone: 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400', icon: <ArchiveX className="h-4 w-4" /> };
  }
  return { label: 'Rejected', tone: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300', icon: <XCircle className="h-4 w-4" /> };
}

export default function CommunityHistoryPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [communities, setCommunities] = useState<CommunitySummary[]>([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [currentUserId, setCurrentUserId] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const user = await getCurrentUser();
        if (!user) {
          router.replace('/login');
          return;
        }
        setCurrentUserId(user.id);
        const response = await getManagedCommunityHistory();
        setCommunities(response.communities);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load community history');
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, [router]);

  async function handleReopen(id: string) {
    try {
      setBusyId(id);
      setError('');
      await reopenCommunity(id);
      setCommunities((list) => list.filter((c) => c._id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reopen community');
    } finally {
      setBusyId('');
    }
  }

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return communities;
    return communities.filter((community) => {
      const haystack = [
        community.name,
        community.category,
        community.university,
        community.verificationNotes,
        community.archiveReason,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [communities, query]);
  const archivedCount = communities.filter((community) => Boolean(community.archivedAt)).length;
  const rejectedCount = communities.length - archivedCount;

  return (
    <DashboardShell sidebar={<DashboardSidebar />} topbar={<DashboardTopbar />}>
      <SectionHeader
        eyebrow="Communities"
        title="Community History"
        subtitle="Rejected and archived communities you led. These are hidden from your active list."
      />

      <div className="mb-6">
        <button onClick={() => navigateBack(router, '/dashboard/communities')} className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back to communities
        </button>
      </div>

      {error ? <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/50 dark:text-red-300">{error}</div> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat title="History records" value={communities.length} />
        <Stat title="Archived" value={archivedCount} />
        <Stat title="Rejected" value={rejectedCount} />
      </div>

      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search archived/rejected communities..."
            className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-10 pr-3 text-sm text-slate-900 dark:text-slate-100"
          />
        </label>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 shadow-sm">
          <LogoSpinner />
        </div>
      ) : items.length ? (
        <div className="space-y-3">
          {items.map((community) => {
            const meta = statusMeta(community);
            return (
              <div key={community._id} className="flex flex-col gap-3 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900 dark:text-slate-100">{community.name}</p>
                  <p className="truncate text-sm text-slate-500 dark:text-slate-400">{community.category}{community.university ? ` · ${community.university}` : ''}</p>
                  {community.verificationNotes ? <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">“{community.verificationNotes}”</p> : null}
                  {community.archiveReason ? <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Reason: {community.archiveReason}</p> : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${meta.tone}`}>
                    {meta.icon} {meta.label}
                  </span>
                  {community.archivedAt && community.founder === currentUserId ? (
                    <button
                      onClick={() => void handleReopen(community._id)}
                      disabled={busyId === community._id}
                      className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
                    >
                      {busyId === community._id ? 'Reopening…' : <span className="inline-flex items-center gap-1.5"><RotateCcw className="h-4 w-4" /> Reopen</span>}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center text-sm text-slate-500 dark:text-slate-400">
          No rejected or archived communities. Everything you lead is active.
        </div>
      )}
    </DashboardShell>
  );
}

function Stat({ title, value }: { title: string; value: number }) {
  return (
    <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
      <p className="text-2xl font-semibold text-slate-950 dark:text-white">{value.toLocaleString('en-NG')}</p>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</p>
    </section>
  );
}
