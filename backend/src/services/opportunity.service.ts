import { config } from '../config';
import { authStore } from '../store/auth-store';
import { getReputation } from './reputation.service';
import { listUserCertificates } from './event.service';
import { getUserLeadershipHistory } from './community.service';
import { ReputationScoreModel } from '../models/reputation-score.model';
import { EventSpeakerModel } from '../models/event-speaker.model';
import { EventVolunteerModel } from '../models/event-volunteer.model';
import {
  OpportunityModel,
  type OpportunityCategory,
  type OpportunityDocument,
} from '../models/opportunity.model';
import { OpportunityMatchModel } from '../models/opportunity-match.model';
import { OpportunityActionModel, type OpportunityActionType } from '../models/opportunity-action.model';
import { OpportunityReportModel } from '../models/opportunity-report.model';
import { ApplicantReviewModel } from '../models/applicant-review.model';
import { RecruiterProfileModel } from '../models/recruiter-profile.model';
import { generateMatchReason } from './opportunity-ai.service';

const CATEGORIES: OpportunityCategory[] = ['INTERNSHIP', 'SCHOLARSHIP', 'FELLOWSHIP', 'CAMPUS_ROLE', 'COMPETITION', 'CONFERENCE', 'OPEN_SOURCE'];

type StudentSignals = {
  userId: string;
  university: string;
  department: string;
  faculty: string;
  level: string;
  graduationYear: number | null;
  keywords: Set<string>;
  guildScore: number;
  guildLevel: string;
  leadershipRoles: number;
  certificates: number;
  hasSpeaking: boolean;
  hasVolunteering: boolean;
  percentileTop: number; // 1 = very top, 100 = bottom
  summary: string;
};

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9+#]+/i)
    .map((w) => w.trim())
    .filter((w) => w.length > 2);
}

async function buildStudentSignals(userId: string): Promise<StudentSignals> {
  const user = await authStore.getPublicUserById(userId);
  if (!user) throw new Error('User not found');

  const [reputation, certificates, leadership, speaking, volunteering, totalScored, higher] = await Promise.all([
    getReputation(userId),
    listUserCertificates(userId),
    getUserLeadershipHistory(userId),
    EventSpeakerModel.countDocuments({ userId }),
    EventVolunteerModel.countDocuments({ userId }),
    ReputationScoreModel.countDocuments({ guildScore: { $gt: 0 } }),
    ReputationScoreModel.countDocuments({ guildScore: { $gt: 0 } }),
  ]);

  const guildScore = reputation.guildScore;
  const rankHigher = guildScore > 0 ? await ReputationScoreModel.countDocuments({ guildScore: { $gt: guildScore } }) : totalScored;
  const percentileTop = totalScored > 0 && guildScore > 0 ? Math.max(1, Math.round(((rankHigher + 1) / totalScored) * 100)) : 100;

  const keywords = new Set<string>();
  for (const i of user.profile.interests ?? []) tokenize(i).forEach((t) => keywords.add(t));
  for (const c of certificates) tokenize(c.eventTitle).forEach((t) => keywords.add(t));
  tokenize(user.profile.department ?? '').forEach((t) => keywords.add(t));
  tokenize(user.profile.faculty ?? '').forEach((t) => keywords.add(t));

  const summary = [
    user.profile.department || user.profile.level,
    leadership.length ? `${leadership.length} leadership role(s)` : '',
    certificates.length ? `${certificates.length} certificate(s)` : '',
    `Guild Score ${guildScore} (${reputation.level})`,
  ]
    .filter(Boolean)
    .join(', ');

  return {
    userId,
    university: user.profile.university ?? '',
    department: user.profile.department ?? '',
    faculty: user.profile.faculty ?? '',
    level: user.profile.level ?? '',
    graduationYear: user.profile.graduationYear ?? null,
    keywords,
    guildScore,
    guildLevel: reputation.level,
    leadershipRoles: leadership.length,
    certificates: certificates.length,
    hasSpeaking: speaking > 0,
    hasVolunteering: volunteering > 0,
    percentileTop,
    summary,
  };
}

