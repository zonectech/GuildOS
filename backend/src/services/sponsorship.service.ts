import { EventModel } from '../models/event.model';
import { SPONSOR_PERK_KEYS } from '../models/event.model';
import { EventSponsorModel } from '../models/event-sponsor.model';
import { EventRegistrationModel } from '../models/event-registration.model';
import { CommunityModel } from '../models/community.model';
import { PlatformSettingsModel } from '../models/platform-settings.model';
import { SponsorshipInquiryModel, type SponsorshipFeeStatus, type SponsorshipInquiryStatus } from '../models/sponsorship-inquiry.model';
import { requireEditableEvent } from './event.service';
import { createCommunityPost } from './feed.service';
import { createNotification } from './notification.service';

/**
 * Recommended tier structure: certificate logos are reserved for the top tier so the
 * certificate strip stays uncluttered and the premium package keeps its prestige.
 */
const DEFAULT_PACKAGE_TEMPLATES = [
  {
    name: 'Gold Sponsor',
    price: '₦150,000',
    perks: ['LOGO_EVENT_PAGE', 'LOGO_CERTIFICATES', 'SOCIAL_ANNOUNCEMENT', 'ATTENDANCE_REPORT', 'STAGE_MENTION', 'BOOTH', 'VENUE_BANNER'],
    benefits: '',
  },
  {
    name: 'Silver Sponsor',
    price: '₦75,000',
    perks: ['LOGO_EVENT_PAGE', 'SOCIAL_ANNOUNCEMENT', 'ATTENDANCE_REPORT', 'VENUE_BANNER'],
    benefits: '',
  },
  {
    name: 'Bronze Sponsor',
    price: '₦30,000',
    perks: ['LOGO_EVENT_PAGE'],
    benefits: '',
  },
];

const SPONSORABLE_STATUSES = ['PUBLISHED', 'CHECK_IN', 'CHECK_OUT'];

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export type SponsorshipInquiryInput = {
  companyName?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  website?: string;
  packageName?: string;
  message?: string;
};

export async function createSponsorshipInquiry(eventId: string, input: SponsorshipInquiryInput) {
  const event = await EventModel.findOne({ _id: eventId, deletedAt: null }).lean();
  if (!event) {
    throw new Error('Event not found');
  }
  if (!event.sponsorshipOpen || !SPONSORABLE_STATUSES.includes(event.status)) {
    throw new Error('This event is not open for sponsorship');
  }

  const companyName = input.companyName?.trim() ?? '';
  const contactName = input.contactName?.trim() ?? '';
  const email = input.email?.trim().toLowerCase() ?? '';
  if (!companyName) throw new Error('Company name is required');
  if (!contactName) throw new Error('Contact name is required');
  if (!email || !isValidEmail(email)) throw new Error('A valid email is required');

  const packageName = input.packageName?.trim() ?? '';
  if (packageName && !event.sponsorshipPackages.some((p) => p.name === packageName)) {
    throw new Error('Unknown sponsorship package');
  }

  // Anti-spam: cap per-email inquiries per event and reject exact duplicates.
  const message = input.message?.trim().slice(0, 2000) ?? '';
  const priorCount = await SponsorshipInquiryModel.countDocuments({ eventId: event._id, email });
  if (priorCount >= 3) {
    throw new Error('You have already sent several inquiries for this event — the organizers will get back to you');
  }
  const duplicate = await SponsorshipInquiryModel.findOne({ eventId: event._id, email, packageName, message }).lean();
  if (duplicate) {
    throw new Error('You have already sent this inquiry');
  }

  const inquiry = await SponsorshipInquiryModel.create({
    eventId: event._id,
    communityId: event.communityId,
    companyName,
    contactName,
    email,
    phone: input.phone?.trim().slice(0, 40) ?? '',
    website: input.website?.trim().slice(0, 200) ?? '',
    packageName,
    message,
  });

  void createNotification({
    userId: event.createdBy.toString(),
    type: 'SYSTEM',
    title: `New sponsorship inquiry for "${event.title}"`,
    body: `${companyName}${packageName ? ` · ${packageName} package` : ''} — ${contactName} (${email})`,
    link: `/dashboard/events/create?slug=${event.slug}`,
  });

  return serializeInquiry(inquiry.toObject());
}

export async function listSponsorshipInquiries(eventId: string, actorId: string) {
  await requireEditableEvent(eventId, actorId);
  const inquiries = await SponsorshipInquiryModel.find({ eventId }).sort({ createdAt: -1 }).lean();
  return inquiries.map(serializeInquiry);
}

