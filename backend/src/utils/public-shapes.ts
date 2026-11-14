/**
 * What strangers are allowed to receive.
 *
 * Internal records (a user, an event, a community) carry private fields: email addresses, join and
 * chat links, promo codes, reviewer notes. Public endpoints must send these shapes instead of the
 * record itself, so a new private field on a model is never public by accident.
 */

type ProfileLike = {
  username?: string; avatar?: string; university?: string; faculty?: string; department?: string; level?: string;
  profileVisibility?: string; showUniversity?: boolean;
};
type UserLike = { id: string; fullName: string; profile?: ProfileLike | null };

/**
 * A person in a public list (community members, leaders, followers): who they are and where they
 * study. Never an email, phone number, account state or privacy settings. A private profile gives
 * the name and photo only.
 */
export function toPersonCard(user: UserLike) {
  const p = user.profile ?? {};
  const isPrivate = p.profileVisibility === 'PRIVATE';
  const academic = !isPrivate && p.showUniversity !== false;
  return {
    id: user.id,
    fullName: user.fullName,
    profile: {
      username: p.username ?? '',
      avatar: p.avatar ?? '',
      university: academic ? p.university ?? '' : '',
      faculty: academic ? p.faculty ?? '' : '',
      department: academic ? p.department ?? '' : '',
      level: academic ? p.level ?? '' : '',
      profileVisibility: p.profileVisibility ?? 'PUBLIC',
    },
  };
}
export type PersonCard = ReturnType<typeof toPersonCard>;

/**
 * An event as a list or a non-host sees it: the join link, attendee group chats and promo codes
 * are emptied. (The event page hands the links back to people who hold a place; see getEventBySlug.)
 */
export function stripPrivateEventFields<T extends object>(event: T): T {
  const e = { ...event } as Record<string, unknown>;
  if ('meetingLink' in e) e.meetingLink = '';
  if ('attendeeChatLink' in e) e.attendeeChatLink = '';
  if ('ticketPromoCodes' in e) e.ticketPromoCodes = [];
  if (Array.isArray(e.sections)) e.sections = (e.sections as Record<string, unknown>[]).map((s) => ('chatLink' in s ? { ...s, chatLink: '' } : s));
  return e as T;
}

/** Review paperwork: only the founder and platform reviewers ever see these. */
const COMMUNITY_REVIEW_FIELDS = ['verificationNotes', 'endorsementLetter', 'requestNote', 'infoRequest', 'verifiedBy', 'archivedBy', 'archiveReason'] as const;

export function stripPrivateCommunityFields<T extends object>(community: T): T {
  const c = { ...community } as Record<string, unknown>;
  for (const key of COMMUNITY_REVIEW_FIELDS) delete c[key];
  return c as T;
}
