# GuildOS Feature PRD — AI Opportunity Matching Engine

> Status: **Implemented** (backend + frontend), with a compliant ingestion layer and documented open
> items. Reconciled with the codebase (`models/opportunity.model.ts`, `opportunity-match.model.ts`,
> `opportunity-action.model.ts`; `services/opportunity.service.ts`, `opportunity-ai.service.ts`,
> `opportunity-ingest.service.ts`, `opportunity-providers/*`; `routes/opportunities.routes.ts`;
> frontend `opportunity-api.ts`, `opportunities/opportunity-card.tsx`, `app/opportunities/`).

## Goal
Match students to relevant opportunities using their **verified** activities, leadership, skills,
interests, and reputation — closing the flywheel: Community → Event → Verification → Certificate →
Guild Score → Public Profile → Verifiable CV → **Opportunities** → Career Growth.

---

## Matching inputs (verified signals)
`buildStudentSignals` gathers: course/department, university, level, graduation year, interests,
**Guild Score + level**, university **percentile** (top 10% / 25%), leadership-role count, certificate
count, and speaking/volunteering flags. Keywords are tokenized from interests + certificate titles +
department/faculty.

---

## Scoring (deterministic + explainable)
`scoreOpportunity` returns a **0–100** score with human-readable `reasons[]` from:
- tag/interest/certificate **keyword overlap** (up to +40),
- **department alignment** (+15),
- **Guild Score** vs. the opportunity threshold (+15 met / +6 approaching) and **percentile** (+10 top
  10% / +5 top 25%),
- **leadership** for fellowships/campus roles (+15),
- **certificates** for internships/open-source/competitions/scholarships (up to +12),
- **speaking** (conferences/fellowships) and **volunteering** (scholarships/fellowships/campus roles),
- **university/level/graduation-year** eligibility (with a 0.4× penalty for university-restricted
  mismatches).

Tiers: **Excellent 90–100**, **Strong 75–89**, **Moderate 50–74**, **Weak <50**.

---

## Explainable AI
`opportunity-ai.service.ts` turns the deterministic reasons into a friendly one/two-sentence
explanation (OpenAI, **evidence-locked** — never inventing qualifications; heuristic fallback when no
key). The detail page renders a **"Why am I seeing this?"** checklist of the exact verified signals.

---

## Recommendation buckets
`getRecommendedOpportunities` returns:
- **Recommended for you** — score ≥ 75.
- **Stretch** — score 50–74 (growth).
- **Near deadline** — score ≥ 50 and deadline within 14 days.
- **Trending** — most saved/applied across students.

Dismissed (`NOT_RELEVANT`) items are excluded; top matches are cached in `opportunity_matches`.

---

## Feedback loop
`user_opportunity_actions` records one current action per user/opportunity: **SAVED**, **INTERESTED**,
**APPLIED**, **NOT_RELEVANT**. Applying/saving updates the opportunity's counters (drives Trending);
`NOT_RELEVANT` removes it from recommendations.

---

## Opportunity ingestion (compliant)
GuildOS does **not** scrape LinkedIn/Indeed (ToS/legal). Instead a pluggable provider layer
(`opportunity-providers/`) pulls from allowed sources and upserts into `opportunities`:

| Provider | Source | Key |
|---|---|---|
| `remotiveProvider` | Remotive public JSON API | none |
| `arbeitnowProvider` | Arbeitnow public job board | none |
| `adzunaProvider` | Adzuna official API | `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` |
| `joobleProvider` | Jooble official API | `JOOBLE_API_KEY` |
| `rssProvider` | Generic RSS/Atom feeds | `OPPORTUNITY_RSS_FEEDS` (comma-separated) |

- Each listing is normalized (HTML stripped, tags normalized, category inferred from title/tags) and
  **upserted by `{source, externalId}`** (partial unique index) — re-syncs never duplicate. Manual
  admin entries have an empty `externalId` and are unaffected.
- `syncOpportunities()` runs all **enabled** providers (key-less ones always on; keyed/RSS auto-enable
  when configured), failing softly per provider.