function eq(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Deterministic, explainable 0–100 match with human-readable reasons. */
function scoreOpportunity(s: StudentSignals, opp: OpportunityDocument): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  // Tag / interest / certificate keyword overlap
  const tags = (opp.tags ?? []).map((t) => t.toLowerCase());
  const matchedTags = tags.filter((t) => s.keywords.has(t) || tokenize(t).some((w) => s.keywords.has(w)));
  if (matchedTags.length) {
    score += Math.min(matchedTags.length * 12, 40);
    reasons.push(`interest in ${matchedTags.slice(0, 3).join(', ')}`);
  }

  // Department alignment
  const deptMatch = (opp.eligibility.departments ?? []).some((d) => eq(d, s.department)) || tags.some((t) => tokenize(s.department).includes(t));
  if (deptMatch && s.department) {
    score += 15;
    reasons.push(`${s.department} background`);
  }

  // Guild Score
  const min = opp.eligibility.minGuildScore ?? 0;
  if (min > 0) {
    if (s.guildScore >= min) {
      score += 15;
      reasons.push(`Guild Score above the ${min} requirement`);
    } else if (s.guildScore >= min * 0.8) {
      score += 6;
      reasons.push('Guild Score approaching this opportunity\'s level');
    }
  } else if (s.guildScore > 0) {
    score += 5;
  }
  if (s.percentileTop <= 10) {
    score += 10;
    reasons.push('top 10% Guild Score at your university');
  } else if (s.percentileTop <= 25) {
    score += 5;
    reasons.push('top 25% Guild Score');
  }

  // Leadership
  const favorsLeadership = opp.category === 'FELLOWSHIP' || opp.category === 'CAMPUS_ROLE' || tags.includes('leadership');
  if (favorsLeadership && s.leadershipRoles > 0) {
    score += 15;
    reasons.push('verified leadership experience');
  } else if ((opp.eligibility.minLeadershipRoles ?? 0) > 0 && s.leadershipRoles >= opp.eligibility.minLeadershipRoles) {
    score += 10;
    reasons.push('meets the leadership requirement');
  }

  // Certificates
  const favorsCerts = ['INTERNSHIP', 'OPEN_SOURCE', 'COMPETITION', 'SCHOLARSHIP'].includes(opp.category);
  if (favorsCerts && s.certificates > 0) {
    score += Math.min(s.certificates * 4, 12);
    reasons.push(`${s.certificates} verified certificate(s)`);
  }

  // Speaking / volunteering
  if (s.hasSpeaking && (opp.category === 'CONFERENCE' || opp.category === 'FELLOWSHIP')) {
    score += 6;
    reasons.push('speaking experience');
  }
  if (s.hasVolunteering && ['SCHOLARSHIP', 'FELLOWSHIP', 'CAMPUS_ROLE'].includes(opp.category)) {
    score += 6;
    reasons.push('volunteer contributions');
  }

  // University / level / graduation year eligibility
  const universities = opp.eligibility.universities ?? [];
  const eligibleUniversity = universities.length === 0 || universities.some((u) => eq(u, s.university));
  if (universities.length && eligibleUniversity) {
    score += 8;
    reasons.push('eligible university');
  }
  if ((opp.eligibility.levels ?? []).some((l) => eq(l, s.level))) {
    score += 4;
  }
  if (s.graduationYear && (opp.eligibility.graduationYears ?? []).includes(s.graduationYear)) {
    score += 4;
  }

  // Hard university restriction penalty
  if (universities.length && !eligibleUniversity) {
    score = Math.round(score * 0.4);
  }

  return { score: Math.max(0, Math.min(100, Math.round(score))), reasons };
}

function serializeOpportunity(opp: OpportunityDocument & { _id: unknown }) {
  return {
    id: String(opp._id),
    title: opp.title,
    description: opp.description,
    category: opp.category,
    organization: opp.organization,
    location: opp.location,
    deadline: opp.deadline,
    tags: opp.tags,
    applicationUrl: opp.applicationUrl,
    eligibility: opp.eligibility,
    saveCount: opp.saveCount,
    applyCount: opp.applyCount,
    reportCount: opp.reportCount ?? 0,
    recruiterVerified: Boolean(opp.recruiterVerified),
    postedBy: opp.postedBy ? String(opp.postedBy) : null,
  };
}

