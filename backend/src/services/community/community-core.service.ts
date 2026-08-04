import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { CommunityModel, type CommunityVerificationMethod, type CommunityRole } from '../../models/community.model';
import { CommunityJoinRequestModel, type CommunityJoinRequestStatus } from '../../models/community-join-request.model';
import { MembershipModel } from '../../models/membership.model';
import { UserModel } from '../../models/user.model';
import { PostModel } from '../../models/post.model';
import { CommunityFollowModel } from '../../models/community-follow.model';
import { EventModel } from '../../models/event.model';
import { MembershipActivityModel } from '../../models/membership-activity.model';
import { authStore } from '../../store/auth-store';
import { hasCommunityAccess } from '../community-access.service';
import { isRankingEnabled } from '../ranking/ranking.config';
import { rankCommunitiesForUser } from '../ranking/community-ranking.service';
import {
  slugify,
  ensureNonEmpty,
  validateCommunityFields,
  hasCommunityPermission,
  openLeadershipRole,
  logMembershipActivity,
  LEADER_ROLES,
  ENDORSEMENT_THRESHOLD,
} from './community-shared';
import { listCommunityEndorsements } from './community-endorsement.service';
import { findInstitutionByName, institutionAcceptsEmail } from '../institution.service';
import {
  enforceCommunityCreationQuota,
  enforceSafeCommunityContent,
  enforceUniqueCommunityName,
} from '../community-creation-policy.service';

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function getEmailDomain(email: string) {
  return normalizeEmail(email).split('@')[1] ?? '';
}

// Consumer providers that can never count as an institutional email.
const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'ymail.com', 'outlook.com', 'hotmail.com',
  'live.com', 'msn.com', 'icloud.com', 'me.com', 'aol.com', 'proton.me', 'protonmail.com',
  'gmx.com', 'mail.com', 'zoho.com', 'yandex.com', 'pm.me', 'fastmail.com',
]);
const ACADEMIC_DOMAIN = /(^|\.)(edu|ac|sch)(\.[a-z]{2,})?$/i;

function isAcademicEmail(email: string) {
  const domain = getEmailDomain(email);
  if (!domain || FREE_EMAIL_DOMAINS.has(domain)) return false;
  return ACADEMIC_DOMAIN.test(domain);
}

/**
 * A community's official status can be granted automatically when the founder
 * has a *verified* institutional (school) email on an academic domain. This is
 * the primary, school-email-anchored verification path.
 */
function isVerifiedUniversityEmail(schoolEmail: string, schoolEmailVerified: boolean) {
  return schoolEmailVerified && isAcademicEmail(schoolEmail);
}

async function canCreateCommunity(input: {
  schoolEmail: string;
  schoolEmailVerified: boolean;
  university: string;
  institution: { emailDomains: string[] };
  verificationMethod?: 'UNIVERSITY_EMAIL' | 'ENDORSEMENT' | 'MANUAL';
}): Promise<{
  allowed: boolean;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  verificationMethod: CommunityVerificationMethod;
  reason?: string;
}> {
  const universityEmailVerified =
    isVerifiedUniversityEmail(input.schoolEmail, input.schoolEmailVerified) &&
    institutionAcceptsEmail(input.institution, input.schoolEmail);

  if (input.verificationMethod === 'UNIVERSITY_EMAIL') {
    if (universityEmailVerified) {
      return {
        allowed: true,
        verificationStatus: 'VERIFIED',
        verificationMethod: 'UNIVERSITY_EMAIL',
      };
    }

    return {
      allowed: true,
      verificationStatus: 'PENDING',
      verificationMethod: 'MANUAL',
      reason: 'Your verified school-email domain must match the selected institution. Admin review is required.',
    };
  }

  if (input.verificationMethod === 'ENDORSEMENT') {
    return {
      allowed: true,
      verificationStatus: 'PENDING',
      verificationMethod: 'ENDORSEMENT',
      reason: `Needs ${ENDORSEMENT_THRESHOLD} endorsements from verified leaders at ${input.university || 'your university'}`,
    };
  }

  if (input.verificationMethod === 'MANUAL') {
    return {
      allowed: true,
      verificationStatus: 'PENDING',
      verificationMethod: 'MANUAL',
      reason: 'Requires admin review',
    };
  }

  if (universityEmailVerified) {
    return {
      allowed: true,
      verificationStatus: 'VERIFIED',
      verificationMethod: 'UNIVERSITY_EMAIL',
    };
  }

  return {
    allowed: true,
    verificationStatus: 'PENDING',
    verificationMethod: 'MANUAL',
    reason: 'Requires admin review',
  };
}

