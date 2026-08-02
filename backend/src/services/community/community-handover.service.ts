import { CommunityLeaderModel } from '../../models/community-leader.model';
import { CommunityModel, type CommunityRole } from '../../models/community.model';
import { MembershipModel } from '../../models/membership.model';
import { hasCommunityPermission } from './community-shared';
import { updateMemberRole, joinCommunityByInvite } from './community-membership.service';
import { transferCommunityOwnership } from './community-core.service';
import { createNotification } from '../notification.service';

/**
 * Roles a handover can hand out — the real leadership permission set.
 * FOUNDER is deliberately excluded (that's the separate ownership transfer).
 */
const HANDOVER_ROLES: CommunityRole[] = ['PRESIDENT', 'VICE_PRESIDENT', 'SECRETARY', 'TREASURER', 'COORDINATOR'];

export type HandoverAssignment = {
  /** CommunityLeader roster entry id — must be linked to a GuildOS account. */
  leaderId: string;
  role: CommunityRole;
};

/**
 * The year-end permission bridge: the CommunityLeader roster is deliberately
 * cosmetic (people without accounts can be listed), so importing a new session's
 * excos gives them ZERO management power. This turns roster entries with linked
 * GuildOS accounts into REAL Membership roles in one action:
 *
 * - linked user not a member yet  → membership created, then the role assigned
 * - linked user already a member  → role updated
 * - all of updateMemberRole's rank guards apply (can't assign at/above your own
 *   rank, can't touch the founder), so a VP can't mint a new President — only
 *   the president/founder can
 * - optional ownership transfer (founder-only) rides along at the end so the
 *   whole year-end handover is one flow
 *
 * Each appointee gets a bell notification. Assignments are processed
 * independently — one failure (e.g. rank guard) doesn't abort the rest; the
 * caller gets a per-assignment result list.
 */
export async function handoverCommunityLeadership(
  communityId: string,
  actorId: string,
  assignments: HandoverAssignment[],
  options?: { transferOwnershipToLeaderId?: string | null },
) {
  const community = await CommunityModel.findById(communityId);
  if (!community) {
    throw new Error('Community not found');
  }
  if (community.archivedAt) {
    throw new Error('Community is archived');
  }

  const actor = await MembershipModel.findOne({ communityId, userId: actorId });
  if (!actor || !hasCommunityPermission(actor.role, 'VICE_PRESIDENT')) {
    throw new Error('Insufficient permissions');
  }

  const results: { leaderId: string; name: string; role: CommunityRole; status: 'ASSIGNED' | 'FAILED'; error?: string }[] = [];

  for (const assignment of assignments.slice(0, 30)) {
    const outcome = { leaderId: assignment.leaderId, name: '', role: assignment.role, status: 'FAILED' as 'ASSIGNED' | 'FAILED', error: undefined as string | undefined };
    try {
      if (!HANDOVER_ROLES.includes(assignment.role)) {
        throw new Error('Invalid handover role');
      }
      const leader = await CommunityLeaderModel.findOne({ _id: assignment.leaderId, communityId });
      if (!leader) throw new Error('Roster entry not found');
      outcome.name = leader.name;
      if (!leader.linkedUserId) throw new Error('No linked GuildOS account');

      let membership = await MembershipModel.findOne({ communityId, userId: leader.linkedUserId });
      if (!membership) {
        // Not a member yet — bring them in first (MEMBER), then promote below.
        await joinCommunityByInvite(communityId, leader.linkedUserId.toString());
        membership = await MembershipModel.findOne({ communityId, userId: leader.linkedUserId });
        if (!membership) throw new Error('Unable to create membership');
      }

      if (membership.role !== assignment.role) {
        await updateMemberRole(communityId, membership._id.toString(), assignment.role, actorId);
      }

      await createNotification({
        userId: leader.linkedUserId.toString(),
        type: 'SYSTEM',
        title: `You're now ${assignment.role.replace('_', ' ')} of ${community.name}`,
        body: 'Leadership handover — you have management access for the new session.',
        link: `/communities/${community.slug}`,
      });

      outcome.status = 'ASSIGNED';
    } catch (error) {
      outcome.error = error instanceof Error ? error.message : 'Failed';
    }
    results.push(outcome);
  }

  // Optional final step: hand the community itself over (founder-only, enforced
  // inside transferCommunityOwnership).
  let ownershipTransferred = false;
  let ownershipError = '';
  if (options?.transferOwnershipToLeaderId) {
    try {
      const leader = await CommunityLeaderModel.findOne({ _id: options.transferOwnershipToLeaderId, communityId });
      if (!leader?.linkedUserId) throw new Error('Successor has no linked GuildOS account');
      const membership = await MembershipModel.findOne({ communityId, userId: leader.linkedUserId });
      if (!membership) throw new Error('Successor is not a member');
      await transferCommunityOwnership(communityId, actorId, membership._id.toString());
      ownershipTransferred = true;
    } catch (error) {
      ownershipError = error instanceof Error ? error.message : 'Ownership transfer failed';
    }
  }

  return {
    assigned: results.filter((r) => r.status === 'ASSIGNED').length,
    results,
    ownershipTransferred,
    ownershipError,
  };
}
