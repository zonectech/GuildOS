import mongoose from 'mongoose';
import { ProfileViewModel, type ProfileViewSource, type ViewerRole } from '../models/profile-view.model';
import { NotificationModel } from '../models/notification.model';
import { CertificateModel } from '../models/certificate.model';
import { authStore } from '../store/auth-store';
import { createNotification } from './notification.service';

function normalizeAvatar(avatar?: string) {
  if (!avatar) return '';
  if (avatar.startsWith('http') || avatar.startsWith('/')) return avatar;
  return `/uploads/${avatar}`;
}

/**
 * Records a profile/certificate view. No-ops on self-views. Fire-and-forget: never throws
 * into the request flow. When a RECRUITER views a profile, a notification is created at most
 * once per recruiter/target per 24h.
 */
export async function recordProfileView(input: {
  targetUserId: string;
  viewerId?: string | null;
  viewerRole?: ViewerRole;
  source?: ProfileViewSource;
  refId?: string;
}) {
  try {
    const { targetUserId, viewerId } = input;
    if (!targetUserId || !mongoose.Types.ObjectId.isValid(targetUserId)) return;
    if (viewerId && viewerId === targetUserId) return;

    await ProfileViewModel.create({
      targetUserId,
      viewerId: viewerId && mongoose.Types.ObjectId.isValid(viewerId) ? viewerId : null,
      viewerRole: input.viewerRole ?? 'ANON',
      source: input.source ?? 'PROFILE',
      refId: input.refId ?? '',
    });

    if (input.viewerRole === 'RECRUITER' && viewerId) {
      const since = new Date(Date.now() - 1000 * 60 * 60 * 24);
      const recent = await NotificationModel.findOne({
        userId: targetUserId,
        actorId: viewerId,
        type: 'SYSTEM',
        title: /recruiter viewed your profile/i,
        createdAt: { $gte: since },
      }).lean();
      if (!recent) {
        const actor = await authStore.getPublicUserById(viewerId).catch(() => null);
        await createNotification({
          userId: targetUserId,
          actorId: viewerId,
          type: 'SYSTEM',
          title: `A recruiter viewed your profile`,
          body: actor?.fullName ?? '',
          link: '/verification',
        });
      }
    }
  } catch (error) {
    console.warn('[GuildOS] profile view record failed', error instanceof Error ? error.message : error);
  }
}

export async function recordCertificateView(serial: string, viewerId: string | null, viewerRole: ViewerRole) {
  try {
    const cert = await CertificateModel.findOne({ serial }).select('userId').lean();
    if (!cert) return;
    await recordProfileView({ targetUserId: cert.userId.toString(), viewerId, viewerRole, source: 'CERTIFICATE', refId: serial });
  } catch {
    /* ignore */
  }
}

export async function getVerificationCenter(userId: string) {
  const now = Date.now();
  const monthAgo = new Date(now - 1000 * 60 * 60 * 24 * 30);

  const [certificatesVerified, profileViews, profileViews30d, recruiterViews, certificateViews, recentRows] = await Promise.all([
    CertificateModel.countDocuments({ userId, status: 'VERIFIED' }),
    ProfileViewModel.countDocuments({ targetUserId: userId, source: 'PROFILE' }),
    ProfileViewModel.countDocuments({ targetUserId: userId, source: 'PROFILE', createdAt: { $gte: monthAgo } }),
    ProfileViewModel.countDocuments({ targetUserId: userId, viewerRole: 'RECRUITER' }),
    ProfileViewModel.countDocuments({ targetUserId: userId, source: 'CERTIFICATE' }),
    ProfileViewModel.find({ targetUserId: userId }).sort({ createdAt: -1 }).limit(15).lean(),
  ]);

  const viewerIds = [...new Set(recentRows.filter((r) => r.viewerId).map((r) => r.viewerId!.toString()))];
  const viewers = await Promise.all(viewerIds.map((id) => authStore.getPublicUserById(id).catch(() => null)));
  const viewerById = new Map(
    viewers
      .filter((v): v is NonNullable<typeof v> => Boolean(v))
      .map((v) => [v.id, { id: v.id, fullName: v.fullName, username: v.profile?.username ?? '', avatar: normalizeAvatar(v.profile?.avatar) }]),
  );

  const recent = recentRows.map((r) => {
    const viewer = r.viewerId ? viewerById.get(r.viewerId.toString()) ?? null : null;
    // Only reveal identity for recruiters; keep other viewers anonymous for privacy.
    const showIdentity = r.viewerRole === 'RECRUITER' && viewer;
    return {
      id: r._id.toString(),
      source: r.source,
      viewerRole: r.viewerRole,
      createdAt: r.createdAt,
      viewer: showIdentity ? viewer : null,
      label: showIdentity ? viewer!.fullName : r.viewerRole === 'RECRUITER' ? 'A recruiter' : r.viewerRole === 'ANON' ? 'Someone (signed out)' : 'A GuildOS member',
    };
  });

  return {
    stats: { certificatesVerified, profileViews, profileViews30d, recruiterViews, certificateViews },
    recent,
  };
}
