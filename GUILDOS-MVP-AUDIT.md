# GuildOS MVP Product Audit

**Date:** 2026-08-20
**Method:** Full codebase trace — every feature verified end-to-end (frontend page → API endpoint → service → model). Statuses reflect what the *code* actually does, not what the docs claim.

## Status Legend

| Status | Meaning |
| --- | --- |
| ✅ Complete | Works end-to-end (UI → API → service → DB) |
| 🟡 Partial | UI exists but backend/edge cases remain (or vice versa) |
| 🔴 Broken | Doesn't work correctly / security defect |
| 🟣 Needs validation | Technically works but needs real-user testing |
| ⚪ Future | Don't touch now |

**Infrastructure baseline:** Real MongoDB via Mongoose (`backend/src/db.ts`), JWT auth in httpOnly cookies, Google OAuth, email verification, password reset, Paystack/Flutterwave payment gateways, Web Push (VAPID). No in-memory store, no feature-flag gates disabling core features.

---

## 1. Student Side

| # | Feature | Status | Evidence / Gaps |
| --- | --- | --- | --- |
| 1 | Home / feed | ✅ Complete | Posts, likes, comments, polls, milestone auto-posts, trending. `feed.routes.ts`, `post.model.ts` + like/comment/poll-vote models. |
| 2 | Events discovery + detail | ✅ Complete | List with filters (status/mode), slug detail page, LIVE/UPCOMING/ENDED buckets, view tracking. `events.routes.ts`, `event.model.ts`. |
| 3 | Event registration | ✅ Complete | OPEN/APPROVAL/INVITE/WALK_IN types, approve/reject flow, capacity + waitlist promotion, sections, multi-day planned days. `event-registration.model.ts`. |
| 4 | Ticket / pass | 🟣 Needs validation | Paid tiers, group-buy, guest claim links (transfers), commission split, refund status all modeled and wired (`ticket-payment`, `ticket-claim` models). Payment gateways are real integrations but need live-transaction testing (webhooks, failed payments, refunds). |
| 5 | QR attendance (check-in/out) | 🟣 Needs validation | Fully wired: QR token or registrationId, `checkInAt`/`checkOutAt`/`attendanceMinutes`, per-day attendance for multi-day events, device-bound scanner passes. Needs real-venue testing (offline behavior, double scans, camera quality). `attendance.routes.ts`, `scanner-pass.model.ts`. |
| 6 | Certificates | ✅ Complete | Generation, PDF render, download, revoke/expiry, public verify, secured single + bulk issuance (PRESIDENT permission, verified community). **Fixed 2026-08-20:** dead `GET /api/certificates` stub (hardcoded `[]`) removed. |
| 7 | Profile + public profile | ✅ Complete | Edit (bio, skills, socials, avatar/cover), visibility PUBLIC/PRIVATE/UNLISTED, field-level privacy flags respected on `/u/[username]`. |
| 8 | Guild Score / reputation | ✅ Complete | Every point traceable: `reputation-activity.model.ts` stores type, category, `scoreAwarded`, `referenceId` back to the source event/role. Leaderboards scoped GLOBAL/COMMUNITY/UNIVERSITY/FACULTY/DEPARTMENT. Timeline UI groups by month. |
| 9 | Leadership on profile | � Partial | Profile display works via community-leader queries. **Fixed 2026-08-20:** `POST /api/leadership` previously had **no auth middleware** and accepted an arbitrary `userId` (anyone could mint leadership records for any user) — now `requireAuth` + `requireRole('ADMIN')`; the dead `GET /` stub was removed. Remaining: no frontend consumes this router; decide whether to build it out or delete it. |
| 10 | Communities (browse/join/membership) | ✅ Complete | 80+ endpoints: join, leave, request-join, approve, roles. Membership statuses ACTIVE/PENDING/SUSPENDED/REMOVED/LEFT. |
| 11 | Knowledge Hub (consume) | ✅ Complete | ARTICLE/LINK/FILE types; categories incl. TUTORIAL, DOCUMENTATION, PAST_QUESTIONS; file upload/download (PDF/images, 10MB); search; bookmarks; view/download counts. |
| 12 | Opportunities (browse/apply) | ✅ Complete | Categories, eligibility rules (minGuildScore, universities, levels…), recommended + matches, save/apply tracking, external apply URL. |
| 13 | Search | 🟡 Partial | No unified search endpoint. Frontend fans out to 5 APIs; communities/events are filtered **client-side** after full fetch — won't scale and misses results beyond first page. Knowledge/opportunities have real backend search. |
| 14 | Notifications | ✅ Complete | In-app (cursor-paginated, unread count, typed) + Web Push subscribe/unsubscribe. Push requires VAPID keys configured in prod. |
| 15 | Messages / connections | ✅ Complete | Conversations, rate-limited send, unread counts; students limited to connections, recruiters can message candidates. Connection request/accept/reject wired. |
| 16 | CV / resume / portfolio | 🟣 Needs validation | AI CV generation (`POST /cv/generate` behind `aiLimiter`), PDF export, public resume/portfolio pages respecting visibility. Works if AI provider configured; needs output-quality validation and testing of the unconfigured-AI path. |

