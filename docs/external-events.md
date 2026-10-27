# External events and attendance

Organizers can keep an event on another platform while GuildOS holds members' participation records and certificates.

## Event setup

1. In Create Event, select the community and paste a public HTTPS event page into **Already created this event elsewhere?**
2. Preview the imported details, then choose **Use these details in the form**. Check dates, timezone, venue, and registration URL before saving. Private pages and sites that block access may need manual entry. Pages without structured event data may supply only a title and description.
3. Under Registration Settings, enter the official partner registration URL and name.
4. Choose **External platform attendance report** when the other platform records attendance. GuildOS disables its QR/walk-in attendance for this mode and excludes the event from automatic no-show settlement.

A confirmed free registration saves the GuildOS registration and redirects to the partner URL. Waitlisted and approval-pending members are not redirected. Opening the link records a visit, not a completed external registration. The member's checkbox remains explicitly self-reported until a registration report matches their email.

## Report import

On the event's Attendees page, choose **Registration list** or **Attendance report** and upload a CSV or TSV. Attendance imports are available only after the configured event end time and only when external attendance is selected.

Example attendance CSV:

    email,minutes,day
    attendee@example.edu,45,2026-10-20

- Email is required. Matches use verified primary emails and verified alternate emails, never names.
- Minutes are optional when the event has no minimum duration. A blank value is not zero. Zero-minute rows do not establish attendance.
- A day column in YYYY-MM-DD format is required for multi-day events. Dates must fall within the active event schedule.
- Common Email, Duration, In-meeting duration, and Time in session (minutes) headers are recognized. Duration supports minutes, HH:MM:SS, and values such as 1h 20m 30s.
- Combine multiple sessions into one row per email/day before uploading. Duplicate email/day rows are rejected rather than added together.
- Maximum file size: 2 MB; maximum attendees per import: 5,000.

Review the match preview before applying it. A registration list never grants attendance or certificate eligibility. Attendance must satisfy the event's duration and day requirements, including ticket day coverage. Canceled, rejected, pending, and waitlisted registrations are not eligible. Existing GuildOS check-ins and issued certificates are kept unchanged.

Repeated imports keep the greatest reported duration for each member/day, instead of adding it twice. To reduce or revoke previously accepted attendance, review the record with the organizer; importing a shorter report does not revoke an already earned certificate.

Unmatched rows remain in Previous imports. Download the rows needing verification, ask members to verify their platform email, then select **Recheck matches** and apply the resolved rows. Finalizing external attendance preserves unmatched registrations as unresolved instead of incorrectly marking them absent.

## Alternate emails

Registered members can expand **Using a different email on the external platform?** on the event page. Verification sends a six-digit code to that email. Codes expire after ten minutes, allow five attempts, and cannot be requested more than once per minute. Email delivery must be configured. An address belonging to another GuildOS account cannot be linked.

## Evidence and trust

Uploaded attendance is labeled **Organizer reported** on attendee records, downloaded reports, sponsor reports, and certificate verification pages. GuildOS checks member identity matching and event requirements; it cannot authenticate a spreadsheet's origin. Original parsed rows, file name, report hash, uploader, and application time are retained for review.

Direct platform registration confirmation, webhooks, and direct attendance API connections are not part of this version. Email-code delivery and real provider access need to be checked in the deployment environment.

## Local browser fixture

The script backend/scripts/browser-external-events.ts runs a local-only sample API on 127.0.0.1:4301. It replaces model operations with in-memory sample records and does not connect to a database or send email. Start a separate frontend development process on port 4300 with NEXT_PUBLIC_API_URL=http://127.0.0.1:4301. Open http://127.0.0.1:4301/__test/session to enter the sample session. Do not deploy this fixture.

The fixture uses the real event-page extraction and report-matching services with sample source data. It tests the user interface and service behavior, but does not prove that a live provider permits fetching or that an email provider delivers codes.

## Public participation and registration confirmation

