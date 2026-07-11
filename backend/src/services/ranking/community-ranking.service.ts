/**
 * Community ranking — "Suggested communities" with activity signals.
 * Spec: docs/discovery-ranking-algorithms.md §4.
 *
 * Extends the existing school/interest heuristic with popularity and
 * activity (recent posts, upcoming events) so active communities outrank
 * large-but-dead ones.
 */

import { CommunityModel } from '../../models/community.model';
import { CommunityFollowModel } from '../../models/community-follow.model';
import { MembershipModel } from '../../models/membership.model';
import { PostModel } from '../../models/post.model';
import { EventModel } from '../../models/event.model';
import { UserModel } from '../../models/user.model';
import { RANKING_WEIGHTS, log2p1, norm } from './ranking.config';

export async function rankCommunitiesForUser(userId: string, limit = 6) {
  const w = RANKING_WEIGHTS.communities;

  const [user, memberships, follows, communities] = await Promise.all([
    UserModel.findById(userId).lean(),
    MembershipModel.find({ userId, status: { $nin: ['REMOVED', 'LEFT'] } }).select('communityId').lean(),
    CommunityFollowModel.find({ userId }).select('communityId').lean(),
    CommunityModel.find({ verificationStatus: 'VERIFIED', visibility: 'PUBLIC', archivedAt: null }).lean(),
  ]);

  const profile = user?.profile;
  const university = norm(profile?.university);
  const faculty = norm(profile?.faculty);
  const department = norm(profile?.department);
  const location = norm(profile?.location);
  const interests = (profile?.interests ?? []).map((i: string) => norm(i)).filter(Boolean);

  const excluded = new Set(
    [...memberships, ...follows].map((row) => row.communityId?.toString()).filter(Boolean) as string[],
  );
  const candidates = communities.filter((c) => !excluded.has(c._id.toString()));
  if (!candidates.length) return [];

  // Activity signals in two aggregate queries.
  const candidateIds = candidates.map((c) => c._id);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 864e5);
  const [postCounts, eventCounts] = await Promise.all([
    PostModel.aggregate([
      { $match: { communityId: { $in: candidateIds }, hiddenAt: null, createdAt: { $gte: thirtyDaysAgo } } },
      { $group: { _id: '$communityId', count: { $sum: 1 } } },
    ]),
    EventModel.aggregate([
      {
        $match: {
          communityId: { $in: candidateIds },
          deletedAt: null,
          visibility: 'PUBLIC',
          status: 'PUBLISHED',
          startDate: { $gte: new Date() },
        },
      },
      { $group: { _id: '$communityId', count: { $sum: 1 } } },
    ]),
  ]);
  const recentPosts = new Map(postCounts.map((r: { _id: unknown; count: number }) => [String(r._id), r.count]));
  const upcomingEvents = new Map(eventCounts.map((r: { _id: unknown; count: number }) => [String(r._id), r.count]));

  const scored = candidates.map((c) => {
    const id = c._id.toString();
    const cUni = norm(c.university);
    const cFac = norm(c.faculty);
    const cDep = norm(c.department);
    const haystack = [c.name, c.shortDescription, c.description, c.category].filter(Boolean).join(' ').toLowerCase();

    let score = 0;
    let reason = '';

    if (university && cUni && cUni === university) {
      score += w.sameUniversity;
      reason = 'From your school';
    }
    if (department && cDep && cDep === department) {
      score += w.sameDepartment;
      if (!reason) reason = 'Popular in your department';
    } else if (faculty && cFac && cFac === faculty) {
      score += w.sameFaculty;
      if (!reason) reason = 'Popular in your faculty';
    }

    if (interests.length) {
      const matched = interests.filter((i) => haystack.includes(i));
      if (matched.length) {
        score += w.interestMatch * matched.length;
        if (!reason) reason = `Matches your interest in ${matched[0]}`;
      }
    }

    if (location && (cUni.includes(location) || haystack.includes(location))) {
      score += w.locationMatch;
      if (!reason) reason = 'Near your location';
    }

    // Momentum: popularity + recent activity.
    score += w.popularityLogWeight * log2p1((c.memberCount ?? 0) + (c.followerCount ?? 0));
    score += w.recentPostsLogWeight * log2p1(recentPosts.get(id));
    const events = Math.min(upcomingEvents.get(id) ?? 0, w.upcomingEventCap);
    if (events > 0) {
      score += w.upcomingEventBoost * events;
      if (!reason) reason = `${events} upcoming event${events > 1 ? 's' : ''}`;
    }

    return { community: c, score, reason: reason || 'Popular on campus' };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(({ community, reason }) => ({ ...community, reason }));
}
