import { randomUUID } from 'node:crypto';
import { CommunityModel, type CommunityRole, type CommunityVerificationMethod } from '../models/community.model';
import { CommunityJoinRequestModel, type CommunityJoinRequestStatus } from '../models/community-join-request.model';
import { CommunityEndorsementModel } from '../models/community-endorsement.model';
import { MembershipModel, type MembershipStatus } from '../models/membership.model';
import { UserModel } from '../models/user.model';
import { PostModel } from '../models/post.model';
import { CommunityFollowModel } from '../models/community-follow.model';
import { EventModel } from '../models/event.model';
import { LeadershipRoleModel } from '../models/leadership-role.model';
import { MembershipActivityModel, type MembershipActivityAction } from '../models/membership-activity.model';
import { authStore } from '../store/auth-store';
import { awardReputation, roleReputation } from './reputation.service';
import { createMilestonePost } from './feed.service';
import { createNotification } from './notification.service';
import { hasCommunityAccess } from './community-access.service';
import { isRankingEnabled } from './ranking/ranking.config';
import { rankCommunitiesForUser } from './ranking/community-ranking.service';

const roleOrder: CommunityRole[] = [
  'MEMBER',
  'VOLUNTEER',
  'COORDINATOR',
  'SECRETARY',
  'TREASURER',
  'VICE_PRESIDENT',
  'PRESIDENT',
  'FOUNDER',
];

const LEADERSHIP_ROLES: CommunityRole[] = ['VOLUNTEER', 'COORDINATOR', 'SECRETARY', 'TREASURER', 'VICE_PRESIDENT', 'PRESIDENT', 'FOUNDER'];

const ROLE_DESCRIPTIONS: Record<CommunityRole, string> = {
  MEMBER: 'Default role. View community, join events, download certificates, leave community.',
  VOLUNTEER: 'Assist with event check-in and view attendance statistics.',
  COORDINATOR: 'Create draft events and edit assigned events.',
  SECRETARY: 'Manage announcements and export reports.',
  TREASURER: 'View financial records and manage dues.',
  VICE_PRESIDENT: 'Manage members and assign lower roles.',
  PRESIDENT: 'Approve events, verify certificates, manage the leadership team.',
  FOUNDER: 'Full control: delete community, transfer ownership, assign presidents, modify all settings.',
};

function rankOf(role: CommunityRole) {
  return roleOrder.indexOf(role);
}

function isLeadershipRole(role: CommunityRole) {
  return LEADERSHIP_ROLES.includes(role);
}

