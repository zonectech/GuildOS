import { CommunityModel } from '../../models/community.model';
import { CommunityLeaderModel } from '../../models/community-leader.model';
import { LeadershipRoleModel } from '../../models/leadership-role.model';
import { MembershipModel } from '../../models/membership.model';
import { hasCommunityPermission, logMembershipActivity } from './community-shared';

/** Normalize a role/title for dedupe: 'Vice President' and 'VICE_PRESIDENT' compare equal. */
function normalizeRoleLabel(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_');
}

/**
 * A user's complete leadership history for their public profile/resume.
 * Merges two sources:
 * - LeadershipRole records (opened automatically when a Membership is promoted — the permission-backed source)
 * - Curated CommunityLeader roster entries linked to this user (communities that manage
 *   their leadership team by session on their public page)
 * Roster entries that duplicate a membership-backed record (same community, same role label)
 * are skipped so the same post never shows twice.
 */
export async function getUserLeadershipHistory(userId: string) {
  const [records, rosterEntries] = await Promise.all([
    LeadershipRoleModel.find({ userId }).sort({ startDate: -1 }).lean(),
    CommunityLeaderModel.find({ linkedUserId: userId }).sort({ createdAt: -1 }).lean(),
  ]);

  const communityIds = [...new Set([...records, ...rosterEntries].map((r) => r.communityId.toString()))];
  const communities = await CommunityModel.find({ _id: { $in: communityIds } })
    .select('name slug logo verificationStatus')
    .lean();
  const communityById = new Map(communities.map((c) => [c._id.toString(), c]));

  const toCommunitySummary = (communityId: unknown) => {
    const community = communityById.get(String(communityId));
    return community
      ? {
          id: community._id.toString(),
          name: community.name,
          slug: community.slug,
          logo: community.logo,
          verificationStatus: community.verificationStatus,
        }
      : null;
  };

  const membershipEntries = records.map((record) => ({
    id: record._id.toString(),
    role: record.role as string,
    session: '',
    source: 'MEMBERSHIP' as const,
    startDate: record.startDate,
    endDate: record.endDate,
    current: record.endDate === null,
    verificationStatus: record.verificationStatus,
    assignedBy: record.assignedBy,
    community: toCommunitySummary(record.communityId),
  }));

  const covered = new Set(records.map((r) => `${r.communityId.toString()}:${normalizeRoleLabel(r.role)}`));
  const rosterMapped = rosterEntries
    .filter((entry) => !covered.has(`${entry.communityId.toString()}:${normalizeRoleLabel(entry.title || '')}`))
    .map((entry) => {
      const community = toCommunitySummary(entry.communityId);
      return {
        id: entry._id.toString(),
        role: entry.title || 'Leadership Team',
        session: entry.session ?? '',
        source: 'ROSTER' as const,
        startDate: entry.createdAt,
        endDate: entry.status === 'ACTIVE' ? null : entry.updatedAt,
        current: entry.status === 'ACTIVE',
        // Roster entries are written by the community's own VP+; a verified
        // community's roster is treated as a verified claim.
        verificationStatus: (community?.verificationStatus === 'VERIFIED' ? 'VERIFIED' : 'PENDING') as 'PENDING' | 'VERIFIED',
        assignedBy: entry.addedBy ?? null,
        community,
      };
    });

  return [...membershipEntries, ...rosterMapped].sort(
    (a, b) =>
      Number(b.current) - Number(a.current) ||
      new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
  );
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