async function actionMap(userId: string, opportunityIds: string[]): Promise<Map<string, OpportunityActionType>> {
  const actions = await OpportunityActionModel.find({ userId, opportunityId: { $in: opportunityIds } }).lean();
  return new Map(actions.map((a) => [a.opportunityId.toString(), a.action]));
}

export async function getRecommendedOpportunities(userId: string) {
  const signals = await buildStudentSignals(userId);
  const opps = await OpportunityModel.find({ status: 'OPEN', moderationStatus: 'VERIFIED' }).lean();

  const scored = opps.map((opp) => {
    const { score, reasons } = scoreOpportunity(signals, opp as OpportunityDocument);
    return { opp: opp as OpportunityDocument & { _id: unknown }, score, reasons };
  });
  scored.sort((a, b) => b.score - a.score);

  // Generate AI reasons for the top matches and cache them.
  const topForReasons = scored.slice(0, 15);
  await Promise.all(
    topForReasons.map(async (entry) => {
      const matchReason = await generateMatchReason({
        opportunityTitle: entry.opp.title,
        category: entry.opp.category,
        organization: entry.opp.organization,
        score: entry.score,
        reasons: entry.reasons,
        studentSummary: signals.summary,
      });
      (entry as typeof entry & { matchReason: string }).matchReason = matchReason;
      await OpportunityMatchModel.updateOne(
        { userId, opportunityId: entry.opp._id },
        { $set: { matchScore: entry.score, matchReason, reasons: entry.reasons, generatedAt: new Date() } },
        { upsert: true },
      );
    }),
  );

  const ids = scored.map((e) => String(e.opp._id));
  const actions = await actionMap(userId, ids);

  const enrich = (entry: typeof scored[number]) => ({
    ...serializeOpportunity(entry.opp),
    matchScore: entry.score,
    matchReason: (entry as typeof entry & { matchReason?: string }).matchReason ?? '',
    reasons: entry.reasons,
    action: actions.get(String(entry.opp._id)) ?? null,
  });

  const notDismissed = scored.filter((e) => actions.get(String(e.opp._id)) !== 'NOT_RELEVANT');
  const now = Date.now();

  const recommended = notDismissed.filter((e) => e.score >= 75).slice(0, 10).map(enrich);
  const stretch = notDismissed.filter((e) => e.score >= 50 && e.score < 75).slice(0, 8).map(enrich);
  const nearDeadline = notDismissed
    .filter((e) => e.score >= 50 && e.opp.deadline && new Date(e.opp.deadline).getTime() - now <= 1000 * 60 * 60 * 24 * 14 && new Date(e.opp.deadline).getTime() >= now)
    .sort((a, b) => new Date(a.opp.deadline as Date).getTime() - new Date(b.opp.deadline as Date).getTime())
    .slice(0, 8)
    .map(enrich);

  const trendingSorted = [...scored].sort((a, b) => (b.opp.saveCount + b.opp.applyCount) - (a.opp.saveCount + a.opp.applyCount));
  const trending = trendingSorted.filter((e) => e.opp.saveCount + e.opp.applyCount > 0).slice(0, 6).map(enrich);

  return { recommended, stretch, nearDeadline, trending };
}