export async function setSponsorshipInquiryStatus(
  eventId: string,
  inquiryId: string,
  actorId: string,
  status: SponsorshipInquiryStatus,
) {
  await requireEditableEvent(eventId, actorId);
  if (!['NEW', 'CONTACTED', 'WON', 'CLOSED'].includes(status)) {
    throw new Error('Invalid inquiry status');
  }
  const inquiry = await SponsorshipInquiryModel.findOneAndUpdate(
    { _id: inquiryId, eventId },
    { status },
    { new: true },
  ).lean();
  if (!inquiry) {
    throw new Error('Inquiry not found');
  }
  return serializeInquiry(inquiry);
}

/**
 * Marks an inquiry as WON and publishes the company as an official event sponsor
 * (logo listing). This is how closed deals become visible on-platform. The organizer
 * reports the package won and the deal amount; a platform fee (percentage set by the
 * admin) becomes payable to the platform bank account.
 */
export async function convertInquiryToSponsor(
  eventId: string,
  inquiryId: string,
  actorId: string,
  input: { packageWon?: string; dealAmount?: number; dealNote?: string; logo?: string } = {},
) {
  const event = await requireEditableEvent(eventId, actorId);
  const inquiry = await SponsorshipInquiryModel.findOne({ _id: inquiryId, eventId });
  if (!inquiry) {
    throw new Error('Inquiry not found');
  }
  if (inquiry.status === 'WON') {
    throw new Error('This inquiry has already been converted');
  }

  const packageWon = input.packageWon?.trim() ?? '';
  const wonPackage = packageWon ? event.sponsorshipPackages.find((p) => p.name === packageWon) : undefined;
  if (packageWon && !wonPackage) {
    throw new Error('Unknown sponsorship package');
  }
  const dealAmount = Math.max(0, Number(input.dealAmount) || 0);
  const perks = wonPackage?.perks ?? [];

  const existingSponsor = await EventSponsorModel.findOne({ eventId, name: inquiry.companyName });
  const sponsor =
    existingSponsor ??
    (await EventSponsorModel.create({
      eventId,
      name: inquiry.companyName,
      logo: '',
      website: inquiry.website,
    }));

  // Sponsor logo (optional, uploaded during conversion) — used on the event page and certificates.
  const logo = input.logo?.trim() ?? '';
  if (logo && sponsor.logo !== logo) {
    sponsor.logo = logo.slice(0, 500);
    await sponsor.save();
  }

  // Perk delivery: LOGO_CERTIFICATES — flag the sponsor for certificate placement.
  if (perks.includes('LOGO_CERTIFICATES') && !sponsor.showOnCertificate) {
    sponsor.showOnCertificate = true;
    await sponsor.save();
  }

  // Perk delivery: SOCIAL_ANNOUNCEMENT — auto-publish a community thank-you post.
  if (perks.includes('SOCIAL_ANNOUNCEMENT')) {
    const thanks = `A big thank you to ${inquiry.companyName} for sponsoring ${event.title}${packageWon ? ` as our ${packageWon}` : ''}! 🎉`;
    void createCommunityPost(actorId, event.communityId.toString(), thanks).catch(() => {
      /* announcement is best-effort — org may repost manually */
    });
  }

  inquiry.status = 'WON';
  inquiry.packageWon = packageWon;
  inquiry.dealAmount = dealAmount;
  inquiry.feeStatus = dealAmount > 0 ? 'PENDING' : 'NONE';
  inquiry.dealNote = input.dealNote?.trim().slice(0, 500) ?? '';
  await inquiry.save();

  const feeSettings = await getSponsorshipFeeSettings();

  return {
    inquiry: serializeInquiry(inquiry.toObject()),
    sponsor: {
      _id: sponsor._id.toString(),
      eventId,
      name: sponsor.name,
      logo: sponsor.logo,
      website: sponsor.website,
    },
    feeSettings,
  };
}

/** Fee settings shown to organizers so they know how much to remit and where. */
export async function getSponsorshipFeeSettings() {
  let settings = await PlatformSettingsModel.findOneAndUpdate(
    { key: 'GLOBAL' },
    { $setOnInsert: { key: 'GLOBAL', sponsorshipPackageTemplates: DEFAULT_PACKAGE_TEMPLATES } },
    { new: true, upsert: true },
  ).lean();
  if (!settings.sponsorshipPackageTemplates?.length) {
    settings = (await PlatformSettingsModel.findOneAndUpdate(
      { key: 'GLOBAL' },
      { $set: { sponsorshipPackageTemplates: DEFAULT_PACKAGE_TEMPLATES } },
      { new: true },
    ).lean())!;
  }
  return {
    sponsorshipFeePercent: settings.sponsorshipFeePercent,
    feeBankName: settings.feeBankName,
    feeAccountNumber: settings.feeAccountNumber,
    feeAccountName: settings.feeAccountName,
    packageTemplates: settings.sponsorshipPackageTemplates ?? [],
  };
}

