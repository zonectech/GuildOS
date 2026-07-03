import { ReputationSnapshotModel } from '../models/reputation-snapshot.model';
import { OpportunityMatchModel } from '../models/opportunity-match.model';
import { getReputation, levelForScore } from './reputation.service';

function currentPeriod(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function previousPeriod(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth() - 1, 1);
  return currentPeriod(d);
}

function monthLabel(period: string) {
  const [y, m] = period.split('-').map(Number);
  if (!y || !m) return period;
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long' });
}

export type ReputationInsight = {
  icon: string;
  tone: 'up' | 'info' | 'goal' | 'flat';
  text: string;
  href?: string;
};

/**
 * Actionable, human-readable insights derived from the user's reputation breakdown,
 * a light monthly score snapshot (for growth), and opportunity matches.
 */
export async function getReputationInsights(userId: string): Promise<{ insights: ReputationInsight[]; guildScore: number; level: string }> {
  const rep = await getReputation(userId);
  const period = currentPeriod();

  // Capture / refresh this month's snapshot with the latest score.
  await ReputationSnapshotModel.updateOne(
    { userId, period },
    { $set: { guildScore: rep.guildScore, level: rep.level, capturedAt: new Date() } },
    { upsert: true },
  );

  const prevSnap = await ReputationSnapshotModel.findOne({ userId, period: previousPeriod() }).lean();

  const insights: ReputationInsight[] = [];

  // 1) Month-over-month growth (needs history).
  if (prevSnap && prevSnap.guildScore > 0) {
    const delta = rep.guildScore - prevSnap.guildScore;
    if (delta > 0) {
      const pct = Math.round((delta / prevSnap.guildScore) * 100);
      insights.push({ icon: '📈', tone: 'up', text: `Your Guild Score grew ${pct}% (+${delta}) since ${monthLabel(previousPeriod())}.` });
    } else if (delta === 0) {
      insights.push({ icon: '➖', tone: 'flat', text: `Your Guild Score held steady since ${monthLabel(previousPeriod())}. Join an event to keep it climbing.` });
    }
  }

  // 2) Top contributing category.
  const contributors: Array<{ label: string; value: number }> = [
    { label: 'Leadership', value: rep.leadershipScore },
    { label: 'Attendance', value: rep.attendanceScore },
    { label: 'Volunteering', value: rep.volunteerScore },
    { label: 'Speaking', value: rep.speakerScore },
    { label: 'Organizing', value: rep.organizerScore },
  ];
  const top = contributors.filter((c) => c.value > 0).sort((a, b) => b.value - a.value)[0];
  if (top && rep.guildScore > 0) {
    const share = Math.round((top.value / rep.guildScore) * 100);
    insights.push({ icon: '🏅', tone: 'info', text: `${top.label} activities drive ${share}% of your Guild Score.` });
  }

  // 3) Next-level gap.
  if (rep.nextLevelAt && rep.nextLevelAt > rep.guildScore) {
    const gap = rep.nextLevelAt - rep.guildScore;
    const nextLevel = levelForScore(rep.nextLevelAt).level;
    insights.push({ icon: '🎯', tone: 'goal', text: `You're ${gap} point${gap === 1 ? '' : 's'} away from ${nextLevel}.` });
  } else if (!rep.nextLevelAt) {
    insights.push({ icon: '👑', tone: 'up', text: `You've reached the top tier — ${rep.level}. Keep it up!` });
  }

  // 4) Opportunity matches.
  const matchCount = await OpportunityMatchModel.countDocuments({ userId, matchScore: { $gte: 75 } });
  if (matchCount > 0) {
    insights.push({ icon: '💼', tone: 'info', text: `Your profile strongly matches ${matchCount} open opportunit${matchCount === 1 ? 'y' : 'ies'}.`, href: '/opportunities' });
  }

  // 5) Starter nudge when there's nothing else to say.
  if (!insights.length) {
    insights.push({ icon: '✨', tone: 'goal', text: 'Attend an event or take a leadership role to start building your Guild Score.', href: '/events' });
  }

  return { insights, guildScore: rep.guildScore, level: rep.level };
}
