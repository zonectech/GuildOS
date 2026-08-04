import mongoose from 'mongoose';
import { ConnectionModel, connectionPairKey, type ConnectionStatus } from '../models/connection.model';
import { UserModel } from '../models/user.model';
import { MembershipModel } from '../models/membership.model';
import { CommunityModel } from '../models/community.model';
import { authStore } from '../store/auth-store';
import { createNotification } from './notification.service';
import { isBlockedBetween } from './user-safety.service';
import { isRankingEnabled } from './ranking/ranking.config';
import { getRankedPeerSuggestions } from './ranking/peer-ranking.service';

export type ConnectionState = 'NONE' | 'PENDING_OUTGOING' | 'PENDING_INCOMING' | 'CONNECTED' | 'SELF';

function normalizeAvatar(avatar?: string) {
  if (!avatar) return '';
  if (avatar.startsWith('http') || avatar.startsWith('/')) return avatar;
  return `/uploads/${avatar}`;
}

async function publicPerson(userId: string) {
  const u = await authStore.getPublicUserById(userId).catch(() => null);
  if (!u) return null;
  return {
    id: u.id,
    fullName: u.fullName,
    username: u.profile?.username ?? '',
    avatar: normalizeAvatar(u.profile?.avatar),
    headline: [u.profile?.department, u.profile?.university].filter(Boolean).join(' · '),
  };
}

/** IDs of a user's accepted connections (the "other" side). */
async function acceptedConnectionIds(userId: string): Promise<string[]> {
  const rows = await ConnectionModel.find({
    status: 'ACCEPTED',
    $or: [{ requesterId: userId }, { addresseeId: userId }],
  }).select('requesterId addresseeId').lean();
  return rows.map((r) => (r.requesterId.toString() === userId ? r.addresseeId.toString() : r.requesterId.toString()));
}

export async function getConnectionState(userId: string, otherId: string): Promise<ConnectionState> {
  if (userId === otherId) return 'SELF';
  const conn = await ConnectionModel.findOne({ pairKey: connectionPairKey(userId, otherId) }).lean();
  if (!conn) return 'NONE';
  if (conn.status === 'ACCEPTED') return 'CONNECTED';
  return conn.requesterId.toString() === userId ? 'PENDING_OUTGOING' : 'PENDING_INCOMING';
}

export async function sendConnectionRequest(userId: string, targetId: string) {
  if (!mongoose.Types.ObjectId.isValid(targetId)) throw new Error('User not found');
  if (userId === targetId) throw new Error('You cannot connect with yourself');
  const target = await UserModel.findById(targetId).select('_id status deletedAt').lean();
  // Blocked/deleted accounts can't receive connection requests.
  if (!target || target.deletedAt || target.status === 'BLOCKED') throw new Error('User not found');
  // A user-level block (either direction) also stops connection requests — same
  // opaque error so the blocked person can't probe who blocked them.
  if (await isBlockedBetween(userId, targetId)) throw new Error('User not found');

  const pairKey = connectionPairKey(userId, targetId);
  const existing = await ConnectionModel.findOne({ pairKey });
  if (existing) {
    if (existing.status === 'ACCEPTED') return { state: 'CONNECTED' as ConnectionState };
    // A pending request from the other side → accept it (mutual intent).
    if (existing.addresseeId.toString() === userId) {
      existing.status = 'ACCEPTED';
      await existing.save();
      const actor = await publicPerson(userId);
      await createNotification({
        userId: existing.requesterId.toString(),
        actorId: userId,
        type: 'CONNECTION_ACCEPTED',
        title: `${actor?.fullName ?? 'Someone'} accepted your connection request`,
        link: actor?.username ? `/profile/${actor.username}` : '/connections',
      });
      return { state: 'CONNECTED' as ConnectionState };
    }
    return { state: 'PENDING_OUTGOING' as ConnectionState };
  }

  await ConnectionModel.create({ requesterId: userId, addresseeId: targetId, pairKey, status: 'PENDING' });
  const actor = await publicPerson(userId);
  await createNotification({
    userId: targetId,
    actorId: userId,
    type: 'CONNECTION_REQUEST',
    title: `${actor?.fullName ?? 'Someone'} wants to connect`,
    link: '/connections',
  });
  return { state: 'PENDING_OUTGOING' as ConnectionState };
}

export async function respondToRequest(userId: string, requesterId: string, accept: boolean) {
  const conn = await ConnectionModel.findOne({ pairKey: connectionPairKey(userId, requesterId), status: 'PENDING' });
  if (!conn || conn.addresseeId.toString() !== userId) throw new Error('Request not found');
  if (!accept) {
    await conn.deleteOne();
    return { state: 'NONE' as ConnectionState };
  }
  conn.status = 'ACCEPTED';
  await conn.save();
  const actor = await publicPerson(userId);
  await createNotification({
    userId: requesterId,
    actorId: userId,
    type: 'CONNECTION_ACCEPTED',
    title: `${actor?.fullName ?? 'Someone'} accepted your connection request`,
    link: actor?.username ? `/profile/${actor.username}` : '/connections',
  });
  return { state: 'CONNECTED' as ConnectionState };
}

