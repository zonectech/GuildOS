import { EventModel } from '../models/event.model';
import { SPONSOR_PERK_KEYS } from '../models/event.model';
import { EventSponsorModel } from '../models/event-sponsor.model';
import { EventFeedbackModel } from '../models/event-feedback.model';
import { EventRegistrationModel } from '../models/event-registration.model';
import { CommunityModel } from '../models/community.model';
import { PlatformSettingsModel } from '../models/platform-settings.model';
import { SponsorshipInquiryModel, type SponsorshipFeeStatus, type SponsorshipInquiryStatus } from '../models/sponsorship-inquiry.model';
import { requireEditableEvent } from './event.service';
import { aiChat } from './ai-provider';
import { createCommunityPost } from './feed.service';
import { createNotification } from './notification.service';
import { createSponsorThanksImage } from './sponsor-thanks-image.service';
import { config } from '../config';
import { confirmationEmail, congratulationsEmail, sendEmail } from '../utils/email';

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
  const inquiry = await SponsorshipInquiryModel.findOne({ _id: inquiryId, eventId });
  if (!inquiry) {
    throw new Error('Inquiry not found');
  }
  if (inquiry.status === 'NEW' && status !== 'NEW' && !inquiry.firstRespondedAt) {
    inquiry.firstRespondedAt = new Date();
  }
  inquiry.status = status;
  await inquiry.save();
  return serializeInquiry(inquiry.toObject());
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
  // Off-platform deals get it at conversion as usual; platform-paid deals also earn
  // the "Paid via GuildOS" verified badge on top (delivered at payment).
  if (perks.includes('LOGO_CERTIFICATES') && !sponsor.showOnCertificate) {
    sponsor.showOnCertificate = true;
    await sponsor.save();
  }

  // Perk delivery: SOCIAL_ANNOUNCEMENT — auto-publish a community thank-you post.
  // A generated wide social card (sponsor logo composed in) beats posting a raw
  // square logo, which renders oversized in the feed; falls back gracefully.
  if (perks.includes('SOCIAL_ANNOUNCEMENT')) {
    const thanks = `A big thank you to ${inquiry.companyName} for sponsoring ${event.title}${packageWon ? ` as our ${packageWon}` : ''}! 🎉`;
    void (async () => {
      let imageUrl = '';
      try {
        imageUrl = await createSponsorThanksImage({
          sponsorName: inquiry.companyName,
          eventTitle: event.title,
          packageWon,
          logo: sponsor.logo,
        });
      } catch {
        /* card generation is cosmetic — text-only post still goes out */
      }
      await createCommunityPost(actorId, event.communityId.toString(), thanks, imageUrl ? { imageUrl } : {});
    })().catch(() => {
      /* announcement is best-effort — org may repost manually */
    });
  }

  inquiry.status = 'WON';
  inquiry.packageWon = packageWon;
  inquiry.dealAmount = dealAmount;
  inquiry.feeStatus = dealAmount > 0 ? 'PENDING' : 'NONE';
  inquiry.dealNote = input.dealNote?.trim().slice(0, 500) ?? '';
  if (!inquiry.firstRespondedAt) inquiry.firstRespondedAt = new Date();
  await inquiry.save();

  // Durable sponsor trail (no account/dashboard needed): confirm the deal by email
  // with the shareable report link — off-platform deals included.
  const reportUrl = `${config.frontendUrl}/events/${encodeURIComponent(event.slug)}/sponsor-report`;
  void sendEmail(
    inquiry.email,
    confirmationEmail(
      inquiry.contactName,
      `Sponsorship confirmed for "${event.title}"`,
      `${inquiry.companyName} is now an official sponsor of "${event.title}"${packageWon ? ` (${packageWon} package)` : ''}. Your verified reach report is at the link below — it's yours to share.${dealAmount > 0 ? ' Full attendance figures unlock once the sponsorship is settled through GuildOS.' : ''}`,
      'View your sponsor report',
      reportUrl,
    ),
  ).catch(() => undefined);

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

