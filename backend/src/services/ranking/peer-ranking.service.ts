/**
 * Peer ranking — multi-signal "People You May Know".
 * Spec: docs/discovery-ranking-algorithms.md §2.
 *
 * Signals: shared communities, mutual connections, co-attended events,
 * same department/faculty/university, shared interests. Every suggestion
 * carries a human-readable reason from its strongest signal.
 */

import { ConnectionModel } from '../../models/connection.model';
import { MembershipModel } from '../../models/membership.model';
import { CommunityModel } from '../../models/community.model';
import { EventRegistrationModel } from '../../models/event-registration.model';
import { UserModel } from '../../models/user.model';
import { authStore } from '../../store/auth-store';
import { RANKING_WEIGHTS, norm } from './ranking.config';

const ACTIVE_MEMBERSHIP = { $nin: ['SUSPENDED', 'REMOVED', 'LEFT'] };
const REAL_REGISTRATION = { $nin: ['CANCELLED', 'REJECTED', 'NO_SHOW'] };

function normalizeAvatar(avatar?: string) {
  if (!avatar) return '';
  if (avatar.startsWith('http') || avatar.startsWith('/')) return avatar;
  return `/uploads/${avatar}`;
}

type Candidate = {
  score: number;
  sharedCommunities: number;
  sampleCommunity: string;
  mutuals: number;
  coEvents: number;
  sharedInterest: string;
  schoolReason: string;
};

function blank(): Candidate {
  return { score: 0, sharedCommunities: 0, sampleCommunity: '', mutuals: 0, coEvents: 0, sharedInterest: '', schoolReason: '' };
}

function reasonFor(c: Candidate): string {
  // Strongest signal wins, mirroring the weight order in the spec.
  if (c.sharedCommunities > 0) {
    return c.sampleCommunity ? `Member of ${c.sampleCommunity}` : `${c.sharedCommunities} shared communities`;
  }
  if (c.mutuals > 0) return `${c.mutuals} mutual connection${c.mutuals > 1 ? 's' : ''}`;
  if (c.coEvents > 0) return `Attended ${c.coEvents} event${c.coEvents > 1 ? 's' : ''} with you`;
  if (c.schoolReason) return c.schoolReason;
  if (c.sharedInterest) return `Shares your interest in ${c.sharedInterest}`;
  return 'Suggested for you';
}