export async function removeConnection(userId: string, otherId: string) {
  await ConnectionModel.deleteOne({ pairKey: connectionPairKey(userId, otherId) });
  return { state: 'NONE' as ConnectionState };
}

export async function getConnectionCount(userId: string) {
  return ConnectionModel.countDocuments({ status: 'ACCEPTED', $or: [{ requesterId: userId }, { addresseeId: userId }] });
}

export async function getMutualCount(userId: string, otherId: string) {
  if (userId === otherId) return 0;
  const [mine, theirs] = await Promise.all([acceptedConnectionIds(userId), acceptedConnectionIds(otherId)]);
  const set = new Set(mine);
  return theirs.filter((id) => set.has(id)).length;
}

export async function listConnections(userId: string) {
  const ids = await acceptedConnectionIds(userId);
  const people = await Promise.all(ids.map((id) => publicPerson(id)));
  return people.filter((p): p is NonNullable<typeof p> => Boolean(p));
}

export async function listPendingRequests(userId: string) {
  const rows = await ConnectionModel.find({ addresseeId: userId, status: 'PENDING' }).sort({ createdAt: -1 }).lean();
  const people = await Promise.all(rows.map((r) => publicPerson(r.requesterId.toString())));
  return rows
    .map((r, i) => ({ requester: people[i], createdAt: r.createdAt }))
    .filter((x): x is { requester: NonNullable<Awaited<ReturnType<typeof publicPerson>>>; createdAt: Date } => Boolean(x.requester));
}

export async function getPeopleYouMayKnow(userId: string, limit = 12) {
  // Multi-signal ranking (docs/discovery-ranking-algorithms.md §2) when enabled.
  if (isRankingEnabled()) return getRankedPeerSuggestions(userId, limit);

  const me = await UserModel.findById(userId).select('profile.university').lean();
  const connected = await acceptedConnectionIds(userId);
  const pending = await ConnectionModel.find({ status: 'PENDING', $or: [{ requesterId: userId }, { addresseeId: userId }] })
    .select('requesterId addresseeId')
    .lean();
  const exclude = new Set<string>([userId, ...connected]);
  for (const p of pending) {
    exclude.add(p.requesterId.toString());
    exclude.add(p.addresseeId.toString());
  }

  // Communities I'm an active member of.
  const myMemberships = await MembershipModel.find({ userId, status: { $nin: ['REMOVED', 'LEFT'] } }).select('communityId').lean();
  const communityIds = myMemberships.map((m) => m.communityId);
  const communityNames = communityIds.length
    ? new Map((await CommunityModel.find({ _id: { $in: communityIds } }).select('name').lean()).map((c) => [c._id.toString(), c.name]))
    : new Map<string, string>();

  const scores = new Map<string, { shared: number; sampleCommunity: string }>();

  // Co-members of my communities.
  if (communityIds.length) {
    const coMembers = await MembershipModel.find({ communityId: { $in: communityIds }, status: { $nin: ['REMOVED', 'LEFT'] } })
      .select('userId communityId')
      .lean();
    for (const m of coMembers) {
      const uid = m.userId.toString();
      if (exclude.has(uid)) continue;
      const entry = scores.get(uid) ?? { shared: 0, sampleCommunity: communityNames.get(m.communityId.toString()) ?? '' };
      entry.shared += 1;
      scores.set(uid, entry);
    }
  }

  // Same-university students (public profiles) to fill remaining slots.
  if (me?.profile?.university) {
    const sameUni = await UserModel.find({
      'profile.university': me.profile.university,
      'profile.profileVisibility': { $ne: 'PRIVATE' },
      'profile.username': { $nin: ['', null] },
    })
      .select('_id')
      .limit(40)
      .lean();
    for (const u of sameUni) {
      const uid = u._id.toString();
      if (exclude.has(uid) || scores.has(uid)) continue;
      scores.set(uid, { shared: 0, sampleCommunity: '' });
    }
  }

  const ranked = [...scores.entries()]
    .sort((a, b) => b[1].shared - a[1].shared)
    .slice(0, limit);

  const results = await Promise.all(
    ranked.map(async ([uid, meta]) => {
      const person = await publicPerson(uid);
      if (!person) return null;
      const reason = meta.shared > 0 ? (meta.sampleCommunity ? `Member of ${meta.sampleCommunity}` : `${meta.shared} shared communities`) : 'Same university';
      return { ...person, reason };
    }),
  );
  return results.filter((r): r is NonNullable<typeof r> => Boolean(r));
}
