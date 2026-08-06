'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarCheck, Crown, Flame, Globe2, GraduationCap, HeartHandshake, Info, Medal, Mic, Rocket, Star, Target, TrendingUp, Trophy, Sparkles, RefreshCw, type LucideIcon } from 'lucide-react';

import { getCurrentUser } from '../../components/guildos/auth-api';
import {
  getLeaderboard,
  getMyReputation,
  getReputationActivity,
  getReputationInsights,
  recalculateReputation,
  type LeaderboardEntry,
  type LeaderboardScope,
  type Reputation,
  type ReputationActivityEntry,
  type ReputationInsight,
} from '../../components/guildos/reputation-api';
import { StudentNav } from '../../components/guildos/student-nav';
import { PageLoading } from '../../components/guildos/ui/loading';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function resolveAvatar(avatar?: string) {
  if (!avatar) return '';
  if (avatar.startsWith('http')) return avatar;
  if (avatar.startsWith('/')) return `${API_BASE_URL}${avatar}`;
  return `${API_BASE_URL}/uploads/${avatar}`;
}

const TIERS: { level: string; label: string; tone: string }[] = [
  { level: 'Explorer Guild', label: 'Explorer', tone: 'from-slate-500 to-slate-700' },
  { level: 'Bronze Guild', label: 'Bronze', tone: 'from-amber-600 to-orange-700' },
  { level: 'Silver Guild', label: 'Silver', tone: 'from-slate-400 to-slate-600' },
  { level: 'Gold Guild', label: 'Gold', tone: 'from-yellow-400 to-amber-600' },
  { level: 'Platinum Guild', label: 'Platinum', tone: 'from-cyan-400 to-sky-600' },
  { level: 'Elite Guild', label: 'Elite', tone: 'from-fuchsia-500 to-indigo-700' },
];

const CATEGORY_META: Record<string, { Icon: LucideIcon; tone: string }> = {
  ATTENDANCE: { Icon: CalendarCheck, tone: 'text-emerald-700 bg-emerald-50' },
  LEADERSHIP: { Icon: Crown, tone: 'text-indigo-700 bg-indigo-50' },
  VOLUNTEER: { Icon: HeartHandshake, tone: 'text-sky-700 bg-sky-50' },
  SPEAKER: { Icon: Mic, tone: 'text-fuchsia-700 bg-fuchsia-50' },
  ORGANIZER: { Icon: Rocket, tone: 'text-amber-700 bg-amber-50' },
};

/** Badge artwork by code — the API's emoji icon field is ignored in favour of these. */
const BADGE_ICONS: Record<string, LucideIcon> = {
  EARLY_ADOPTER: GraduationCap,
  SPEAKER: Mic,
  VOLUNTEER: HeartHandshake,
  COMMUNITY_LEADER: Crown,
  CONSISTENCY_STREAK: Flame,
  TOP_CONTRIBUTOR: Rocket,
  MULTI_COMMUNITY_LEADER: Globe2,
};

