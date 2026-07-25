# GuildOS Feature PRD — Event Creation & Management

> Status: **Implemented** (Phases 1–3). Reconciled with the codebase
> (`backend/src/models/event*.model.ts`, `certificate.model.ts`, `backend/src/services/event.service.ts`,
> `backend/src/routes/events.routes.ts`, `certificates.routes.ts`, and the frontend `event-api.ts` + event pages).
> Adds the `EventRegistration` and `Certificate` collections the original PRD omitted.

## Goal
Enable community leaders to create, manage, publish, and monitor events while generating trusted
participation records (attendance + certificates) for students.

---

## Event Creation Abuse Controls

- Only `COORDINATOR`+ members of active, verified communities can create events.
- Each creator may create at most 10 events per UTC day and must wait 2 minutes between creations.
- Each community may create at most 20 events per UTC day across all coordinators.
- Quotas are reserved atomically in MongoDB so parallel requests cannot bypass them; cloning consumes the same quota.
- Exact same-day duplicate titles are protected by a database unique index. Confusingly similar titles within seven days in the same community are rejected.
- Titles claiming official, verified, authorized, or administrator status are rejected, as are common phishing and financial-spam patterns.
- Published events require valid dates, cannot last longer than 31 days, cannot be scheduled more than two years ahead, and cannot already be over.
- Successful and blocked creation, cloning, edits, and publication are written to the administrator audit trail.

---

## Event Lifecycle & Status
`Event.status`: `DRAFT → PUBLISHED → CHECK_IN → CHECK_OUT → COMPLETED → ARCHIVED`.

- "Registration Open" is folded into **`PUBLISHED`** (registration is governed by `registrationPolicy`
  + `registrationDeadline`, not a separate status).
- `CHECK_IN` / `CHECK_OUT` gate QR/manual attendance capture.
- `ARCHIVED` is read-only; deletes are **soft** (`deletedAt`).

## Event Types
`WORKSHOP, SEMINAR, WEBINAR, HACKATHON, BOOTCAMP, COMPETITION, CONFERENCE, MEETUP, TRAINING, VOLUNTEER, FIELD_TRIP, OTHER`.

## Visibility
`PUBLIC` (everyone), `PRIVATE` (community members only), `UNLISTED` (direct link only). Drafts are
visible only to managers.

---

## Permissions
- **Create / edit own event:** `COORDINATOR`+ community members.
- **Edit others' / archive / delete:** event owner (`createdBy`) or `VICE_PRESIDENT`+.
- **Registrations, check-in/out, analytics, issue certificates:** `COORDINATOR`+ (managers).
- Members cannot create events.

---

## Creation Wizard (8 sections)
Basic info · Schedule (start/end + timezone; end must be after start) · Location
(`PHYSICAL`/`HYBRID`/`VIRTUAL` + venue/address/meeting link) · Capacity (0 = unlimited + waitlist) ·
Media (banner upload, **required to publish**) · Registration settings (policy, deadline, walk-ins,
QR, visibility) · Certificate settings (see below) · Publish (Save Draft / Publish).

Speakers and sponsors are added after a draft exists (`POST /:id/speakers`, `/:id/sponsors`).

---

## Registration & Attendance
`EventRegistration` — status `REGISTERED / WAITLISTED / CANCELLED / CHECKED_IN / CHECKED_OUT / COMPLETED / NO_SHOW`,
per-registration `qrToken`, `checkInAt`/`checkOutAt`, `attendanceMinutes`, `certificateIssued`; unique `{eventId,userId}`.

- **Register:** only while `PUBLISHED`/`CHECK_IN`, before `registrationDeadline`. `INVITE` policy blocks
  public registration. If full and `waitlistEnabled` → `WAITLISTED`, else rejected.
- **Cancel:** frees a seat and auto-promotes the earliest waitlisted registrant.
- **Check-in:** manual (manager), by **QR token** (`POST /api/events/check-in/:token`), or via the
  organizer **Check-In Station** (attendee shows a QR pass on the event page; organizer scans with the
  camera — `BarcodeDetector` — or types the code).
- **Check-out is required to complete.** Check-out computes `attendanceMinutes` and marks the
  registration `COMPLETED` only when the attendee **stayed to the end** — i.e. checked out at/after
  the event `endDate` (when scheduled) **and** met any `minimumAttendanceDuration`; otherwise
  `CHECKED_OUT`. Only `COMPLETED` registrations are certificate-eligible. `checkOutRequired`
  defaults to **true**.
- Counters (`registrationCount`, `checkedInCount`, `completedCount`) are recomputed on every change;
  `eventCount` on the community is maintained on publish/archive/delete.