---

## 2. Community Side

| # | Feature | Status | Evidence / Gaps |
| --- | --- | --- | --- |
| 1 | Community creation | ✅ Complete | Create form → `POST /communities`, per-user creation guard, slug/founder tracking. |
| 2 | Community verification | 🟣 Needs validation | Three paths implemented: university-email auto-verify, endorsement-threshold chain, manual admin review. Logic is real but the endorsement chain and email-domain matching need real-world testing. |
| 3 | Community dashboard | ✅ Complete | `/dashboard/communities` lists managed communities (actual leader roles, not just founder); edit, members, moderation, wallet, premium, events, certificates subpages. |
| 4 | Member management | ✅ Complete | Join request → approve/reject → role assignment → suspend/remove. COORDINATOR+ permission enforced in service layer. |
| 5 | Leadership management | ✅ Complete | Curated roster (`community-leader.model.ts`) with sessions, ranks, `linkedUserId`; handover service; session dissolution; leadership certificates. See identity caveat in §4. |
| 6 | Event creation + management | 🟣 Needs validation | Multi-step wizard, drafts, publish, clone, multi-day `days[]` with per-day sessions/venues, sections/tracks, tiers/pricing, deadlines, capacity, AI draft generator, creation guard. Very large surface — the reason this is "needs validation" rather than "complete" is combinatorial complexity (multi-day × sections × tiers × approval), not missing code. |
| 7 | Event scanner | 🟣 Needs validation | Volunteer scanner passes (create/list/revoke), device binding on first use, account-free scanner page `/scan/[token]`, door-scan endpoint. Needs live-event testing. |
| 8 | Projector / live display | ✅ Complete | `/dashboard/events/projector` — live registration/check-in/completion/cert counts, 10s polling, event QR for walk-ins. |
| 9 | Certificate issuance | ✅ Complete | Auto-issue on completion + manual bulk issue; STANDARD canvas + CUSTOM (premium) templates; signatories/logo/theming; signed PDF with verify URL; dedup by attendance. |
| 10 | Announcements / community posts | ✅ Complete | Post-as-community (authorType USER\|COMMUNITY), COORDINATOR+ enforced, pinning (max 3), edit/delete/report, auto-cleanup on archive. |
| 11 | Knowledge Hub management | ✅ Complete | Create/update/delete resources, file uploads, member-only gating for private communities, starter-pack seeding. **Note:** files stored on local disk at `/uploads/<key>` — fine for MVP, breaks on multi-instance/ephemeral hosting; plan object storage later. |
| 12 | Community analytics | ✅ Complete | `GET /:id/member-analytics` (growth, role mix, engagement) + per-event analytics (registration/attendance/completion/feedback). |
| 13 | Community public profile | ✅ Complete | Name, logo, cover, description, rules, verified badge, counts, **WhatsApp + channel link buttons**, leaders page, people page, endorsement badges. |
| 14 | Follows / endorsements | ✅ Complete | Follow toggle with unique index; endorsement create/list/can-endorse; feeds verification pathway. |
| 15 | Partnerships / sponsors / speakers / volunteers | ✅ Complete | All four modeled + managed in the event wizard. Partnerships have invite/respond flow with partner-community leadership approval; sponsors have certificate placement flag; volunteers link to scanner passes and reputation. |
| 16 | Payments / wallet | 🟣 Needs validation | Real Paystack/Flutterwave (`initializeCharge`/`verifyCharge` + webhooks), commission split, fee pass-through, wallet balance, payout requests (admin-processed), premium subscriptions. **Money movement must be validated with live transactions before launch** — webhooks, failed/duplicate payments, refunds, payout reconciliation. |

