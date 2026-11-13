/**
 * The app's data models. Presentation components only ever see these types, never raw backend rows,
 * so swapping a mock for a real endpoint later touches lib/api only.
 */

export type EventType = 'WORKSHOP' | 'SEMINAR' | 'MEETUP' | 'SOCIAL' | 'CONFERENCE' | 'CAREER_FAIR' | 'HACKATHON' | 'TRAINING' | 'BOOTCAMP' | string;
export type EventStatus = 'DRAFT' | 'ANNOUNCED' | 'PUBLISHED' | 'POSTPONED' | 'CHECK_IN' | 'CHECK_OUT' | 'COMPLETED' | 'ARCHIVED';
export type EventPhase = 'BEFORE' | 'LIVE' | 'AFTER' | 'CANCELLED';
export type CertificateOffer = 'INSTANT' | 'AFTER_EVENT' | 'NONE';

export interface School { name: string }

export interface User {
  id: string;
  fullName: string;
  email: string;
  username?: string;
  avatar?: string;
  school?: string;
  /** Not stored by the backend yet. */
  department?: string;
  level?: string;
  guestListVisibility: GuestVisibility;
  /** ADMIN accounts are the platform reviewers. */
  role: string;
  /** Finished onboarding (school, interests). */
  onboarded?: boolean;
}

export type CommunityCategory = 'TECH' | 'FAITH' | 'CAREER' | 'ARTS' | 'SPORTS' | 'DEPARTMENTAL' | 'SOCIAL' | 'HEALTH' | 'ENTREPRENEURSHIP' | 'OTHER';

export interface Community {
  id: string;
  name: string;
  slug: string;
  logo: string;
  school?: string;
  verified: boolean;
  /** Filled in by the Communities stage. */
  cover?: string;
  bio?: string;
  category?: CommunityCategory;
  /** The organizer's crest colour, picked from brand-safe options. */
  accent?: 'green' | 'gold' | 'coral' | 'ink';
  memberCount?: number;
  links?: { whatsapp?: string; instagram?: string; x?: string };
}

/** Lead: full control and can hand over. Admin: runs events, scans, manages members. Member. */
export type CommunityRole = 'LEAD' | 'ADMIN' | 'MEMBER';

export interface CommunityMembership {
  communityId: string;
  userId: string;
  role: CommunityRole;
  joinedAt: string;
  muted: boolean;
  /** Stamps this member has from this community; 5 or more unlocks the "Regular" badge. */
  stampCount: number;
}

export interface Event {
  id: string;
  slug: string;
  title: string;
  type: EventType;
  status: EventStatus;
  mode: 'PHYSICAL' | 'HYBRID' | 'VIRTUAL';
  summary: string;
  description: string;
  cover: string;
  startDate: string | null;
  endDate: string | null;
  timezone: string;
  venue: string;
  state: string;
  community: Community;
  goingCount: number;
  checkedInCount: number;
  attendedCount: number;
  capacity: number;
  certificate: CertificateOffer;
  cancellationReason: string;
  registrationPolicy: 'OPEN' | 'APPROVAL' | 'INVITE';
  registrationClosed: boolean;
  registrationDeadline: string | null;
  /** Set when people register on another site (Luma, Eventbrite...). */
  externalRegistration: { url: string; label: string } | null;
  /** Listed here, run on another site: we don't scan it and never promise attendance for it. */
  external: boolean;
  /** The organizer has finalized attendance. Until then nothing about attendance is settled. */
  finalized: boolean;
  multiDay: boolean;
}

export type RegistrationStatus = 'PENDING_APPROVAL' | 'CONFIRMED' | 'WAITLISTED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'COMPLETED' | 'PARTIAL_ATTENDANCE' | 'CANCELLED' | 'REJECTED' | 'NO_SHOW';

export interface Registration {
  id: string;
  status: RegistrationStatus;
  qrToken: string;
  passCode?: string;
  checkInAt: string | null;
  checkOutAt: string | null;
}

export interface Attendance { checkInAt: string | null; checkOutAt: string | null; counted: boolean }

export type GuestVisibility = 'VISIBLE' | 'DEPARTMENT_ONLY' | 'HIDDEN';

export interface GuestListEntry {
  id: string;
  name: string;
  avatar: string;
  school: string;
  department: string;
  level: string;
  stampCount: number;
  visibility: GuestVisibility;
  checkedIn: boolean;
  attended: boolean;
  isHost: boolean;
  joinedAt: string;
  topCommunities: string[];
  eventsInCommon: number;
}

export interface GuestList {
  /** Real: the number of registrations. Hidden guests count here but are not listed. */
  count: number;
  checkedIn: number;
  entries: GuestListEntry[];
  highlights: { department: number; level: number; attendedWithBefore: number };
  /** True when entries are sample placeholders instead of attendee records from the API. */
  preview: boolean;
  /** From the API: the organizer has finalized attendance for this event. */
  finalized: boolean;
}

export interface Stamp {
  eventId: string;
  eventTitle: string;
  eventSlug: string;
  date: string | null;
  role: 'ATTENDED' | 'HOSTED' | 'CO_HOSTED';
  attendedWith: number;
  certificateSerial: string | null;
  communityName: string;
  communitySlug: string;
}

export interface Certificate { serial: string; eventTitle: string; issuedAt: string }
export interface Rating { rating: number; comment: string }

export interface EventDetail {
  event: Event;
  viewerRegistration: Registration | null;
  viewerCertificateSerial: string | null;
  /** From the API: attendance is finalized AND this viewer's record counted. */
  viewerAttended: boolean;
  viewerRating: Rating | null;
  canManage: boolean;
  saved: boolean;
  speakers: { id: string; name: string; title: string; organization: string; photo: string }[];
  coHosts: Community[];
  contacts: { name: string; phone: string; email: string }[];
}
