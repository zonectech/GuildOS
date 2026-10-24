// Save as: services/status-attachment.service.ts
import { EventModel } from '../models/event.model';
import { CertificateModel } from '../models/certificate.model';
import { UserModel } from '../models/user.model';

/** *_UPLOAD = an image the user uploaded themselves (shown as not verified by GuildOS). */
export type StatusAttachmentType = 'EVENT' | 'TICKET' | 'CERTIFICATE' | 'TICKET_UPLOAD' | 'CERTIFICATE_UPLOAD';

/** What gets stored on a status. Built here, never trusted from the client. */
export type StatusAttachmentSnapshot = {
  type: StatusAttachmentType;
  /** Event _id, or the certificate serial. */
  refId: string;
  slug: string;
  title: string;
  subtitle: string;
  image: string;
  startsAt: Date | null;
  mode: string;
  venue: string;
  /** In-app link opened when the card is tapped. */
  href: string;
  /** Certificates only: the full detail the canvas renderer needs. Never contains a ticket QR. */
  snapshot: Record<string, unknown> | null;
  /** Tickets only: the registration state, used for the default caption (not stored). */
  registrationStatus?: string;
};

const ATTACHMENT_TYPES: StatusAttachmentType[] = ['EVENT', 'TICKET', 'CERTIFICATE', 'TICKET_UPLOAD', 'CERTIFICATE_UPLOAD'];

const UPLOAD_PATH_PATTERN = /^\/uploads\/[A-Za-z0-9._-]{1,200}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

// Public events only, and never drafts or archived ones.
const SHAREABLE_EVENT_STATUSES = ['ANNOUNCED', 'PUBLISHED', 'POSTPONED', 'CHECK_IN', 'CHECK_OUT', 'COMPLETED'];

const CERTIFICATE_TYPE_LABEL: Record<string, string> = {
  ATTENDANCE: 'Certificate of Attendance',
  COMPLETION: 'Certificate of Completion',
  LEADERSHIP: 'Certificate of Leadership',
  VOLUNTEER: 'Certificate of Volunteering',
};

// A ticket is the registration the user holds. Waitlisted, pending-approval,
// cancelled and rejected registrations don't count.
const TICKET_REGISTRATION_STATUSES = ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'COMPLETED', 'PARTIAL_ATTENDANCE'];

const MAX_SNAPSHOT_CHARS = 200_000;

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;

export async function buildStatusAttachment(
  input: unknown,
  userId: string,
): Promise<StatusAttachmentSnapshot | null> {
  if (input === undefined || input === null || input === '') {
    return null;
  }

  if (typeof input !== 'object') {
    throw new Error('Invalid attachment');
  }

  const { type, id } = input as { type?: unknown; id?: unknown };

  if (typeof type !== 'string' || !ATTACHMENT_TYPES.includes(type as StatusAttachmentType)) {
    throw new Error('Invalid attachment type');
  }

  const ref = typeof id === 'string' ? id.trim() : '';

  if (!ref) {
    throw new Error('Choose what to share');
  }

  if (type === 'TICKET_UPLOAD' || type === 'CERTIFICATE_UPLOAD') {
    return buildUploadAttachment(type, ref, (input as { title?: unknown }).title);
  }

  return type === 'CERTIFICATE'
    ? buildCertificateAttachment(ref, userId)
    : buildEventAttachment(type as 'EVENT' | 'TICKET', ref, userId);
}

/** Event fields the ticket design needs (cast: not all are on the shared event type). */
type TicketEventFields = {
  communityId?: unknown;
  ticketPrice?: number;
  ticketTiers?: unknown[];
  ticketTemplate?: string;
  ticketStyle?: string;
  ticketAccent?: string;
  ticketQrPlacement?: string;
  ticketQrBox?: { x: number; y: number; size: number } | null;
  days?: unknown[];
  sections?: Array<{ key?: string; name?: string; venue?: string }>;
};

