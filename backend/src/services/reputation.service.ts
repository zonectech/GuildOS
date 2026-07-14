import mongoose from 'mongoose';
import {
  ReputationActivityModel,
  type ReputationActivityType,
  type ReputationCategory,
} from '../models/reputation-activity.model';
import { ReputationScoreModel, type GuildLevel } from '../models/reputation-score.model';
import { EventRegistrationModel } from '../models/event-registration.model';
import { MembershipModel } from '../models/membership.model';
import { LeadershipRoleModel } from '../models/leadership-role.model';
import { CertificateModel } from '../models/certificate.model';
import type { CommunityRole } from '../models/community.model';
import { authStore } from '../store/auth-store';

// GuildOS-controlled point values. Communities cannot change these (role-inflation prevention).
export const REPUTATION_POINTS = {
  EVENT_COMPLETED: 10,
  EVENT_ORGANIZED: 50,
  SPEAKER_WORKSHOP: 40,
  SPEAKER_PANEL: 30,
  VOLUNTEER_CONTRIBUTION: 20,
  /** Co-hosting an event as a partner community (awarded to the leader who accepted). */
  PARTNERSHIP_HOSTED: 30,
  /** Securing a sponsor for an event (awarded to the organizer, per sponsor). */
  SPONSORSHIP_SECURED: 20,
  /** Publishing a resource in the community Knowledge Hub. */
  KNOWLEDGE_PUBLISHED: 15,
  ROLE: {
    FOUNDER: 150,
    PRESIDENT: 120,
    VICE_PRESIDENT: 100,
    COORDINATOR: 80,
    SECRETARY: 60,
    TREASURER: 60,
    VOLUNTEER: 20,
    MEMBER: 0,
  } as Record<CommunityRole, number>,
};

const LEVELS: { level: GuildLevel; min: number; next: number | null }[] = [
  { level: 'Explorer Guild', min: 0, next: 100 },
  { level: 'Bronze Guild', min: 100, next: 500 },
  { level: 'Silver Guild', min: 500, next: 1500 },
  { level: 'Gold Guild', min: 1500, next: 5000 },
  { level: 'Platinum Guild', min: 5000, next: 10000 },
  { level: 'Elite Guild', min: 10000, next: null },
];

export function levelForScore(score: number): { level: GuildLevel; nextLevelAt: number | null } {
  let current = LEVELS[0];
  for (const tier of LEVELS) {
    if (score >= tier.min) current = tier;
  }
  return { level: current.level, nextLevelAt: current.next };
}

export const BADGE_CATALOG: Record<string, { label: string; icon: string }> = {
  EARLY_ADOPTER: { label: 'Early Adopter', icon: '🎓' },
  SPEAKER: { label: 'Speaker', icon: '🎤' },
  VOLUNTEER: { label: 'Volunteer', icon: '🤝' },
  COMMUNITY_LEADER: { label: 'Community Leader', icon: '👑' },
  CONSISTENCY_STREAK: { label: 'Consistency Streak', icon: '🔥' },
  TOP_CONTRIBUTOR: { label: 'Top Contributor', icon: '🚀' },
  MULTI_COMMUNITY_LEADER: { label: 'Multi-Community Leader', icon: '🌍' },
};

export function roleReputation(role: CommunityRole): { category: ReputationCategory; points: number } {
  const points = REPUTATION_POINTS.ROLE[role] ?? 0;
  const category: ReputationCategory = role === 'VOLUNTEER' ? 'VOLUNTEER' : 'LEADERSHIP';
  return { category, points };
}

export function speakerReputation(type: 'WORKSHOP' | 'PANEL' | 'GUEST'): number {
  if (type === 'WORKSHOP') return REPUTATION_POINTS.SPEAKER_WORKSHOP;
  return REPUTATION_POINTS.SPEAKER_PANEL;
}

type AwardInput = {
  userId: string;
  category: ReputationCategory;
  type: ReputationActivityType;
  scoreAwarded: number;
  description: string;
  referenceId?: string | null;
  communityId?: string | null;
};

/**
 * Records a reputation award (idempotent on user+type+reference) and recalculates the
 * aggregate. Returns null when the award already existed or the points are non-positive.
 */