export async function getUserMemberships(userId: string) {
  const memberships = await MembershipModel.find({ userId }).sort({ joinedAt: -1 }).lean();

  const withCommunity = await Promise.all(
    memberships.map(async (membership) => {
      const community = await CommunityModel.findById(membership.communityId).lean();
      return {
        membershipId: membership._id.toString(),
        role: membership.role,
        status: membership.status,
        joinedAt: membership.joinedAt,
        community: community
          ? {
              id: community._id.toString(),
              name: community.name,
              slug: community.slug,
              logo: community.logo,
              verificationStatus: community.verificationStatus,
            }
          : null,
      };
    }),
  );

  return withCommunity.filter((entry) => entry.community !== null);
}

export async function getCommunityActivity(communityId: string, actorId: string, limit = 50) {
  const community = await CommunityModel.findById(communityId).lean();
  if (!community) {
    throw new Error('Community not found');
  }

  const actor = await MembershipModel.findOne({ communityId, userId: actorId }).lean();
  if (!actor || !hasCommunityPermission(actor.role, 'PRESIDENT')) {
    throw new Error('Insufficient permissions');
  }

  const activity = await MembershipActivityModel.find({ communityId })
    .sort({ createdAt: -1 })
    .limit(Math.min(Math.max(limit, 1), 100))
    .lean();

  const enriched = await Promise.all(
    activity.map(async (entry) => {
      const actorUser = entry.actorId ? await authStore.getPublicUserById(entry.actorId.toString()) : null;
      const membership = await MembershipModel.findById(entry.membershipId).lean();
      const memberUser = membership ? await authStore.getPublicUserById(membership.userId.toString()) : null;

      return {
        id: entry._id.toString(),
        action: entry.action,
        createdAt: entry.createdAt,
        metadata: entry.metadata ?? {},
        actor: actorUser ? { id: actorUser.id, fullName: actorUser.fullName } : null,
        member: memberUser ? { id: memberUser.id, fullName: memberUser.fullName } : null,
      };
    }),
  );

  return enriched;
}

