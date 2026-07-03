# GuildOS Feature PRD — Attendance Verification (Organizer Check-Out)

> Status: **Implemented** (backend + frontend). Reconciled with the codebase
> (`event-registration.model.ts`, `event.service.ts`, `routes/attendance.routes.ts`,
> `routes/events.routes.ts`, and the frontend `event-api.ts` + scanner page).
> Counterpart to the organizer Check-In feature.

## Goal
Verify a student stayed until departure and compute **participation duration** for certificate
eligibility and reputation — quality of attendance, not just its existence.

---

## Pass reuse
The **same per-registration `qrToken`** used for check-in is scanned again for check-out. The event
page pass shows the student's status and (when checked in) can display the running duration.

---

## Check-Out Validation Rules (enforced)
`checkOutRegistration` / `attendanceCheckOut`:
- Scanner authorized (`VOLUNTEER`+ via `requireEventScanner`).
- Event in `CHECK_IN`/`CHECK_OUT` → else **"Check-out has not started"**.
- Registration exists (by `registrationId` or `token`) → else **"Invalid attendance pass"**.
- **Check-in required** → else "Attendee has not checked in".
- Not already checked out → else **"Student already checked out"**.

---

## Duration & Eligibility
- `attendanceMinutes = round((checkOutAt − checkInAt) / 60000)`.
- **`COMPLETED`** when the attendee **stayed to the end** (checkout at/after event `endDate`, when
  scheduled) **and** met `minimumAttendanceDuration` → `certificateEligible = true`.
- Otherwise **`PARTIAL_ATTENDANCE`** → `certificateEligible = false` ("Participation recorded,
  certificate requirement not met"). Early leavers stay recorded and counted.

### Guild Score (feeds future Reputation)
Returned per checkout: `guildScoreAwarded` = **10** (eligible) / **3** (partial) / **0**. Computed and
returned now; persistence awaits the Reputation feature.

---

## Attendance Status Flow
`CONFIRMED → CHECKED_IN → COMPLETED` (met requirement) **or** `→ PARTIAL_ATTENDANCE` (early exit).

---

## Audit Trail
On the registration: `checkOutAt`, `checkedOutBy` (organizer), `scannerRole`, `attendanceMinutes`,
`certificateEligible` (+ the check-in audit fields).

---

## Data Model — `EventRegistration` (delta)
```json
{
  "status": "COMPLETED | PARTIAL_ATTENDANCE",
  "checkOutAt": "Date | null",
  "checkedOutBy": "ObjectId<User> | null",
  "attendanceMinutes": "Number  // attendance duration",
  "certificateEligible": "Boolean"
}
```

---

## Live Attendance Dashboard
`GET /api/events/:id/attendance/live` (scanner) now includes: registrations, checked-in,
**checked-out**, pending arrivals, pending check-outs, walk-ins, completed, **early departures**,
**certificate-eligible**, **average duration**, attendance rate. The scanner page renders these live.

---

## API Endpoints
- `POST /api/attendance/checkout` — `{ registrationId }` or `{ token }`; returns
  `{ success, student, status, attendanceDuration, certificateEligible, guildScoreAwarded, checkedOutAt }`.
- `GET /api/events/:id/completions` — `COMPLETED` registrations (scanner).
- `GET /api/events/:id/certificate-eligible` — eligible attendees (scanner).
- `GET /api/events/:id/attendance-report` — full per-attendee report (manager): name, email, type,
  status, check-in/out, duration, eligibility.

---

## Scanner
The scanner page (`/dashboard/events/scanner`) has a **Check-In / Check-Out mode toggle**; in
check-out mode a scan/entry finalizes participation and shows duration, eligibility, and Guild Score,
with success beep + vibration.

---

## Permissions
- **Students**: present the QR pass.
- **Organizers** (`VOLUNTEER`+): verify departures, monitor completion.
- **Managers** (`COORDINATOR`+): attendance report.
- **Admins**: audit.

---

## Fraud Prevention
- **Duplicate check-out** blocked once `checkOutAt` is set.
- **Check-in required** before check-out.
- **Scanner authorization** (`VOLUNTEER`+).
- **Audit**: `checkedOutBy` + `scannerRole` + duration + eligibility.

---

## Success Criteria
- ✓ Organizers finalize participation via check-out.
- ✓ Duration computed correctly.
- ✓ Duplicate check-outs prevented.
- ✓ Certificate eligibility determined automatically.
- ✓ Reputation signal (`guildScoreAwarded`) generated.
- ✓ Participation quality is measurable (`COMPLETED` vs `PARTIAL_ATTENDANCE`).

---

## Open Items / Planned
- **Per-type minimum-duration presets** (workshop 60 / bootcamp 180 / etc.) — currently a single
  `minimumAttendanceDuration` per event.

## Resolved
- ✓ **Guild Score persistence** (shipped) — completing an event now awards **+10** persisted Guild
  Score via `awardReputation` (`reputation.service.ts`); the check-out response's `guildScoreAwarded`
  reflects the persisted value. See `docs/guild-score-reputation-engine.prd.md`.
- ✓ **NO_SHOW finalization** (shipped) — registered-but-never-checked-in → `NO_SHOW`, and
  checked-in-never-out → `PARTIAL_ATTENDANCE` (certificate-ineligible). Runs manually via
  `POST /api/events/:id/finalize` (COORDINATOR+) and automatically via `startEventFinalizeScheduler`
  (`event-scheduler.ts`), which sweeps events past `endDate + eventFinalizeGraceMs`. The event is set
  to `COMPLETED` and stamped with `attendanceFinalizedAt`. A **Finalize Attendance** button on the
  attendees page surfaces the `{ noShows, partials }` result.