const INSIGHT_ICONS: Record<string, { Icon: LucideIcon; tone: string }> = {
  up: { Icon: TrendingUp, tone: 'text-emerald-600' },
  goal: { Icon: Target, tone: 'text-indigo-600' },
  info: { Icon: Info, tone: 'text-sky-600' },
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
  return d.toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' });
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
  const [meId, setMeId] = useState('');
  const [recalculating, setRecalculating] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const user = await getCurrentUser();
        if (!user) {
          router.replace('/login');
          return;
        }
        setMeId(user.id);
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

  const rank = useMemo(() => leaderboard.find((r) => r.userId === meId)?.rank ?? null, [leaderboard, meId]);

  async function recalc() {
    try {
      setRecalculating(true);
      const { reputation: r } = await recalculateReputation();
      setReputation(r);
      const act = await getReputationActivity(50).catch(() => null);
      if (act) setActivity(act.activity);
    } catch {
      /* ignore */
    } finally {
      setRecalculating(false);
    }
  }

  if (loading) {
    return <PageLoading label="Loading your Guild Score…" />;
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
    { label: 'Attendance', value: reputation.attendanceScore, Icon: CalendarCheck, bar: 'bg-emerald-500', tone: 'bg-emerald-50 text-emerald-600 ring-emerald-100' },
    { label: 'Leadership', value: reputation.leadershipScore, Icon: Crown, bar: 'bg-indigo-500', tone: 'bg-indigo-50 text-indigo-600 ring-indigo-100' },
    { label: 'Volunteer', value: reputation.volunteerScore, Icon: HeartHandshake, bar: 'bg-sky-500', tone: 'bg-sky-50 text-sky-600 ring-sky-100' },
    { label: 'Speaker', value: reputation.speakerScore, Icon: Mic, bar: 'bg-fuchsia-500', tone: 'bg-fuchsia-50 text-fuchsia-600 ring-fuchsia-100' },
    { label: 'Organizer', value: reputation.organizerScore, Icon: Rocket, bar: 'bg-amber-500', tone: 'bg-amber-50 text-amber-600 ring-amber-100' },
  ];
  const maxBreakdown = Math.max(1, ...breakdown.map((b) => b.value));
  const currentTierIndex = TIERS.findIndex((t) => t.level === reputation.level);
  const nextTier = currentTierIndex >= 0 ? TIERS[currentTierIndex + 1] : undefined;
  const tierTone = TIERS[currentTierIndex]?.tone ?? 'from-slate-500 to-slate-700';
  const toNext = reputation.nextLevelAt !== null ? Math.max(0, reputation.nextLevelAt - reputation.guildScore) : 0;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <StudentNav active="/reputation" />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">Guild Score & Reputation</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Your verified reputation across every community, event, and contribution.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-slate-400 dark:text-slate-500 sm:inline">Updated {formatDate(reputation.lastCalculatedAt)}</span>
          <button onClick={() => void recalc()} disabled={recalculating} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 shadow-sm transition hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60">
            <RefreshCw className={`h-4 w-4 ${recalculating ? 'animate-spin' : ''}`} /> {recalculating ? 'Updating…' : 'Recalculate'}
          </button>
        </div>
      </header>

      {/* Hero with tier stepper */}
      <section className="relative overflow-hidden rounded-3xl bg-slate-900 p-6 text-white shadow-sm sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-indigo-500/25 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-violet-500/15 blur-3xl" aria-hidden />
        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div>
            <span className={`inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r ${tierTone} px-3 py-1 text-xs font-semibold text-white shadow-sm`}>
              <Trophy className="h-3.5 w-3.5" /> {reputation.level}
            </span>
            <div className="mt-4 flex items-baseline gap-3">
              <p className="text-6xl font-bold leading-none tabular-nums">{reputation.guildScore.toLocaleString('en-NG')}</p>
              <p className="text-sm font-medium text-slate-400 dark:text-slate-500">Guild Score</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            {rank !== null ? (
              <span className="inline-flex items-baseline gap-1.5 rounded-2xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-semibold">#{rank}<span className="text-xs font-normal text-slate-400 dark:text-slate-500">global</span></span>
            ) : null}
            {reputation.consistencyBonus > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-amber-300"><Flame className="h-3.5 w-3.5" /> +{Math.round(reputation.consistencyBonus * 100)}% streak</span>
            ) : null}
          </div>
        </div>
        <div className="relative mt-6 max-w-xl">
          <div className="mb-1.5 flex items-center justify-between text-xs font-medium">
            <span className="text-slate-300">
              {reputation.nextLevelAt === null ? 'You have reached the highest guild tier.' : `${toNext.toLocaleString('en-NG')} points to ${nextTier?.label ?? 'the next tier'}`}
            </span>
            {reputation.nextLevelAt !== null ? <span className="text-slate-500 dark:text-slate-400 tabular-nums">{reputation.guildScore.toLocaleString('en-NG')} / {reputation.nextLevelAt.toLocaleString('en-NG')}</span> : null}
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-violet-400 transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div className="relative mt-6 border-t border-white/10 pt-5">
          <ol className="flex items-center gap-2">
            {TIERS.map((t, i) => {
              const achieved = i <= currentTierIndex;
              const current = i === currentTierIndex;
              return (
                <li key={t.level} className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className={`h-1.5 w-full rounded-full ${achieved ? `bg-gradient-to-r ${t.tone}` : 'bg-white/10'}`} />
                  <span className={`truncate text-center text-[11px] font-medium ${current ? 'text-white' : achieved ? 'text-slate-300' : 'text-slate-500 dark:text-slate-400'}`}>
                    {t.label}
                    {current ? <span className="text-indigo-300"> · You</span> : null}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="min-w-0 space-y-6">
          {/* AI insights */}
          {insights.length ? (
            <section className="rounded-3xl border border-indigo-200 bg-gradient-to-br from-indigo-50/70 to-white p-6 shadow-sm">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-indigo-700"><Sparkles className="h-4 w-4" /> Insights for you</h2>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {insights.map((ins, i) => {
                  const meta = INSIGHT_ICONS[ins.tone] ?? INSIGHT_ICONS.info;
                  const body = (
                    <div className="flex items-start gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3">
                      <meta.Icon className={`mt-0.5 h-5 w-5 shrink-0 ${meta.tone}`} aria-hidden />
                      <p className="text-sm text-slate-700 dark:text-slate-300">{ins.text}</p>
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

          {/* Score breakdown */}
          <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Score breakdown</h2>
              <span className="text-xs text-slate-400 dark:text-slate-500">Base points: {reputation.basePoints.toLocaleString('en-NG')}</span>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {breakdown.map((b) => (
                <div key={b.label} className={`flex items-center gap-3 ${b.value === 0 ? 'opacity-45' : ''}`}>
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${b.tone}`}><b.Icon className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{b.label}</p>
                      <p className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">{b.value.toLocaleString('en-NG')}</p>
                    </div>
                    <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-950">
                      <div className={`h-full rounded-full ${b.bar} transition-all`} style={{ width: `${Math.round((b.value / maxBreakdown) * 100)}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Activity timeline */}
          <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Activity Timeline</h2>
            {activity.length ? (
              <ol className="mt-4 space-y-3">
                {activity.map((a) => {
                  const meta = CATEGORY_META[a.category] ?? { Icon: Star, tone: 'text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-950' };
                  return (
                    <li key={a.id} className="flex items-start gap-3">
                      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${meta.tone}`}><meta.Icon className="h-4 w-4" /></span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{a.description || a.type}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{formatDate(a.createdAt)}</p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-emerald-600">+{a.scoreAwarded}</span>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">No reputation activity yet. Complete an event to start earning Guild Score.</p>
            )}
          </section>
        </div>

        <div className="space-y-6">
          {/* Badges */}
          <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Reputation Badges</h2>
            {reputation.badges.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {reputation.badges.map((b) => {
                  const BadgeIcon = BADGE_ICONS[b.code] ?? Medal;
                  return (
                    <span key={b.code} className="inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 text-sm font-medium text-slate-800 dark:text-slate-200">
                      <BadgeIcon className="h-4 w-4 text-amber-600" aria-hidden />{b.label}
                    </span>
                  );
                })}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Earn badges by attending, leading, volunteering, and staying consistent.</p>
            )}
          </section>

          {/* Leaderboard */}
          <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Leaderboard</h2>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {SCOPES.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setScope(s.key)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${scope === s.key ? 'bg-slate-900 text-white' : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:bg-slate-200'}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            {leaderboard.length ? (
              <ol className="mt-4 space-y-2">
                {leaderboard.map((row) => (
                  <li key={row.userId} className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${row.userId === meId ? 'border-indigo-200 bg-indigo-50/60' : 'border-slate-100'}`}>
                    <span className={`w-6 text-center text-sm font-bold tabular-nums ${row.rank === 1 ? 'text-amber-500' : row.rank === 2 ? 'text-slate-400 dark:text-slate-500' : row.rank === 3 ? 'text-orange-600' : 'text-slate-400 dark:text-slate-500'}`}>{row.rank}</span>
                    {resolveAvatar(row.avatar) ? (
                      <img src={resolveAvatar(row.avatar)} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                    ) : (
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600 dark:text-slate-400">{(row.fullName || row.username || 'S').slice(0, 1)}</span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{row.fullName || row.username || 'Student'}{row.userId === meId ? <span className="ml-1 text-xs font-normal text-indigo-500">You</span> : null}</p>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">{row.level}</p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">{row.guildScore.toLocaleString('en-NG')}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">No ranked students in this view yet.</p>
            )}
          </section>
        </div>
      </div>
    </main>
    </div>
  );
}
