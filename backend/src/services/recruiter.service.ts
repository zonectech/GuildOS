import { UserModel } from '../models/user.model';
import mongoose from 'mongoose';
import { RecruiterProfileModel } from '../models/recruiter-profile.model';
import { OpportunityModel } from '../models/opportunity.model';
import { OpportunityActionModel } from '../models/opportunity-action.model';
import { ApplicantReviewModel } from '../models/applicant-review.model';
import { MembershipModel } from '../models/membership.model';
import { CommunityModel } from '../models/community.model';
import { ReputationScoreModel } from '../models/reputation-score.model';
import { authStore } from '../store/auth-store';

export type RecruiterTier = 'Unverified' | 'Verified Recruiter' | 'Trusted Employer' | 'Top Campus Employer';

function recruiterTier(verified: boolean, successfulHires: number): RecruiterTier {
  if (!verified) return 'Unverified';
  if (successfulHires >= 20) return 'Top Campus Employer';
  if (successfulHires >= 5) return 'Trusted Employer';
  return 'Verified Recruiter';
}

export async function computeRecruiterReputation(userId: string) {
  const profile = await RecruiterProfileModel.findOne({ userId }).lean();
  const opps = await OpportunityModel.find({ postedBy: userId }).select('_id').lean();
  const oppIds = opps.map((o) => o._id);

  const [successfulHires, totalApplicants, reviewedCount] = await Promise.all([
    oppIds.length ? ApplicantReviewModel.countDocuments({ opportunityId: { $in: oppIds }, status: 'HIRED' }) : 0,
    oppIds.length ? OpportunityActionModel.countDocuments({ opportunityId: { $in: oppIds }, action: 'APPLIED' }) : 0,
    oppIds.length ? ApplicantReviewModel.countDocuments({ opportunityId: { $in: oppIds }, status: { $ne: 'NEW' } }) : 0,
  ]);

  const verified = Boolean(profile?.verified);
  const responseRate = totalApplicants > 0 ? Math.min(100, Math.round((reviewedCount / totalApplicants) * 100)) : 0;

  return {
    company: profile?.company ?? '',
    verified,
    tier: recruiterTier(verified, successfulHires),
    successfulHires,
    totalApplicants,
    responseRate,
    activeSince: profile?.createdAt ?? null,
  };
}

