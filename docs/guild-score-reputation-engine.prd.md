# GuildOS Feature PRD — Guild Score & Reputation Engine

> Status: **Implemented** (backend + frontend). Reconciled with the codebase
> (`models/reputation-activity.model.ts`, `models/reputation-score.model.ts`,
> `services/reputation.service.ts`, `routes/reputation.routes.ts`, and the frontend
> `reputation-api.ts` + `app/reputation/page.tsx`). Awards are wired into `event.service.ts`
> (attendance + organizer) and `community.service.ts` (leadership + volunteer).

## Goal
A long-term, verifiable reputation system that measures a student's participation, leadership,
consistency, and contribution across their university journey: **activity → verified participation →
reputation signals → Guild Score → opportunity**.

---

## Architecture — event-sourced ledger + aggregate cache
- **Ledger (`reputation_activities`, source of truth)** — one immutable row per awarded contribution:
  `userId`, `category`, `type`, `referenceId`, `communityId`, `scoreAwarded`, `description`,
  `createdAt`. A **unique index on `{userId, type, referenceId}`** enforces duplicate-event
  protection at the database level.
- **Aggregate (`reputation_scores`, denormalized cache)** — one row per user with per-category
  scores, `consistencyBonus`, `guildScore`, `level`, `nextLevelAt`, `badges`, and denormalized
  `fullName`/`username`/`avatar`/`university`/`faculty`/`department` for leaderboard scoping and
  display. Rebuilt from the ledger on every award by `recalculateReputation`.

---

## Point system (GuildOS-controlled — `REPUTATION_POINTS`)
Communities cannot set point values (role-inflation prevention).

| Contribution | Category | Points |
|---|---|---|
| Completed event | ATTENDANCE | +10 |
| Event organizer | ORGANIZER | +50 |
| Founder | LEADERSHIP | +150 |
| President | LEADERSHIP | +120 |
| Vice President | LEADERSHIP | +100 |
| Coordinator | LEADERSHIP | +80 |
| Secretary / Treasurer | LEADERSHIP | +60 |
| Volunteer (role) | VOLUNTEER | +20 |
| Workshop speaker | SPEAKER | +40 |
| Panel speaker | SPEAKER | +30 |

---

## Score formula
```
basePoints        = attendance + leadership + volunteer + speaker + organizer
consistencyBonus  = max(monthly tier, semester tier)   // 0.0 – 0.3
guildScore        = round(basePoints × (1 + consistencyBonus))
```
Consistency tiers (from completed-event dates in the ledger):
- ≥ 3 events this calendar month → **+10%**
- ≥ 5 events this calendar month → **+20%**
- ≥ 10 events in the last ~6 months (semester) → **+30%**

Worked example (matches PRD): `120 + 300 + 80 = 500`, bonus `15%` → **575**.

**Infinite growth**: Guild Score never resets and never caps.

---

## Guild levels (`levelForScore`)
| Level | Range | `nextLevelAt` |
|---|---|---|
| Explorer Guild | 0 – 99 | 100 |
| Bronze Guild | 100 – 499 | 500 |
| Silver Guild | 500 – 1499 | 1500 |
| Gold Guild | 1500 – 4999 | 5000 |
| Platinum Guild | 5000 – 9999 | 10000 |
| Elite Guild | 10000+ | null (max) |

---

## Badges (`BADGE_CATALOG`, derived on recalc)
- 🎓 **Early Adopter** — has any reputation activity.
- 🎤 **Speaker** — `speakerScore > 0`.
- 🤝 **Volunteer** — `volunteerScore > 0`.
- 👑 **Community Leader** — `leadershipScore > 0`.
- 🔥 **Consistency Streak** — `consistencyBonus > 0`.
- 🚀 **Top Contributor** — `guildScore ≥ 1500`.
- 🌍 **Multi-Community Leader** — leadership in ≥ 2 distinct communities.

---

## Award wiring (automatic)
- **Attendance +10** — `checkOutRegistration` on `COMPLETED` (dedupe by event). Partial/no-show award
  nothing.