---

## 3. Recruiter Side

| # | Feature | Status | Evidence / Gaps |
| --- | --- | --- | --- |
| 1 | Recruiter signup | ✅ Complete | `POST /auth/recruiter-signup` → user with `role='RECRUITER'` + `RecruiterProfile` (company, position, website), email verification. |
| 2 | Recruiter verification | ✅ Complete | Admin workflow: UNVERIFIED → PENDING → VERIFIED/REJECTED via `admin.recruiters.routes.ts`, with audit logging. Unverified recruiters' opportunities go to PENDING_REVIEW moderation. |
| 3 | Recruiter profile | ✅ Complete | `PATCH /recruiter/me`; dashboard with stats. |
| 4 | Opportunity creation | ✅ Complete | Full CRUD with moderation gate, eligibility rules, ownership via `postedBy`. |
| 5 | Candidate discovery | ✅ Complete | Works via `GET /recruiter/candidates` (filters: university, faculty, department, minGuildScore, leadership, openToWork). **Fixed 2026-08-20:** duplicate route `GET /opportunities/candidates` standardized to `requireRole(['RECRUITER', 'ADMIN'])`. |
| 6 | Applicant pipeline | ✅ Complete | NEW → SHORTLISTED → CONTACTED → REJECTED → HIRED with match scores; review UI on recruiter dashboard. |
| 7 | Guild Score visibility | ✅ Complete | Score, level, leadership score visible per applicant; analytics bucketed by score band. Candidate availability (`openToWork`) respected in search. |
| 8 | Credential verification | ✅ Complete | `GET /certificates/verify/:serial` is public (optionalAuth) — anyone can verify serial, status, revocation, with view tracking. This is the core differentiator and it works. |
| 9 | Ownership / security | ✅ Complete | All opportunity/applicant endpoints check `postedBy === actorId || isAdmin`; `requireRole` middleware consistent. |

---

## 4. Identity + Role Architecture (Foundational)

**Verdict: fundamentally sound — one user, contextual roles — with one significant fragmentation risk.**

What the code does today:

- **One account per human.** Global `user.role` enum: `STUDENT | COMMUNITY_LEADER | ADMIN | RECRUITER`.
- **Community-scoped roles** live on `Membership` (`MEMBER | VOLUNTEER | COORDINATOR | SECRETARY | TREASURER | VICE_PRESIDENT | PRESIDENT | FOUNDER`), unique per `(userId, communityId)`. A STUDENT can be PRESIDENT in Community A and MEMBER in Community B. ✅ This matches the intended model.

Issues found:

| # | Issue | Severity | Detail |
| --- | --- | --- | --- |
| 1 | **"Community leader" exists in 3 places** | 🟠 High | (a) global `user.role='COMMUNITY_LEADER'`, (b) `Membership.role` leadership values (the actual permission source), (c) `CommunityLeader` curated roster (display-only, optional `linkedUserId`). Risk: features checking the wrong layer. Action: document that **Membership is the single source of truth for permissions**, audit all `user.role === 'COMMUNITY_LEADER'` checks, and consider deprecating the global value entirely. |
| 2 | **Unauthenticated leadership write** | ✅ Fixed 2026-08-20 | `POST /api/leadership` had no auth and took arbitrary `userId`. Now gated by `requireAuth` + `requireRole('ADMIN')` ([leadership.routes.ts](backend/src/routes/leadership.routes.ts)). |
| 3 | Frontend middleware only checks token presence | 🟡 Medium | [frontend/middleware.ts](frontend/middleware.ts) has no role-based route protection; role gating is client-side only. Backend enforcement is the real boundary (and is consistent), but recruiter/admin/dashboard routes should also be gated in middleware for UX + defense in depth. |
| 4 | No admin-grant endpoint | 🟡 Low | `ADMIN` is set by direct DB edit/seed only. Acceptable for MVP; document the procedure. |
| 5 | Candidate-search role mismatch | ✅ Fixed 2026-08-20 | See Recruiter §5. |