export async function awardReputation(input: AwardInput) {
  if (!input.scoreAwarded || input.scoreAwarded <= 0) return null;
  const referenceId = input.referenceId ? new mongoose.Types.ObjectId(input.referenceId) : null;
  try {
    await ReputationActivityModel.create({
      userId: new mongoose.Types.ObjectId(input.userId),
      category: input.category,
      type: input.type,
      referenceId,
      communityId: input.communityId ? new mongoose.Types.ObjectId(input.communityId) : null,
      scoreAwarded: input.scoreAwarded,
      description: input.description,
    });
  } catch (error) {
    // Duplicate key = already awarded for this reference; nothing to do.
    if ((error as { code?: number }).code === 11000) return null;
    throw error;
  }
  return recalculateReputation(input.userId);
}

function computeConsistencyBonus(completedDates: Date[]): number {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const semesterStart = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 182);
  const thisMonth = completedDates.filter((d) => d >= monthStart).length;
  const thisSemester = completedDates.filter((d) => d >= semesterStart).length;
  let bonus = 0;
  if (thisMonth >= 5) bonus = Math.max(bonus, 0.2);
  else if (thisMonth >= 3) bonus = Math.max(bonus, 0.1);
  if (thisSemester >= 10) bonus = Math.max(bonus, 0.3);
  return bonus;
}

/** Rebuilds the aggregate reputation cache from the activity ledger (source of truth). */
export async function recalculateReputation(userId: string) {
  const activities = await ReputationActivityModel.find({ userId }).lean();

  let attendanceScore = 0;
  let leadershipScore = 0;
  let volunteerScore = 0;
  let speakerScore = 0;
  let organizerScore = 0;
  const completedDates: Date[] = [];
  const leadershipCommunities = new Set<string>();

  for (const a of activities) {
    switch (a.category) {
      case 'ATTENDANCE':
        attendanceScore += a.scoreAwarded;
        if (a.type === 'EVENT_COMPLETED') completedDates.push(new Date(a.createdAt));
        break;
      case 'LEADERSHIP':
        leadershipScore += a.scoreAwarded;
        if (a.communityId) leadershipCommunities.add(a.communityId.toString());
        break;
      case 'VOLUNTEER':
        volunteerScore += a.scoreAwarded;
        break;
      case 'SPEAKER':
        speakerScore += a.scoreAwarded;
        break;
      case 'ORGANIZER':
        organizerScore += a.scoreAwarded;
        break;
      default:
        break;
    }
  }

  const basePoints = attendanceScore + leadershipScore + volunteerScore + speakerScore + organizerScore;
  const consistencyBonus = computeConsistencyBonus(completedDates);
  const guildScore = Math.round(basePoints * (1 + consistencyBonus));
  const { level, nextLevelAt } = levelForScore(guildScore);

  const badges: string[] = [];
  if (activities.length > 0) badges.push('EARLY_ADOPTER');
  if (speakerScore > 0) badges.push('SPEAKER');
  if (volunteerScore > 0) badges.push('VOLUNTEER');
  if (leadershipScore > 0) badges.push('COMMUNITY_LEADER');
  if (consistencyBonus > 0) badges.push('CONSISTENCY_STREAK');
  if (guildScore >= 1500) badges.push('TOP_CONTRIBUTOR');
  if (leadershipCommunities.size >= 2) badges.push('MULTI_COMMUNITY_LEADER');

  const user = await authStore.getPublicUserById(userId);

  const doc = await ReputationScoreModel.findOneAndUpdate(
    { userId },
    {
      $set: {
        guildScore,
        basePoints,
        attendanceScore,
        leadershipScore,
        volunteerScore,
        speakerScore,
        organizerScore,
        consistencyBonus,
        level,
        nextLevelAt,
        badges,
        fullName: user?.fullName ?? '',
        username: user?.profile?.username ?? '',
        avatar: user?.profile?.avatar ?? '',
        university: user?.profile?.university ?? '',
        faculty: user?.profile?.faculty ?? '',
        department: user?.profile?.department ?? '',
        availability: user?.profile?.availability ?? 'CLOSED',
        jobSeeking: user?.profile?.jobSeeking ?? false,
        lastCalculatedAt: new Date(),
      },
    },
    { new: true, upsert: true },
  ).lean();

  return doc;
}

