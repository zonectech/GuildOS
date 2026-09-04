import { CommunityModel } from '../../models/community.model';
import { CommunityEndorsementModel } from '../../models/community-endorsement.model';
import { MembershipModel } from '../../models/membership.model';
import { UserModel } from '../../models/user.model';
import { EventModel } from '../../models/event.model';
import { authStore } from '../../store/auth-store';
import { recalculateReputation } from '../reputation.service';
import { LEADER_ROLES, ENDORSEMENT_THRESHOLD } from './community-shared';

/** An endorser's own community must have proven activity — not just a verified badge. */
const MIN_ENDORSER_COMPLETED_EVENTS = 5;

/** Completed events for a community (archived-after-completion counts; cancellations don't). */
async function completedEventCount(communityId: unknown) {
  return EventModel.countDocuments({
    communityId,
    deletedAt: null,
    $or: [{ status: 'COMPLETED' }, { status: 'ARCHIVED', cancellationReason: '' }],
  });
}

async function isVerifiedCommunityLeader(userId: string, sameUniversity?: string) {
  // Endorsement power requires proven institutional identity, not just a
  // self-assigned role: the endorser must have a verified school email AND hold
  // a leadership role in a community that is itself VERIFIED and has run at
  // least MIN_ENDORSER_COMPLETED_EVENTS completed events.
  const user = await UserModel.findById(userId).select('communityAccessEmailVerified').lean();
  if (!user?.communityAccessEmailVerified) {
    return false;
  }

  const memberships = await MembershipModel.find({
    userId,
    role: { $in: LEADER_ROLES },
    status: { $nin: ['REMOVED', 'LEFT'] },
  }).lean();

  if (!memberships.length) {
    return false;
  }

  const communities = await Promise.all(memberships.map((membership) => CommunityModel.findById(membership.communityId).lean()));
  let verified = communities.filter((community) => community?.verificationStatus === 'VERIFIED');

  if (sameUniversity && sameUniversity.trim()) {
    const target = sameUniversity.trim().toLowerCase();
    verified = verified.filter((community) => (community?.university ?? '').trim().toLowerCase() === target);
  }

  for (const community of verified) {
    if (!community) continue;
    if ((await completedEventCount(community._id)) >= MIN_ENDORSER_COMPLETED_EVENTS) {
      return true;
    }
  }
  return false;
}

/**
 * Whether a viewer qualifies to endorse this community — drives the endorse
 * form's visibility so unqualified users never see a dead "+" form.
 */
export async function canUserEndorseCommunity(communityId: string, userId?: string | null) {
  if (!userId) return false;
  const community = await CommunityModel.findById(communityId).lean();
  if (!community || community.archivedAt) return false;
  if (community.verificationStatus !== 'PENDING') return false;
  if (community.founder?.toString() === userId) return false;
  const existing = await CommunityEndorsementModel.findOne({ communityId, endorserId: userId }).select('_id').lean();
  if (existing) return false;
  return isVerifiedCommunityLeader(userId, community.university);
}

export async function listCommunityEndorsements(communityId: string) {
  const endorsements = await CommunityEndorsementModel.find({ communityId }).sort({ createdAt: -1 }).lean();
  const withUsers = await Promise.all(
    endorsements.map(async (endorsement) => {
      const user = await authStore.getPublicUserById(endorsement.endorserId.toString());
      return user ? { endorsement, user } : null;
    }),
  );

  return withUsers.filter(Boolean);
}

export async function createCommunityEndorsement(communityId: string, endorserId: string, note = '') {
  const community = await CommunityModel.findById(communityId);
  if (!community) {
    throw new Error('Community not found');
  }

  if (community.archivedAt) {
    throw new Error('Community is archived');
  }

  if (community.verificationStatus !== 'PENDING') {
    throw new Error('Community is not pending verification');
  }

  if (community.founder?.toString() === endorserId) {
    throw new Error('You cannot endorse your own community');
  }

  const verifiedLeader = await isVerifiedCommunityLeader(endorserId, community.university);
  if (!verifiedLeader) {
    throw new Error('Only verified community leaders from the same university can endorse communities');
  }

  const existing = await CommunityEndorsementModel.findOne({ communityId, endorserId });
  if (existing) {
    return existing;
  }

  const endorsement = await CommunityEndorsementModel.create({
    communityId,
    endorserId,
    note: note.trim(),
  });

  if (community.verificationMethod === 'ENDORSEMENT') {
    const endorsementCount = await CommunityEndorsementModel.countDocuments({ communityId });
    // Endorsements act as an accelerator: once enough same-university verified
    // leaders vouch, the community earns official status automatically.
    if (endorsementCount >= ENDORSEMENT_THRESHOLD) {
      community.verificationStatus = 'VERIFIED';
      community.verifiedAt = new Date();
      community.verificationNotes = `Auto-verified via ${endorsementCount} peer endorsements`;
      // Verification unlocks the founder's FOUNDER badge — refresh their score now.
      void recalculateReputation(community.founder.toString()).catch(() => undefined);
    } else {
      community.verificationNotes = `${endorsementCount}/${ENDORSEMENT_THRESHOLD} endorsements collected`;
    }
    await community.save();
  }

  return endorsement;
}