/**
 * Perk delivery: ATTENDANCE_REPORT — public, shareable proof-of-reach report built
 * from verified attendance data. Contains aggregates only (no attendee PII).
 */
export async function getSponsorReport(slugOrId: string) {
  const bySlug = await EventModel.findOne({ slug: slugOrId.toLowerCase(), deletedAt: null }).lean();
  const event = bySlug ?? (/^[a-f0-9]{24}$/i.test(slugOrId) ? await EventModel.findOne({ _id: slugOrId, deletedAt: null }).lean() : null);
  if (!event || event.status === 'DRAFT') {
    throw new Error('Event not found');
  }

  const [community, sponsors, registrations] = await Promise.all([
    CommunityModel.findById(event.communityId).select('name slug logo verificationStatus').lean(),
    EventSponsorModel.find({ eventId: event._id }).sort({ createdAt: 1 }).select('name logo website').lean(),
    EventRegistrationModel.find({ eventId: event._id }).select('status checkInAt checkOutAt attendanceMinutes').lean(),
  ]);

  const active = registrations.filter((r) => !['CANCELLED', 'REJECTED'].includes(r.status as string));
  const checkedIn = active.filter((r) => r.checkInAt);
  const completed = active.filter((r) => r.status === 'COMPLETED');
  const minutes = checkedIn.map((r) => r.attendanceMinutes ?? 0).filter((m) => m > 0);
  const averageAttendanceMinutes = minutes.length ? Math.round(minutes.reduce((a, b) => a + b, 0) / minutes.length) : 0;

  return {
    event: {
      title: event.title,
      slug: event.slug,
      type: event.type,
      mode: event.mode,
      venue: event.venue,
      startDate: event.startDate,
      endDate: event.endDate,
      bannerImage: event.bannerImage,
      status: event.status,
      certificatesIssued: event.certificatesIssued,
    },
    community: community
      ? { name: community.name, slug: community.slug, logo: community.logo, verificationStatus: community.verificationStatus }
      : null,
    sponsors: sponsors.map((s) => ({ name: s.name, logo: s.logo, website: s.website })),
    stats: {
      registered: active.length,
      checkedIn: checkedIn.length,
      completed: completed.length,
      checkInRate: active.length ? Math.round((checkedIn.length / active.length) * 100) : 0,
      completionRate: checkedIn.length ? Math.round((completed.length / checkedIn.length) * 100) : 0,
      averageAttendanceMinutes,
    },
    final: event.status === 'COMPLETED' || event.status === 'ARCHIVED' || Boolean(event.attendanceFinalizedAt),
    generatedAt: new Date(),
  };
}

export async function updateSponsorshipFeeSettings(input: {
  sponsorshipFeePercent?: number;
  feeBankName?: string;
  feeAccountNumber?: string;
  feeAccountName?: string;
  packageTemplates?: { name?: string; price?: string; perks?: string[]; benefits?: string }[];
}) {
  const update: Record<string, unknown> = {};
  if (input.sponsorshipFeePercent !== undefined) {
    const pct = Number(input.sponsorshipFeePercent);
    if (!Number.isFinite(pct) || pct < 0 || pct > 50) throw new Error('Fee percent must be between 0 and 50');
    update.sponsorshipFeePercent = pct;
  }
  if (input.feeBankName !== undefined) update.feeBankName = String(input.feeBankName).trim().slice(0, 100);
  if (input.feeAccountNumber !== undefined) update.feeAccountNumber = String(input.feeAccountNumber).trim().slice(0, 30);
  if (input.feeAccountName !== undefined) update.feeAccountName = String(input.feeAccountName).trim().slice(0, 100);
  if (input.packageTemplates !== undefined) {
    if (!Array.isArray(input.packageTemplates)) throw new Error('Invalid package templates');
    update.sponsorshipPackageTemplates = input.packageTemplates
      .slice(0, 6)
      .map((t) => ({
        name: String(t?.name ?? '').trim(),
        price: String(t?.price ?? '').trim(),
        perks: Array.isArray(t?.perks)
          ? Array.from(new Set(t.perks.map(String).filter((k) => (SPONSOR_PERK_KEYS as readonly string[]).includes(k))))
          : [],
        benefits: String(t?.benefits ?? '').trim(),
      }))
      .filter((t) => t.name);
  }

  await PlatformSettingsModel.findOneAndUpdate({ key: 'GLOBAL' }, { $set: update }, { upsert: true });
  return getSponsorshipFeeSettings();
}