export function listCommunityRoles() {
  return roleOrder.map((role, index) => ({
    role,
    rank: index,
    isLeadership: isLeadershipRole(role),
    description: ROLE_DESCRIPTIONS[role],
  }));
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

async function logMembershipActivity(
  membershipId: unknown,
  communityId: unknown,
  action: MembershipActivityAction,
  actorId: string | null,
  metadata: Record<string, unknown> = {},
) {
  await MembershipActivityModel.create({
    membershipId,
    communityId,
    action,
    actorId,
    metadata,
  });
}

async function openLeadershipRole(input: {
  membershipId: unknown;
  communityId: unknown;
  userId: unknown;
  role: CommunityRole;
  assignedBy: string | null;
  verified: boolean;
}) {
  if (!isLeadershipRole(input.role)) {
    return;
  }

  const created = await LeadershipRoleModel.create({
    membershipId: input.membershipId,
    communityId: input.communityId,
    userId: input.userId,
    role: input.role,
    startDate: new Date(),
    endDate: null,
    assignedBy: input.assignedBy,
    verificationStatus: input.verified ? 'VERIFIED' : 'PENDING',
  });

  const { category, points } = roleReputation(input.role);
  await awardReputation({
    userId: String(input.userId),
    category,
    type: 'ROLE_ASSIGNED',
    referenceId: created._id.toString(),
    communityId: String(input.communityId),
    scoreAwarded: points,
    description: `Appointed ${input.role} `.trim(),
  });

  const roleLabel = input.role.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  const community = await CommunityModel.findById(input.communityId).select('name').lean();
  await createMilestonePost(String(input.userId), {
    type: 'ROLE',
    label: `👑 Appointed ${roleLabel}${community?.name ? ` of ${community.name}` : ''}`,
    refId: created._id.toString(),
    communityId: String(input.communityId),
  });
}

async function closeOpenLeadershipRoles(membershipId: unknown) {
  await LeadershipRoleModel.updateMany(
    { membershipId, endDate: null },
    { $set: { endDate: new Date() } },
  );
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function ensureNonEmpty(value: string, label: string) {
  if (!value?.trim()) {
    throw new Error(`${label} is required`);
  }
}

const FIELD_MAX_LENGTHS = {
  name: 100,
  shortDescription: 160,
  description: 2000,
  category: 50,
  university: 120,
  faculty: 120,
  department: 120,
} as const;

function ensureMaxLength(value: string | undefined, label: string, max: number) {
  if (value !== undefined && value.trim().length > max) {
    throw new Error(`${label} must be at most ${max} characters`);
  }
}

function validateCommunityFields(input: Partial<{
  name: string;
  shortDescription: string;
  description: string;
  category: string;
  university: string;
  faculty: string;
  department: string;
}>) {
  ensureMaxLength(input.name, 'Community name', FIELD_MAX_LENGTHS.name);
  ensureMaxLength(input.shortDescription, 'Short description', FIELD_MAX_LENGTHS.shortDescription);
  ensureMaxLength(input.description, 'Description', FIELD_MAX_LENGTHS.description);
  ensureMaxLength(input.category, 'Category', FIELD_MAX_LENGTHS.category);
  ensureMaxLength(input.university, 'University', FIELD_MAX_LENGTHS.university);
  ensureMaxLength(input.faculty, 'Faculty', FIELD_MAX_LENGTHS.faculty);
  ensureMaxLength(input.department, 'Department', FIELD_MAX_LENGTHS.department);
}

function isValidRole(value: string): value is CommunityRole {
  return roleOrder.includes(value as CommunityRole);
}

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

// How many same-university verified-leader endorsements auto-verify a community.
const ENDORSEMENT_THRESHOLD = 2;

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
  verificationMethod?: 'UNIVERSITY_EMAIL' | 'ENDORSEMENT' | 'MANUAL';
}): Promise<{
  allowed: boolean;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  verificationMethod: CommunityVerificationMethod;
  reason?: string;
}> {
  const universityEmailVerified = isVerifiedUniversityEmail(input.schoolEmail, input.schoolEmailVerified);

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
      reason: 'Verify your school email to earn automatic official status',
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

export function hasCommunityPermission(currentRole: CommunityRole, requiredRole: CommunityRole) {
  return roleOrder.indexOf(currentRole) >= roleOrder.indexOf(requiredRole);
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

  const creator = await authStore.getPublicUserById(input.creatorId);
  if (!creator) {
    throw new Error('Creator not found');
  }

  if (!(await hasCommunityAccess(input.creatorId))) {
    throw new Error('Community Mode access is required. Request approval from an admin first.');
  }

  const creatorDoc = await UserModel.findById(input.creatorId)
    .select('communityAccessEmail communityAccessEmailVerified')
    .lean();

  const policy = await canCreateCommunity({
    schoolEmail: creatorDoc?.communityAccessEmail ?? '',
    schoolEmailVerified: Boolean(creatorDoc?.communityAccessEmailVerified),
    university: input.university,
    verificationMethod: input.verificationMethod,
  });

  const baseSlug = slugify(input.name);
  const slug = `${baseSlug}-${randomUUID().slice(0, 8)}`;

  const community = await CommunityModel.create({
    name: input.name.trim(),
    slug,
    shortDescription: input.shortDescription.trim(),
    description: input.description?.trim() ?? '',
    logo: input.logo.trim(),
    coverImage: input.coverImage?.trim() ?? '',
    category: input.category.trim(),
    university: input.university.trim(),
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

const LEADER_ROLES = ['FOUNDER', 'PRESIDENT', 'VICE_PRESIDENT', 'TREASURER', 'SECRETARY', 'COORDINATOR'];

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

/**
 * When a community is REJECTED it is purged permanently: remove its followers
 * and regular members, delete its posts, cancel its events, and drop pending
 * join requests. (Archiving is a reversible soft-hide and does NOT call this.)
 */
async function deactivateCommunityContent(communityId: unknown) {
  await PostModel.deleteMany({ communityId });
  await CommunityFollowModel.deleteMany({ communityId });
  await CommunityJoinRequestModel.deleteMany({ communityId, status: 'PENDING' });
  await MembershipModel.updateMany(
    { communityId, role: { $nin: LEADER_ROLES }, status: { $nin: ['REMOVED', 'LEFT'] } },
    { status: 'REMOVED' },
  );
  await EventModel.updateMany({ communityId, deletedAt: null }, { deletedAt: new Date() });

  const memberCount = await MembershipModel.countDocuments({
    communityId,
    status: { $nin: ['REMOVED', 'LEFT'] },
  });
  await CommunityModel.updateOne({ _id: communityId }, { memberCount, followerCount: 0 });
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

async function isVerifiedCommunityLeader(userId: string, sameUniversity?: string) {
  // Endorsement power requires proven institutional identity, not just a
  // self-assigned role: the endorser must have a verified school email AND hold
  // a leadership role in a community that is itself VERIFIED.
  const user = await UserModel.findById(userId).select('communityAccessEmailVerified').lean();
  if (!user?.communityAccessEmailVerified) {
    return false;
  }

  const memberships = await MembershipModel.find({
    userId,
    role: { $in: LEADER_ROLES },
    status: { $nin: ['REMOVED', 'LEFT'] },
  }).lean();

  if (!memberships.length) {
    return false;
  }

  const communities = await Promise.all(memberships.map((membership) => CommunityModel.findById(membership.communityId).lean()));
  const verified = communities.filter((community) => community?.verificationStatus === 'VERIFIED');
  if (!verified.length) {
    return false;
  }

  if (sameUniversity && sameUniversity.trim()) {
    const target = sameUniversity.trim().toLowerCase();
    return verified.some((community) => (community?.university ?? '').trim().toLowerCase() === target);
  }

  return true;
}

export async function listCommunityEndorsements(communityId: string) {
  const endorsements = await CommunityEndorsementModel.find({ communityId }).sort({ createdAt: -1 }).lean();
  const withUsers = await Promise.all(
    endorsements.map(async (endorsement) => {
      const user = await authStore.getPublicUserById(endorsement.endorserId.toString());
      return user ? { endorsement, user } : null;
    }),
  );

  return withUsers.filter(Boolean);
}

export async function createCommunityEndorsement(communityId: string, endorserId: string, note = '') {
  const community = await CommunityModel.findById(communityId);
  if (!community) {
    throw new Error('Community not found');
  }

  if (community.archivedAt) {
    throw new Error('Community is archived');
  }

  if (community.verificationStatus !== 'PENDING') {
    throw new Error('Community is not pending verification');
  }

  if (community.founder?.toString() === endorserId) {
    throw new Error('You cannot endorse your own community');
  }

  const verifiedLeader = await isVerifiedCommunityLeader(endorserId, community.university);
  if (!verifiedLeader) {
    throw new Error('Only verified community leaders from the same university can endorse communities');
  }

  const existing = await CommunityEndorsementModel.findOne({ communityId, endorserId });
  if (existing) {
    return existing;
  }

  const endorsement = await CommunityEndorsementModel.create({
    communityId,
    endorserId,
    note: note.trim(),
  });

  if (community.verificationMethod === 'ENDORSEMENT') {
    const endorsementCount = await CommunityEndorsementModel.countDocuments({ communityId });
    // Endorsements act as an accelerator: once enough same-university verified
    // leaders vouch, the community earns official status automatically.
    if (endorsementCount >= ENDORSEMENT_THRESHOLD) {
      community.verificationStatus = 'VERIFIED';
      community.verifiedAt = new Date();
      community.verificationNotes = `Auto-verified via ${endorsementCount} peer endorsements`;
    } else {
      community.verificationNotes = `${endorsementCount}/${ENDORSEMENT_THRESHOLD} endorsements collected`;
    }
    await community.save();
  }

  return endorsement;
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

  if (input.name !== undefined) community.name = input.name.trim();
  if (input.shortDescription !== undefined) community.shortDescription = input.shortDescription.trim();
  if (input.description !== undefined) community.description = input.description.trim();
  if (input.logo !== undefined) community.logo = input.logo.trim();
  if (input.coverImage !== undefined) community.coverImage = input.coverImage.trim();
  if (input.category !== undefined) community.category = input.category.trim();
  if (input.university !== undefined) community.university = input.university.trim();
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

export async function joinCommunity(communityId: string, userId: string) {

  const community = await CommunityModel.findById(communityId);
  if (!community) {
    throw new Error('Community not found');
  }

  if (community.archivedAt) {
    throw new Error('Community is archived');
  }

  if (community.verificationStatus !== 'VERIFIED') {
    throw new Error('This community is not verified yet');
  }

  const existing = await MembershipModel.findOne({ communityId, userId });
  if (existing) {
    return { community, alreadyMember: true };
  }

  if (community.visibility === 'PRIVATE') {
    throw new Error('Private communities require an invitation');
  }

  if (community.autoApprove) {
    const membership = await MembershipModel.create({
      communityId,
      userId,
      role: 'MEMBER',
      assignedBy: null,
    });

    community.memberCount += 1;
    await community.save();

    await logMembershipActivity(membership._id, community._id, 'MEMBER_JOINED', userId, { via: 'open' });

    await CommunityJoinRequestModel.findOneAndUpdate(
      { communityId, userId },
      {
        userId,
        communityId,
        status: 'APPROVED' as CommunityJoinRequestStatus,
        requestedAt: new Date(),
        resolvedAt: new Date(),
        resolvedBy: userId as any,
        notes: 'Auto-approved (open community)',
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    return { community, joined: true };
  }

  const existingRequest = await CommunityJoinRequestModel.findOne({ communityId, userId });
  if (existingRequest?.status === 'PENDING') {
    return { community, alreadyRequested: true };
  }

  await CommunityJoinRequestModel.findOneAndUpdate(
    { communityId, userId },
    {
      userId,
      communityId,
      status: 'PENDING' as CommunityJoinRequestStatus,
      requestedAt: new Date(),
      resolvedAt: null,
      resolvedBy: null,
      notes: '',
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return { community, alreadyRequested: false };
}

export async function joinCommunityByInvite(communityId: string, userId: string) {
  const community = await CommunityModel.findById(communityId);
  if (!community) {
    throw new Error('Community not found');
  }

  if (community.archivedAt) {
    throw new Error('Community is archived');
  }

  const existing = await MembershipModel.findOne({ communityId, userId });
  if (existing) {
    return { community, alreadyMember: true };
  }

  const membership = await MembershipModel.create({
    communityId,
    userId,
    role: 'MEMBER',
    assignedBy: null,
  });

  community.memberCount += 1;
  await community.save();

  await logMembershipActivity(membership._id, community._id, 'MEMBER_JOINED', userId, { via: 'invite' });

  await CommunityJoinRequestModel.findOneAndUpdate(
    { communityId, userId },
    {
      userId,
      communityId,
      status: 'APPROVED' as CommunityJoinRequestStatus,
      requestedAt: new Date(),
      resolvedAt: new Date(),
      resolvedBy: userId as any,
      notes: 'Joined through invite link',
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return { community, alreadyMember: false };
}

export async function leaveCommunity(communityId: string, userId: string) {
  const community = await CommunityModel.findById(communityId);
  if (!community) {
    throw new Error('Community not found');
  }

  if (community.archivedAt) {
    throw new Error('Community is archived');
  }

  const membership = await MembershipModel.findOne({ communityId, userId });
  if (!membership) {
    throw new Error('Membership not found');
  }

  if (membership.role === 'FOUNDER') {
    throw new Error('Founder cannot leave the community');
  }

  await closeOpenLeadershipRoles(membership._id);
  await logMembershipActivity(membership._id, community._id, 'MEMBER_LEFT', userId, { role: membership.role });

  await membership.deleteOne();
  community.memberCount = Math.max(0, community.memberCount - 1);
  await community.save();

  await CommunityJoinRequestModel.deleteOne({ communityId, userId });

  return community;
}

export async function updateMemberRole(
  communityId: string,
  memberId: string,
  role: string,
  assignerId: string,
) {
  if (!isValidRole(role)) {
    throw new Error('Invalid community role');
  }

  if (role === 'FOUNDER') {
    throw new Error('Use ownership transfer to assign the FOUNDER role');
  }

  const membership = await MembershipModel.findById(memberId);
  if (!membership || membership.communityId.toString() !== communityId) {
    throw new Error('Membership not found');
  }

  const community = await CommunityModel.findById(communityId);
  if (!community) {
    throw new Error('Community not found');
  }

  if (community.archivedAt) {
    throw new Error('Community is archived');
  }

  const assigner = await MembershipModel.findOne({ communityId, userId: assignerId });
  if (!assigner) {
    throw new Error('Membership required');
  }

  const assignerRank = rankOf(assigner.role);
  if (membership.role === 'FOUNDER') {
    throw new Error('The founder role cannot be changed here');
  }
  if (assignerRank <= rankOf(membership.role)) {
    throw new Error('You cannot manage a member at or above your rank');
  }
  if (assignerRank <= rankOf(role as CommunityRole)) {
    throw new Error('You cannot assign a role at or above your rank');
  }

  const previousRole = membership.role;
  if (previousRole === role) {
    return membership;
  }

  membership.role = role;
  membership.assignedBy = assignerId as any;
  await membership.save();

  await closeOpenLeadershipRoles(membership._id);
  if (isLeadershipRole(previousRole)) {
    await logMembershipActivity(membership._id, community._id, 'ROLE_REMOVED', assignerId, { role: previousRole });
  }
  await openLeadershipRole({
    membershipId: membership._id,
    communityId: community._id,
    userId: membership.userId,
    role: role as CommunityRole,
    assignedBy: assignerId,
    verified: community.verificationStatus === 'VERIFIED',
  });
  await logMembershipActivity(membership._id, community._id, 'ROLE_ASSIGNED', assignerId, { role, previousRole });

  return membership;
}

export async function assignRoleByMembership(membershipId: string, role: string, assignerId: string) {
  const membership = await MembershipModel.findById(membershipId);
  if (!membership) {
    throw new Error('Membership not found');
  }

  return updateMemberRole(membership.communityId.toString(), membershipId, role, assignerId);
}

export async function updateMembershipStatus(membershipId: string, status: string, actorId: string) {
  const allowed: MembershipStatus[] = ['ACTIVE', 'SUSPENDED', 'REMOVED'];
  if (!allowed.includes(status as MembershipStatus)) {
    throw new Error('Invalid membership status');
  }

  const membership = await MembershipModel.findById(membershipId);
  if (!membership) {
    throw new Error('Membership not found');
  }

  const community = await CommunityModel.findById(membership.communityId);
  if (!community) {
    throw new Error('Community not found');
  }

  if (community.archivedAt) {
    throw new Error('Community is archived');
  }

  const actor = await MembershipModel.findOne({ communityId: membership.communityId, userId: actorId });
  if (!actor || !hasCommunityPermission(actor.role, 'VICE_PRESIDENT')) {
    throw new Error('Insufficient permissions');
  }

  if (membership.role === 'FOUNDER') {
    throw new Error('The founder cannot be suspended or removed');
  }

  if (rankOf(actor.role) <= rankOf(membership.role)) {
    throw new Error('You cannot manage a member at or above your rank');
  }

  const previousStatus = membership.status;

  if (status === 'REMOVED') {
    await closeOpenLeadershipRoles(membership._id);
    await logMembershipActivity(membership._id, community._id, 'MEMBER_REMOVED', actorId, { previousStatus, role: membership.role });
    await membership.deleteOne();
    community.memberCount = Math.max(0, community.memberCount - 1);
    await community.save();
    await CommunityJoinRequestModel.deleteOne({ communityId: membership.communityId, userId: membership.userId });
    return { removed: true };
  }

  membership.status = status as MembershipStatus;
  await membership.save();
  await logMembershipActivity(membership._id, community._id, 'STATUS_CHANGED', actorId, { from: previousStatus, to: status });

  return { membership };
}

export async function getUserLeadershipHistory(userId: string) {
  const records = await LeadershipRoleModel.find({ userId }).sort({ startDate: -1 }).lean();

  const withCommunity = await Promise.all(
    records.map(async (record) => {
      const community = await CommunityModel.findById(record.communityId).lean();
      return {
        id: record._id.toString(),
        role: record.role,
        startDate: record.startDate,
        endDate: record.endDate,
        current: record.endDate === null,
        verificationStatus: record.verificationStatus,
        assignedBy: record.assignedBy,
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

  return withCommunity;
}

export async function updateLeadershipRole(
  roleId: string,
  actorId: string,
  input: { endDate?: string | null; verificationStatus?: 'PENDING' | 'VERIFIED' },
) {
  const record = await LeadershipRoleModel.findById(roleId);
  if (!record) {
    throw new Error('Leadership role not found');
  }

  const actor = await MembershipModel.findOne({ communityId: record.communityId, userId: actorId });
  if (!actor || !hasCommunityPermission(actor.role, 'PRESIDENT')) {
    throw new Error('Insufficient permissions');
  }

  if (input.endDate !== undefined) {
    record.endDate = input.endDate ? new Date(input.endDate) : null;
  }
  if (input.verificationStatus !== undefined) {
    record.verificationStatus = input.verificationStatus;
  }

  await record.save();
  return record;
}

export async function endLeadershipRole(roleId: string, actorId: string) {
  const record = await LeadershipRoleModel.findById(roleId);
  if (!record) {
    throw new Error('Leadership role not found');
  }

  const actor = await MembershipModel.findOne({ communityId: record.communityId, userId: actorId });
  if (!actor || !hasCommunityPermission(actor.role, 'PRESIDENT')) {
    throw new Error('Insufficient permissions');
  }

  if (record.endDate === null) {
    record.endDate = new Date();
    await record.save();
  }

  await logMembershipActivity(record.membershipId, record.communityId, 'ROLE_REMOVED', actorId, { role: record.role, archived: true });

  return record;
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
  const members = showMembers ? await getCommunityMembers(communityId) : [];
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
    joinRequests,
  };
}

// ... existing imports and code ...

export async function listPendingCommunities() {
  return CommunityModel.find({ verificationStatus: 'PENDING' }).sort({ createdAt: -1 }).lean();
}

export async function verifyCommunity(communityId: string, adminId: string, notes = '') {
  const community = await CommunityModel.findById(communityId);
  if (!community) {
    throw new Error('Community not found');
  }

  if (community.verificationMethod === 'ENDORSEMENT') {
    const endorsementCount = await CommunityEndorsementModel.countDocuments({ communityId });
    if (endorsementCount < 1) {
      throw new Error('At least one endorsement is required');
    }
  }

  community.verificationStatus = 'VERIFIED';
  community.verifiedBy = adminId as any;
  community.verifiedAt = new Date();
  community.verificationNotes = notes.trim();

  await community.save();
  return community;
}

export async function rejectCommunity(communityId: string, adminId: string, notes = '') {
  const community = await CommunityModel.findById(communityId);
  if (!community) {
    throw new Error('Community not found');
  }

  community.verificationStatus = 'REJECTED';
  community.verifiedBy = adminId as any;
  community.verifiedAt = new Date();
  community.verificationNotes = notes.trim();

  await community.save();
  await deactivateCommunityContent(community._id);
  return community;
}

export async function approveCommunityJoinRequest(communityId: string, requestId: string, actorId: string) {
  const community = await CommunityModel.findById(communityId);
  if (!community) {
    throw new Error('Community not found');
  }

  if (community.archivedAt) {
    throw new Error('Community is archived');
  }

  const membership = await MembershipModel.findOne({ communityId, userId: actorId });
  if (!membership || !hasCommunityPermission(membership.role, 'PRESIDENT')) {
    throw new Error('Insufficient permissions');
  }

  const request = await CommunityJoinRequestModel.findById(requestId);
  if (!request || request.communityId.toString() !== communityId) {
    throw new Error('Join request not found');
  }

  if (request.status !== 'PENDING') {
    return request;
  }

  const existingMember = await MembershipModel.findOne({ communityId, userId: request.userId });
  if (!existingMember) {
    const membership = await MembershipModel.create({
      communityId,
      userId: request.userId,
      role: 'MEMBER',
      assignedBy: actorId,
    });
    community.memberCount += 1;
    await community.save();
    await logMembershipActivity(membership._id, community._id, 'MEMBER_JOINED', actorId, { via: 'approval' });
  }

  request.status = 'APPROVED';
  request.resolvedAt = new Date();
  request.resolvedBy = actorId as any;
  request.notes = 'Approved by community leadership';
  await request.save();

  await createNotification({
    userId: request.userId.toString(),
    actorId,
    type: 'JOIN_APPROVED',
    title: `Your request to join ${community.name} was approved`,
    link: `/communities/${community.slug}`,
  });

  return request;
}

export async function rejectCommunityJoinRequest(communityId: string, requestId: string, actorId: string) {
  const community = await CommunityModel.findById(communityId);
  if (!community) {
    throw new Error('Community not found');
  }

  if (community.archivedAt) {
    throw new Error('Community is archived');
  }

  const membership = await MembershipModel.findOne({ communityId, userId: actorId });
  if (!membership || !hasCommunityPermission(membership.role, 'PRESIDENT')) {
    throw new Error('Insufficient permissions');
  }

  const request = await CommunityJoinRequestModel.findById(requestId);
  if (!request || request.communityId.toString() !== communityId) {
    throw new Error('Join request not found');
  }

  request.status = 'REJECTED';
  request.resolvedAt = new Date();
  request.resolvedBy = actorId as any;
  request.notes = 'Rejected by community leadership';
  await request.save();

  return request;
}