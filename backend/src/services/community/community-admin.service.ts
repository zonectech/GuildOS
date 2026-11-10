import { CommunityModel } from '../../models/community.model';
import { UserModel } from '../../models/user.model';
import { CommunityEndorsementModel } from '../../models/community-endorsement.model';
import { CommunityJoinRequestModel } from '../../models/community-join-request.model';
import { CommunityFollowModel } from '../../models/community-follow.model';
import { MembershipModel } from '../../models/membership.model';
import { PostModel } from '../../models/post.model';
import { EventModel } from '../../models/event.model';
import { createNotification } from '../notification.service';
import { schoolEmailVerification } from '../community-access.service';
import { recalculateReputation } from '../reputation.service';
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
  const communities = await CommunityModel.find({ verificationStatus: 'PENDING' }).sort({ createdAt: -1 }).lean();
  // Who is asking, so reviewers can check identity and authority together.
  const founders = await UserModel.find({ _id: { $in: communities.map((c) => c.founder) } })
    .select('fullName email emailVerified communityAccessEmail communityAccessEmailVerified profile.username profile.university').lean();
  const byId = new Map(founders.map((u) => [String(u._id), u]));
  return communities.map((c) => {
    const u = byId.get(String(c.founder));
    const school = u ? schoolEmailVerification(u) : { email: '', verified: false };
    return { ...c, applicant: u ? { id: String(u._id), fullName: u.fullName, email: u.email, username: u.profile?.username ?? '', university: u.profile?.university ?? '', schoolEmail: school.email, schoolEmailVerified: school.verified } : null };
  });
}

/**
 * A reviewer needs more before deciding. The community stays PENDING with the reviewer's message;
 * the founder is told, answers with an update, and it returns to the queue.
 */
export async function requestCommunityInfo(communityId: string, adminId: string, message: string) {
  const text = String(message ?? '').trim();
  if (text.length < 10) throw new Error('Tell the applicant what you need (at least a sentence)');
  const community = await CommunityModel.findById(communityId);
  if (!community) throw new Error('Community not found');
  if (community.verificationStatus !== 'PENDING') throw new Error('Only communities under review can be asked for more information');
  community.infoRequest = { message: text.slice(0, 1000), requestedAt: new Date(), requestedBy: adminId as any, response: '', respondedAt: null };
  await community.save();
  await createNotification({
    userId: community.founder.toString(), actorId: adminId, type: 'SYSTEM',
    title: `More information needed for ${community.name}`,
    body: text.slice(0, 200),
    link: '/communities/request/status',
  }).catch(() => undefined);
  return community;
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
  // Verifying the community is the founder's one approval: they can run events from now on.
  // The role label is display and targeting only, kept in step with access.
  await UserModel.updateOne({ _id: community.founder, communityAccessStatus: { $ne: 'APPROVED' } }, { $set: { communityAccessStatus: 'APPROVED' } });
  await UserModel.updateOne({ _id: community.founder, role: 'STUDENT' }, { $set: { role: 'COMMUNITY_LEADER' } });
  // Verification unlocks the founder's FOUNDER badge — refresh their score now.
  void recalculateReputation(community.founder.toString()).catch(() => undefined);
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

  const membership = await MembershipModel.findOne({ communityId, userId: actorId, status: 'ACTIVE' });
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

  const membership = await MembershipModel.findOne({ communityId, userId: actorId, status: 'ACTIVE' });
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
  void createNotification({ userId: String(request.userId), type: 'SYSTEM', title: `Your request to join ${community.name} was declined`, body: 'You can still attend its public events.', link: `/communities/${community.slug}` });

  return request;
}
