import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { config } from '../../config';
import { EventModel, DEFAULT_CERTIFICATE_THEME, DEFAULT_CERTIFICATE_CONTENT } from '../../models/event.model';
import { EventSponsorModel } from '../../models/event-sponsor.model';
import { EventPartnershipModel } from '../../models/event-partnership.model';
import { EventRegistrationModel } from '../../models/event-registration.model';
import { CertificateModel } from '../../models/certificate.model';
import { CommunityModel } from '../../models/community.model';
import { authStore } from '../../store/auth-store';
import { buildDomainActivityRecord } from '../domain-activity.service';
import { createMilestonePost } from '../feed.service';
import { createNotification } from '../notification.service';
import { sendEmail, certificateEarnedEmail } from '../../utils/email';
import { requireEventManager, isMultiDayEvent, distinctDaysAttended, eventTotalDays } from './event-shared';
import { sendEventAppreciation } from './event-registration.service';

async function generateCertificateSerial(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `GLD-${year}-`;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const count = await CertificateModel.countDocuments({ serial: { $regex: `^${prefix}` } });
    const serial = `${prefix}${String(count + 1 + attempt).padStart(6, '0')}`;
    const exists = await CertificateModel.exists({ serial });
    if (!exists) return serial;
  }
  return `${prefix}${randomUUID().slice(0, 6).toUpperCase()}`;
}

function certificateVerificationUrl(serial: string) {
  return `${config.frontendUrl}/certificates/${serial}`;
}

export async function issueEventCertificates(eventId: string, actorId: string) {
  const event = await requireEventManager(eventId, actorId);
  if (!event.certificateEnabled) {
    throw new Error('Certificates are not enabled for this event');
  }
  const mode = event.certificateMode ?? 'STANDARD';
  if (mode === 'CUSTOM' && !event.certificateTemplate) {
    throw new Error('Upload a certificate template before issuing');
  }

  const community = await CommunityModel.findById(event.communityId).lean();
  if (!community) {
    throw new Error('Community not found');
  }
  if (community.verificationStatus !== 'VERIFIED') {
    throw new Error('Only verified communities can issue certificates');
  }

  const eligible = await EventRegistrationModel.find({ eventId, status: 'COMPLETED', certificateIssued: false });
  let issued = 0;

  for (const registration of eligible) {
    const user = await authStore.getPublicUserById(registration.userId.toString());
    if (!user) continue;

    const existing = await CertificateModel.findOne({ eventId, userId: registration.userId });
    if (!existing) {
      const created = await CertificateModel.create({
        serial: await generateCertificateSerial(),
        verificationToken: randomUUID(),
        eventId,
        communityId: event.communityId,
        userId: registration.userId,
        registrationId: registration._id,
        attendeeName: user.fullName,
        eventTitle: event.title,
        communityName: community.name,
        university: user.profile?.university ?? '',
        type: event.certificateType ?? 'ATTENDANCE',
        mode,
        templateImage: mode === 'CUSTOM' ? event.certificateTemplate : '',
        namePlacement: event.certificateNamePlacement,
        theme: event.certificateTheme ?? DEFAULT_CERTIFICATE_THEME,
        content: event.certificateContent ?? DEFAULT_CERTIFICATE_CONTENT,
        style: event.certificateStyle ?? 'CLASSIC',
        eventDate: event.startDate ?? null,
        attendanceMinutes: registration.attendanceMinutes ?? 0,
        // Multi-day proof-of-work: "Attended 3 of 3 days" on the certificate.
        daysAttended: isMultiDayEvent(event) ? distinctDaysAttended(event, registration) : 0,
        totalDays: isMultiDayEvent(event) ? eventTotalDays(event) : 0,
        issuedBy: actorId,
      });
      await buildDomainActivityRecord(registration.userId.toString(), 'CERTIFICATE', event.title, `Certificate for ${event.title}`);
      await createMilestonePost(registration.userId.toString(), {
        type: 'CERTIFICATE',
        label: `Earned a verified certificate for ${event.title} · @${community.name}`,
        refId: created._id.toString(),
        communityId: event.communityId.toString(),
        // Tag the community so the caption renders it as a clickable mention.
        tags: [{ type: 'COMMUNITY', refId: event.communityId.toString(), label: community.name, handle: community.slug }],
      });
      await createNotification({
        userId: registration.userId.toString(),
        type: 'CERTIFICATE_EARNED',
        title: `You earned a certificate for ${event.title}`,
        body: community.name,
        link: `/certificates/${created.serial}`,
      });
      // Instant congratulations email (fire-and-forget so the issue loop stays fast).
      if (user.email) {
        void sendEmail(
          user.email,
          certificateEarnedEmail(user.fullName, event.title, community.name, certificateVerificationUrl(created.serial)),
        ).catch(() => undefined);
      }
    }

    registration.certificateIssued = true;
    await registration.save();
    issued += 1;
  }

  const total = await CertificateModel.countDocuments({ eventId });
  await EventModel.updateOne({ _id: eventId }, { certificatesIssued: total });

  // AUTO appreciation: pair the thank-you blast with the certificate drop so
  // organizers don't have to remember it (CUSTOM = designed by hand, OFF = none).
  let appreciationSent = Boolean(event.appreciationSentAt);
  if (issued > 0 && event.appreciationMode === 'AUTO' && !event.appreciationSentAt) {
    await sendEventAppreciation(eventId, actorId, {})
      .then(() => {
        appreciationSent = true;
      })
      .catch((error) => {
        console.warn('[GuildOS] auto appreciation failed:', error instanceof Error ? error.message : error);
      });
  }

  return { issued, totalCertificates: total, appreciationSent };
}