export async function createCommunity(input: {
  name: string;
  shortDescription: string;
  description?: string;
  logo: string;
  coverImage?: string;
  category: string;
  university: string;
  faculty?: string;
  department?: string;
  whatsappLink?: string;
  channelLink?: string;
  visibility?: 'PUBLIC' | 'PRIVATE';
  autoApprove?: boolean;
  verificationMethod?: 'UNIVERSITY_EMAIL' | 'ENDORSEMENT' | 'MANUAL';
  creatorId: string;
}) {
  ensureNonEmpty(input.name, 'Community name');
  ensureNonEmpty(input.shortDescription, 'Short description');
  ensureNonEmpty(input.logo, 'Logo');
  ensureNonEmpty(input.category, 'Category');
  ensureNonEmpty(input.university, 'University');

  validateCommunityFields({
    name: input.name,
    shortDescription: input.shortDescription,
    description: input.description,
    category: input.category,
    university: input.university,
    faculty: input.faculty,
    department: input.department,
  });
  enforceSafeCommunityContent(input.name, input.shortDescription, input.description);

  const creator = await authStore.getPublicUserById(input.creatorId);
  if (!creator) {
    throw new Error('Creator not found');
  }

  if (!(await hasCommunityAccess(input.creatorId))) {
    throw new Error('Community Mode access is required. Request approval from an admin first.');
  }

  const institution = await findInstitutionByName(input.university);
  if (!institution) {
    throw new Error('Select a verified institution from the GuildOS institution registry. Ask an administrator to add a missing institution.');
  }

  const normalizedName = await enforceUniqueCommunityName(input.name, institution._id.toString());
  await enforceCommunityCreationQuota(input.creatorId);

  const creatorDoc = await UserModel.findById(input.creatorId)
    .select('communityAccessEmail communityAccessEmailVerified')
    .lean();

  const policy = await canCreateCommunity({
    schoolEmail: creatorDoc?.communityAccessEmail ?? '',
    schoolEmailVerified: Boolean(creatorDoc?.communityAccessEmailVerified),
    university: institution.name,
    institution,
    verificationMethod: input.verificationMethod,
  });

  const baseSlug = slugify(input.name);
  const slug = `${baseSlug}-${randomUUID().slice(0, 8)}`;

  const community = await CommunityModel.create({
    name: input.name.trim(),
    normalizedName,
    slug,
    shortDescription: input.shortDescription.trim(),
    description: input.description?.trim() ?? '',
    logo: input.logo.trim(),
    coverImage: input.coverImage?.trim() ?? '',
    category: input.category.trim(),
    university: institution.name,
    institutionId: institution._id,
    faculty: input.faculty?.trim() ?? '',
    department: input.department?.trim() ?? '',
    whatsappLink: input.whatsappLink?.trim() ?? '',
    channelLink: input.channelLink?.trim() ?? '',
    visibility: input.visibility ?? 'PUBLIC',
    autoApprove: input.autoApprove ?? false,
    verificationStatus: policy.verificationStatus,
    verificationMethod: policy.verificationMethod,
    verifiedBy: policy.verificationStatus === 'VERIFIED' ? input.creatorId : null,
    verifiedAt: policy.verificationStatus === 'VERIFIED' ? new Date() : null,
    verificationNotes: policy.reason ?? '',
    founder: input.creatorId,
    archivedAt: null,
    archivedBy: null,
    archiveReason: '',
    memberCount: 1,
    eventCount: 0,
  });

  await MembershipModel.create({
    userId: input.creatorId,
    communityId: community._id,
    role: 'FOUNDER',
    assignedBy: input.creatorId,
  });

  const founderMembership = await MembershipModel.findOne({ communityId: community._id, userId: input.creatorId });
  if (founderMembership) {
    await openLeadershipRole({
      membershipId: founderMembership._id,
      communityId: community._id,
      userId: input.creatorId,
      role: 'FOUNDER',
      assignedBy: input.creatorId,
      verified: community.verificationStatus === 'VERIFIED',
    });
    await logMembershipActivity(founderMembership._id, community._id, 'MEMBER_JOINED', input.creatorId, { role: 'FOUNDER' });
  }

  return community;
}

export async function listCommunities() {
  // Public discovery only ever surfaces verified, public, non-archived communities
  // so students never see pending, rejected, or private ones.
  return CommunityModel.find({
    verificationStatus: 'VERIFIED',
    visibility: 'PUBLIC',
    archivedAt: null,
  })
    .sort({ createdAt: -1 })
    .lean();
}

/**
 * Facebook-style community suggestions for a student: ranks verified public
 * communities the user hasn't joined/followed by how well they match the user's
 * school (university/faculty/department), interests, and location. Falls back to
 * popular communities when there aren't enough personalised matches.
 */
