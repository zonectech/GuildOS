import mongoose from 'mongoose';
import { UserBlockModel } from '../models/user-block.model';
import { peopleSearchFilter } from './ranking/people-discovery-query';
import { ConnectionModel, connectionPairKey, type ConnectionStatus } from '../models/connection.model';
import { UserModel } from '../models/user.model';
import { authStore } from '../store/auth-store';
import { createNotification } from './notification.service';
import { isBlockedBetween } from './user-safety.service';
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
    headline: u.profile?.showUniversity === false ? '' : [u.profile?.department, u.profile?.university].filter(Boolean).join(' · '),
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

export async function listOutgoingRequests(userId: string) {
  const rows = await ConnectionModel.find({ requesterId: userId, status: 'PENDING' }).sort({ createdAt: -1 }).lean();
  const people = await Promise.all(rows.map(async row => {
    const id = row.addresseeId.toString();
    return await isBlockedBetween(userId, id) ? null : publicPerson(id);
  }));
  return rows.map((row, index) => ({ recipient: people[index], createdAt: row.createdAt }))
    .filter((entry): entry is { recipient: NonNullable<Awaited<ReturnType<typeof publicPerson>>>; createdAt: Date } => Boolean(entry.recipient));
}

async function getAffinitySuggestions(userId: string, limit = 12, query = '') {
  return getRankedPeerSuggestions(userId, limit, query);
}

/** Fill sparse networks with public people, while enforcing discovery safety. */
export async function getPeopleYouMayKnow(userId: string, limit = 12, query = '') {
  const size = Math.min(50, Math.max(1, Math.floor(Number(limit) || 12)));
  const preferred = await getAffinitySuggestions(userId, size, query);
  const [relations, blocks] = await Promise.all([
    ConnectionModel.find({ $or: [{ requesterId: userId }, { addresseeId: userId }] }).select('requesterId addresseeId status').lean(),
    UserBlockModel.find({ $or: [{ blockerId: userId }, { blockedId: userId }] }).select('blockerId blockedId').lean(),
  ]);
  const excluded = new Set([userId]);
  for (const block of blocks) {
    excluded.add(block.blockerId.toString());
    excluded.add(block.blockedId.toString());
  }
  const states = new Map<string, ConnectionState>();
  for (const row of relations) {
    const requester = row.requesterId.toString();
    const other = requester === userId ? row.addresseeId.toString() : requester;
    states.set(other, row.status === 'ACCEPTED' ? 'CONNECTED' : requester === userId ? 'PENDING_OUTGOING' : 'PENDING_INCOMING');
  }
  const eligible = {
    ...peopleSearchFilter(query),
    _id: { $nin: [...excluded] }, status: 'ACTIVE', deletedAt: null,
    'profile.profileVisibility': 'PUBLIC',
    'profile.username': { $type: 'string', $ne: '' },
  };
  const rows = await UserModel.find(eligible).select('_id').sort({ createdAt: -1 }).limit(200).lean();
  const allowed = new Set(rows.map(row => row._id.toString()));
  // Check ranked candidates independently; the fallback pool is intentionally bounded.
  const preferredRows = preferred.length ? await UserModel.find({ ...eligible, _id: { $in: preferred.map(p => p.id), $nin: [...excluded] } }).select('_id').lean() : [];
  for (const row of preferredRows) allowed.add(row._id.toString());
  const seen = new Set<string>();
  const candidates = [...preferred, ...rows.map(row => ({ id: row._id.toString() }))].filter(candidate => {
    if (excluded.has(candidate.id) || seen.has(candidate.id) || !allowed.has(candidate.id)) return false;
    seen.add(candidate.id);
    return true;
  }).slice(0, size);
  const people = await Promise.all(candidates.map(async candidate => {
    const person = await publicPerson(candidate.id);
    if (!person) return null;
    const suggestedReason = 'reason' in candidate && typeof candidate.reason === 'string' ? candidate.reason : 'Discover someone on GuildOS';
    const academicReason = ['Same university', 'Same course of study', 'Same faculty', 'Same department', 'Same level of study'].includes(suggestedReason);
    return { ...person, state: states.get(candidate.id) ?? 'NONE', reason: academicReason && !person.headline ? 'Discover someone on GuildOS' : suggestedReason };
  }));
  return people.filter((person): person is NonNullable<typeof person> => Boolean(person));
}
