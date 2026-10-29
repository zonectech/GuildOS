import { CommunityModel } from '../models/community.model';
export class CommunityInactiveError extends Error {}
export async function assertCommunityActive(communityId: unknown) {
  const community = await CommunityModel.findById(communityId).select('archivedAt adminSuspended verificationStatus').lean();
  if (!community) throw new Error('Community not found');
  if (community.verificationStatus && !['VERIFIED','UNVERIFIED'].includes(community.verificationStatus)) throw new CommunityInactiveError('Community verification is pending or rejected');
  if (community.archivedAt || community.adminSuspended) throw new CommunityInactiveError('This community is suspended or archived');
}
export async function activeCommunityIds(ids: string[]) {
  const communities = await CommunityModel.find({_id:{$in:ids},archivedAt:null,adminSuspended:{$ne:true},verificationStatus:{$in:['VERIFIED','UNVERIFIED']}}).select('_id').lean();
  return communities.map(community=>String(community._id));
}
