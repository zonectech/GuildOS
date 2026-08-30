import { randomUUID } from 'node:crypto';
import { CommunityModel } from '../../models/community.model';
import { CommunityJoinRequestModel, type CommunityJoinRequestStatus } from '../../models/community-join-request.model';
import { MembershipModel, type MembershipStatus } from '../../models/membership.model';
import { UserModel } from '../../models/user.model';
import { config } from '../../config';
import { categoryEmail, sendEmail } from '../../utils/email';
import {
  rankOf,
  isLeadershipRole,
  isValidRole,
  hasCommunityPermission,
  logMembershipActivity,
  openLeadershipRole,
  closeOpenLeadershipRoles,
} from './community-shared';
import type { CommunityRole } from '../../models/community.model';

export async function joinCommunity(communityId: string, userId: string) {
  const community = await CommunityModel.findById(communityId);
  if (!community) {
    throw new Error('Community not found');
  }

  if (community.archivedAt) {
    throw new Error('Community is archived');
  }

  // Verified and unverified communities are joinable; pending-review and
  // rejected ones are not ("allow them to belong" — unverified tier).
  if (community.verificationStatus !== 'VERIFIED' && community.verificationStatus !== 'UNVERIFIED') {
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

  // Unverified tier: members only — leadership roles (and their reputation
  // points) unlock once the community is verified.
  if (community.verificationStatus !== 'VERIFIED' && role !== 'MEMBER') {
    throw new Error('Unverified communities cannot assign roles — verify the community to unlock leadership roles');
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

/**
 * Bulk member invites by email (COORDINATOR+): paste a list of addresses, each gets a
 * branded email with the community's join link. Reuses the existing invite-token system —
 * a token is minted if the community doesn't have one yet. Existing members are skipped,
 * addresses are deduped, and the batch is capped so it can't be used as a spam cannon.
 */
export async function inviteMembersByEmail(communityId: string, actorId: string, emails: string[]) {
  const community = await CommunityModel.findById(communityId);
  if (!community) throw new Error('Community not found');
  if (community.archivedAt) throw new Error('Community is archived');

  const actor = await MembershipModel.findOne({ communityId, userId: actorId });
  if (!actor || !hasCommunityPermission(actor.role, 'COORDINATOR')) {
    throw new Error('Insufficient permissions');
  }

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const unique = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  if (unique.length === 0) throw new Error('No email addresses provided');
  if (unique.length > 50) throw new Error('At most 50 invites per batch — split larger lists');
  const invalid = unique.filter((e) => !EMAIL_RE.test(e));
  if (invalid.length) throw new Error(`Invalid email address: ${invalid[0]}`);

  if (!community.inviteToken) {
    community.inviteToken = randomUUID();
    await community.save();
  }
  const joinUrl = `${config.frontendUrl}/communities/join/${community.inviteToken}`;

  // Skip addresses that already belong to an active member.
  const existingUsers = await UserModel.find({ email: { $in: unique } }).select('_id email').lean();
  const existingByEmail = new Map(existingUsers.map((u) => [u.email.toLowerCase(), u._id]));
  const memberIds = existingUsers.length
    ? new Set(
        (await MembershipModel.find({ communityId, userId: { $in: existingUsers.map((u) => u._id) }, status: 'ACTIVE' }).select('userId').lean()).map((m) =>
          m.userId.toString(),
        ),
      )
    : new Set<string>();

  let sent = 0;
  let skippedMembers = 0;
  const failures: string[] = [];
  for (const email of unique) {
    const uid = existingByEmail.get(email);
    if (uid && memberIds.has(uid.toString())) {
      skippedMembers += 1;
      continue;
    }
    const template = categoryEmail('INFO', {
      subject: `You're invited to join ${community.name} on GuildOS`,
      heading: `Join ${community.name}`,
      message: `${community.name} has invited you to join their community on GuildOS — the platform where student communities run events, share knowledge, and issue verified certificates.\n\nClick the button below to join. If you don't have a GuildOS account yet, you can create one in a minute.`,
      ctaLabel: `Join ${community.name}`,
      ctaUrl: joinUrl,
      note: 'If you were not expecting this invitation you can safely ignore this email.',
    });
    try {
      await sendEmail(email, template);
      sent += 1;
    } catch {
      failures.push(email);
    }
  }

  await logMembershipActivity(actor._id, community._id, 'MEMBERS_INVITED', actorId, { sent, skippedMembers, failed: failures.length });
  return { sent, skippedMembers, failed: failures };
}
