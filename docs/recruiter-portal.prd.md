# GuildOS Feature PRD — Recruiter Portal

> Status: **Implemented** (backend + frontend). Reconciled with the codebase
> (`models/recruiter-profile.model.ts`, `models/applicant-review.model.ts`; `services/recruiter.service.ts`,
> `services/auth.service.ts` (`signupRecruiter`), `services/opportunity.service.ts` (owner-scoped
> functions + applicant reviews); `routes/recruiter.routes.ts`, `routes/auth.routes.ts`; frontend
> `recruiter-api.ts`, `app/recruiter/signup/`, `app/recruiter/page.tsx`, and login/verify redirects).

## Goal
Give the demand side of the ecosystem a first-class home: recruiters sign up, publish opportunities
(which flow into the student matching engine), and discover/manage candidates by **verified**
reputation — turning GuildOS into a two-sided career platform.

---

## The `RECRUITER` role
A fourth `UserRole` (`STUDENT | COMMUNITY_LEADER | ADMIN | RECRUITER`). Recruiter routes are gated with
`requireRole(['RECRUITER', 'ADMIN'])`. Admins retain full access for moderation.

---

## End-to-end flow
1. **Signup** — dedicated `POST /api/auth/recruiter-signup` creates a `RECRUITER` user **and** a
   `RecruiterProfile` (company/position/website) in one step, sets session cookies, and sends the
   verification email. Frontend: `/recruiter/signup`, linked from the login page.
2. **Email verification** — same verified-email flow; on confirm, recruiters route to `/recruiter`
   (not student profile-setup). Unverified recruiters see a **"Verify your email"** banner in the
   portal with a resend action.
3. **Login routing** — `RECRUITER` accounts are sent straight to `/recruiter`, bypassing student
   onboarding/profile-setup.
4. **Upgrade path** — existing students can also become recruiters in-portal via
   `POST /api/recruiter/register` ("Become a recruiter").
5. **Publish opportunities** — recruiters post (category, deadline, tags, application URL, eligibility
   like min Guild Score); listings enter the same `opportunities` collection the matching engine scores
   for students.
6. **Manage opportunities** — owner-scoped edit + open/close (`PATCH /api/recruiter/opportunities/:id`).
7. **Review applicants** — students who Save/Interested/Apply appear per opportunity with their Guild
   Score and level.
8. **Applicant pipeline** — recruiters move each applicant through **NEW → SHORTLISTED → CONTACTED →
   REJECTED → HIRED** (persisted via `ApplicantReview`).
9. **Source candidates** — search students by university/faculty/department/min Guild Score/leaders-only,
   ranked by reputation, linking to public profiles.

---

## Data model
- `recruiter_profiles`: userId (unique), company, position, website, about, `verified`.
- `applicant_reviews`: opportunityId, candidateId, reviewerId, `status`
  (NEW/SHORTLISTED/CONTACTED/REJECTED/HIRED), note (unique per opportunity+candidate).
- Opportunities gained `postedBy` (the recruiter) — used for ownership checks — alongside the earlier
  `source`/`externalId` provenance.

---

## API endpoints
Auth:
- `POST /api/auth/recruiter-signup` — create a recruiter account (public).

Recruiter (`/api/recruiter`, RECRUITER/ADMIN):
- `POST /register` — upgrade the signed-in user to recruiter.
- `GET  /me` — recruiter profile + stats (opportunities / open / total applicants).
- `PATCH /me` — update company/position/website/about.
- `GET  /opportunities` — the recruiter's posted opportunities.
- `POST /opportunities` — publish an opportunity.
- `PATCH /opportunities/:id` — edit / open / close (owner-or-admin).
- `GET  /opportunities/:id/applicants` — applicants + Guild Score + review status.
- `POST /opportunities/:id/applicants/:candidateId/status` — set pipeline status.
- `GET  /candidates` — candidate search by university/faculty/department/minGuildScore/leadership.

---

## Frontend
- `/recruiter/signup` — recruiter registration.
- `/recruiter` — the portal: verification banner (if unverified), stats, post-opportunity form,
  "My opportunities" (apply/save counts, open/close, inline applicant lists with a **pipeline status
  dropdown**), and candidate search. Non-recruiters see the "Become a recruiter" upgrade form.
- Role-based redirects in `login-page` and `verify-email-page`; a recruiter signup link on login.

---

## Permissions
- **Recruiters** — manage their own opportunities and applicants; search candidates.
- **Admins** — all of the above for any opportunity (moderation); also `POST /api/opportunities` and
  provider sync.
- **Students** — unaffected; their save/interested/applied actions surface to the posting recruiter.

---

## Success criteria
- ✓ Recruiters onboard from a dedicated signup through to hiring.
- ✓ Recruiter opportunities feed the student matching engine.
- ✓ Recruiters review and progress applicants through a pipeline.
- ✓ Recruiters discover candidates by verified reputation.
- ✓ Ownership is enforced (recruiters only touch their own listings/applicants).

---

## Verification, trust & analytics (shipped)
- **Recruiter verification workflow** — recruiters request verification (`POST /api/recruiter/verify/request`);
  admins review a queue (`GET /api/admin/recruiters/pending`, `PATCH /:userId/verify|reject`) at
  `/dashboard/recruiters`. Approval sets the profile `verified` badge **and** flips `recruiterVerified`
  on all the recruiter's listings (a "✓ Verified recruiter" badge students see).
- **Recruiter reputation** — `computeRecruiterReputation` derives `successfulHires` (HIRED pipeline),
  `responseRate` (% of applicants given a non-`NEW` decision), `activeSince`, and an **employer tier**
  (`Verified Recruiter` → `Trusted Employer` ≥5 hires → `Top Campus Employer` ≥20 hires). Shown in the
  portal and publicly on the opportunity detail page via `GET /api/recruiter/public/:userId`.
- **Opportunity verification (anti-scam)** — opportunities carry `moderationStatus`
  (`PENDING_REVIEW | VERIFIED | FLAGGED | ARCHIVED`). Recruiter posts start `PENDING_REVIEW` unless the
  recruiter is verified; admin/ingested/seed default `VERIFIED`. **Only VERIFIED listings reach
  students.** Admin queue at `/dashboard/moderation` (`GET /api/opportunities/moderation/pending`,
  `PATCH /:id/moderation`).
- **Candidate intent & availability** — student profiles carry `availability` (OPEN/CASUAL/CLOSED),
  `jobSeeking`, `internshipSeeking`, `openToRelocation`, `preferredIndustries` (managed in Settings →
  Career & Availability, shown on the public profile). `availability` is denormalized onto the
  reputation aggregate so candidate search offers an **"open to opportunities only"** filter.
- **Match explanations for recruiters** — applicant lists show a per-candidate match % + verified
  reasons against that specific opportunity.
- **Recruiter analytics** — `GET /api/recruiter/analytics`: views (tracked on detail opens), applied/
  interested/saved/hires, applicants by university, by Guild Score band, top communities, and
  per-opportunity view/apply/save counts. Rendered as an Analytics section in the portal.

## Open Items / Planned
- **Applicant messaging** — a `note` field exists on reviews but there is no in-app candidate outreach/
  messaging.
- **Team accounts** — one recruiter profile per user; multi-seat company accounts are future work.
- **Skill-based candidate search** — filters by university/department/Guild Score/leadership/availability;
  granular skills filtering needs skills persisted on the reputation aggregate.
- **Billing / posting limits** — no monetization or quota controls.
- **Response-time & recency metrics** — response *rate* ships; median response *time* and listing
  recency scoring are future work.