function serializeScore(doc: {
  guildScore: number;
  basePoints: number;
  attendanceScore: number;
  leadershipScore: number;
  volunteerScore: number;
  speakerScore: number;
  organizerScore: number;
  consistencyBonus: number;
  level: GuildLevel;
  nextLevelAt: number | null;
  badges: string[];
  lastCalculatedAt: Date;
}) {
  return {
    guildScore: doc.guildScore,
    basePoints: doc.basePoints,
    attendanceScore: doc.attendanceScore,
    leadershipScore: doc.leadershipScore,
    volunteerScore: doc.volunteerScore,
    speakerScore: doc.speakerScore,
    organizerScore: doc.organizerScore,
    consistencyBonus: doc.consistencyBonus,
    level: doc.level,
    nextLevelAt: doc.nextLevelAt,
    badges: doc.badges.map((code) => ({ code, ...(BADGE_CATALOG[code] ?? { label: code, icon: '🏅' }) })),
    lastCalculatedAt: doc.lastCalculatedAt,
  };
}

export async function getReputation(userId: string) {
  let doc = await ReputationScoreModel.findOne({ userId }).lean();
  if (!doc) {
    doc = await recalculateReputation(userId);
  }
  return serializeScore(doc!);
}

export async function getReputationActivity(userId: string, limit = 50) {
  const activities = await ReputationActivityModel.find({ userId })
    .sort({ createdAt: -1 })
    .limit(Math.min(Math.max(limit, 1), 200))
    .lean();
  return activities.map((a) => ({
    id: a._id.toString(),
    category: a.category,
    type: a.type,
    scoreAwarded: a.scoreAwarded,
    description: a.description,
    communityId: a.communityId ? a.communityId.toString() : null,
    referenceId: a.referenceId ? a.referenceId.toString() : null,
    createdAt: a.createdAt,
  }));
}

/** Reputation + headline counts + global rank for a public profile. */
export async function getReputationProfileSummary(userId: string) {
  const reputation = await getReputation(userId);
  const [eventsCompleted, certificatesEarned, communitiesJoined, leadershipRoles] = await Promise.all([
    EventRegistrationModel.countDocuments({ userId, status: 'COMPLETED' }),
    CertificateModel.countDocuments({ userId, status: 'VERIFIED' }),
    MembershipModel.countDocuments({ userId, status: 'ACTIVE' }),
    LeadershipRoleModel.countDocuments({ userId }),
  ]);
  let rank: number | null = null;
  if (reputation.guildScore > 0) {
    const higher = await ReputationScoreModel.countDocuments({ guildScore: { $gt: reputation.guildScore } });
    rank = higher + 1;
  }
  return {
    reputation,
    stats: { eventsCompleted, certificatesEarned, communitiesJoined, leadershipRoles },
    rank,
  };
}

export type LeaderboardScope = 'GLOBAL' | 'UNIVERSITY' | 'FACULTY' | 'DEPARTMENT' | 'COMMUNITY';

export async function getLeaderboard(options: {
  scope?: LeaderboardScope;
  university?: string;
  faculty?: string;
  department?: string;
  communityId?: string;
  limit?: number;
}) {
  const scope = options.scope ?? 'GLOBAL';
  const limit = Math.min(Math.max(options.limit ?? 25, 1), 100);
  const filter: Record<string, unknown> = { guildScore: { $gt: 0 } };

  if (scope === 'UNIVERSITY' && options.university) filter.university = options.university;
  if (scope === 'FACULTY' && options.faculty) filter.faculty = options.faculty;
  if (scope === 'DEPARTMENT' && options.department) filter.department = options.department;

  if (scope === 'COMMUNITY' && options.communityId) {
    const userIds = await ReputationActivityModel.distinct('userId', {
      communityId: new mongoose.Types.ObjectId(options.communityId),
    });
    filter.userId = { $in: userIds };
  }

  const rows = await ReputationScoreModel.find(filter).sort({ guildScore: -1 }).limit(limit).lean();
  return rows.map((row, index) => ({
    rank: index + 1,
    userId: row.userId.toString(),
    fullName: row.fullName,
    username: row.username,
    avatar: row.avatar,
    university: row.university,
    guildScore: row.guildScore,
    level: row.level,
    badges: row.badges.map((code) => ({ code, ...(BADGE_CATALOG[code] ?? { label: code, icon: '🏅' }) })),
  }));
}
