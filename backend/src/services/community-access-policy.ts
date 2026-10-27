import { UserModel } from '../models/user.model';

/** Fresh database approval, never a role label, token claim or browser cookie. */
export async function hasApprovedCommunityAccess(userId: string): Promise<boolean> {
  const user = await UserModel.findById(userId).select('role status deletedAt emailVerified communityAccessStatus').lean();
  return Boolean(user && user.status === 'ACTIVE' && !user.deletedAt && user.emailVerified && (user.role === 'ADMIN' || user.communityAccessStatus === 'APPROVED'));
}
export async function assertApprovedCommunityAccess(userId: string) {
  if (!await hasApprovedCommunityAccess(userId)) throw new Error('Community Mode approval and verified account email are required');
}
