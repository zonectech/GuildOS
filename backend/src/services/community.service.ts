import { randomUUID } from 'node:crypto';
import { CommunityModel, type CommunityRole, type CommunityVerificationMethod } from '../models/community.model';
import { CommunityJoinRequestModel, type CommunityJoinRequestStatus } from '../models/community-join-request.model';
import { CommunityEndorsementModel } from '../models/community-endorsement.model';
import { MembershipModel, type MembershipStatus } from '../models/membership.model';
import { LeadershipRoleModel } from '../models/leadership-role.model';
import { MembershipActivityModel, type MembershipActivityAction } from '../models/membership-activity.model';
import { authStore } from '../store/auth-store';
import { awardReputation, roleReputation } from './reputation.service';
import { createMilestonePost } from './feed.service';
import { createNotification } from './notification.service';

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

function isVerifiedUniversityEmail(userEmail: string, university?: string) {
  const domain = getEmailDomain(userEmail);
  const normalizedUniversity = university?.trim().toLowerCase() ?? '';

  if (normalizedUniversity.includes('futminna')) {
    return domain === 'futminna.edu.ng';
  }

  return false;
}

async function canCreateCommunity(input: {
  userEmail: string;
  university: string;
  verificationMethod?: 'UNIVERSITY_EMAIL' | 'ENDORSEMENT' | 'MANUAL';
}): Promise<{
  allowed: boolean;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  verificationMethod: CommunityVerificationMethod;
  reason?: string;
}> {
  if (input.verificationMethod === 'UNIVERSITY_EMAIL') {
    if (isVerifiedUniversityEmail(input.userEmail, input.university)) {
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
      reason: 'University email must be verified before official status is granted',
    };
  }

  if (input.verificationMethod === 'ENDORSEMENT') {
    return {
      allowed: true,
      verificationStatus: 'PENDING',
      verificationMethod: 'ENDORSEMENT',
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

  if (isVerifiedUniversityEmail(input.userEmail, input.university)) {
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

  const policy = await canCreateCommunity({
    userEmail: creator.email,
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
  return CommunityModel.find().sort({ createdAt: -1 }).lean();
}

export async function getCommunityBySlug(slug: string) {
  return CommunityModel.findOne({ slug }).lean();
}

export async function getCommunityById(id: string) {
  return CommunityModel.findById(id);
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

async function isVerifiedCommunityLeader(userId: string) {
  const memberships = await MembershipModel.find({
    userId,
    role: { $in: ['FOUNDER', 'PRESIDENT', 'VICE_PRESIDENT', 'TREASURER', 'SECRETARY', 'COORDINATOR'] },
  }).lean();

  if (!memberships.length) {
    return false;
  }

  const communities = await Promise.all(memberships.map((membership) => CommunityModel.findById(membership.communityId).lean()));
  return communities.some((community) => community?.verificationStatus === 'VERIFIED');
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

  const verifiedLeader = await isVerifiedCommunityLeader(endorserId);
  if (!verifiedLeader) {
    throw new Error('Only verified community leaders can endorse communities');
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
    community.verificationNotes = note.trim() || community.verificationNotes;
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

  await community.save();
  return community;
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