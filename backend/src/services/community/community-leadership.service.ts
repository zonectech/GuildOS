import { CommunityModel } from '../../models/community.model';
import { LeadershipRoleModel } from '../../models/leadership-role.model';
import { MembershipModel } from '../../models/membership.model';
import { hasCommunityPermission, logMembershipActivity } from './community-shared';

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
