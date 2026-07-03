'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { getCurrentUser } from '../../components/guildos/auth-api';
import {
  getLeaderboard,
  getMyReputation,
  getReputationActivity,
  getReputationInsights,
  type LeaderboardEntry,
  type LeaderboardScope,
  type Reputation,
  type ReputationActivityEntry,
  type ReputationInsight,
} from '../../components/guildos/reputation-api';
import { StudentNav } from '../../components/guildos/student-nav';

const LEVEL_TONE: Record<string, string> = {
  'Explorer Guild': 'from-slate-500 to-slate-700',
  'Bronze Guild': 'from-amber-600 to-orange-700',
  'Silver Guild': 'from-slate-400 to-slate-600',
  'Gold Guild': 'from-yellow-400 to-amber-600',
  'Platinum Guild': 'from-cyan-400 to-sky-600',
  'Elite Guild': 'from-fuchsia-500 to-indigo-700',
};

const CATEGORY_META: Record<string, { icon: string; tone: string }> = {
  ATTENDANCE: { icon: '✅', tone: 'text-emerald-700 bg-emerald-50' },
  LEADERSHIP: { icon: '👑', tone: 'text-indigo-700 bg-indigo-50' },
  VOLUNTEER: { icon: '🤝', tone: 'text-sky-700 bg-sky-50' },
  SPEAKER: { icon: '🎤', tone: 'text-fuchsia-700 bg-fuchsia-50' },
  ORGANIZER: { icon: '🚀', tone: 'text-amber-700 bg-amber-50' },
};