/** Admin: confirm the platform fee for a WON deal has been received. */
export async function setInquiryFeeStatus(inquiryId: string, feeStatus: SponsorshipFeeStatus) {
  if (!['NONE', 'PENDING', 'PAID'].includes(feeStatus)) {
    throw new Error('Invalid fee status');
  }
  const inquiry = await SponsorshipInquiryModel.findByIdAndUpdate(inquiryId, { feeStatus }, { new: true }).lean();
  if (!inquiry) {
    throw new Error('Inquiry not found');
  }
  return serializeInquiry(inquiry);
}

/** Admin oversight: every sponsorship inquiry across the platform, newest first. */
export async function adminListSponsorshipInquiries() {
  const inquiries = await SponsorshipInquiryModel.find({}).sort({ createdAt: -1 }).limit(500).lean();
  const eventIds = Array.from(new Set(inquiries.map((q) => q.eventId.toString())));
  const communityIds = Array.from(new Set(inquiries.map((q) => q.communityId.toString())));
  const [events, communities] = await Promise.all([
    EventModel.find({ _id: { $in: eventIds } }).select('title slug').lean(),
    CommunityModel.find({ _id: { $in: communityIds } }).select('name').lean(),
  ]);
  const eventById = new Map(events.map((e) => [e._id.toString(), e]));
  const communityById = new Map(communities.map((c) => [c._id.toString(), c]));

  return inquiries.map((q) => {
    const event = eventById.get(q.eventId.toString());
    const community = communityById.get(q.communityId.toString());
    return {
      ...serializeInquiry(q),
      eventTitle: event?.title ?? '',
      eventSlug: event?.slug ?? '',
      communityName: community?.name ?? '',
    };
  });
}

export async function listOpenSponsorshipEvents() {
  const archived = await CommunityModel.find({ archivedAt: { $ne: null } }).select('_id').lean();
  const query: Record<string, unknown> = {
    deletedAt: null,
    visibility: 'PUBLIC',
    sponsorshipOpen: true,
    status: { $in: SPONSORABLE_STATUSES },
  };
  if (archived.length) {
    query.communityId = { $nin: archived.map((c) => c._id) };
  }

  const events = await EventModel.find(query).sort({ startDate: 1, createdAt: -1 }).lean();
  const communityIds = Array.from(new Set(events.map((e) => e.communityId.toString())));
  const communities = await CommunityModel.find({ _id: { $in: communityIds } })
    .select('name slug logo verificationStatus')
    .lean();
  const communityById = new Map(communities.map((c) => [c._id.toString(), c]));

  return events.map((event) => {
    const community = communityById.get(event.communityId.toString());
    return {
      _id: event._id.toString(),
      slug: event.slug,
      title: event.title,
      type: event.type,
      shortDescription: event.shortDescription,
      bannerImage: event.bannerImage,
      mode: event.mode,
      venue: event.venue,
      startDate: event.startDate,
      capacity: event.capacity,
      registrationCount: event.registrationCount,
      sponsorshipPitch: event.sponsorshipPitch,
      sponsorshipPackages: event.sponsorshipPackages,
      community: community
        ? { name: community.name, slug: community.slug, logo: community.logo, verificationStatus: community.verificationStatus }
        : null,
    };
  });
}

function serializeInquiry(inquiry: {
  _id: unknown;
  eventId: unknown;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  website: string;
  packageName: string;
  message: string;
  dealNote?: string;
  packageWon?: string;
  dealAmount?: number;
  feeStatus?: SponsorshipFeeStatus;
  status: SponsorshipInquiryStatus;
  createdAt: Date;
}) {
  return {
    _id: String(inquiry._id),
    eventId: String(inquiry.eventId),
    companyName: inquiry.companyName,
    contactName: inquiry.contactName,
    email: inquiry.email,
    phone: inquiry.phone,
    website: inquiry.website,
    packageName: inquiry.packageName,
    message: inquiry.message,
    dealNote: inquiry.dealNote ?? '',
    packageWon: inquiry.packageWon ?? '',
    dealAmount: inquiry.dealAmount ?? 0,
    feeStatus: inquiry.feeStatus ?? 'NONE',
    status: inquiry.status,
    createdAt: inquiry.createdAt,
  };
}