- **Organizer +50** — `finalizeEventAttendance` awards `event.createdBy` (dedupe by event).
- **Leadership / Volunteer** — `community.service.openLeadershipRole` awards on role appointment,
  keyed by the `LeadershipRole` document id (dedupe per appointment). VOLUNTEER → VOLUNTEER category;
  all higher roles → LEADERSHIP.
- **Speaker (Workshop +40 / Panel +30 / Guest +30)** — an `EventSpeaker` may optionally link to a
  GuildOS `userId`. Linked speakers are awarded at `finalizeEventAttendance` (dedupe by speaker id),
  and **immediately** if an organizer tags them *after* the event finished (late tagging / claim).
  Off-site speakers stay unlinked and simply earn nothing while still being listed.
- **Per-event volunteer +20** — an organizer credits GuildOS members via `EventVolunteer`
  (unique per `{event, user}`). Awarded at `finalizeEventAttendance` and **immediately** if tagged
  after the event finished (dedupe by volunteer id). This is separate from the community VOLUNTEER
  role award.

Each award writes the ledger row (idempotent) then calls `recalculateReputation`, so the aggregate,
consistency bonus, level, and badges are always current.

---

## Leaderboard (`getLeaderboard`)
Scopes: **GLOBAL**, **UNIVERSITY**, **FACULTY**, **DEPARTMENT**, **COMMUNITY**. University/faculty/
department filter the denormalized fields on `reputation_scores`; community resolves member `userId`s
via `distinct` on the ledger's `communityId`, then sorts by `guildScore`.

---

## API endpoints (`/api/reputation`)
- `GET  /me` — the signed-in student's reputation (auth).
- `GET  /leaderboard?scope=&university=&faculty=&department=&communityId=&limit=` — public.
- `GET  /activity?limit=` — the signed-in student's timeline (auth).
- `POST /recalculate` — recompute self; **ADMIN** may pass `{ userId }` to recompute anyone.
- `GET  /:userId` — public reputation profile, gated by the target's `profileVisibility`
  (PRIVATE → 403 unless owner/admin).

Example `/me` response:
```json
{
  "guildScore": 2480,
  "level": "Gold Guild",
  "nextLevelAt": 5000,
  "badges": [{ "code": "COMMUNITY_LEADER", "label": "Community Leader", "icon": "👑" }]
}
```

---

## Frontend
- `components/guildos/reputation-api.ts` — typed client (`getMyReputation`, `getReputationActivity`,
  `getLeaderboard`, `recalculateReputation`).
- `app/reputation/page.tsx` — Guild Score hero (level gradient, progress to `nextLevelAt`, consistency
  bonus), badge wall, 5-category breakdown, activity timeline, and a scoped leaderboard with tabs.
- A **Guild Score** link is surfaced on the events page.

---

## Anti-abuse
- **Duplicate event protection** — unique `{userId, type, referenceId}` index; multiple attendance
  records for the same event count once.
- **Role-inflation prevention** — point values are GuildOS constants, not community-editable.
- **Suspicious activity** — recalculation is deterministic from the ledger; admins can force
  `POST /recalculate` for any user during investigation. (Automated anomaly detection is future work.)

---

## Permissions
- **Students** — view/share their reputation; recalculate self.
- **Community leaders** — view community leaderboards.
- **Recruiters** — view public reputation profiles (`GET /:userId`, visibility-gated).
- **Platform admins** — recalculate/investigate any user.

---

## Success criteria
- ✓ Guild Score increases automatically from verified activity.
- ✓ Contributions across multiple communities and events accumulate.
- ✓ Reputation is portable and verifiable (ledger-backed, public profile + leaderboards).
- ✓ Consistency is rewarded via the monthly/semester multiplier.
- ✓ Fake activity is resisted (DB-level dedupe + GuildOS-controlled points).

---

## Open Items / Planned
- **Speaker & volunteer self-claim** — currently the organizer tags contributors; a member who joins
  later cannot self-claim their credit (an organizer re-tag awards it).
- **Reputation-specific visibility** (`Recruiters Only`) — currently reuses `profileVisibility`
  (Public/Unlisted/Private).
- **Automated anomaly detection** — flag unusually high growth / suspicious patterns for review.
- **Public-profile Guild Score badge** — surface score/level/top badges on `app/u/[username]`.
- **Leaderboard pagination & time windows** (all-time vs. this semester).