- `startOpportunitySyncScheduler()` runs periodically **only when `OPPORTUNITY_SYNC_ENABLED=true`**.
- Admin trigger: `POST /api/opportunities/sync` and a **"Sync from partner sources"** button on the
  opportunities page (ADMIN only).

---

## Data model
- `opportunities`: title, description, category (INTERNSHIP/SCHOLARSHIP/FELLOWSHIP/CAMPUS_ROLE/
  COMPETITION/CONFERENCE/OPEN_SOURCE), organization, location, deadline, tags, `eligibility`
  (minGuildScore/minLeadershipRoles/minCertificates/universities/departments/levels/graduationYears),
  applicationUrl, status, **source**, **externalId**, postedBy, saveCount, applyCount.
- `opportunity_matches`: userId, opportunityId, matchScore, matchReason, reasons, generatedAt
  (unique per user/opportunity).
- `user_opportunity_actions`: userId, opportunityId, action, timestamps (unique per user/opportunity).

---

## API endpoints (`/api/opportunities`)
- `GET  /recommended` — bucketed recommendations (auth).
- `GET  /matches` — cached matches (auth).
- `GET  /` — browse (category/search), with per-user match scores (optionalAuth).
- `GET  /:id` — detail + fresh match + explanation (optionalAuth).
- `POST /:id/save` — save.
- `POST /:id/apply-status` — set action `{ SAVED | INTERESTED | APPLIED | NOT_RELEVANT }`.
- `POST /` — create an opportunity (**ADMIN**).
- `POST /sync` — ingest from providers (**ADMIN**).
- `GET  /candidates` — recruiter/admin candidate search by university/faculty/department/minGuildScore/
  leadership (**ADMIN**; recruiter role is a future layer).

---

## Frontend
- `app/opportunities/page.tsx` — recommendation buckets + browse with category filter/search, plus the
  admin sync button.
- `app/opportunities/[id]/page.tsx` — detail with match tier, AI explanation, "Why am I seeing this?"
  checklist, apply link, and feedback actions.
- Reusable `OpportunityCard` (score badge, reason, tags, deadline countdown, actions).

---

## Permissions
- **Students** — view/save/track opportunities; personalized recommendations.
- **Admins** — create opportunities, trigger sync, search candidates, moderate.
- **Recruiters** — candidate search endpoint exists (gated to ADMIN for now); a dedicated recruiter
  role/portal is the next layer.

---

## Success criteria
- ✓ Personalized recommendations from verified data.
- ✓ Transparent, explainable match reasons.
- ✓ Feedback loop improves relevance (dismiss + trending).
- ✓ Real opportunities via compliant ingestion (no ToS-violating scraping).
- ✓ Recruiter candidate discovery (foundation).

---

## Open Items / Planned
## Shipped since v1
- **Recruiter role & portal** — dedicated recruiter accounts publish opportunities and search
  candidates. See `docs/recruiter-portal.prd.md`.
- **Candidate intent & availability** — students set availability (OPEN/CASUAL/CLOSED) + job/internship/
  relocation intent + preferred industries; candidate search can filter to those open to work.
- **Opportunity verification** — `moderationStatus` gate (only VERIFIED listings reach students);
  admin moderation queue.
- **Match explanations for recruiters** — applicants show a per-candidate match % + verified reasons.
- **Recruiter reputation & analytics** — employer tiers, successful hires, response rate, and per-
  opportunity analytics.

## Open Items / Planned
- **Notification engine** — alerts for new matches, approaching deadlines, and profile improvements
  that unlock opportunities (not yet built).
- **Skill-based candidate search** — needs granular skills persisted on the reputation aggregate.
- **More providers** — Greenhouse/Lever/Workable boards, USAJOBS; the provider interface makes each a
  drop-in.
- **Stale-listing cleanup** — ingested listings are upserted but not auto-closed when they disappear
  upstream.
- **Learning-to-rank** — current scoring is deterministic; action history could tune weights over time.