export async function listUserCertificates(userId: string) {
  const certificates = await CertificateModel.find({ userId }).sort({ issuedAt: -1 }).lean();
  return certificates.map((certificate) => ({
    serial: certificate.serial,
    eventTitle: certificate.eventTitle,
    communityName: certificate.communityName,
    type: certificate.type ?? 'ATTENDANCE',
    status: certificate.status ?? 'VERIFIED',
    verificationUrl: certificateVerificationUrl(certificate.serial),
    issuedAt: certificate.issuedAt,
  }));
}

/** Light certificate lookup for link previews — never touches verification counters. */
export async function getCertificateMetaBySerial(serial: string) {
  const certificate = await CertificateModel.findOne({ serial })
    .select('serial attendeeName eventTitle communityName type status issuedAt')
    .lean();
  if (!certificate) {
    throw new Error('Certificate not found');
  }
  return {
    serial: certificate.serial,
    attendeeName: certificate.attendeeName,
    eventTitle: certificate.eventTitle,
    communityName: certificate.communityName,
    type: certificate.type ?? 'ATTENDANCE',
    status: certificate.status ?? 'VERIFIED',
    issuedAt: certificate.issuedAt,
  };
}

export async function getCertificateBySerial(serial: string) {
  const certificate = await CertificateModel.findOneAndUpdate(
    { serial },
    { $inc: { verificationCount: 1 }, $set: { lastVerifiedAt: new Date() } },
    { new: true },
  ).lean();
  if (!certificate) {
    throw new Error('Certificate not found');
  }
  const status = certificate.status ?? 'VERIFIED';
  // Sponsor perk delivery (LOGO_CERTIFICATES): sponsors flagged for certificate
  // placement appear on every certificate issued for the event.
  const [certificateSponsors, certEvent, acceptedPartnerships] = await Promise.all([
    EventSponsorModel.find({ eventId: certificate.eventId, showOnCertificate: true })
      .sort({ createdAt: 1 })
      .select('name logo')
      .lean(),
    EventModel.findById(certificate.eventId).select('partners').lean(),
    EventPartnershipModel.find({ eventId: certificate.eventId, status: 'ACCEPTED' }).select('communityId').lean(),
  ]);
  const coHostCommunities = acceptedPartnerships.length
    ? await CommunityModel.find({ _id: { $in: acceptedPartnerships.map((p) => p.communityId) } }).select('name logo').lean()
    : [];
  return {
    verified: status === 'VERIFIED',
    status,
    serial: certificate.serial,
    attendeeName: certificate.attendeeName,
    studentName: certificate.attendeeName,
    eventTitle: certificate.eventTitle,
    eventName: certificate.eventTitle,
    communityName: certificate.communityName,
    university: certificate.university ?? '',
    type: certificate.type ?? 'ATTENDANCE',
    mode: certificate.mode ?? 'STANDARD',
    templateImage: certificate.templateImage,
    namePlacement: certificate.namePlacement,
    theme: certificate.theme ?? DEFAULT_CERTIFICATE_THEME,
    content: certificate.content ?? DEFAULT_CERTIFICATE_CONTENT,
    style: certificate.style ?? 'CLASSIC',
    eventDate: certificate.eventDate,
    attendanceDuration: certificate.attendanceMinutes ?? 0,
    attendanceMinutes: certificate.attendanceMinutes ?? 0,
    daysAttended: certificate.daysAttended ?? 0,
    totalDays: certificate.totalDays ?? 0,
    verificationUrl: certificateVerificationUrl(certificate.serial),
    verificationCount: certificate.verificationCount ?? 0,
    revokeReason: certificate.revokeReason ?? '',
    issueDate: certificate.issuedAt,
    issuedAt: certificate.issuedAt,
    sponsors: certificateSponsors.map((s) => ({ name: s.name, logo: s.logo })),
    partners: (certEvent?.partners ?? []).map((p) => ({ name: p.name, logo: p.logo })),
    coHosts: coHostCommunities.map((c) => ({ name: c.name, logo: c.logo })),
  };
}

export async function revokeCertificate(serial: string, adminId: string, reason: string) {
  const certificate = await CertificateModel.findOne({ serial });
  if (!certificate) {
    throw new Error('Certificate not found');
  }
  certificate.status = 'REVOKED';
  certificate.revokedAt = new Date();
  certificate.revokedBy = new mongoose.Types.ObjectId(adminId);
  certificate.revokeReason = reason?.trim() ?? '';
  await certificate.save();
  return {
    serial: certificate.serial,
    status: certificate.status,
    revokedAt: certificate.revokedAt,
    revokeReason: certificate.revokeReason,
  };
}