const SCOPES: { key: LeaderboardScope; label: string }[] = [
  { key: 'GLOBAL', label: 'Global' },
  { key: 'UNIVERSITY', label: 'My University' },
  { key: 'FACULTY', label: 'My Faculty' },
  { key: 'DEPARTMENT', label: 'My Department' },
];

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function ReputationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reputation, setReputation] = useState<Reputation | null>(null);
  const [activity, setActivity] = useState<ReputationActivityEntry[]>([]);
  const [insights, setInsights] = useState<ReputationInsight[]>([]);
  const [scope, setScope] = useState<LeaderboardScope>('GLOBAL');
  const [scopeArgs, setScopeArgs] = useState<{ university?: string; faculty?: string; department?: string }>({});
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const user = await getCurrentUser();
        if (!user) {
          router.replace('/login');
          return;
        }
        setScopeArgs({
          university: user.profile?.university,
          faculty: user.profile?.faculty,
          department: user.profile?.department,
        });
        const [rep, act] = await Promise.all([getMyReputation(), getReputationActivity(50)]);
        setReputation(rep.reputation);
        setActivity(act.activity);
        getReputationInsights()
          .then((r) => setInsights(r.insights))
          .catch(() => setInsights([]));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load your Guild Score');
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  useEffect(() => {
    void (async () => {
      try {
        const result = await getLeaderboard({ scope, ...scopeArgs, limit: 25 });
        setLeaderboard(result.leaderboard);
      } catch {
        setLeaderboard([]);
      }
    })();
  }, [scope, scopeArgs]);

  const progress = useMemo(() => {
    if (!reputation) return 0;
    if (reputation.nextLevelAt === null) return 100;
    const pct = Math.round((reputation.guildScore / reputation.nextLevelAt) * 100);
    return Math.min(100, Math.max(0, pct));
  }, [reputation]);

  if (loading) {
    return <main className="mx-auto max-w-5xl px-4 py-10"><p className="text-slate-500">Loading your Guild Score…</p></main>;
  }

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      </main>
    );
  }

  if (!reputation) return null;

  const breakdown = [
    { label: 'Attendance', value: reputation.attendanceScore, icon: '✅' },
    { label: 'Leadership', value: reputation.leadershipScore, icon: '👑' },
    { label: 'Volunteer', value: reputation.volunteerScore, icon: '🤝' },
    { label: 'Speaker', value: reputation.speakerScore, icon: '🎤' },
    { label: 'Organizer', value: reputation.organizerScore, icon: '🚀' },
  ];

  return (
    <div className="min-h-screen bg-slate-100">
      <StudentNav active="/reputation" />
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-10">
      <header>
        <h1 className="text-2xl font-semibold text-slate-950">Guild Score & Reputation</h1>
        <p className="text-sm text-slate-500">Your cumulative reputation across every community and event.</p>
      </header>

      {/* Score hero */}
      <section className={`rounded-3xl bg-gradient-to-br ${LEVEL_TONE[reputation.level] ?? 'from-slate-600 to-slate-800'} p-6 text-white shadow-sm`}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm/6 opacity-80">Guild Score</p>
            <p className="text-5xl font-bold tabular-nums">{reputation.guildScore.toLocaleString()}</p>
            <p className="mt-1 text-sm font-medium">{reputation.level}</p>
          </div>
          {reputation.consistencyBonus > 0 ? (
            <span className="rounded-full bg-white/20 px-3 py-1 text-sm font-medium">🔥 +{Math.round(reputation.consistencyBonus * 100)}% consistency bonus</span>
          ) : null}
        </div>
        <div className="mt-5">
          <div className="mb-1 flex justify-between text-xs opacity-80">
            <span>{reputation.guildScore.toLocaleString()}</span>
            <span>{reputation.nextLevelAt === null ? 'Max level' : `Next level at ${reputation.nextLevelAt.toLocaleString()}`}</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/25">
            <div className="h-full rounded-full bg-white" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </section>

      {/* AI insights */}
      {insights.length ? (
        <section className="rounded-3xl border border-indigo-200 bg-gradient-to-br from-indigo-50/70 to-white p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-indigo-700">✨ Insights for you</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {insights.map((ins, i) => {
              const body = (
                <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <span className="text-lg" aria-hidden>{ins.icon}</span>
                  <p className="text-sm text-slate-700">{ins.text}</p>
                </div>
              );
              return ins.href ? (
                <a key={i} href={ins.href} className="block transition hover:-translate-y-0.5">{body}</a>
              ) : (
                <div key={i}>{body}</div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Badges */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Reputation Badges</h2>
        {reputation.badges.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {reputation.badges.map((b) => (
              <span key={b.code} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-800">
                <span aria-hidden>{b.icon}</span>{b.label}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">Earn badges by attending, leading, volunteering, and staying consistent.</p>
        )}
      </section>

      {/* Score breakdown */}
      <section className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {breakdown.map((b) => (
          <div key={b.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-2xl">{b.icon}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{b.value.toLocaleString()}</p>
            <p className="text-xs text-slate-500">{b.label} points</p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        {/* Activity timeline */}
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Activity Timeline</h2>
          {activity.length ? (
            <ol className="mt-4 space-y-3">
              {activity.map((a) => {
                const meta = CATEGORY_META[a.category] ?? { icon: '⭐', tone: 'text-slate-700 bg-slate-100' };
                return (
                  <li key={a.id} className="flex items-start gap-3">
                    <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm ${meta.tone}`}>{meta.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900">{a.description || a.type}</p>
                      <p className="text-xs text-slate-500">{formatDate(a.createdAt)}</p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-emerald-600">+{a.scoreAwarded}</span>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="mt-4 text-sm text-slate-500">No reputation activity yet. Complete an event to start earning Guild Score.</p>
          )}
        </section>

        {/* Leaderboard */}
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Leaderboard</h2>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {SCOPES.map((s) => (
              <button
                key={s.key}
                onClick={() => setScope(s.key)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${scope === s.key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {s.label}
              </button>
            ))}
          </div>
          {leaderboard.length ? (
            <ol className="mt-4 space-y-2">
              {leaderboard.map((row) => (
                <li key={row.userId} className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2">
                  <span className="w-6 text-center text-sm font-semibold text-slate-400">{row.rank}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{row.fullName || row.username || 'Student'}</p>
                    <p className="truncate text-xs text-slate-500">{row.level}</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">{row.guildScore.toLocaleString()}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-4 text-sm text-slate-500">No ranked students in this view yet.</p>
          )}
        </section>
      </div>
    </main>
    </div>
  );
}
