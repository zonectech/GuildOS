import mongoose from 'mongoose';
import { CommunityFollowModel } from '../models/community-follow.model';
import { CommunityModel } from '../models/community.model';
import { authStore } from '../store/auth-store';
import { createNotification } from './notification.service';

export async function toggleFollow(userId: string, communityId: string) {
  const community = await CommunityModel.findById(communityId).select('_id name slug founder verificationStatus archivedAt').lean();
  if (!community) {
    throw new Error('Community not found');
  }
  const existing = await CommunityFollowModel.findOne({ userId, communityId });
  if (existing) {
    await existing.deleteOne();
    await CommunityModel.updateOne({ _id: communityId }, { $inc: { followerCount: -1 } });
    return { following: false };
  }
  if ((community.verificationStatus !== 'VERIFIED' && community.verificationStatus !== 'UNVERIFIED') || community.archivedAt) {
    throw new Error('This community is not verified yet');
  }
  await CommunityFollowModel.create({ userId, communityId: new mongoose.Types.ObjectId(communityId) });
  await CommunityModel.updateOne({ _id: communityId }, { $inc: { followerCount: 1 } });
  if (community.founder) {
    const actor = await authStore.getPublicUserById(userId).catch(() => null);
    await createNotification({
      userId: community.founder.toString(),
      actorId: userId,
      type: 'COMMUNITY_FOLLOW',
      title: `${actor?.fullName ?? 'Someone'} followed ${community.name}`,
      link: `/communities/${community.slug}`,
    });
  }
  return { following: true };
}

export async function unfollowCommunity(userId: string, communityId: string) {
  const result = await CommunityFollowModel.deleteOne({ userId, communityId });
  if (result.deletedCount) {
    await CommunityModel.updateOne({ _id: communityId }, { $inc: { followerCount: -1 } });
  }
  return { following: false };
}

export async function listFollowedCommunityIds(userId: string): Promise<string[]> {
  const rows = await CommunityFollowModel.find({ userId }).select('communityId').lean();
  return rows.map((r) => r.communityId.toString());
}
