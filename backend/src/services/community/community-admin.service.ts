import { CommunityModel } from '../../models/community.model';
import { CommunityEndorsementModel } from '../../models/community-endorsement.model';
import { CommunityJoinRequestModel } from '../../models/community-join-request.model';
import { CommunityFollowModel } from '../../models/community-follow.model';
import { MembershipModel } from '../../models/membership.model';
import { PostModel } from '../../models/post.model';
import { EventModel } from '../../models/event.model';
import { createNotification } from '../notification.service';
import { hasCommunityPermission, logMembershipActivity, LEADER_ROLES } from './community-shared';

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