---

## 5. The Core Loop — Current State

> Student joins community → registers for event → gets unique pass → organizer verifies attendance → certificate issued → Guild Score updates → milestone on profile → recruiter verifies credential.

**Every link in this chain is implemented in code.** No missing pieces were found:

| Loop stage | Code status |
| --- | --- |
| Join community | ✅ |
| Register for event | ✅ (incl. approval/capacity/waitlist) |
| Unique ticket/pass (QR token) | ✅ |
| Check-in / check-out scan | ✅ (multi-day aware) |
| Certificate generated | ✅ (auto on completion + manual) |
| Guild Score updated (traceable) | ✅ (`referenceId` links every point to its source) |
| Milestone on profile/feed | ✅ (MILESTONE post kind) |
| Recruiter verifies credential publicly | ✅ (no login required) |

**What's missing is not code — it's proof.** The entire loop is 🟣 until it has been run end-to-end with real people at a real event, with payments and push configured in production.

---

## 6. GuildBot / AI

Real, not stubbed: provider abstraction (OpenAI or Google via `AI_PROVIDER`), streaming, `optionalAuth` + rate limiting, capability manifest (`guildos-capabilities.ts`) as the system-prompt source of truth, heuristic fallback when unconfigured. AI CV generation and AI event drafting use the same layer. ⚪ **Correctly positioned as a layer on top — no further AI investment needed until the core loop is validated.**

---

## 7. Priority Actions

### ✅ Fixed in this audit pass (2026-08-20)
1. **Secured `leadership.routes.ts`** — unauthenticated `POST /` (reputation-forgery hole) now requires ADMIN; dead `GET /` stub removed.
2. **Removed the dead `GET /api/certificates` stub** (returned hardcoded `[]`; nothing consumed it — the UI uses `GET /mine`).
3. **Standardized candidate-search roles** — `GET /opportunities/candidates` now `requireRole(['RECRUITER','ADMIN'])`, matching `/recruiter/candidates`.

### 🔴 Next (foundational)
4. **Identity audit:** grep every `user.role === 'COMMUNITY_LEADER'` check and replace with Membership-scoped checks; declare Membership the single permission source; add role gating to frontend middleware.

### 🟠 Then (validation, not construction)
5. **Run the full event loop live** — one real community, one real event, real phones, real QR scans, real (test-mode then live) payment, certificate issued, score updated, credential verified by an outsider. Log every failure.
6. **Validate payments end-to-end** — webhooks, failures, refunds, payout request → admin processing.
7. **Backend-power search** — replace client-side community/event filtering with a proper search endpoint (or at minimum server-side regex/text-index queries).

### 🟡 Later
8. Knowledge Hub polish (it's already functionally complete — resist rebuilding it).
9. Move uploads from local disk to object storage before scaling/multi-instance deploy.
10. Recruiter experience refinement, then AI expansion.

### ⚪ Not now
- Mobile app (web serves both sides; the `mobile/` folder stays frozen).
- New major features of any kind.

---

## 8. Bottom Line

The audit **confirms the consolidation thesis**: GuildOS does not have a missing-features problem. Of ~40 audited features, none are unbuilt; the 3 defects found (one security-critical) were **fixed during this audit pass**, 3 features remain partial, and the highest-value work is **validating the already-built core loop with real users** — not writing new systems. The identity model matches the intended "one user, contextual roles" design and needs a cleanup pass, not a redesign.