async function buildEventAttachment(
  type: 'EVENT' | 'TICKET',
  ref: string,
  userId: string,
): Promise<StatusAttachmentSnapshot> {
  // Accept an _id or a slug (slugs are unique and lowercase).
  const query = OBJECT_ID_PATTERN.test(ref) ? { _id: ref } : { slug: ref.toLowerCase() };

  const event = await EventModel.findOne(query)
    .select(
      'slug title bannerImage startDate endDate mode venue visibility status communityId ' +
        'ticketPrice ticketTiers ticketTemplate ticketStyle ticketAccent ticketQrPlacement ticketQrBox days sections',
    )
    .lean();

  if (!event) {
    throw new Error('Event not found');
  }

  if (event.visibility !== 'PUBLIC' || !SHAREABLE_EVENT_STATUSES.includes(event.status)) {
    throw new Error('This event cannot be shared to status');
  }

  let registrationStatus = '';
  let snapshot: Record<string, unknown> | null = null;

  if (type === 'TICKET') {
    // A ticket means "I'm going", so it only makes sense while the event is still ahead.
    // (No end date: allow a day after the start, events run late.)
    const { endDate, startDate } = event as unknown as { endDate?: Date | null; startDate?: Date | null };
    const endsAt = endDate ?? (startDate ? new Date(new Date(startDate).getTime() + DAY_MS) : null);

    if (event.status === 'COMPLETED' || (endsAt && new Date(endsAt).getTime() < Date.now())) {
      throw new Error('Tickets can only be shared for upcoming events. Share the event or your certificate instead.');
    }

    // Lazy import: keeps the heavy event service out of unrelated code paths and tests.
    const { getMyRegistration } = await import('./event.service.js');
    const registration = await getMyRegistration(String(event._id), userId);
    registrationStatus = String((registration as { status?: unknown } | null)?.status ?? '');

    if (!registration || !TICKET_REGISTRATION_STATUSES.includes(registrationStatus)) {
      throw new Error('You need an active ticket for this event');
    }

    snapshot = await buildTicketDesign(
      event as unknown as TicketEventFields,
      registration as { plannedDays?: number[]; sectionKey?: string },
      userId,
    );
  }

  return {
    type,
    refId: String(event._id),
    slug: event.slug,
    title: event.title,
    subtitle: '',
    image: event.bannerImage ?? '',
    startsAt: event.startDate ?? null,
    mode: event.mode ?? '',
    venue: event.venue ?? '',
    href: `/events/${event.slug}`,
    snapshot,
    registrationStatus: type === 'TICKET' ? registrationStatus : undefined,
  };
}

/**
 * Everything needed to draw the ticket image. Deliberately has NO qrToken,
 * gate/pass code or payment reference: a status is visible campus-wide, and
 * those are the credentials for getting in.
 */
async function buildTicketDesign(
  event: TicketEventFields,
  registration: { plannedDays?: number[]; sectionKey?: string },
  userId: string,
): Promise<Record<string, unknown>> {
  const [user, community] = await Promise.all([
    UserModel.findById(userId).select('fullName').lean(),
    loadCommunity(event.communityId),
  ]);

  // Same labels the check-in pass prints on the downloaded ticket.
  const totalDays = event.days?.length ?? 0;
  const planned = registration.plannedDays ?? [];
  const daysLabel =
    totalDays > 1 && planned.length > 0 && planned.length < totalDays
      ? planned.length === 1
        ? `Day ${planned[0]} only`
        : `Days ${planned.join(' & ')}`
      : '';

  const section = registration.sectionKey
    ? (event.sections ?? []).find((item) => item.key === registration.sectionKey)
    : undefined;

  return {
    ticket: {
      templateImage: event.ticketTemplate ?? '',
      qrPlacement: event.ticketQrPlacement ?? '',
      qrBox: event.ticketQrBox ?? null,
      style: event.ticketStyle ?? '',
      accent: event.ticketAccent ?? '',
      priceNgn: event.ticketPrice ?? 0,
      hasTiers: (event.ticketTiers ?? []).length > 0,
      communityName: community.name,
      communityLogo: community.logo,
      holderName: user?.fullName ?? '',
      daysLabel,
      sectionLabel: section ? [section.name, section.venue].filter(Boolean).join(' · ') : '',
    },
  };
}

