/**
 * Event ranking — "Recommended for you" events.
 * Spec: docs/discovery-ranking-algorithms.md §3.
 *
 * Also exposes listRecommendedEvents() which degrades gracefully to
 * "upcoming events by date" when ranking is disabled, so the endpoint
 * can ship now and light up later.
 */

import { EventModel } from '../../models/event.model';
import { EventRegistrationModel } from '../../models/event-registration.model';
import { CommunityModel } from '../../models/community.model';
import { CommunityFollowModel } from '../../models/community-follow.model';
import { MembershipModel } from '../../models/membership.model';
import { ConnectionModel } from '../../models/connection.model';
import { UserModel } from '../../models/user.model';
import { RANKING_WEIGHTS, isRankingEnabled, log2p1, norm } from './ranking.config';

const ACTIVE_MEMBERSHIP = { $nin: ['SUSPENDED', 'REMOVED', 'LEFT'] };
const REAL_REGISTRATION = { $nin: ['CANCELLED', 'REJECTED', 'NO_SHOW'] };

async function upcomingPublicEvents(cap = 200) {
  const archived = await CommunityModel.find({ archivedAt: { $ne: null } }).select('_id').lean();
  return EventModel.find({
    deletedAt: null,
    visibility: 'PUBLIC',
    status: 'PUBLISHED',
    startDate: { $gte: new Date() },
    ...(archived.length ? { communityId: { $nin: archived.map((c) => c._id) } } : {}),
  })
    .sort({ startDate: 1 })
    .limit(cap)
    .lean();
}

export async function rankEventsForUser(userId: string, limit = 12) {
  const w = RANKING_WEIGHTS.events;
  const events = await upcomingPublicEvents();
  if (!events.length) return [];

  const [me, memberships, follows, connections] = await Promise.all([
    UserModel.findById(userId).select('profile.university profile.location profile.interests').lean(),
    MembershipModel.find({ userId, status: ACTIVE_MEMBERSHIP }).select('communityId').lean(),
    CommunityFollowModel.find({ userId }).select('communityId').lean(),
    ConnectionModel.find({ status: 'ACCEPTED', $or: [{ requesterId: userId }, { addresseeId: userId }] })
      .select('requesterId addresseeId')
      .lean(),
  ]);

  const myCommunityIds = new Set(memberships.map((m) => m.communityId.toString()));
  const followedIds = new Set(follows.map((f) => f.communityId.toString()));
  const connIds = connections.map((c) =>
    c.requesterId.toString() === userId ? c.addresseeId.toString() : c.requesterId.toString(),
  );
  const myUniversity = norm(me?.profile?.university);
  const myLocation = norm(me?.profile?.location);
  const interests = (me?.profile?.interests ?? []).map((i: string) => norm(i)).filter(Boolean);

  const eventIds = events.map((e) => e._id);

  // Popularity + friends-attending in two aggregate queries.
  const [regCounts, friendRegs, hostCommunities] = await Promise.all([
    EventRegistrationModel.aggregate([
      { $match: { eventId: { $in: eventIds }, status: REAL_REGISTRATION } },
      { $group: { _id: '$eventId', count: { $sum: 1 } } },
    ]),
    connIds.length
      ? EventRegistrationModel.find({
          eventId: { $in: eventIds },
          userId: { $in: connIds },
          status: REAL_REGISTRATION,
        })
          .select('eventId')
          .lean()
      : Promise.resolve([] as { eventId: unknown }[]),
    CommunityModel.find({ _id: { $in: Array.from(new Set(events.map((e) => e.communityId.toString()))) } })
      .select('name slug logo university')
      .lean(),
  ]);

  const popularity = new Map(regCounts.map((r: { _id: unknown; count: number }) => [String(r._id), r.count]));
  const friendCount = new Map<string, number>();
  for (const r of friendRegs) {
    const key = String(r.eventId);
    friendCount.set(key, (friendCount.get(key) ?? 0) + 1);
  }
  const communityById = new Map(hostCommunities.map((c) => [c._id.toString(), c]));

  const now = Date.now();
  const scored = events.map((event) => {
    const id = event._id.toString();
    const communityId = event.communityId.toString();
    const host = communityById.get(communityId);
    let score = 0;
    let reason = '';

    if (myCommunityIds.has(communityId)) {
      score += w.myCommunity;
      reason = `From ${host?.name ?? 'your community'}`;
    } else if (followedIds.has(communityId)) {
      score += w.followedCommunity;
      reason = `From ${host?.name ?? 'a community you follow'}`;
    }

    const friends = Math.min(friendCount.get(id) ?? 0, w.connectionAttendingCap);
    if (friends > 0) {
      score += w.connectionAttending * friends;
      if (!reason) reason = `${friends} connection${friends > 1 ? 's' : ''} attending`;
    }

    if (interests.length) {
      const haystack = [event.title, event.shortDescription, event.description, event.type].join(' ').toLowerCase();
      const matched = interests.filter((i) => haystack.includes(i));
      if (matched.length) {
        score += w.interestMatch * matched.length;
        if (!reason) reason = `Matches your interest in ${matched[0]}`;
      }
    }

    if (myUniversity && norm(host?.university) === myUniversity) {
      score += w.sameUniversityHost;
      if (!reason) reason = 'From your school';
    }

    if (myLocation && event.mode !== 'VIRTUAL') {
      const place = [event.venue, event.address].join(' ').toLowerCase();
      if (place.includes(myLocation)) {
        score += w.locationMatch;
        if (!reason) reason = 'Near you';
      }
    }

    score += w.popularityLogWeight * log2p1(popularity.get(id));
    if (event.certificateEnabled) score += w.certificateBoost;

    const daysUntil = event.startDate ? Math.max(0, (new Date(event.startDate).getTime() - now) / 864e5) : 30;
    score += w.urgencyBase * Math.pow(w.urgencyDailyDecay, daysUntil);

    return {
      event,
      score,
      reason: reason || 'Happening soon',
      community: host ? { name: host.name, slug: host.slug, logo: host.logo } : null,
      registrations: popularity.get(id) ?? 0,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(({ event, reason, community, registrations }) => ({
    ...event,
    reason,
    community,
    registrationCount: registrations,
  }));
}

/**
 * Public entry point for GET /api/events/recommended.
 * Flag off → upcoming events by date (no personalisation), same shape.
 */
export async function listRecommendedEvents(userId: string, limit = 12) {
  if (isRankingEnabled()) return rankEventsForUser(userId, limit);

  const events = await upcomingPublicEvents(limit);
  const communityIds = Array.from(new Set(events.map((e) => e.communityId.toString())));
  const communities = communityIds.length
    ? await CommunityModel.find({ _id: { $in: communityIds } }).select('name slug logo').lean()
    : [];
  const byId = new Map(communities.map((c) => [c._id.toString(), c]));
  return events.map((event) => {
    const host = byId.get(event.communityId.toString());
    return {
      ...event,
      reason: 'Happening soon',
      community: host ? { name: host.name, slug: host.slug, logo: host.logo } : null,
      registrationCount: 0,
    };
  });
}
