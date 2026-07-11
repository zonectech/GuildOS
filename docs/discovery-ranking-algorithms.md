# GuildOS Discovery & Ranking Algorithms

> Status: **Built & integrated, disabled by default.** Flip `RANKING_ENABLED=true` in
> `backend/.env` when the user base is large enough (see [Rollout](#rollout-plan)).
> Code lives in `backend/src/services/ranking/`.

## Why

GuildOS is **student reputation infrastructure**: campus activities → verified
records → professional portfolio. Discovery must therefore optimise for
**meaningful campus connections and verified participation**, not raw
engagement time. Every surface ranks by three pillars:

| Pillar | Meaning |
| --- | --- |
| **Relevance** | Same school / faculty / department, shared communities, shared interests |
| **Trust** | Verified communities, milestones, real participation (attendance, certificates) |
| **Momentum** | Recency, activity, and social proof (people you know are there) |

## Architecture

```
backend/src/services/ranking/
├── ranking.config.ts             # All tunable weights + feature flag helpers
├── feed-ranking.service.ts       # Feed (For You) scoring
├── peer-ranking.service.ts       # People You May Know scoring
├── event-ranking.service.ts      # Recommended events scoring
└── community-ranking.service.ts  # Suggested communities scoring
```

Integration points (all behind the flag — chronological/simple fallback when off):

| Surface | Entry point | When flag OFF | When flag ON |
| --- | --- | --- | --- |
| Feed | `feed.service.ts → getFeed()` | Newest first | Ranked first page, chronological pagination |
| Peers | `connection.service.ts → getPeopleYouMayKnow()` | Shared-community count | Full multi-signal ranking |
| Events | `GET /api/events/recommended` | Upcoming by date | Full multi-signal ranking |
| Communities | `community.service.ts → listSuggestedCommunities()` | School/interest heuristic | Weighted ranking + activity signals |

**Design rules**

1. **Transparent** — every recommendation carries a human-readable `reason`.
2. **Tunable** — all weights live in `ranking.config.ts`, nothing hard-coded.
3. **Zero new infra** — pure Mongo queries + in-process scoring. No ML, no
   offline jobs. Candidate pools are capped so cost stays bounded.
4. **Safe fallback** — flag off ⇒ behaviour identical to today.

---

## 1. Feed algorithm (`FORYOU` scope)

Candidate pool: the most recent `RANKING_FEED_POOL` posts (default 150,
non-hidden, non-archived communities). Each post is scored:

```
score = (BASE + affinity + engagement + content) × decay(age) × diversity
```

### Affinity — "do I care about this author/space?"

| Signal | Weight | Rationale |
| --- | --- | --- |
| Author is my connection | +30 | Strongest tie on the platform |
| Posted in a community I'm a member of | +25 | My spaces come first |
| Posted in a community I follow | +15 | Opted-in interest |
| I'm tagged in the post | +40 | Direct relevance |
| Author from my university | +8 | Campus locality |

### Engagement — log-scaled so big posts don't dominate

```
engagement = 6·log2(1+likes) + 9·log2(1+comments)
```

Comments weigh more than likes: conversation > applause.

### Content quality

| Signal | Weight |
| --- | --- |
| Milestone post (certificate, leadership, event completion) | +12 |
| Has image | +3 |

Milestones are boosted because **verified achievement is the product**.

### Recency decay

Exponential half-life of **18 hours**: `decay = 0.5^(ageHours/18)`.
A 3-day-old viral post still loses to a fresh post from your community.

### Diversity guard

Repeated posts by the same author on one page are multiplied by
`0.65^(n-1)` so no single account floods the feed.

### Pagination

Ranked scoring applies to the **first page only**; older pages stay
chronological (cursor-based). Phase 2 adds seen-post tracking for true
infinite ranked scroll.

---

## 2. Peer algorithm (People You May Know)

Excludes: self, existing connections, pending requests, `PRIVATE` profiles.

| Signal | Weight | Reason string |
| --- | --- | --- |
| Shared community (each) | +12 | "Member of {community}" |
| Mutual connection (each) | +10 | "{n} mutual connections" |
| Co-attended event (each) | +6 | "Attended {n} events with you" |
| Same department | +6 | "Same department" |
| Same faculty | +4 | "Same faculty" |
| Same university | +8 | "Same university" |
| Shared interest (each) | +3 | "Shares your interest in {interest}" |

Ties broken by most-recently-active. The `reason` shown is the highest-weight
matched signal. Candidate pool capped at ~400 profiles per request.

---

## 3. Event algorithm (Recommended events)

Candidates: `PUBLISHED`, public, upcoming, non-archived-community events.

| Signal | Weight |
| --- | --- |
| Hosted by a community I'm a member of | +30 |
| Hosted by a community I follow | +18 |
| Connection registered (each, cap 5) | +8 |
| Interest matches title/description/type (each) | +6 |
| Host community from my university | +10 |
| Location matches my location (physical/hybrid) | +6 |
| Popularity | `5·log2(1+registrations)` |
| Urgency (starts soon) | `12 · 0.9^daysUntilStart` |
| Certificate offered | +5 |

Certificate-enabled events get a boost because attending them builds the
student's verifiable record — the core loop of the platform.

---

## 4. Community algorithm (Suggested communities)

Candidates: verified, public, non-archived, not joined/followed.

| Signal | Weight |
| --- | --- |
| Same university | +20 |
| Same department | +14 (else same faculty +8) |
| Interest match (each) | +6 |
| Location match | +4 |
| Popularity | `4·log2(1 + members + followers)` |
| Activity: posts in last 30 days | `3·log2(1+posts)` |
| Activity: upcoming events | +5 each (cap 3) |

Active communities outrank large-but-dead ones — a smaller community that
runs events is worth more to a student than a big silent group.

---

## Rollout plan

| Phase | Trigger | What happens |
| --- | --- | --- |
| **0 — now** | default | Flag off. Chronological feed, heuristic suggestions. Structure ships dark. |
| **1 — enable** | ~500+ WAU or feeds feel stale | Set `RANKING_ENABLED=true`. Heuristic ranking live on all four surfaces. |
| **2 — engagement signals** | Enough interaction data | Track impressions/seen posts; add per-user author affinity from like/comment history; true ranked pagination. |
| **3 — learned ranking** | Clear metric baseline | Replace hand weights with a trained model (logistic regression first). Same feature names — the config schema is the feature contract. |

### Env flags

```env
RANKING_ENABLED=false        # master switch, all four surfaces
RANKING_FEED_POOL=150        # feed candidate pool size
```

### Metrics to watch after enabling (Phase 1 exit criteria)

- Feed: like/comment rate per session vs. chronological baseline
- Peers: connection-request accept rate from suggestions
- Events: registrations originating from "recommended"
- Communities: join rate from suggestions
- Guardrail: %of feed impressions that are milestone posts (should rise)

### Tuning

All weights are in `ranking.config.ts` (`RANKING_WEIGHTS`). Change → restart →
observe. Keep changes small (±20%) and change one surface at a time.