/**
 * Un-converts a WON deal that fell through: removes the company's sponsor listing
 * (event page + certificate strip), reopens the inquiry as CLOSED, and clears any
 * pending platform fee. PAID fees are kept on record — disputes go through admins.
 */
export async function revokeInquiryConversion(eventId: string, inquiryId: string, actorId: string) {
  await requireEditableEvent(eventId, actorId);
  const inquiry = await SponsorshipInquiryModel.findOne({ _id: inquiryId, eventId });
  if (!inquiry) {
    throw new Error('Inquiry not found');
  }
  if (inquiry.status !== 'WON') {
    throw new Error('Only WON deals can be revoked');
  }

  await EventSponsorModel.deleteOne({ eventId, name: inquiry.companyName });

  inquiry.status = 'CLOSED';
  inquiry.packageWon = '';
  inquiry.dealAmount = 0;
  if (inquiry.feeStatus === 'PENDING') inquiry.feeStatus = 'NONE';
  await inquiry.save();

  return { inquiry: serializeInquiry(inquiry.toObject()) };
}

/**
 * Nudges organizers about inquiries sitting in NEW for 72h+ (one reminder per
 * inquiry). Sponsors ghosted at the top of the funnel kill marketplace trust.
 */
export async function remindStaleSponsorshipInquiries() {
  const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000);
  const stale = await SponsorshipInquiryModel.find({
    status: 'NEW',
    staleRemindedAt: null,
    createdAt: { $lt: cutoff },
  })
    .limit(200)
    .lean();
  if (!stale.length) return;

  const byEvent = new Map<string, typeof stale>();
  for (const inquiry of stale) {
    const key = inquiry.eventId.toString();
    byEvent.set(key, [...(byEvent.get(key) ?? []), inquiry]);
  }

  for (const [eventId, inquiries] of byEvent) {
    const event = await EventModel.findOne({ _id: eventId, deletedAt: null }).select('title slug createdBy').lean();
    if (event) {
      const [first] = inquiries;
      void createNotification({
        userId: event.createdBy.toString(),
        type: 'SYSTEM',
        title: `${inquiries.length === 1 ? 'A sponsor is' : `${inquiries.length} sponsors are`} waiting on "${event.title}"`,
        body: `${first.companyName}${inquiries.length > 1 ? ' and others' : ''} inquired over 3 days ago — quick replies keep sponsors interested.`,
        link: `/dashboard/events/create?slug=${event.slug}`,
      });
    }
    await SponsorshipInquiryModel.updateMany(
      { _id: { $in: inquiries.map((q) => q._id) } },
      { staleRemindedAt: new Date() },
    );
  }
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
 * Sponsor-facing AI digest of attendee feedback — honest, aggregate-only, cached per
 * (event, feedback state) so the public report page never hammers the AI provider.
 * Falls back to a plain-stats sentence when no AI key is configured.
 */
const feedbackSummaryCache = new Map<string, string>();