export async function getRecruiterAnalytics(userId: string) {
  const opps = await OpportunityModel.find({ postedBy: userId }).lean();
  const oppIds = opps.map((o) => o._id);

  const totalViews = opps.reduce((n, o) => n + (o.viewCount ?? 0), 0);

  const [applied, saved, interested, hires] = await Promise.all([
    oppIds.length ? OpportunityActionModel.countDocuments({ opportunityId: { $in: oppIds }, action: 'APPLIED' }) : 0,
    oppIds.length ? OpportunityActionModel.countDocuments({ opportunityId: { $in: oppIds }, action: 'SAVED' }) : 0,
    oppIds.length ? OpportunityActionModel.countDocuments({ opportunityId: { $in: oppIds }, action: 'INTERESTED' }) : 0,
    oppIds.length ? ApplicantReviewModel.countDocuments({ opportunityId: { $in: oppIds }, status: 'HIRED' }) : 0,
  ]);

  const applicantIds = oppIds.length
    ? await OpportunityActionModel.distinct('userId', { opportunityId: { $in: oppIds }, action: { $in: ['APPLIED', 'INTERESTED'] } })
    : [];

  const scores = applicantIds.length ? await ReputationScoreModel.find({ userId: { $in: applicantIds } }).select('university guildScore').lean() : [];

  const uniMap = new Map<string, number>();
  const bands = { '0–499': 0, '500–1499': 0, '1500–4999': 0, '5000+': 0 };
  for (const s of scores) {
    const uni = s.university || 'Unknown';
    uniMap.set(uni, (uniMap.get(uni) ?? 0) + 1);
    const g = s.guildScore ?? 0;
    if (g >= 5000) bands['5000+'] += 1;
    else if (g >= 1500) bands['1500–4999'] += 1;
    else if (g >= 500) bands['500–1499'] += 1;
    else bands['0–499'] += 1;
  }
  const byUniversity = Array.from(uniMap.entries()).map(([university, count]) => ({ university, count })).sort((a, b) => b.count - a.count).slice(0, 8);
  const byScoreBand = Object.entries(bands).map(([band, count]) => ({ band, count }));

  // Top communities among applicants.
  let byCommunity: Array<{ community: string; count: number }> = [];
  if (applicantIds.length) {
    const grouped = await MembershipModel.aggregate([
      { $match: { userId: { $in: applicantIds }, status: 'ACTIVE' } },
      { $group: { _id: '$communityId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]);
    const communities = await CommunityModel.find({ _id: { $in: grouped.map((g) => g._id) } }).select('name').lean();
    const nameById = new Map(communities.map((c) => [c._id.toString(), c.name]));
    byCommunity = grouped.map((g) => ({ community: nameById.get(g._id.toString()) ?? 'Community', count: g.count }));
  }

  const perOpportunity = opps
    .map((o) => ({ id: o._id.toString(), title: o.title, views: o.viewCount ?? 0, applyCount: o.applyCount ?? 0, saveCount: o.saveCount ?? 0 }))
    .sort((a, b) => b.views - a.views);

  return {
    summary: { opportunities: opps.length, totalViews, applied, saved, interested, hires },
    byUniversity,
    byScoreBand,
    byCommunity,
    perOpportunity,
  };
}

export async function registerRecruiter(
  userId: string,
  input: { company?: string; position?: string; website?: string; about?: string },
) {
  const company = input.company?.trim();
  if (!company) {
    throw new Error('Company name is required');
  }

  const user = await UserModel.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  if (user.role === 'ADMIN') {
    throw new Error('Admins cannot register as recruiters');
  }
  user.role = 'RECRUITER';
  await user.save();

  const profile = await RecruiterProfileModel.findOneAndUpdate(
    { userId },
    {
      $set: {
        company,
        position: input.position?.trim() ?? '',
        website: input.website?.trim() ?? '',
        about: input.about?.trim() ?? '',
      },
    },
    { new: true, upsert: true },
  ).lean();

  return {
    user: authStore.toPublicUser(user),
    recruiter: serializeRecruiter(profile),
  };
}

function serializeRecruiter(profile: {
  company: string;
  position: string;
  website: string;
  about: string;
  verified: boolean;
  verificationStatus?: string;
  verificationNote?: string;
} | null) {
  if (!profile) return null;
  return {
    company: profile.company,
    position: profile.position,
    website: profile.website,
    about: profile.about,
    verified: profile.verified,
    verificationStatus: profile.verificationStatus ?? (profile.verified ? 'VERIFIED' : 'UNVERIFIED'),
    verificationNote: profile.verificationNote ?? '',
  };
}

export async function getRecruiterDashboard(userId: string) {
  const profile = await RecruiterProfileModel.findOne({ userId }).lean();
  const opportunities = await OpportunityModel.find({ postedBy: userId }).select('_id status applyCount saveCount').lean();
  const opportunityIds = opportunities.map((o) => o._id);
  const totalApplicants = opportunityIds.length
    ? await OpportunityActionModel.countDocuments({ opportunityId: { $in: opportunityIds }, action: 'APPLIED' })
    : 0;

  const reputation = await computeRecruiterReputation(userId);

  return {
    recruiter: serializeRecruiter(profile),
    stats: {
      opportunities: opportunities.length,
      openOpportunities: opportunities.filter((o) => o.status === 'OPEN').length,
      totalApplicants,
    },
    reputation,
  };
}

export async function getPublicRecruiterReputation(userId: string) {
  const reputation = await computeRecruiterReputation(userId);
  // Public view omits nothing sensitive — company + trust signals only.
  return {
    company: reputation.company,
    verified: reputation.verified,
    tier: reputation.tier,
    successfulHires: reputation.successfulHires,
    responseRate: reputation.responseRate,
    activeSince: reputation.activeSince,
  };
}

export async function updateRecruiterProfile(
  userId: string,
  input: { company?: string; position?: string; website?: string; about?: string },
) {
  const existing = await RecruiterProfileModel.findOne({ userId });
  if (!existing) {
    throw new Error('Recruiter profile not found');
  }
  if (input.company !== undefined) {
    if (!input.company.trim()) throw new Error('Company name is required');
    existing.company = input.company.trim();
  }
  if (input.position !== undefined) existing.position = input.position.trim();
  if (input.website !== undefined) existing.website = input.website.trim();
  if (input.about !== undefined) existing.about = input.about.trim();
  await existing.save();
  return serializeRecruiter(existing.toObject());
}

export async function requestRecruiterVerification(userId: string) {
  const profile = await RecruiterProfileModel.findOne({ userId });
  if (!profile) {
    throw new Error('Recruiter profile not found');
  }
  if (profile.verificationStatus === 'VERIFIED') {
    throw new Error('Your account is already verified');
  }
  if (profile.verificationStatus === 'PENDING') {
    throw new Error('Verification is already pending review');
  }
  profile.verificationStatus = 'PENDING';
  profile.verificationNote = '';
  await profile.save();
  return serializeRecruiter(profile.toObject());
}

export async function listRecruiterVerificationRequests() {
  const profiles = await RecruiterProfileModel.find({ verificationStatus: 'PENDING' }).sort({ updatedAt: 1 }).lean();
  return Promise.all(
    profiles.map(async (p) => {
      const user = await authStore.getPublicUserById(p.userId.toString());
      return {
        userId: p.userId.toString(),
        fullName: user?.fullName ?? '',
        email: user?.email ?? '',
        company: p.company,
        position: p.position,
        website: p.website,
        about: p.about,
        requestedAt: p.updatedAt,
      };
    }),
  );
}

export async function reviewRecruiterVerification(userId: string, adminId: string, approve: boolean, note = '') {
  const profile = await RecruiterProfileModel.findOne({ userId });
  if (!profile) {
    throw new Error('Recruiter profile not found');
  }
  profile.verificationStatus = approve ? 'VERIFIED' : 'REJECTED';
  profile.verified = approve;
  profile.verificationNote = note.trim();
  profile.verifiedAt = approve ? new Date() : null;
  profile.verifiedBy = new mongoose.Types.ObjectId(adminId);
  await profile.save();

  // Reflect trust on the recruiter's listings so students see a verified badge.
  await OpportunityModel.updateMany({ postedBy: userId }, { $set: { recruiterVerified: approve } });

  return {
    userId,
    verificationStatus: profile.verificationStatus,
    verified: profile.verified,
    verificationNote: profile.verificationNote,
  };
}