export async function listSuggestedCommunities(userId: string, limit = 6) {
  // Weighted ranking with activity signals (docs/discovery-ranking-algorithms.md §4) when enabled.
  if (isRankingEnabled()) return rankCommunitiesForUser(userId, limit);

  const user = await UserModel.findById(userId).lean();
  const profile = user?.profile;
  const norm = (value?: string) => (value ?? '').trim().toLowerCase();
  const university = norm(profile?.university);
  const faculty = norm(profile?.faculty);
  const department = norm(profile?.department);
  const location = norm(profile?.location);
  const interests = (profile?.interests ?? []).map((i) => norm(i)).filter(Boolean);

  const [memberships, follows, communities] = await Promise.all([
    MembershipModel.find({ userId, status: { $nin: ['REMOVED', 'LEFT'] } }).select('communityId').lean(),
    CommunityFollowModel.find({ userId }).select('communityId').lean(),
    CommunityModel.find({ verificationStatus: 'VERIFIED', visibility: 'PUBLIC', archivedAt: null }).lean(),
  ]);

  const excluded = new Set(
    [...memberships, ...follows].map((row) => row.communityId?.toString()).filter(Boolean) as string[],
  );

  const scored = communities
    .filter((c) => !excluded.has(c._id.toString()))
    .map((c) => {
      const cUni = norm(c.university);
      const cFac = norm(c.faculty);
      const cDep = norm(c.department);
      const cCat = norm(c.category);
      const haystack = [c.name, c.shortDescription, c.description, c.category].filter(Boolean).join(' ').toLowerCase();

      let score = 0;
      let reason = '';

      if (university && cUni && cUni === university) {
        score += 5;
        reason = 'From your school';
      }
      if (department && cDep && cDep === department) {
        score += 4;
        if (!reason) reason = 'Popular in your department';
      } else if (faculty && cFac && cFac === faculty) {
        score += 3;
        if (!reason) reason = 'Popular in your faculty';
      }

      const matchedInterests = interests.filter((i) => cCat.includes(i) || haystack.includes(i));
      if (matchedInterests.length) {
        score += 2 * matchedInterests.length;
        if (!reason) reason = `Matches your interest in ${matchedInterests[0]}`;
      }

      if (location && (cUni.includes(location) || haystack.includes(location))) {
        score += 2;
        if (!reason) reason = 'Near your location';
      }

      const popularity = (c.memberCount ?? 0) + (c.followerCount ?? 0);
      return { community: c, score, popularity, reason: reason || 'Popular on campus' };
    });

  scored.sort((a, b) => b.score - a.score || b.popularity - a.popularity);

  return scored.slice(0, limit).map(({ community, reason }) => ({ ...community, reason }));
}

async function leaderCommunityIds(userId: string) {
  const memberships = await MembershipModel.find({
    userId,
    role: { $in: LEADER_ROLES },
    status: { $nin: ['REMOVED', 'LEFT'] },
  })
    .select('communityId')
    .lean();

  return memberships.map((membership) => membership.communityId);
}

/**
 * Communities the given user personally manages (holds a leadership role in).
 * Shows only active communities — verified (approved) and pending. Rejected and
 * archived communities are moved to the history view. Admins should use the
 * admin endpoints for the full list.
 */
export async function listManagedCommunities(userId: string) {
  const ids = await leaderCommunityIds(userId);
  if (!ids.length) {
    return [];
  }

  return CommunityModel.find({
    _id: { $in: ids },
    archivedAt: null,
    verificationStatus: { $in: ['VERIFIED', 'PENDING'] },
  })
    .sort({ createdAt: -1 })
    .lean();
}

/**
 * Rejected or archived communities the user leads — surfaced only in the
 * owner's history view, never in the normal management list.
 */
export async function listManagedCommunityHistory(userId: string) {
  const ids = await leaderCommunityIds(userId);
  if (!ids.length) {
    return [];
  }

  return CommunityModel.find({
    _id: { $in: ids },
    $or: [{ verificationStatus: 'REJECTED' }, { archivedAt: { $ne: null } }],
  })
    .sort({ updatedAt: -1 })
    .lean();
}

export async function getCommunityBySlug(slug: string) {
  return CommunityModel.findOne({ slug }).lean();
}

export async function getCommunityById(id: string) {
  return CommunityModel.findById(id);
}

export async function setCommunityPremium(id: string, isPremium: boolean) {
  const community = await CommunityModel.findById(id);
  if (!community) {
    throw new Error('Community not found');
  }
  community.isPremium = isPremium;
  await community.save();
  return community;
}

export async function getCommunityByInviteToken(token: string) {
  return CommunityModel.findOne({ inviteToken: token, inviteEnabled: true });
}

export async function getCommunityMembership(communityId: string, userId: string) {
  return MembershipModel.findOne({ communityId, userId });
}

