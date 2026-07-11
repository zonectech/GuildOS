/**
 * Discovery & ranking configuration.
 *
 * All tunable weights for the four ranking surfaces (feed, peers, events,
 * communities) live here — see docs/discovery-ranking-algorithms.md for the
 * full spec. Ranking is OFF by default; flip RANKING_ENABLED=true when the
 * user base is large enough (Phase 1 in the doc).
 */

export const rankingConfig = {
  /** Master switch for all ranked surfaces. */
  enabled: process.env.RANKING_ENABLED === 'true',
  /** Candidate pool size for feed ranking (first page only). */
  feedPoolSize: Math.min(Math.max(Number(process.env.RANKING_FEED_POOL ?? 150), 50), 500),
};

export function isRankingEnabled() {
  return rankingConfig.enabled;
}

export const RANKING_WEIGHTS = {
  feed: {
    base: 10,
    authorIsConnection: 30,
    inMyCommunity: 25,
    inFollowedCommunity: 15,
    taggedMe: 40,
    sameUniversity: 8,
    likeLogWeight: 6,
    commentLogWeight: 9,
    milestoneBoost: 12,
    imageBoost: 3,
    halfLifeHours: 18,
    authorDiversityFactor: 0.65,
  },
  peers: {
    sharedCommunity: 12,
    mutualConnection: 10,
    coAttendedEvent: 6,
    sameDepartment: 6,
    sameFaculty: 4,
    sameUniversity: 8,
    sharedInterest: 3,
    candidateCap: 400,
  },
  events: {
    myCommunity: 30,
    followedCommunity: 18,
    connectionAttending: 8,
    connectionAttendingCap: 5,
    interestMatch: 6,
    sameUniversityHost: 10,
    locationMatch: 6,
    popularityLogWeight: 5,
    urgencyBase: 12,
    urgencyDailyDecay: 0.9,
    certificateBoost: 5,
  },
  communities: {
    sameUniversity: 20,
    sameDepartment: 14,
    sameFaculty: 8,
    interestMatch: 6,
    locationMatch: 4,
    popularityLogWeight: 4,
    recentPostsLogWeight: 3,
    upcomingEventBoost: 5,
    upcomingEventCap: 3,
  },
} as const;

/** log2(1 + n), safe for negative/undefined inputs. */
export function log2p1(n: number | undefined | null) {
  return Math.log2(1 + Math.max(0, n ?? 0));
}

export function norm(value?: string | null) {
  return (value ?? '').trim().toLowerCase();
}