export async function getRankedPeerSuggestions(userId: string, limit = 12) {
  const w = RANKING_WEIGHTS.peers;

  const [me, myConnections, pending, myMemberships, myRegistrations] = await Promise.all([
    UserModel.findById(userId).select('profile.university profile.faculty profile.department profile.interests').lean(),
    ConnectionModel.find({ status: 'ACCEPTED', $or: [{ requesterId: userId }, { addresseeId: userId }] })
      .select('requesterId addresseeId')
      .lean(),
    ConnectionModel.find({ status: 'PENDING', $or: [{ requesterId: userId }, { addresseeId: userId }] })
      .select('requesterId addresseeId')
      .lean(),
    MembershipModel.find({ userId, status: ACTIVE_MEMBERSHIP }).select('communityId').lean(),
    EventRegistrationModel.find({ userId, status: REAL_REGISTRATION }).select('eventId').limit(100).lean(),
  ]);

  const myConnIds = myConnections.map((c) =>
    c.requesterId.toString() === userId ? c.addresseeId.toString() : c.requesterId.toString(),
  );
  const exclude = new Set<string>([userId, ...myConnIds]);
  for (const p of pending) {
    exclude.add(p.requesterId.toString());
    exclude.add(p.addresseeId.toString());
  }

  const candidates = new Map<string, Candidate>();
  const get = (uid: string) => {
    let c = candidates.get(uid);
    if (!c) {
      c = blank();
      candidates.set(uid, c);
    }
    return c;
  };

  // ── Shared communities ──
  const communityIds = myMemberships.map((m) => m.communityId);
  if (communityIds.length) {
    const [coMembers, communityRows] = await Promise.all([
      MembershipModel.find({ communityId: { $in: communityIds }, status: ACTIVE_MEMBERSHIP })
        .select('userId communityId')
        .limit(w.candidateCap * 2)
        .lean(),
      CommunityModel.find({ _id: { $in: communityIds } }).select('name').lean(),
    ]);
    const communityNames = new Map(communityRows.map((c) => [c._id.toString(), c.name]));
    for (const m of coMembers) {
      const uid = m.userId.toString();
      if (exclude.has(uid)) continue;
      const c = get(uid);
      c.sharedCommunities += 1;
      c.score += w.sharedCommunity;
      if (!c.sampleCommunity) c.sampleCommunity = communityNames.get(m.communityId.toString()) ?? '';
    }
  }

  // ── Mutual connections (connections of my connections) ──
  if (myConnIds.length) {
    const second = await ConnectionModel.find({
      status: 'ACCEPTED',
      $or: [{ requesterId: { $in: myConnIds } }, { addresseeId: { $in: myConnIds } }],
    })
      .select('requesterId addresseeId')
      .limit(w.candidateCap * 3)
      .lean();
    const myConnSet = new Set(myConnIds);
    for (const conn of second) {
      const a = conn.requesterId.toString();
      const b = conn.addresseeId.toString();
      const other = myConnSet.has(a) ? b : a;
      if (exclude.has(other)) continue;
      const c = get(other);
      c.mutuals += 1;
      c.score += w.mutualConnection;
    }
  }

  // ── Co-attended events ──
  const myEventIds = myRegistrations.map((r) => r.eventId);
  if (myEventIds.length) {
    const coAttendees = await EventRegistrationModel.find({
      eventId: { $in: myEventIds },
      status: REAL_REGISTRATION,
    })
      .select('userId')
      .limit(w.candidateCap * 2)
      .lean();
    for (const r of coAttendees) {
      const uid = r.userId.toString();
      if (exclude.has(uid)) continue;
      const c = get(uid);
      c.coEvents += 1;
      c.score += w.coAttendedEvent;
    }
  }

  // ── School & interests (also fills the pool when graph is sparse) ──
  const university = norm(me?.profile?.university);
  const faculty = norm(me?.profile?.faculty);
  const department = norm(me?.profile?.department);
  const interests = (me?.profile?.interests ?? []).map((i: string) => norm(i)).filter(Boolean);

  if (university) {
    const sameUni = await UserModel.find({
      'profile.university': { $regex: `^${university.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
      'profile.profileVisibility': { $ne: 'PRIVATE' },
      'profile.username': { $nin: ['', null] },
    })
      .select('profile.faculty profile.department profile.interests')
      .limit(w.candidateCap)
      .lean();

    for (const u of sameUni) {
      const uid = u._id.toString();
      if (exclude.has(uid)) continue;
      const c = get(uid);
      c.score += w.sameUniversity;
      c.schoolReason = 'Same university';
      if (department && norm(u.profile?.department) === department) {
        c.score += w.sameDepartment;
        c.schoolReason = 'Same department';
      } else if (faculty && norm(u.profile?.faculty) === faculty) {
        c.score += w.sameFaculty;
        c.schoolReason = 'Same faculty';
      }
      if (interests.length) {
        const theirs = (u.profile?.interests ?? []).map((i: string) => norm(i));
        const shared = interests.filter((i) => theirs.includes(i));
        if (shared.length) {
          c.score += w.sharedInterest * shared.length;
          if (!c.sharedInterest) c.sharedInterest = shared[0];
        }
      }
    }
  }

  // ── Rank, hydrate, attach reasons ──
  const ranked = [...candidates.entries()].sort((a, b) => b[1].score - a[1].score).slice(0, limit);

  const results = await Promise.all(
    ranked.map(async ([uid, meta]) => {
      const u = await authStore.getPublicUserById(uid).catch(() => null);
      if (!u) return null;
      return {
        id: u.id,
        fullName: u.fullName,
        username: u.profile?.username ?? '',
        avatar: normalizeAvatar(u.profile?.avatar),
        headline: [u.profile?.department, u.profile?.university].filter(Boolean).join(' · '),
        reason: reasonFor(meta),
      };
    }),
  );
  return results.filter((r): r is NonNullable<typeof r> => Boolean(r));
}