export async function listOpportunities(userId: string | null, filters: { category?: string; search?: string }) {
  const query: Record<string, unknown> = { status: 'OPEN', moderationStatus: 'VERIFIED' };
  if (filters.category && CATEGORIES.includes(filters.category as OpportunityCategory)) query.category = filters.category;
  if (filters.search) {
    const rx = new RegExp(filters.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    query.$or = [{ title: rx }, { organization: rx }, { tags: rx }];
  }
  const opps = await OpportunityModel.find(query).sort({ deadline: 1, createdAt: -1 }).lean();

  let signals: StudentSignals | null = null;
  let actions = new Map<string, OpportunityActionType>();
  if (userId) {
    signals = await buildStudentSignals(userId);
    actions = await actionMap(userId, opps.map((o) => o._id.toString()));
  }

  return opps.map((opp) => {
    const base = serializeOpportunity(opp as OpportunityDocument & { _id: unknown });
    if (!signals) return { ...base, matchScore: null, reasons: [] as string[], action: null as OpportunityActionType | null };
    const { score, reasons } = scoreOpportunity(signals, opp as OpportunityDocument);
    return { ...base, matchScore: score, reasons, action: actions.get(opp._id.toString()) ?? null };
  });
}

export async function getOpportunityDetail(id: string, userId: string | null) {
  const opp = await OpportunityModel.findById(id).lean();
  if (!opp) throw new Error('Opportunity not found');
  // Count a view when a non-owner opens the detail page.
  if (userId && opp.postedBy?.toString() !== userId) {
    await OpportunityModel.updateOne({ _id: id }, { $inc: { viewCount: 1 } });
  }
  const base = serializeOpportunity(opp as OpportunityDocument & { _id: unknown });
  if (!userId) return { ...base, matchScore: null, matchReason: '', reasons: [] as string[], action: null as OpportunityActionType | null };

  const signals = await buildStudentSignals(userId);
  const { score, reasons } = scoreOpportunity(signals, opp as OpportunityDocument);
  const matchReason = await generateMatchReason({
    opportunityTitle: opp.title,
    category: opp.category,
    organization: opp.organization,
    score,
    reasons,
    studentSummary: signals.summary,
  });
  const action = (await OpportunityActionModel.findOne({ userId, opportunityId: id }).lean())?.action ?? null;
  return { ...base, matchScore: score, matchReason, reasons, action };
}

export async function recordOpportunityAction(userId: string, id: string, action: string) {
  const allowed: OpportunityActionType[] = ['SAVED', 'INTERESTED', 'APPLIED', 'NOT_RELEVANT'];
  if (!allowed.includes(action as OpportunityActionType)) {
    throw new Error('Invalid action');
  }
  const opp = await OpportunityModel.findById(id);
  if (!opp) throw new Error('Opportunity not found');

  await OpportunityActionModel.updateOne(
    { userId, opportunityId: id },
    { $set: { action } },
    { upsert: true },
  );

  const [saveCount, applyCount] = await Promise.all([
    OpportunityActionModel.countDocuments({ opportunityId: id, action: 'SAVED' }),
    OpportunityActionModel.countDocuments({ opportunityId: id, action: 'APPLIED' }),
  ]);
  opp.saveCount = saveCount;
  opp.applyCount = applyCount;
  await opp.save();

  return { opportunityId: id, action };
}

export async function reportOpportunity(userId: string, id: string, reason: string) {
  const opp = await OpportunityModel.findById(id);
  if (!opp) throw new Error('Opportunity not found');
  await OpportunityReportModel.updateOne(
    { opportunityId: id, userId },
    { $set: { reason: (reason ?? '').slice(0, 500) } },
    { upsert: true },
  );
  const reportCount = await OpportunityReportModel.countDocuments({ opportunityId: id });
  opp.reportCount = reportCount;
  // Auto-flag for admin review once multiple distinct users report it.
  if (reportCount >= 3 && opp.moderationStatus === 'VERIFIED') {
    opp.moderationStatus = 'FLAGGED';
  }
  await opp.save();
  return { opportunityId: id, reportCount, flagged: opp.moderationStatus === 'FLAGGED' };
}

export async function getSavedOpportunities(userId: string) {
  const saved = await OpportunityActionModel.find({ userId, action: 'SAVED' }).sort({ updatedAt: -1 }).lean();
  if (!saved.length) return [];
  const opps = await OpportunityModel.find({ _id: { $in: saved.map((s) => s.opportunityId) } }).lean();
  const byId = new Map(opps.map((o) => [o._id.toString(), o]));
  return saved
    .map((s) => byId.get(s.opportunityId.toString()))
    .filter((o): o is NonNullable<typeof o> => Boolean(o))
    .map((o) => ({ ...serializeOpportunity(o as OpportunityDocument & { _id: unknown }), action: 'SAVED' as const, matchScore: null as number | null }));
}

export async function getMyMatches(userId: string) {
  const matches = await OpportunityMatchModel.find({ userId }).sort({ matchScore: -1 }).lean();
  const opps = await OpportunityModel.find({ _id: { $in: matches.map((m) => m.opportunityId) }, status: 'OPEN' }).lean();
  const byId = new Map(opps.map((o) => [o._id.toString(), o]));
  const actions = await actionMap(userId, matches.map((m) => m.opportunityId.toString()));
  return matches
    .filter((m) => byId.has(m.opportunityId.toString()))
    .map((m) => {
      const opp = byId.get(m.opportunityId.toString())!;
      return {
        ...serializeOpportunity(opp as OpportunityDocument & { _id: unknown }),
        matchScore: m.matchScore,
        matchReason: m.matchReason,
        reasons: m.reasons,
        action: actions.get(m.opportunityId.toString()) ?? null,
      };
    });
}

export async function createOpportunity(actorId: string, input: Partial<OpportunityDocument>, opts: { autoVerify?: boolean } = {}) {
  if (!input.title || !input.category) {
    throw new Error('Title and category are required');
  }
  if (!CATEGORIES.includes(input.category as OpportunityCategory)) {
    throw new Error('Invalid category');
  }
  const recruiterProfile = await RecruiterProfileModel.findOne({ userId: actorId }).select('verified').lean();
  const trusted = Boolean(opts.autoVerify) || Boolean(recruiterProfile?.verified);
  const opp = await OpportunityModel.create({
    title: String(input.title).trim(),
    description: String(input.description ?? '').trim(),
    category: input.category,
    organization: String(input.organization ?? '').trim(),
    location: String(input.location ?? '').trim(),
    deadline: input.deadline ? new Date(input.deadline) : null,
    tags: Array.isArray(input.tags) ? input.tags.map(String) : [],
    eligibility: {
      minGuildScore: Number(input.eligibility?.minGuildScore ?? 0),
      minLeadershipRoles: Number(input.eligibility?.minLeadershipRoles ?? 0),
      minCertificates: Number(input.eligibility?.minCertificates ?? 0),
      universities: Array.isArray(input.eligibility?.universities) ? input.eligibility!.universities.map(String) : [],
      departments: Array.isArray(input.eligibility?.departments) ? input.eligibility!.departments.map(String) : [],
      levels: Array.isArray(input.eligibility?.levels) ? input.eligibility!.levels.map(String) : [],
      graduationYears: Array.isArray(input.eligibility?.graduationYears) ? input.eligibility!.graduationYears.map(Number) : [],
    },
    applicationUrl: String(input.applicationUrl ?? '').trim(),
    status: 'OPEN',
    moderationStatus: trusted ? 'VERIFIED' : 'PENDING_REVIEW',
    recruiterVerified: Boolean(recruiterProfile?.verified),
    postedBy: actorId,
  });
  return { id: opp._id.toString(), title: opp.title, moderationStatus: opp.moderationStatus };
}

export async function listOpportunitiesForModeration() {
  const opps = await OpportunityModel.find({ moderationStatus: { $in: ['PENDING_REVIEW', 'FLAGGED'] } }).sort({ createdAt: -1 }).lean();
  return opps.map((opp) => ({
    ...serializeOpportunity(opp as OpportunityDocument & { _id: unknown }),
    moderationStatus: opp.moderationStatus,
    source: opp.source,
    postedBy: opp.postedBy ? opp.postedBy.toString() : null,
    createdAt: opp.createdAt,
  }));
}

export async function setOpportunityModeration(id: string, status: string) {
  const allowed = ['PENDING_REVIEW', 'VERIFIED', 'FLAGGED', 'ARCHIVED'];
  if (!allowed.includes(status)) {
    throw new Error('Invalid moderation status');
  }
  const opp = await OpportunityModel.findByIdAndUpdate(id, { $set: { moderationStatus: status } }, { new: true }).lean();
  if (!opp) throw new Error('Opportunity not found');
  return { id: String(opp._id), moderationStatus: opp.moderationStatus };
}

export async function listOpportunitiesByOwner(userId: string) {
  const opps = await OpportunityModel.find({ postedBy: userId }).sort({ createdAt: -1 }).lean();
  return opps.map((opp) => ({
    ...serializeOpportunity(opp as OpportunityDocument & { _id: unknown }),
    status: opp.status,
    moderationStatus: opp.moderationStatus,
    createdAt: opp.createdAt,
  }));
}

export async function updateOwnedOpportunity(
  id: string,
  actorId: string,
  isAdmin: boolean,
  patch: Partial<OpportunityDocument> & { status?: string },
) {
  const opp = await OpportunityModel.findById(id);
  if (!opp) throw new Error('Opportunity not found');
  if (!isAdmin && opp.postedBy?.toString() !== actorId) {
    throw new Error('You can only manage opportunities you posted');
  }

  if (patch.title !== undefined) opp.title = String(patch.title).trim();
  if (patch.description !== undefined) opp.description = String(patch.description).trim();
  if (patch.category !== undefined && CATEGORIES.includes(patch.category as OpportunityCategory)) opp.category = patch.category as OpportunityCategory;
  if (patch.organization !== undefined) opp.organization = String(patch.organization).trim();
  if (patch.location !== undefined) opp.location = String(patch.location).trim();
  if (patch.deadline !== undefined) opp.deadline = patch.deadline ? new Date(patch.deadline) : null;
  if (patch.tags !== undefined && Array.isArray(patch.tags)) opp.tags = patch.tags.map(String);
  if (patch.applicationUrl !== undefined) opp.applicationUrl = String(patch.applicationUrl).trim();
  if (patch.status !== undefined && ['OPEN', 'CLOSED', 'DRAFT'].includes(patch.status)) opp.status = patch.status as OpportunityDocument['status'];
  if (patch.eligibility !== undefined) {
    opp.eligibility = {
      minGuildScore: Number(patch.eligibility.minGuildScore ?? opp.eligibility.minGuildScore ?? 0),
      minLeadershipRoles: Number(patch.eligibility.minLeadershipRoles ?? opp.eligibility.minLeadershipRoles ?? 0),
      minCertificates: Number(patch.eligibility.minCertificates ?? opp.eligibility.minCertificates ?? 0),
      universities: Array.isArray(patch.eligibility.universities) ? patch.eligibility.universities.map(String) : opp.eligibility.universities,
      departments: Array.isArray(patch.eligibility.departments) ? patch.eligibility.departments.map(String) : opp.eligibility.departments,
      levels: Array.isArray(patch.eligibility.levels) ? patch.eligibility.levels.map(String) : opp.eligibility.levels,
      graduationYears: Array.isArray(patch.eligibility.graduationYears) ? patch.eligibility.graduationYears.map(Number) : opp.eligibility.graduationYears,
    };
  }
  await opp.save();
  return { ...serializeOpportunity(opp.toObject() as OpportunityDocument & { _id: unknown }), status: opp.status };
}

export async function getOpportunityApplicants(id: string, actorId: string, isAdmin: boolean) {
  const opp = await OpportunityModel.findById(id).lean();
  if (!opp) throw new Error('Opportunity not found');
  if (!isAdmin && opp.postedBy?.toString() !== actorId) {
    throw new Error('You can only view applicants for opportunities you posted');
  }

  const actions = await OpportunityActionModel.find({ opportunityId: id, action: { $in: ['INTERESTED', 'APPLIED', 'SAVED'] } })
    .sort({ updatedAt: -1 })
    .lean();
  const reviews = await ApplicantReviewModel.find({ opportunityId: id }).lean();
  const reviewByCandidate = new Map(reviews.map((r) => [r.candidateId.toString(), r]));

  const applicants = await Promise.all(
    actions.map(async (a) => {
      const user = await authStore.getPublicUserById(a.userId.toString());
      const rep = await ReputationScoreModel.findOne({ userId: a.userId }).lean();
      if (!user) return null;
      const review = reviewByCandidate.get(a.userId.toString());
      let matchScore = 0;
      let reasons: string[] = [];
      try {
        const signals = await buildStudentSignals(a.userId.toString());
        const result = scoreOpportunity(signals, opp as OpportunityDocument);
        matchScore = result.score;
        reasons = result.reasons;
      } catch {
        /* scoring is best-effort */
      }
      return {
        userId: user.id,
        fullName: user.fullName,
        username: user.profile.username,
        university: user.profile.university,
        department: user.profile.department,
        guildScore: rep?.guildScore ?? 0,
        level: rep?.level ?? 'Explorer Guild',
        availability: rep?.availability ?? user.profile.availability ?? 'CLOSED',
        action: a.action,
        actedAt: a.updatedAt,
        reviewStatus: review?.status ?? 'NEW',
        reviewNote: review?.note ?? '',
        matchScore,
        reasons,
      };
    }),
  );

  return {
    opportunity: { id: String(opp._id), title: opp.title, category: opp.category },
    applicants: applicants.filter(Boolean),
  };
}

export async function setApplicantStatus(
  opportunityId: string,
  candidateId: string,
  reviewerId: string,
  isAdmin: boolean,
  status: string,
  note?: string,
) {
  const allowed = ['NEW', 'SHORTLISTED', 'CONTACTED', 'REJECTED', 'HIRED'];
  if (!allowed.includes(status)) {
    throw new Error('Invalid applicant status');
  }
  const opp = await OpportunityModel.findById(opportunityId).lean();
  if (!opp) throw new Error('Opportunity not found');
  if (!isAdmin && opp.postedBy?.toString() !== reviewerId) {
    throw new Error('You can only manage applicants for opportunities you posted');
  }

  await ApplicantReviewModel.updateOne(
    { opportunityId, candidateId },
    { $set: { status, reviewerId, ...(note !== undefined ? { note: String(note) } : {}) } },
    { upsert: true },
  );
  return { opportunityId, candidateId, status };
}

export async function searchCandidates(filters: {
  university?: string;
  faculty?: string;
  department?: string;
  minGuildScore?: number;
  requireLeadership?: boolean;
  openToWork?: boolean;
  limit?: number;
}) {
  const query: Record<string, unknown> = { guildScore: { $gte: Number(filters.minGuildScore ?? 0) } };
  if (filters.university) query.university = filters.university;
  if (filters.faculty) query.faculty = filters.faculty;
  if (filters.department) query.department = filters.department;
  if (filters.requireLeadership) query.leadershipScore = { $gt: 0 };
  if (filters.openToWork) query.availability = { $in: ['OPEN', 'CASUAL'] };

  const rows = await ReputationScoreModel.find(query).sort({ guildScore: -1 }).limit(Math.min(Math.max(filters.limit ?? 25, 1), 100)).lean();
  return rows.map((r) => ({
    userId: r.userId.toString(),
    fullName: r.fullName,
    username: r.username,
    university: r.university,
    faculty: r.faculty,
    department: r.department,
    guildScore: r.guildScore,
    level: r.level,
    leadershipScore: r.leadershipScore,
    badges: r.badges,
    availability: r.availability ?? 'CLOSED',
  }));
}

const SEED_OPPORTUNITIES: Array<Partial<OpportunityDocument>> = [
  {
    title: 'AgriTech Innovation Fellowship',
    description: 'A 6-month fellowship for students driving innovation and community impact in agricultural technology.',
    category: 'FELLOWSHIP',
    organization: 'AgriConnect Foundation',
    location: 'Remote',
    tags: ['agritech', 'agriculture', 'innovation', 'leadership', 'community'],
    eligibility: { minGuildScore: 1000, minLeadershipRoles: 1, minCertificates: 0, universities: [], departments: [], levels: [], graduationYears: [] } as never,
    applicationUrl: 'https://example.org/agritech-fellowship',
  },
  {
    title: 'Software Engineering Internship',
    description: 'Summer internship building production web and mobile applications with a modern stack.',
    category: 'INTERNSHIP',
    organization: 'NovaLabs',
    location: 'Lagos, Nigeria',
    tags: ['software', 'engineering', 'react', 'mobile', 'javascript'],
    eligibility: { minGuildScore: 300, minLeadershipRoles: 0, minCertificates: 1, universities: [], departments: [], levels: [], graduationYears: [] } as never,
    applicationUrl: 'https://example.org/swe-internship',
  },
  {
    title: 'Undergraduate Leadership Scholarship',
    description: 'Scholarship recognizing students with demonstrated leadership and service.',
    category: 'SCHOLARSHIP',
    organization: 'Future Leaders Trust',
    location: 'National',
    tags: ['leadership', 'scholarship', 'service', 'community'],
    eligibility: { minGuildScore: 800, minLeadershipRoles: 1, minCertificates: 0, universities: [], departments: [], levels: [], graduationYears: [] } as never,
    applicationUrl: 'https://example.org/leadership-scholarship',
  },
  {
    title: 'National Student Hackathon',
    description: '48-hour hackathon to build solutions for local challenges. Great for builders and teams.',
    category: 'COMPETITION',
    organization: 'CodeSprint',
    location: 'Abuja, Nigeria',
    tags: ['hackathon', 'software', 'innovation', 'startup'],
    eligibility: { minGuildScore: 0, minLeadershipRoles: 0, minCertificates: 0, universities: [], departments: [], levels: [], graduationYears: [] } as never,
    applicationUrl: 'https://example.org/hackathon',
  },
  {
    title: 'Campus Ambassador Program',
    description: 'Represent a leading tech brand on your campus, run events, and build community.',
    category: 'CAMPUS_ROLE',
    organization: 'TechReach',
    location: 'On campus',
    tags: ['ambassador', 'community', 'events', 'leadership', 'public speaking'],
    eligibility: { minGuildScore: 200, minLeadershipRoles: 0, minCertificates: 0, universities: [], departments: [], levels: [], graduationYears: [] } as never,
    applicationUrl: 'https://example.org/ambassador',
  },
  {
    title: 'Open Source Mentorship Summer',
    description: 'A guided summer program contributing to open-source projects with mentor support.',
    category: 'OPEN_SOURCE',
    organization: 'OpenDev',
    location: 'Remote',
    tags: ['open source', 'software', 'mentorship', 'engineering'],
    eligibility: { minGuildScore: 400, minLeadershipRoles: 0, minCertificates: 1, universities: [], departments: [], levels: [], graduationYears: [] } as never,
    applicationUrl: 'https://example.org/oss-summer',
  },
];

/** Daily sweep: OPEN opportunities whose deadline has passed stop showing to students. */
export async function closeExpiredOpportunities() {
  const result = await OpportunityModel.updateMany(
    { status: 'OPEN', deadline: { $ne: null, $lt: new Date() } },
    { $set: { status: 'CLOSED' } },
  );
  if (result.modifiedCount) console.log(`[GuildOS] Closed ${result.modifiedCount} past-deadline opportunit${result.modifiedCount === 1 ? 'y' : 'ies'}`);
  return result.modifiedCount ?? 0;
}

export async function seedOpportunitiesIfEmpty() {
  const count = await OpportunityModel.estimatedDocumentCount();
  if (count > 0) return 0;
  const now = Date.now();
  const withDeadlines = SEED_OPPORTUNITIES.map((o, i) => ({
    ...o,
    status: 'OPEN' as const,
    deadline: new Date(now + 1000 * 60 * 60 * 24 * (10 + i * 7)),
  }));
  await OpportunityModel.insertMany(withDeadlines);
  console.log(`[GuildOS] Seeded ${withDeadlines.length} sample opportunities`);
  return withDeadlines.length;
}

export { CATEGORIES as OPPORTUNITY_CATEGORIES };
