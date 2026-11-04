import type { Reputation } from '@/lib/account';

// Same level steps the backend uses, so the bar matches the level shown.
const LEVELS = [
  { level: 'Explorer Guild', min: 0 }, { level: 'Bronze Guild', min: 100 }, { level: 'Silver Guild', min: 500 },
  { level: 'Gold Guild', min: 1500 }, { level: 'Platinum Guild', min: 5000 }, { level: 'Elite Guild', min: 10000 },
];

/**
 * The Guild Score, kept honest: one number, its level, how far to the next one,
 * and where the points came from. No ranking against other students.
 */
export function ScoreCard({ reputation, certificates, own }: { reputation: Reputation; certificates: number; own?: boolean }) {
  const min = [...LEVELS].reverse().find((l) => reputation.guildScore >= l.min)?.min ?? 0;
  const next = reputation.nextLevelAt;
  const pct = next ? Math.min(100, Math.round(((reputation.guildScore - min) / Math.max(1, next - min)) * 100)) : 100;
  const nextName = LEVELS.find((l) => l.min === next)?.level;
  const parts = [
    [reputation.attendanceScore, 'from events attended'], [reputation.organizerScore, 'from running events'],
    [reputation.leadershipScore, 'from leadership'], [reputation.speakerScore, 'from speaking'], [reputation.volunteerScore, 'from volunteering'],
  ].filter(([n]) => Number(n) > 0) as [number, string][];
  return (
    <section className="score" aria-label="Guild Score">
      <span className="big">{reputation.guildScore}</span>
      <div className="stack" style={{ gap: 6 }}>
        <b>Guild Score · {reputation.level}</b>
        {own && next ? <><div className="bar" aria-hidden="true"><i style={{ width: `${pct}%` }} /></div><span className="small">{next - reputation.guildScore} points to {nextName ?? 'the next level'}</span></> : null}
        <span className="small">{parts.length ? parts.map(([n, t]) => `${n} ${t}`).join(' · ') : 'Points come from verified attendance, roles and events you run.'}{certificates ? ` · ${certificates} certificate${certificates === 1 ? '' : 's'}` : ''}</span>
      </div>
    </section>
  );
}
