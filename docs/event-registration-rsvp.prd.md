# GuildOS Feature PRD — Event Registration & RSVP Management

> Status: **Implemented** (backend + frontend). Reconciled with the codebase
> (`backend/src/models/event-registration.model.ts`, `backend/src/services/event.service.ts`,
> `event-notification.service.ts`, `backend/src/routes/events.routes.ts`, `users.routes.ts`,
> and the frontend `event-api.ts`, event pages, attendees page, and `my-events` page).
> This extends the Events feature's registration system to the RSVP spec.

## Goal
Let students express intent to attend, reserve slots when needed, and create the participation
record that becomes verified attendance → certificate eligibility → portfolio → Guild Score.

---

## Registration Types → Status
Driven by the event's `registrationPolicy` (and walk-ins at check-in time):

- **OPEN** — instant `CONFIRMED` (or `WAITLISTED` when full + waitlist).
- **APPROVAL** — `PENDING_APPROVAL` → organizer approve → `CONFIRMED`/`WAITLISTED`, or reject → `REJECTED`.
- **INVITE** — registration via the public endpoint is blocked (invite-link flow is **Planned**).
- **WALK_IN** — created at the venue on check-in (`CHECKED_IN`) when `allowWalkIns` and the event is in `CHECK_IN`/`CHECK_OUT`.

`registrationType` is stamped on every registration (`OPEN | APPROVAL | INVITE | WALK_IN`).

---

## Registration Statuses
`PENDING_APPROVAL`, `CONFIRMED`, `WAITLISTED`, `CHECKED_IN`, `CHECKED_OUT`, `COMPLETED`,
`CANCELLED`, `REJECTED`, `NO_SHOW`.

- Active statuses (count toward attendance/upcoming): `CONFIRMED`, `CHECKED_IN`, `CHECKED_OUT`, `COMPLETED` (plus `PENDING_APPROVAL`/`WAITLISTED` for the student's own view).
- `COMPLETED` requires checking out **at/after the event end** and meeting `minimumAttendanceDuration`; it sets `certificateEligible = true`.

---

## Capacity & Waitlist
- `capacity = 0` → unlimited.
- When full: `waitlistEnabled` → new registration becomes `WAITLISTED`; otherwise the request is rejected ("This event is full").
- On cancel, the **earliest `WAITLISTED`** registrant is auto-promoted to `CONFIRMED`.

---

## Walk-In Registration
`POST /api/events/:id/walk-in` (student, auth): if `allowWalkIns` and the event is in `CHECK_IN`/`CHECK_OUT`,
creates (or reactivates a cancelled/rejected) registration as `WALK_IN` / `CHECKED_IN`.
UX: the projector QR opens the event page, where a **"Check in now (walk-in)"** button appears.

---

## Validation Rules (enforced)
- A user cannot register twice for the same event (unique `{eventId, userId}` index).
- A `CANCELLED`/`REJECTED` registration **cannot check in**.
- Check-out requires a prior check-in.
- `CANCELLED`/`REJECTED` cannot be cancelled again.

---

## Data Model — `EventRegistration`
```json
{
  "eventId": "ObjectId<Event>",
  "communityId": "ObjectId<Community> | null",
  "userId": "ObjectId<User>",
  "registrationType": "OPEN | APPROVAL | INVITE | WALK_IN",
  "status": "PENDING_APPROVAL | CONFIRMED | WAITLISTED | CHECKED_IN | CHECKED_OUT | COMPLETED | CANCELLED | REJECTED | NO_SHOW",
  "qrToken": "String (unique)",
  "registeredAt": "Date",
  "approvedAt": "Date | null",
  "approvedBy": "ObjectId<User> | null",
  "checkInAt": "Date | null",
  "checkOutAt": "Date | null",
  "attendanceMinutes": "Number",
  "certificateEligible": "Boolean",
  "certificateIssued": "Boolean",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```
Unique compound index: `{ eventId, userId }`.

---

## API Endpoints

### Student
- `POST /api/events/:id/register` — register (open → confirmed, approval → pending).
- `POST /api/events/:id/cancel` and `DELETE /api/events/:id/register` — cancel.
- `POST /api/events/:id/walk-in` — walk-in check-in.
- `GET /api/events/:id/my-registration` — the viewer's registration on an event.
- `GET /api/users/me/registrations` — all of the user's registrations (with event info).
- `GET /api/users/me/upcoming-events` — upcoming registered events.

### Organizer (manager, `COORDINATOR`+)
- `GET /api/events/:id/registrations` — attendee list (enriched with email/department/faculty/university).
- `POST /api/events/:id/registrations/:rid/approve` — approve (records `approvedAt`/`approvedBy`).
- `POST /api/events/:id/registrations/:rid/reject` — reject (`REJECTED`).
- `POST /api/events/:id/registrations/:rid/check-in` and `.../check-out`.
- `POST /api/events/check-in/:token` — QR/token check-in at the Check-In Station.
- `GET /api/events/:id/analytics` — organizer metrics.

---

## Permissions
- **Students**: register, cancel, view their own registrations/upcoming.
- **Community leaders** (`COORDINATOR`+): approve/reject, check-in/out, list attendees, export CSV.
- **Certificate issuance**: `VERIFIED` community + `PRESIDENT`+ (Certificates flow).

---

## Organizer Dashboard & Tools
Metrics (from `/analytics`): **Total Registrations, Confirmed, Pending approvals, Waitlist, Walk-ins,
Checked-in, Completed, Certificates, Attendance/Completion rates, Avg. duration**.

- **Filters**: status, registration type, and search (name/email/department/faculty/university).
- **Export**: **CSV** of the currently filtered attendees (Name, Email, Department, Faculty, University,
  Status, Type, Check-In, Check-Out). Opens in Excel.
- **Check-In Station**: camera QR scan (`BarcodeDetector`) or manual code entry.

---

## Student Experience
- **Public event page**: Register / Cancel, **QR check-in pass** (for `CONFIRMED`/`CHECKED_IN`),
  **Walk-in check-in**, Add to Calendar (Google + `.ics`), Share.
- **My Events** (`/my-events`): upcoming events + full registration history with status, certificate-eligibility, and cancel.

---

## Notifications (SMTP-gated)
`event-notification.service.ts` (no-op without SMTP; failures never block requests):
- **Registration confirmed** — on open-registration confirm (with the check-in/check-out reminder).
- **Registration approved** / **rejected** — on organizer action.
- **Venue changed** — when venue/meeting link changes on a published event, active registrants are emailed.
- **Event reminder** — a boot-started scheduler sweeps every `EVENT_REMINDER_INTERVAL_MS` (default 15 min) and emails active registrants once for events starting within `EVENT_REMINDER_WINDOW_MS` (default 24 h), tracked via the event's `reminderSentAt` (reset when an event is rescheduled).

---

## Success Criteria
- ✓ Students can register; duplicates prevented.
- ✓ Capacity limits + automatic waitlist promotion.
- ✓ Walk-ins supported.
- ✓ Approval flow with recorded approver.
- ✓ Records feed QR attendance → certificate eligibility.
- ✓ Organizers monitor prep in real time (metrics, filters, export).

---

## Open Items / Planned
- **INVITE-only link flow** (registration via invitation link) — endpoint currently blocks INVITE registration.
- **Excel (native .xlsx)** — currently CSV (opens in Excel).
- **Status migration** for any pre-existing registrations created before the status rename
  (`REGISTERED→CONFIRMED`, `PENDING→PENDING_APPROVAL`).
- **NO_SHOW** finalization (mark non-attended confirmed registrants after an event ends).