export async function getCommunityJoinRequest(communityId: string, userId: string) {
  return CommunityJoinRequestModel.findOne({ communityId, userId }).lean();
}

export async function getCommunityMembers(communityId: string) {
  const memberships = await MembershipModel.find({ communityId }).sort({ joinedAt: 1 }).lean();

  const members = await Promise.all(
    memberships.map(async (membership) => {
      const user = await authStore.getPublicUserById(membership.userId.toString());
      return user ? { membership, user } : null;
    }),
  );

  return members.filter(Boolean);
}

/**
 * Large-membership member management: paginated, searchable roster.
 * - COORDINATOR+ only (same gate as the full list)
 * - `q` searches member names/usernames server-side (via the user collection first,
 *   then intersecting with this community's memberships — bounded at 200 matches)
 * - cursor = last membership id of the previous page (memberships are immutable per
 *   user+community, and _id order tracks join order)
 * - one batched user lookup per page instead of N+1
 */
export async function listCommunityMembersPaged(
  communityId: string,
  actorId: string,
  options?: { limit?: number; cursor?: string; q?: string; role?: string },
) {
  const actor = await MembershipModel.findOne({ communityId, userId: actorId }).lean();
  if (!actor || !hasCommunityPermission(actor.role, 'COORDINATOR')) {
    throw new Error('Insufficient permissions');
  }

  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 100);
  const query: Record<string, unknown> = { communityId };
  const VALID_MEMBER_ROLES: CommunityRole[] = ['MEMBER', 'VOLUNTEER', 'COORDINATOR', 'SECRETARY', 'TREASURER', 'VICE_PRESIDENT', 'PRESIDENT', 'FOUNDER'];
  if (options?.role && VALID_MEMBER_ROLES.includes(options.role as CommunityRole)) {
    query.role = options.role;
  }

  const q = options?.q?.trim() ?? '';
  if (q.length >= 2) {
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const matchingUsers = await UserModel.find({ $or: [{ fullName: re }, { 'profile.username': re }] })
      .select('_id')
      .limit(200)
      .lean();
    query.userId = { $in: matchingUsers.map((u) => u._id) };
  }

  if (options?.cursor && mongoose.Types.ObjectId.isValid(options.cursor)) {
    query._id = { $gt: new mongoose.Types.ObjectId(options.cursor) };
  }

  const [memberships, total] = await Promise.all([
    MembershipModel.find(query).sort({ _id: 1 }).limit(limit + 1).lean(),
    MembershipModel.countDocuments({ communityId }),
  ]);

  const page = memberships.slice(0, limit);
  const nextCursor = memberships.length > limit ? page[page.length - 1]._id.toString() : null;

  const users = await authStore.getPublicUsersByIds(page.map((m) => m.userId.toString()));
  const members = page
    .map((membership) => {
      const user = users.get(membership.userId.toString());
      return user ? { membership, user } : null;
    })
    .filter(Boolean);

  return { members, nextCursor, total };
}

/**
 * Member analytics for community managers (COORDINATOR+): growth trend, role mix,
 * join/leave counts and an activity split. "Active" = posted in the community OR
 * joined within the last 60 days (a cheap, honest proxy — no heavy attendance joins).
 */
