import { CommunityModel, type CommunityRole } from '../../models/community.model';
import { LeadershipRoleModel } from '../../models/leadership-role.model';
import { MembershipActivityModel, type MembershipActivityAction } from '../../models/membership-activity.model';
import { awardReputation, roleReputation } from '../reputation.service';
import { createMilestonePost } from '../feed.service';

export const roleOrder: CommunityRole[] = [
  'MEMBER',
  'VOLUNTEER',
  'COORDINATOR',
  'ORGANIZER',
  'SECRETARY',
  'TREASURER',
  'VICE_PRESIDENT',
  'PRESIDENT',
  'FOUNDER',
];

export const LEADERSHIP_ROLES: CommunityRole[] = ['VOLUNTEER', 'COORDINATOR', 'ORGANIZER', 'SECRETARY', 'TREASURER', 'VICE_PRESIDENT', 'PRESIDENT', 'FOUNDER'];

const ROLE_DESCRIPTIONS: Record<CommunityRole, string> = {
  MEMBER: 'Default role. View community, join events, download certificates, leave community.',
  VOLUNTEER: 'Assist with event check-in and view attendance statistics.',
  COORDINATOR: 'Create draft events and edit assigned events.',
  ORGANIZER: 'Plan and run events end-to-end: create, edit, and manage event operations.',
  SECRETARY: 'Manage announcements and export reports.',
  TREASURER: 'View financial records and manage dues.',
  VICE_PRESIDENT: 'Manage members and assign lower roles.',
  PRESIDENT: 'Approve events, verify certificates, manage the leadership team.',
  FOUNDER: 'Full control: delete community, transfer ownership, assign presidents, modify all settings.',
};

export function rankOf(role: CommunityRole) {
  return roleOrder.indexOf(role);
}

export function isLeadershipRole(role: CommunityRole) {
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

export function hasCommunityPermission(currentRole: CommunityRole, requiredRole: CommunityRole) {
  return roleOrder.indexOf(currentRole) >= roleOrder.indexOf(requiredRole);
}

export function isValidRole(value: string): value is CommunityRole {
  return roleOrder.includes(value as CommunityRole);
}

export async function logMembershipActivity(
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

export async function openLeadershipRole(input: {
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
    label: `Appointed ${roleLabel}${community?.name ? ` of ${community.name}` : ''}`,
    refId: created._id.toString(),
    communityId: String(input.communityId),
  });
}

export async function closeOpenLeadershipRoles(membershipId: unknown) {
  await LeadershipRoleModel.updateMany(
    { membershipId, endDate: null },
    { $set: { endDate: new Date() } },
  );
}

export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

export function ensureNonEmpty(value: string, label: string) {
  if (!value?.trim()) {
    throw new Error(`${label} is required`);
  }
}

export const FIELD_MAX_LENGTHS = {
  name: 100,
  shortDescription: 160,
  description: 2000,
  category: 50,
  university: 120,
  faculty: 120,
  department: 120,
} as const;

export function ensureMaxLength(value: string | undefined, label: string, max: number) {
  if (value !== undefined && value.trim().length > max) {
    throw new Error(`${label} must be at most ${max} characters`);
  }
}

export function validateCommunityFields(input: Partial<{
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

/** Community roles that count as "leadership" for management/history listings and content purges. */
export const LEADER_ROLES = ['FOUNDER', 'PRESIDENT', 'VICE_PRESIDENT', 'TREASURER', 'SECRETARY', 'ORGANIZER', 'COORDINATOR'];

// How many same-university verified-leader endorsements auto-verify a community.
export const ENDORSEMENT_THRESHOLD = 2;
