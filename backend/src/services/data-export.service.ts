import { authStore } from '../store/auth-store';
import { PostModel } from '../models/post.model';
import { CertificateModel } from '../models/certificate.model';
import { ReputationScoreModel } from '../models/reputation-score.model';
import { ReputationActivityModel } from '../models/reputation-activity.model';
import { EventRegistrationModel } from '../models/event-registration.model';
import { MembershipModel } from '../models/membership.model';
import { ConnectionModel } from '../models/connection.model';
import { CvDocumentModel } from '../models/cv-document.model';

/**
 * Self-service GDPR-style data export — everything the platform holds that is directly
 * "about" the requesting user, in one JSON document they can download. Deliberately scoped to
 * data the user themselves created or that describes them (not moderation logs, admin notes,
 * or other users' content that merely references them).
 */
export async function exportUserData(userId: string) {
  const user = await authStore.getUserById(userId);
  if (!user) throw new Error('User not found');

  const [posts, certificates, reputationScore, reputationActivity, eventRegistrations, memberships, connections, cvDocuments] =
    await Promise.all([
      PostModel.find({ userId }).sort({ createdAt: -1 }).lean(),
      CertificateModel.find({ userId }).sort({ createdAt: -1 }).lean(),
      ReputationScoreModel.findOne({ userId }).lean(),
      ReputationActivityModel.find({ userId }).sort({ createdAt: -1 }).lean(),
      EventRegistrationModel.find({ userId }).sort({ createdAt: -1 }).lean(),
      MembershipModel.find({ userId }).sort({ createdAt: -1 }).lean(),
      ConnectionModel.find({ $or: [{ requesterId: userId }, { addresseeId: userId }], status: 'ACCEPTED' })
        .sort({ createdAt: -1 })
        .lean(),
      CvDocumentModel.find({ userId }).sort({ updatedAt: -1 }).lean(),
    ]);

  return {
    exportedAt: new Date().toISOString(),
    account: authStore.toPublicUser(user),
    posts: posts.map((p) => ({
      id: String(p._id),
      kind: p.kind,
      content: p.content,
      imageUrl: p.imageUrl ?? '',
      likeCount: p.likeCount,
      commentCount: p.commentCount,
      createdAt: p.createdAt,
    })),
    certificates: certificates.map((c) => ({
      serial: c.serial,
      eventTitle: c.eventTitle,
      attendeeName: c.attendeeName,
      type: c.type,
      status: c.status,
      createdAt: c.createdAt,
    })),
    reputation: reputationScore
      ? {
          guildScore: reputationScore.guildScore,
          level: reputationScore.level,
          attendanceScore: reputationScore.attendanceScore,
          leadershipScore: reputationScore.leadershipScore,
          volunteerScore: reputationScore.volunteerScore,
          speakerScore: reputationScore.speakerScore,
          organizerScore: reputationScore.organizerScore,
          badges: reputationScore.badges,
        }
      : null,
    reputationActivity: reputationActivity.map((a) => ({
      category: a.category,
      type: a.type,
      scoreAwarded: a.scoreAwarded,
      description: a.description,
      createdAt: a.createdAt,
    })),
    eventRegistrations: eventRegistrations.map((r) => ({
      eventId: String(r.eventId),
      status: r.status,
      createdAt: r.createdAt,
    })),
    communityMemberships: memberships.map((m) => ({
      communityId: String(m.communityId),
      role: m.role,
      status: m.status,
      createdAt: m.createdAt,
    })),
    connections: connections.map((c) => ({
      otherUserId: String(c.requesterId) === userId ? String(c.addresseeId) : String(c.requesterId),
      connectedSince: c.createdAt,
    })),
    cvDocuments: cvDocuments.map((d) => ({
      id: String(d._id),
      cvId: d.cvId,
      template: d.template,
      mode: d.mode,
      updatedAt: d.updatedAt,
    })),
  };
}