async function buildSponsorFeedbackSummary(eventId: unknown, eventTitle: string, average: number, count: number): Promise<string> {
  if (count < 1) return '';
  const cacheKey = `${String(eventId)}:${count}:${average}`;
  const cached = feedbackSummaryCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const fallback = `Attendees rated this event ${average.toFixed(1)}/5 across ${count} verified rating${count === 1 ? '' : 's'}.`;
  let summary = fallback;
  try {
    const entries = await EventFeedbackModel.find({ eventId })
      .sort({ updatedAt: -1 })
      .limit(30)
      .select('rating comment')
      .lean();
    const comments = entries.filter((e) => (e.comment ?? '').trim()).map((e) => `${e.rating}/5: ${e.comment.trim().slice(0, 200)}`);
    if (comments.length) {
      const ai = await aiChat({
        messages: [
          {
            role: 'user',
            content:
              `You are writing a short, honest summary of attendee feedback for a SPONSOR of the student event "${eventTitle}". ` +
              `Average rating ${average.toFixed(1)}/5 from ${count} verified attendees. Sample comments (rating: comment):\n` +
              comments.join('\n') +
              `\n\nWrite 2-3 sentences for the sponsor: what attendees valued, the audience's engagement quality, and any constructive theme. ` +
              `Plain text, no bullet points, no marketing fluff, do not invent facts.`,
          },
        ],
        temperature: 0.4,
        maxTokens: 700,
      });
      const text = (ai ?? '').trim();
      if (text) summary = text.slice(0, 900);
    }
  } catch {
    /* fallback stands */
  }
  if (feedbackSummaryCache.size > 200) feedbackSummaryCache.clear();
  feedbackSummaryCache.set(cacheKey, summary);
  return summary;
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

  const [community, sponsors, registrations, unpaidDeals, ratingAgg] = await Promise.all([
    CommunityModel.findById(event.communityId).select('name slug logo verificationStatus').lean(),
    EventSponsorModel.find({ eventId: event._id }).sort({ createdAt: 1 }).select('name logo website paidViaPlatform').lean(),
    EventRegistrationModel.find({ eventId: event._id }).select('status checkInAt checkOutAt attendanceMinutes').lean(),
    // Fee gate: full reach stats unlock once every reported deal's platform fee is settled.
    SponsorshipInquiryModel.countDocuments({ eventId: event._id, status: 'WON', dealAmount: { $gt: 0 }, feeStatus: { $ne: 'PAID' } }),
    // Attendee rating (checked-in attendees only) — a trust signal sponsors care about.
    EventFeedbackModel.aggregate<{ average: number; count: number }>([
      { $match: { eventId: event._id } },
      { $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]),
  ]);
  const locked = unpaidDeals > 0;
  const attendeeRating = ratingAgg[0]
    ? { average: Math.round(ratingAgg[0].average * 10) / 10, count: ratingAgg[0].count }
    : { average: 0, count: 0 };

  const active = registrations.filter((r) => !['CANCELLED', 'REJECTED'].includes(r.status as string));
  const checkedIn = active.filter((r) => r.checkInAt);
  const completed = active.filter((r) => r.status === 'COMPLETED');
  const minutes = checkedIn.map((r) => r.attendanceMinutes ?? 0).filter((m) => m > 0);
  const averageAttendanceMinutes = minutes.length ? Math.round(minutes.reduce((a, b) => a + b, 0) / minutes.length) : 0;

  const feedbackSummary = locked ? '' : await buildSponsorFeedbackSummary(event._id, event.title, attendeeRating.average, attendeeRating.count);

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
      certificatesIssued: locked ? 0 : event.certificatesIssued,
      /** Organizer-cancelled events show the reason on the report. */
      cancelled: event.status === 'ARCHIVED' && Boolean(event.cancellationReason),
      cancellationReason: event.cancellationReason ?? '',
    },
    community: community
      ? { name: community.name, slug: community.slug, logo: community.logo, verificationStatus: community.verificationStatus }
      : null,
    sponsors: sponsors.map((s) => ({ name: s.name, logo: s.logo, website: s.website, paidViaPlatform: Boolean(s.paidViaPlatform) })),
    attendeeRating: locked ? { average: 0, count: 0 } : attendeeRating,
    feedbackSummary,
    stats: locked
      ? { registered: 0, checkedIn: 0, completed: 0, checkInRate: 0, completionRate: 0, averageAttendanceMinutes: 0 }
      : {
          registered: active.length,
          checkedIn: checkedIn.length,
          completed: completed.length,
          checkInRate: active.length ? Math.round((checkedIn.length / active.length) * 100) : 0,
          completionRate: checkedIn.length ? Math.round((completed.length / checkedIn.length) * 100) : 0,
          averageAttendanceMinutes,
        },
    locked,
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
  const before = await SponsorshipInquiryModel.findById(inquiryId).select('feeStatus').lean();
  const inquiry = await SponsorshipInquiryModel.findByIdAndUpdate(inquiryId, { feeStatus }, { new: true }).lean();
  if (!inquiry) {
    throw new Error('Inquiry not found');
  }
  // Fee settled (bank transfer confirmed by an admin) — tell the sponsor their
  // verified report just unlocked.
  if (feeStatus === 'PAID' && before?.feeStatus !== 'PAID') {
    const event = await EventModel.findById(inquiry.eventId).select('title slug').lean();
    if (event) {
      void sendEmail(
        inquiry.email,
        congratulationsEmail(
          inquiry.contactName,
          `Your verified report for "${event.title}" is unlocked`,
          `The sponsorship for "${event.title}" is fully settled. Your verified reach report — real check-in/check-out attendance data — is now unlocked and ready to share.`,
          'Open your verified report',
          `${config.frontendUrl}/events/${encodeURIComponent(event.slug)}/sponsor-report`,
        ),
      ).catch(() => undefined);
    }
  }
  return serializeInquiry(inquiry);
}