---

## Certificates (image template + name overlay)
Certificate settings store an **image template** (`certificateTemplate`) plus a **name placement**
(`certificateNamePlacement`): `{ x%, y%, fontSize% (of height), color, align }`, configured with a
live preview in the wizard.

- **Issuance** (`POST /api/events/:id/issue-certificates`, managers): requires `certificateEnabled`,
  a template image, and a **`VERIFIED` community**. Issues one `Certificate` per `COMPLETED`
  registration (idempotent), snapshots attendee name + template + placement, assigns a unique
  `serial`, increments `certificatesIssued`, and records an `EVENT`/`CERTIFICATE` portfolio activity.
- **Rendering:** the personalized certificate is drawn **client-side on a canvas** (template image +
  attendee name at the stored placement) at `/certificates/:serial`, with **PNG download**. This avoids
  native image libraries on the server.
- **Verification:** `GET /api/certificates/verify/:serial` is public (recruiters can verify).
- **My certificates:** `GET /api/certificates/mine` (auth); surfaced on the events discovery page.

---

## Analytics
`GET /api/events/:id/analytics` (managers): registration count, check-in rate, completion rate,
attendance rate, certificates issued, and **average attendance duration** (from checked-out records).

---

## Data Models (summary)
- **Event** — full config incl. `registrationPolicy`, `waitlistEnabled`, `certificateTemplate`,
  `certificateNamePlacement`, `checkOutRequired`, `timezone`, `visibility`, denormalized counters,
  `createdBy`, `deletedAt`, timestamps.
- **EventSpeaker** — `eventId, fullName, title, organization, bio, photo, linkedinUrl`.
- **EventSponsor** — `eventId, name, logo, website`.
- **EventRegistration** — see Registration & Attendance.
- **Certificate** — `serial (unique), eventId, communityId, userId, registrationId, attendeeName,
  eventTitle, communityName, templateImage, namePlacement, issuedBy, issuedAt`; unique `{eventId,userId}`.

---

## API Endpoints
**Events:** `GET /api/events` (public list, `?communityId`), `GET /api/events/manage/:communityId`
(manager list incl. drafts), `POST /api/events`, `GET /api/events/:slug`, `PATCH /api/events/:id`,
`DELETE /api/events/:id` (soft), `POST /api/events/:id/publish|archive|status`,
`GET /api/events/:id/analytics`, `POST /api/events/:id/speakers|sponsors`, `POST /api/events/upload`.
**Registration:** `POST /api/events/:id/register|cancel`, `GET /api/events/:id/my-registration`,
`GET /api/events/:id/registrations`, `POST /api/events/:id/registrations/:rid/check-in|check-out`,
`POST /api/events/check-in/:token`.
**Certificates:** `POST /api/events/:id/issue-certificates`, `GET /api/certificates/mine`,
`GET /api/certificates/verify/:serial`.

---

## Security
Only `COORDINATOR`+ can create; owners/`VICE_PRESIDENT`+ edit; archived events are immutable; deletes
are soft (audit). Certificate issuance requires a `VERIFIED` community.

---

## Success Criteria
- ✓ Leaders create/publish events. ✓ Students discover and register (with waitlist).
- ✓ QR/manual attendance (check-in/out). ✓ Manager analytics.
- ✓ Image-template certificates issued on completion, downloadable + publicly verifiable.
- ✓ Events feed verifiable participation data (portfolio activity).

---

## Open Items / Planned
- Reputation points / opportunity-matching signals — future Reputation feature.

### Recently completed
- ✓ **AI Event Assistant**: `POST /api/events/ai-draft` (OpenAI when `OPENAI_API_KEY` is set, heuristic fallback otherwise) + wizard panel to generate and apply a draft.
- ✓ **Approval-required registration**: `APPROVAL` policy queues requests as `PENDING`; leadership approves/rejects on the attendees page.
- ✓ **Mode-aware location fields**: PHYSICAL shows venue/address, VIRTUAL shows meeting link, HYBRID shows both.
- ✓ **QR attendance UI**: attendee QR pass + organizer Check-In Station (camera scan / code entry).
- ✓ **Check-out required**: certificate-eligible completion requires checking out at/after the event end.
- ✓ **Speaker/Sponsor management** with photo/logo uploads; **Add to Calendar** / **Share**; **Projector mode** wired to live data.
- ✓ Create/Edit wizard split into components (`ai-event-assistant`, `certificate-designer`, `speakers-sponsors-editor`, `event-form-ui`) with a back-to-events link.
