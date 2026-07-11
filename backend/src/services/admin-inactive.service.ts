import { CommunityModel } from '../models/community.model';
import { EventModel } from '../models/event.model';
import { UserModel } from '../models/user.model';

const LIMIT = 100;

export type InactiveCommunity = {
  id: string;
  name: string;
  slug: string;
  university: string;
  reason: 'REJECTED' | 'ARCHIVED';
  note: string;
  updatedAt: string;
};

export type InactiveEvent = {
  id: string;
  title: string;
  slug: string;
  community: string;
  reason: 'ARCHIVED' | 'DELETED';
  updatedAt: string;
};

export type InactiveUser = {
  id: string;
  fullName: string;
  email: string;
  username: string;
  role: string;
  reason: 'BLOCKED' | 'DELETED';
  note: string;
  updatedAt: string;
};

export type InactiveEntities = {
  communities: InactiveCommunity[];
  events: InactiveEvent[];
  users: InactiveUser[];
};

/**
 * Aggregates every entity that has been removed from the live platform so
 * admins have a single audit view. None of these are shown to normal users.
 */
export async function getInactiveEntities(): Promise<InactiveEntities> {
  const [communities, events, users] = await Promise.all([
    CommunityModel.find({ $or: [{ verificationStatus: 'REJECTED' }, { archivedAt: { $ne: null } }] })
      .sort({ updatedAt: -1 })
      .limit(LIMIT)
      .lean(),
    EventModel.find({ $or: [{ status: 'ARCHIVED' }, { deletedAt: { $ne: null } }] })
      .sort({ updatedAt: -1 })
      .limit(LIMIT)
      .lean(),
    UserModel.find({ $or: [{ status: 'BLOCKED' }, { deletedAt: { $ne: null } }] })
      .sort({ updatedAt: -1 })
      .limit(LIMIT)
      .lean(),
  ]);

  const communityIds = Array.from(new Set(events.map((event) => event.communityId?.toString()).filter(Boolean)));
  const communityNames = new Map<string, string>();
  if (communityIds.length) {
    const rows = await CommunityModel.find({ _id: { $in: communityIds } }).select('name').lean();
    for (const row of rows) {
      communityNames.set(row._id.toString(), row.name);
    }
  }

  return {
    communities: communities.map((community) => ({
      id: community._id.toString(),
      name: community.name,
      slug: community.slug,
      university: community.university,
      reason: community.archivedAt ? 'ARCHIVED' : 'REJECTED',
      note: community.archivedAt ? community.archiveReason || '' : community.verificationNotes || '',
      updatedAt: (community.updatedAt ?? community.createdAt).toISOString(),
    })),
    events: events.map((event) => ({
      id: event._id.toString(),
      title: event.title,
      slug: event.slug,
      community: communityNames.get(event.communityId?.toString() ?? '') ?? '',
      reason: event.deletedAt ? 'DELETED' : 'ARCHIVED',
      updatedAt: (event.updatedAt ?? event.createdAt).toISOString(),
    })),
    users: users.map((user) => ({
      id: user._id.toString(),
      fullName: user.fullName,
      email: user.email,
      username: user.profile?.username ?? '',
      role: user.role,
      reason: user.deletedAt ? 'DELETED' : 'BLOCKED',
      note: user.blockReason ?? '',
      updatedAt: (user.updatedAt ?? user.createdAt).toISOString(),
    })),
  };
}