/**
 * Public sponsor roster for a community — social proof + answers "who has sponsored
 * this community's events?". Aggregates sponsor listings across all the community's
 * events, deduped by name (case-insensitive), newest events first. No money figures
 * on purpose: deal amounts stay between the organizer and the sponsor.
 */
export async function getCommunitySponsors(communityId: string) {
  const allEvents = await EventModel.find({ communityId, deletedAt: null, status: { $ne: 'DRAFT' } })
    .select('title slug startDate status cancellationReason')
    .lean();
  // Cancelled events don't count — their sponsorships were unwound (platform payments auto-refunded).
  const events = allEvents.filter((e) => !(e.status === 'ARCHIVED' && e.cancellationReason));
  if (!events.length) return { sponsors: [], totalSponsors: 0, eventsSponsored: 0 };
  const eventById = new Map(events.map((e) => [e._id.toString(), e]));

  const listings = await EventSponsorModel.find({ eventId: { $in: events.map((e) => e._id) } })
    .sort({ createdAt: -1 })
    .select('eventId name logo website paidViaPlatform')
    .lean();

  const byName = new Map<string, { name: string; logo: string; website: string; paidViaPlatform: boolean; events: { title: string; slug: string }[] }>();
  for (const s of listings) {
    const key = s.name.trim().toLowerCase();
    const event = eventById.get(s.eventId.toString());
    const entry = byName.get(key) ?? { name: s.name, logo: '', website: '', paidViaPlatform: false, events: [] };
    if (!entry.logo && s.logo) entry.logo = s.logo;
    if (!entry.website && s.website) entry.website = s.website;
    if (s.paidViaPlatform) entry.paidViaPlatform = true;
    if (event && !entry.events.some((e) => e.slug === event.slug)) entry.events.push({ title: event.title, slug: event.slug });
    byName.set(key, entry);
  }

  const sponsors = [...byName.values()].sort((a, b) => b.events.length - a.events.length || a.name.localeCompare(b.name));
  const eventsSponsored = new Set(listings.map((s) => s.eventId.toString())).size;
  return { sponsors, totalSponsors: sponsors.length, eventsSponsored };
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

  // "Responds quickly" signal: ≥3 inquiries answered in the last 90 days and ≥70%
  // of them moved out of NEW within 72 hours. Keeps the marketplace credible.
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const recentInquiries = communityIds.length
    ? await SponsorshipInquiryModel.find({ communityId: { $in: communityIds }, createdAt: { $gte: since }, firstRespondedAt: { $ne: null } })
        .select('communityId createdAt firstRespondedAt')
        .lean()
    : [];
  const responseStats = new Map<string, { responded: number; quick: number }>();
  for (const inquiry of recentInquiries) {
    const key = inquiry.communityId.toString();
    const stats = responseStats.get(key) ?? { responded: 0, quick: 0 };
    stats.responded += 1;
    if (inquiry.firstRespondedAt && inquiry.firstRespondedAt.getTime() - inquiry.createdAt.getTime() <= 72 * 60 * 60 * 1000) {
      stats.quick += 1;
    }
    responseStats.set(key, stats);
  }

  return events.map((event) => {
    const community = communityById.get(event.communityId.toString());
    const stats = responseStats.get(event.communityId.toString());
    const respondsQuickly = Boolean(stats && stats.responded >= 3 && stats.quick / stats.responded >= 0.7);
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
      respondsQuickly,
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