Event detail pages show confirmed registrations publicly. Attendance stays pending until the event has ended and the organizer has finalized attendance. Counts include each attendee once, including partial attendance, and exclude canceled/rejected registrations and no-shows from attendance. The evidence label distinguishes GuildOS check-in from organizer-uploaded reports. Private event access checks run before these totals are calculated.

Confirmed registrations that stay on GuildOS open a dismissible success dialog. Discover more events opens discovery with similar topics and event types ranked first and the source event excluded. Waitlisted and approval-pending registrations keep their pending messages, and external-platform registrations keep their existing handoff.

Validation: 226 automated tests passed; backend and frontend type checks passed. Browser checks with isolated sample data covered success confirmation, discovery ordering, finalized check-in/report labels, waitlisting, pending approval and external handoff. No live provider registration or production record was modified.

### Alternate email prompt

Signed-in students see an optional email verification panel before external registration and when returning to the event. They can link the email they plan to use or already used on the external platform. Only verified emails participate in organizer report matching; linking an email is not proof of registration or attendance. Reports already imported need an organizer recheck and apply. The panel shows linked addresses, verification codes, delivery errors and an explicit skip instruction for students using their verified GuildOS email.

Validation: 27 alternate email and external report service tests passed; frontend type check passed.
Browser check: the prompt appears before external registration, empty input disables sending, and delivery failures appear without claiming verification success. Sample email delivery is deliberately disabled in the isolated fixture. Screenshot: browser-external-email-prompt.jpg.

The primary recommendation now displays the signed-in student’s GuildOS email with a Copy email button. Alternate verification is collapsed under “Already registered with another email?” by default, including an explanation for school/work-only platforms. Clipboard failures provide manual copying instructions. Frontend type check passed.
Browser verified the account email display, successful Copy email feedback, and collapsed/expanded alternate email verification. Screenshot: browser-email-recommendation.jpg.

## Schedule labels and evidence clarity

Public detail pages and discovery derive Upcoming / Live / Ended from the scheduled instants; end time overrides an old check-in status. Draft, announced, canceled, postponed and finalized states retain their appropriate labels. Ended events remain attendance-pending until finalized. These display states do not open scanning, grant attendance, or change organizer registration controls; late registration remains possible when existing policy allows it. Public detail pages refresh schedules and participation in the background and on focus.

External events now explain the external registration destination, the distinction between a click/self-report and a registration report match, and that attendance matching checks verified member emails and event requirements without authenticating the external report. Certificate verification and sponsor reports carry the same boundary. External event certificate selection requires completed, eligible imported attendance records after the event end.

Validation: 246 backend tests across 34 files; frontend type check; isolated browser checks for scheduled Live, Ended with attendance pending, postponed events and external evidence disclosure.

Real-provider import check: tested the supplied Cerebral Valley Meta Global AI Developer Hackathon URL with its tracking query. The actual importer retrieved the title, description, VIRTUAL mode, and timezone-qualified dates (2026-10-26T17:00:00Z to 2026-11-05T02:00:00Z). This exposed and fixed Node all-address DNS lookup callback handling while preserving public-IP pinning and private-address rejection. Three network regression tests passed along with the 19 extraction/security tests. Application deadlines, capacity, prices and selection requirements remain manual review items; the preview now warns about them explicitly. No registration was submitted and no event was published.

Canonical directory link support: the Built with Claude Japan directory overlay is followed to its same-origin canonical event page, with a strict one-hop limit and public-address validation on every fetch. Cross-origin, credential-bearing and unsafe canonical URLs are ignored. The exact supplied link now imports 2026-11-02T03:00:00Z to 2026-11-10T05:00:00Z. A user-authorized, unlisted TEST event was created in GuildOS Help at /events/test-built-with-claude-japan-2026-external-import-6eb2bb89 (event ID 6ae0689a97c72a77d088202e). It preserves Asia/Tokyo, the published October 26 application deadline, closed registration, and disabled certificates; no attendee records or notifications were created. Remove this disposable event when the user finishes reviewing it. The event detail rail now shows exact start/end times and the stored timezone even for multi-day imports without an agenda.