export async function getCommunityMemberAnalytics(communityId: string, actorId: string) {
  const actor = await MembershipModel.findOne({ communityId, userId: actorId }).lean();
  if (!actor || !hasCommunityPermission(actor.role, 'COORDINATOR')) {
    throw new Error('Insufficient permissions');
  }

  const cid = new mongoose.Types.ObjectId(communityId);
  const now = new Date();
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [activeTotal, departedTotal, newLast30, roleAgg, joinsAgg, recentPosters, followerCount] = await Promise.all([
    MembershipModel.countDocuments({ communityId, status: 'ACTIVE' }),
    MembershipModel.countDocuments({ communityId, status: { $in: ['LEFT', 'REMOVED'] } }),
    MembershipModel.countDocuments({ communityId, status: 'ACTIVE', joinedAt: { $gte: thirtyDaysAgo } }),
    MembershipModel.aggregate<{ _id: string; count: number }>([
      { $match: { communityId: cid, status: 'ACTIVE' } },
      { $group: { _id: '$role', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    MembershipModel.aggregate<{ _id: string; count: number }>([
      { $match: { communityId: cid, joinedAt: { $gte: twelveMonthsAgo } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$joinedAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    PostModel.distinct('userId', { communityId: cid, createdAt: { $gte: sixtyDaysAgo } }),
    CommunityFollowModel.countDocuments({ communityId }),
  ]);

  // Members counted "active" when they posted recently or joined recently.
  const posterIds = new Set(recentPosters.map((id) => id.toString()));
  const recentJoiners = await MembershipModel.find({ communityId, status: 'ACTIVE', joinedAt: { $gte: sixtyDaysAgo } })
    .select('userId')
    .lean();
  for (const m of recentJoiners) posterIds.add(m.userId.toString());
  const activeMembers = await MembershipModel.countDocuments({
    communityId,
    status: 'ACTIVE',
    userId: { $in: [...posterIds].filter((id) => mongoose.Types.ObjectId.isValid(id)).map((id) => new mongoose.Types.ObjectId(id)) },
  });

  // Fill the last 12 months so the chart never has holes.
  const joinsByMonth: { month: string; count: number }[] = [];
  const joinMap = new Map(joinsAgg.map((j) => [j._id, j.count]));
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    joinsByMonth.push({ month: key, count: joinMap.get(key) ?? 0 });
  }

  return {
    totalMembers: activeTotal,
    departedMembers: departedTotal,
    newLast30Days: newLast30,
    followerCount,
    engagedLast60Days: activeMembers,
    dormantMembers: Math.max(0, activeTotal - activeMembers),
    roleBreakdown: roleAgg.map((r) => ({ role: r._id, count: r.count })),
    joinsByMonth,
  };
}

export async function getCommunityLeadership(communityId: string) {
  const memberships = await MembershipModel.find({
    communityId,
    role: { $in: ['FOUNDER', 'PRESIDENT', 'VICE_PRESIDENT', 'TREASURER', 'SECRETARY', 'COORDINATOR'] },
  }).sort({ joinedAt: 1 });

  const leadership = await Promise.all(
    memberships.map(async (membership) => {
      const user = await authStore.getPublicUserById(membership.userId.toString());
      return user ? { membership, user } : null;
    }),
  );

  return leadership.filter(Boolean);
}

export async function updateCommunity(
  communityId: string,
  updaterId: string,
  input: Partial<{
    name: string;
    shortDescription: string;
    description: string;
    logo: string;
    coverImage: string;
    category: string;
    university: string;
    faculty: string;
    department: string;
    whatsappLink: string;
    channelLink: string;
    rules: string[];
    visibility: 'PUBLIC' | 'PRIVATE';
    autoApprove: boolean;
  }>,
) {
  const community = await CommunityModel.findById(communityId);
  if (!community) {
    throw new Error('Community not found');
  }

  if (community.archivedAt) {
    throw new Error('Community is archived');
  }

  if (community.founder.toString() !== updaterId) {
    throw new Error('Only the founder can update the community');
  }

  validateCommunityFields(input);

  const nextName = input.name?.trim() ?? community.name;
  const nextShortDescription = input.shortDescription?.trim() ?? community.shortDescription;
  const nextDescription = input.description?.trim() ?? community.description;
  enforceSafeCommunityContent(nextName, nextShortDescription, nextDescription);

  let institutionId = community.institutionId;
  let universityName = community.university;
  if (input.university !== undefined) {
    const institution = await findInstitutionByName(input.university);
    if (!institution) throw new Error('Select a verified institution from the GuildOS institution registry');
    institutionId = institution._id;
    universityName = institution.name;
  }
  if (!institutionId) {
    const institution = await findInstitutionByName(universityName);
    if (!institution) throw new Error('This legacy community must be linked to a verified institution before it can be updated');
    institutionId = institution._id;
    universityName = institution.name;
  }
  const normalizedName = await enforceUniqueCommunityName(nextName, institutionId.toString(), communityId);

  if (input.name !== undefined) community.name = input.name.trim();
  community.normalizedName = normalizedName;
  if (input.shortDescription !== undefined) community.shortDescription = input.shortDescription.trim();
  if (input.description !== undefined) community.description = input.description.trim();
  if (input.logo !== undefined) community.logo = input.logo.trim();
  if (input.coverImage !== undefined) community.coverImage = input.coverImage.trim();
  if (input.category !== undefined) community.category = input.category.trim();
  community.university = universityName;
  community.institutionId = institutionId;
  if (input.faculty !== undefined) community.faculty = input.faculty.trim();
  if (input.department !== undefined) community.department = input.department.trim();
  if (input.whatsappLink !== undefined) community.whatsappLink = input.whatsappLink.trim();
  if (input.channelLink !== undefined) community.channelLink = input.channelLink.trim();
  if (input.rules !== undefined) {
    if (!Array.isArray(input.rules)) throw new Error('Rules must be a list');
    community.rules = input.rules
      .filter((r): r is string => typeof r === 'string')
      .map((r) => r.trim().slice(0, 200))
      .filter(Boolean)
      .slice(0, 10);
  }
  if (input.visibility !== undefined) community.visibility = input.visibility;
  if (input.autoApprove !== undefined) community.autoApprove = input.autoApprove;

  await community.save();
  return community;
}

export async function deleteCommunity(communityId: string, requesterId: string) {
  const community = await CommunityModel.findById(communityId);
  if (!community) {
    throw new Error('Community not found');
  }

  if (community.founder.toString() !== requesterId) {
    throw new Error('Only the founder can delete the community');
  }

  await MembershipModel.deleteMany({ communityId });
  await community.deleteOne();

  return { message: 'Community deleted successfully' };
}

export async function archiveCommunity(communityId: string, requesterId: string, reason = '') {
  const community = await CommunityModel.findById(communityId);
  if (!community) {
    throw new Error('Community not found');
  }

  if (community.founder.toString() !== requesterId) {
    throw new Error('Only the founder can archive the community');
  }

  community.archivedAt = new Date();
  community.archivedBy = requesterId as any;
  community.archiveReason = reason.trim();
  community.inviteEnabled = false;
  community.inviteToken = '';

  // Archiving is a reversible soft-hide: content (members, followers, posts,
  // events) is retained and hidden at read time so a reopen fully restores it.
  await community.save();
  return community;
}

/**
 * Reopen an archived community. Founder-only; clears the archived flags so it
 * becomes active again under its existing verification status. (Rejected
 * communities are not reopened this way — they need admin re-verification.)
 */
export async function reopenCommunity(communityId: string, requesterId: string) {
  const community = await CommunityModel.findById(communityId);
  if (!community) {
    throw new Error('Community not found');
  }

  if (community.founder.toString() !== requesterId) {
    throw new Error('Only the founder can reopen the community');
  }

  if (!community.archivedAt) {
    throw new Error('Community is not archived');
  }

  community.archivedAt = null;
  community.archivedBy = null;
  community.archiveReason = '';

  await community.save();
  return community;
}

/** Admin-only: suspend (archive) or restore any community regardless of ownership. */
export async function adminSetCommunityArchived(communityId: string, archived: boolean, reason = '') {
  const community = await CommunityModel.findById(communityId);
  if (!community) {
    throw new Error('Community not found');
  }
  if (archived) {
    community.archivedAt = new Date();
    community.archiveReason = reason.trim();
    community.inviteEnabled = false;
    community.inviteToken = '';
  } else {
    community.archivedAt = null;
    community.archivedBy = null;
    community.archiveReason = '';
  }
  await community.save();
  return community;
}

/** Admin-only: all verified communities (active + suspended) for platform moderation. */
export async function listCommunitiesForAdmin() {
  const communities = await CommunityModel.find({ verificationStatus: 'VERIFIED' })
    .sort({ name: 1 })
    .lean();
  return communities.map((c) => ({
    id: c._id.toString(),
    name: c.name,
    slug: c.slug,
    university: c.university,
    category: c.category,
    memberCount: c.memberCount,
    eventCount: c.eventCount,
    suspended: Boolean(c.archivedAt),
    archiveReason: c.archiveReason ?? '',
    isPremium: Boolean(c.isPremium),
  }));
}

export async function transferCommunityOwnership(communityId: string, requesterId: string, newFounderMembershipId: string) {
  const community = await CommunityModel.findById(communityId);
  if (!community) {
    throw new Error('Community not found');
  }

  if (community.founder.toString() !== requesterId) {
    throw new Error('Only the founder can transfer ownership');
  }

  const currentFounderMembership = await MembershipModel.findOne({ communityId, userId: requesterId });
  const nextFounderMembership = await MembershipModel.findById(newFounderMembershipId);

  if (!nextFounderMembership || nextFounderMembership.communityId.toString() !== communityId) {
    throw new Error('Membership not found');
  }

  if (nextFounderMembership.role === 'FOUNDER') {
    return community;
  }

  if (currentFounderMembership) {
    currentFounderMembership.role = 'PRESIDENT';
    currentFounderMembership.assignedBy = requesterId as any;
    await currentFounderMembership.save();
  }

  nextFounderMembership.role = 'FOUNDER';
  nextFounderMembership.assignedBy = requesterId as any;
  await nextFounderMembership.save();

  community.founder = nextFounderMembership.userId;
  await community.save();

  return community;
}

export async function createCommunityInviteLink(communityId: string, requesterId: string) {

  const community = await CommunityModel.findById(communityId);
  if (!community) {
    throw new Error('Community not found');
  }

  if (community.founder.toString() !== requesterId) {
    throw new Error('Only the founder can manage invite links');
  }

  if (community.archivedAt) {
    throw new Error('Community is archived');
  }

    const token = randomUUID();
  community.inviteToken = token;
  community.inviteEnabled = true;

  await community.save();

  return community;
}

export async function revokeCommunityInviteLink(communityId: string, requesterId: string) {
  const community = await CommunityModel.findById(communityId);
  if (!community) {
    throw new Error('Community not found');
  }

  if (community.founder.toString() !== requesterId) {
    throw new Error('Only the founder can manage invite links');
  }

    community.inviteToken = '';
  community.inviteEnabled = false;

  await community.save();

  return community;
}

export async function getCommunityContext(communityId: string, viewerId?: string) {
  const community = await CommunityModel.findById(communityId).lean();
  if (!community) {
    throw new Error('Community not found');
  }

  const viewerMembership = viewerId ? await MembershipModel.findOne({ communityId, userId: viewerId }).lean() : null;
  const viewerJoinRequest = viewerId ? await CommunityJoinRequestModel.findOne({ communityId, userId: viewerId }).lean() : null;
  const leadership = await getCommunityLeadership(communityId);
  const endorsements = await listCommunityEndorsements(communityId);

  const showMembers = Boolean(viewerMembership && hasCommunityPermission(viewerMembership.role, 'COORDINATOR'));
  // Large-membership guard: the context ships only the FIRST page of the roster —
  // the frontend pages/searches the rest through GET /:id/members.
  const memberPage = showMembers && viewerId
    ? await listCommunityMembersPaged(communityId, viewerId, { limit: 50 })
    : { members: [], nextCursor: null, total: 0 };
  const members = memberPage.members;
  const showJoinRequests = Boolean(viewerMembership && hasCommunityPermission(viewerMembership.role, 'PRESIDENT'));
  const pendingRequests = showJoinRequests
    ? await CommunityJoinRequestModel.find({ communityId, status: 'PENDING' }).sort({ requestedAt: 1 }).lean()
    : [];
  const joinRequests = await Promise.all(
    pendingRequests.map(async (request) => {
      const user = await authStore.getPublicUserById(request.userId.toString());
      return {
        ...request,
        user: user ? { id: user.id, fullName: user.fullName } : null,
      };
    }),
  );

  return {
    community,
    viewerMembership,
    viewerJoinRequest,
    leadership,
    endorsements,
    members,
    membersTotal: memberPage.total,
    membersNextCursor: memberPage.nextCursor,
    joinRequests,
  };
}
