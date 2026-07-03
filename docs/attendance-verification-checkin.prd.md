# GuildOS Feature PRD — Attendance Verification (Organizer Check-In)

> Status: **Implemented** (backend + frontend). Reconciled with the codebase
> (`event-registration.model.ts`, `event.service.ts`, `routes/attendance.routes.ts`,
> `routes/events.routes.ts`, `store/auth-store.ts`, and the frontend `event-api.ts`,
> attendees page, scanner page, and shared `events/qr-scanner.tsx`).

## Goal
Verify a student was physically present by requiring an **authorized organizer to scan the
student's event pass** — trust over convenience.

---

## Trust model
Attendance is **organizer-verified**, not self-service: the student presents their per-registration
QR pass and an authorized organizer scans it. Every verification is attributed and audited.

---

## Student Event Pass
Each registration has a unique `qrToken` (UUID v4). On the event page, a confirmed/checked-in
student sees a **QR pass** (name/status/code) to present for scanning.

---

## Organizer Scanner
A dedicated **Scanner page** (`/dashboard/events/scanner?eventId=`) for authorized staff:
- **Camera scan** via `BarcodeDetector`, **manual code entry** fallback.
- **Success feedback**: beep (WebAudio) + vibration (`navigator.vibrate`).
- **Live attendance** counters that refresh after each scan and every 15s.
- Also embedded in the manager **Attendees** page Check-In Station.

---

## Authorized Scanner Roles
`FOUNDER`, `PRESIDENT`, `VICE_PRESIDENT`, `COORDINATOR`, and **`VOLUNTEER`** (the PRD's
`EVENT_VOLUNTEER`) — enforced by `requireEventScanner` (`VOLUNTEER`+). `MEMBER` cannot scan.

---

## Scan Validation Rules (enforced)
- Event must be in `CHECK_IN`/`CHECK_OUT` → else **"Check-in has not started"**.
- Registration must exist (by `registrationId` or `token`) → else **"Invalid attendance pass"** / "Student is not registered".
- Not `CANCELLED`/`REJECTED` → else "not eligible for check-in".
- Not already checked in → else **"Student already checked in"** (duplicate prevention).

On success: `status = CHECKED_IN`, `checkInAt`, `attendanceVerified = true`, and audit fields set.

---

## Walk-Ins
Two supported paths:
- **Student self walk-in** — "Check in now" on the event page (`allowWalkIns` + `CHECK_IN`).
- **Organizer-registered walk-in** — on the Scanner page, search the student (name/email/username),
  select, and the system creates a `WALK_IN` registration **already `CHECKED_IN`** and verified.

---

## Attendance Metadata / Audit Trail
On the registration: `checkedInBy` (organizer), `scannerRole`, `checkInAt`, `attendanceVerified`,
plus optional `checkInIp` and `checkInUserAgent`. This gives a complete, attributable verification history.

---

## Attendance Dashboard (live)
`GET /api/events/:id/attendance/live` (scanner) returns: **registrations, checked-in,
pending arrivals, walk-ins, completed, attendance rate**. The scanner page renders these live.

---

## Data Model — `EventRegistration` (delta)
```json
{
  "qrToken": "String (unique) — the student event pass",
  "status": "... CHECKED_IN ...",
  "checkInAt": "Date | null",
  "attendanceVerified": "Boolean",
  "checkedInBy": "ObjectId<User> | null",
  "scannerRole": "String",
  "checkInIp": "String",
  "checkInUserAgent": "String"
}
```

---

## API Endpoints
- `POST /api/attendance/checkin` — `{ registrationId }` **or** `{ token }`; returns `{ success, student, event, checkedInAt }`.
- `POST /api/events/check-in/:token` — token check-in (organizer).
- `GET /api/events/:id/attendance` — check-in log (scanner).
- `GET /api/events/:id/attendance/live` — live counters (scanner).
- `GET /api/events/:id/walkins` — walk-in list (scanner).
- `GET /api/events/:id/walk-in-search?q=` — search students for walk-in (scanner).
- `POST /api/events/:id/walk-in-register` — `{ userId }` create + check-in a walk-in (scanner).

---

## Permissions
- **Students**: view their event pass, present QR.
- **Organizers** (`VOLUNTEER`+): scan passes, register walk-ins, monitor live attendance.
- **Managers** (`COORDINATOR`+): full attendee management + export.
- **Admins**: audit records.

---

## Fraud Prevention
- **Duplicate check-in**: blocked once `checkInAt` is set.
- **Organizer verification**: only `VOLUNTEER`+ staff can scan.
- **Audit trail**: `checkedInBy` + `scannerRole` + timestamp + IP/UA per scan.

---

## Success Criteria
- ✓ Students receive unique event passes (`qrToken`).
- ✓ Authorized organizers scan attendees (camera or code).
- ✓ Duplicate scans prevented.
- ✓ Walk-ins supported (student self + organizer-registered).
- ✓ Audit trail maintained.
- ✓ Verified attendance feeds certificates and future reputation scoring.

---

## Open Items / Planned
- **QR single-use rotation** (currently duplicate-guarded via `checkInAt` rather than token invalidation).
- **Richer device fingerprinting** beyond IP/UA.
- **NO_SHOW finalization** for registered students who never checked in (post-event sweep).
- **Flashlight toggle** on the camera scanner (browser support permitting).
