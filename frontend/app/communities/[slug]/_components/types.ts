import type { CommunityEndorsement, CommunityJoinRequest, CommunitySummary, MembershipStatus } from '../../../../components/guildos/community-list-api';

export type ViewerMembership = { role: string } | null;

export type MemberRow = {
  membership: { _id: string; role: string; status?: MembershipStatus; joinedAt?: string; assignedBy?: string | null };
  user: { id: string; fullName: string; profile?: { avatar?: string } };
};

export type CommunityContext = {
  community: CommunitySummary;
  viewerMembership?: ViewerMembership;
  viewerJoinRequest?: CommunityJoinRequest | null;
  leadership?: Array<{ membership: { _id: string; role: string; joinedAt?: string }; user: { id: string; fullName: string; profile?: { avatar?: string } } }>;
  endorsements?: CommunityEndorsement[];
  /** Average attendee rating across this community's events (checked-in attendees only). */
  eventRating?: { average: number; count: number };
  members?: MemberRow[];
  membersTotal?: number;
  membersNextCursor?: string | null;
  joinRequests?: CommunityJoinRequest[];
};

/** Membership roles that may manage the community (COORDINATOR and up). */
export const MANAGER_ROLES = ['COORDINATOR', 'ORGANIZER', 'SECRETARY', 'TREASURER', 'VICE_PRESIDENT', 'PRESIDENT', 'FOUNDER'];
