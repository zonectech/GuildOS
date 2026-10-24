import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { CertificateModel, type CertificateDocument } from '../../models/certificate.model';
import { CommunityModel } from '../../models/community.model';
import { DEFAULT_CERTIFICATE_CONTENT, DEFAULT_CERTIFICATE_THEME, type CertificateType } from '../../models/event.model';
import { MembershipModel } from '../../models/membership.model';
import { authStore } from '../../store/auth-store';
import { certificateEarnedEmail, sendEmail } from '../../utils/email';
import { certificateVerificationUrl, generateCertificateSerial } from '../event/event-certificate.service';
import { createNotification } from '../notification.service';
import { type CommunityRole } from '../../models/community.model';
import { hasCommunityPermission } from './community-shared';

const INACTIVE_MEMBER_STATUSES = ['REMOVED', 'LEFT', 'SUSPENDED'];
const ISSUABLE_TYPES: CertificateType[] = ['COMPLETION', 'LEADERSHIP', 'VOLUNTEER', 'ATTENDANCE'];

/** Title shown at the top of the certificate for each type (the achievement name goes underneath). */
const HEADING: Record<CertificateType, string> = {
  COMPLETION: 'Certificate of Achievement',
  LEADERSHIP: 'Certificate of Leadership',
  VOLUNTEER: 'Certificate of Appreciation',
  ATTENDANCE: 'Certificate of Participation',
};

export type IssuedCommunityCertificate = {
  serial: string;
  userId: string | null;
  recipientName: string;
  title: string;
  description: string;
  type: CertificateType;
  issuedAt: string;
  status: CertificateDocument['status'];
};

function serialize(doc: CertificateDocument & { _id: unknown }): IssuedCommunityCertificate {
  return {
    serial: doc.serial,
    userId: doc.userId ? doc.userId.toString() : null,
    recipientName: doc.attendeeName,
    title: doc.eventTitle,
    description: doc.content?.message ?? '',
    type: doc.type,
    issuedAt: new Date(doc.issuedAt ?? doc.createdAt).toISOString(),
    status: doc.status,
  };
}

/** Verified community + PRESIDENT-or-above on it, or throws with a message the route maps to a status. */
async function requireIssuer(communityId: string, actorId: string) {
  if (!mongoose.isValidObjectId(communityId)) throw new Error('Community not found');
  const community = await CommunityModel.findById(communityId).select('name verificationStatus').lean();
  if (!community) throw new Error('Community not found');
  if (community.verificationStatus !== 'VERIFIED') throw new Error('Verified community required to issue certificates');
  const membership = await MembershipModel.findOne({ communityId, userId: actorId }).select('role status').lean();
  if (!membership || INACTIVE_MEMBER_STATUSES.includes(membership.status as string) || !hasCommunityPermission(membership.role as CommunityRole, 'PRESIDENT')) {
    throw new Error('Insufficient permissions');
  }
  return community;
}

/**
 * Issues a real, QR-verifiable certificate (persisted like event certificates, so it shows on the
 * recipient's profile, CV and the public verify page) to each selected active member. Members who
 * already hold a certificate with the same title from this community are skipped, so a double
 * click or a re-run never duplicates.
 */
export async function issueCommunityCertificates(input: {
  communityId: string;
  actorId: string;
  userIds?: string[];
  role?: string;
  title?: string;
  description?: string;
  type?: string;
}) {
  const community = await requireIssuer(input.communityId, input.actorId);
  const title = (input.title ?? '').trim().slice(0, 140) || 'Community Achievement';
  const description = (input.description ?? '').trim().slice(0, 400);
  const type = ISSUABLE_TYPES.includes(input.type as CertificateType) ? (input.type as CertificateType) : 'COMPLETION';

  const memberQuery: Record<string, unknown> = { communityId: input.communityId, status: { $nin: INACTIVE_MEMBER_STATUSES } };
  if (input.role) memberQuery.role = input.role;
  const wanted = Array.isArray(input.userIds) ? input.userIds.map(String).filter((id) => mongoose.isValidObjectId(id)) : [];
  if (wanted.length) memberQuery.userId = { $in: wanted };
  const memberships = await MembershipModel.find(memberQuery).select('userId').lean();
  if (!memberships.length) throw new Error('No eligible members to issue certificates to');

  const recipientIds = memberships.map((m) => m.userId.toString());
  const existing = await CertificateModel.find({
    communityId: input.communityId,
    eventId: null,
    leaderId: null,
    eventTitle: title,
    userId: { $in: recipientIds },
    status: 'VERIFIED',
  }).select('userId').lean();
  const alreadyHas = new Set(existing.map((c) => c.userId?.toString()));

  const certificates: IssuedCommunityCertificate[] = [];
  const skipped: string[] = [];
  for (const userId of recipientIds) {
    const user = await authStore.getPublicUserById(userId).catch(() => null);
    if (!user) continue;
    if (alreadyHas.has(userId)) {
      skipped.push(`${user.fullName} (already has this certificate)`);
      continue;
    }
    const created = await CertificateModel.create({
      serial: await generateCertificateSerial(),
      verificationToken: randomUUID(),
      // Not tied to an event: eventId/leaderId stay null so the per-event and per-leader
      // uniqueness indexes don't apply.
      eventId: null,
      leaderId: null,
      registrationId: null,
      communityId: input.communityId,
      userId,
      attendeeName: user.fullName,
      eventTitle: title,
      communityName: community.name,
      university: user.profile?.university ?? '',
      type,
      mode: 'STANDARD',
      theme: DEFAULT_CERTIFICATE_THEME,
      style: 'CLASSIC',
      content: { ...DEFAULT_CERTIFICATE_CONTENT, title: HEADING[type], presentation: 'for', message: description },
      eventDate: new Date(),
      issuedBy: input.actorId,
      issuedAt: new Date(),
    });
    certificates.push(serialize(created.toObject()));

    void createNotification({
      userId,
      type: 'CERTIFICATE_EARNED',
      title: `${community.name} awarded you a certificate`,
      body: title,
      link: `/certificates/${created.serial}`,
    }).catch(() => undefined);
    if (user.email) {
      void sendEmail(user.email, certificateEarnedEmail(user.fullName, title, community.name, certificateVerificationUrl(created.serial))).catch(() => undefined);
    }
  }

  return { certificates, skipped, issued: certificates.length };
}

/** Certificates this community issued directly (not event or leadership-session ones), newest first. */
export async function listCommunityIssuedCertificates(communityId: string, actorId: string) {
  await requireIssuer(communityId, actorId);
  const docs = await CertificateModel.find({ communityId, eventId: null, leaderId: null })
    .sort({ issuedAt: -1 })
    .limit(200)
    .lean();
  return docs.map((doc) => serialize(doc as CertificateDocument & { _id: unknown }));
}