async function loadCommunity(id: unknown): Promise<{ name: string; logo: string }> {
  if (!id) {
    return { name: '', logo: '' };
  }

  try {
    const { getCommunityById } = await import('./community.service.js');
    const community = (await getCommunityById(String(id))) as { name?: string; logo?: string } | null;
    return { name: community?.name ?? '', logo: community?.logo ?? '' };
  } catch {
    return { name: '', logo: '' };
  }
}

/** An image the user uploaded (their own ticket or certificate). Never treated as verified. */
function buildUploadAttachment(
  type: 'TICKET_UPLOAD' | 'CERTIFICATE_UPLOAD',
  path: string,
  title: unknown,
): StatusAttachmentSnapshot {
  if (!UPLOAD_PATH_PATTERN.test(path)) {
    throw new Error('Invalid upload');
  }

  const fallback = type === 'TICKET_UPLOAD' ? 'My ticket' : 'My certificate';
  const name = typeof title === 'string' ? title.trim().slice(0, 100) : '';

  return {
    type,
    refId: path,
    slug: '',
    title: name || fallback,
    subtitle: '',
    image: path,
    startsAt: null,
    mode: '',
    venue: '',
    href: '',
    snapshot: null,
  };
}

async function buildCertificateAttachment(
  ref: string,
  userId: string,
): Promise<StatusAttachmentSnapshot> {
  const serial = ref.slice(0, 64);

  // Same rule the feed uses for milestones: only your own VERIFIED certificate.
  const certificate = await CertificateModel.findOne({
    serial,
    userId,
    status: 'VERIFIED',
  })
    .select('serial eventTitle communityName type')
    .lean();

  if (!certificate) {
    throw new Error('Certificate not found or not verified');
  }

  const { getCertificateBySerial } = await import('./event.service.js');
  const detail = await getCertificateBySerial(certificate.serial);

  // Plain JSON (no ObjectIds / Dates) so it can be stored and sent as-is.
  const snapshot = JSON.parse(JSON.stringify(detail ?? {})) as Record<string, unknown>;

  if (JSON.stringify(snapshot).length > MAX_SNAPSHOT_CHARS) {
    throw new Error('This certificate is too large to share');
  }

  return {
    type: 'CERTIFICATE',
    refId: certificate.serial,
    slug: '',
    title: certificate.eventTitle,
    subtitle: [CERTIFICATE_TYPE_LABEL[certificate.type], certificate.communityName]
      .filter(Boolean)
      .join(' · '),
    image: '',
    startsAt: null,
    mode: '',
    venue: '',
    href: pathFromUrl(snapshot.verificationUrl) || `/certificates/${encodeURIComponent(certificate.serial)}`,
    snapshot,
  };
}

function pathFromUrl(value: unknown): string {
  if (typeof value !== 'string' || !value) {
    return '';
  }

  try {
    return new URL(value).pathname;
  } catch {
    return '';
  }
}

/** Default caption, editable in the composer. Used when the user sends none. */
export function defaultCaptionFor(
  attachment: Pick<StatusAttachmentSnapshot, 'type' | 'title' | 'registrationStatus'>,
): string {
  const title = attachment.title.slice(0, 200);

  switch (attachment.type) {
    case 'TICKET':
      // The caption follows where the ticket is in its life.
      switch (attachment.registrationStatus) {
        case 'COMPLETED':
          return `I completed ${title}!`;
        case 'CHECKED_OUT':
          return `I attended ${title}!`;
        case 'CHECKED_IN':
        case 'PARTIAL_ATTENDANCE':
          return `I'm attending ${title}!`;
        default:
          return `I'm going to ${title}! 🎟️ See you there.`;
      }
    case 'TICKET_UPLOAD':
      return "I've got my ticket! 🎟️";
    case 'CERTIFICATE_UPLOAD':
      return 'Proud to share my certificate 🎓';
    case 'CERTIFICATE':
      return `Proud to share my certificate from ${title} 🎓`;
    default:
      return `Join me at ${title}!`;
  }
}

export function kindForAttachment(
  attachment: Pick<StatusAttachmentSnapshot, 'type'>,
): 'event' | 'milestone' {
  return attachment.type === 'CERTIFICATE' || attachment.type === 'CERTIFICATE_UPLOAD' ? 'milestone' : 'event';
}