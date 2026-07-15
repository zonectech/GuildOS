# GuildOS — Backlog & Roadmap

> Consolidated list of planned / not-yet-built items pulled from the feature PRDs. Review later.

## Marketplace / Recruiters
- **Applicant messaging** — in-app recruiter ↔ candidate outreach (a review `note` exists, no messaging).
- **Team accounts** — multi-seat company accounts (currently one recruiter profile per user).
- **Billing / posting limits** — monetization, quotas, featured listings.
- **Response-time & recency metrics** — response *rate* ships; median response *time* + listing recency scoring pending.

## Sponsorship / Revenue
> Shipped 2026-07-06: sponsorship packages on events, public `/sponsors` browse page, no-account inquiry form (honeypot + per-email caps + dedupe), organizer inquiry inbox (NEW → CONTACTED → WON/CLOSED), convert-inquiry-to-sponsor with package + amount + logo upload, platform fee settings + bank remittance instructions, admin sponsorship pipeline with fee tracking, admin-editable tiered package templates (pre-fill organizer editor), system-defined perk catalog, and perk delivery automation (sponsor logos/names on standard certificates, auto thank-you community post, public verified sponsor report at `/events/[slug]/sponsor-report`).
- **Post-event sponsor report** — shareable proof-of-delivery per sponsor: registered vs. checked-in vs. completed (data already in `getEventAnalytics`), university/faculty split. Key differentiator (verified attendance) and the "deliverable" that keeps deals on-platform.
- **On-platform sponsorship payments** — Paystack/Flutterwave; escrow-style release after event completion, sponsor report as proof of delivery; platform takes commission automatically (solves deal-leakage).
- **Paid event ticketing + commission** — payment gateway on the registration flow; 5–7.5% platform fee. First revenue lever; monetizes from a single active club.
- **Pricing model decision** — commission requires deal visibility; consider pay-per-lead or a premium club tier (sponsorship listing as paid feature) which needs no deal tracking.
- **Full sponsor portal (Option B)** — sponsor accounts, cross-campus browse, in-platform offers/negotiation, deliverable tracking. Needs event volume first.

## Opportunity Matching
- **Notification engine** — alerts for new matches, approaching deadlines, and profile improvements that unlock opportunities.
- **Skill-based candidate search** — needs granular skills persisted on the reputation aggregate.
- **More ingestion providers** — Greenhouse / Lever / Workable boards, USAJOBS (provider interface makes each a drop-in).
- **Stale-listing cleanup** — auto-close ingested listings that disappear upstream.
- **Learning-to-rank** — tune match weights from action history (currently deterministic scoring).

## Reputation / Guild Score
- **Speaker & volunteer self-claim** — members self-claim credit (currently organizer-tagged).
- **Reputation-specific visibility** (`Recruiters Only` tier) — currently reuses `profileVisibility`.
- **Automated anomaly detection** — flag suspicious score growth for review.
- **Leaderboard pagination & time windows** (all-time vs. this semester).

## Public Profiles
- **Profile analytics** — profile/recruiter/certificate view counts, verification requests.
- **AI-inferred Skills** traceable to verified activities.
- **Opportunity Readiness Score.**
- **Username reservation/immutability policy.**

## Certificates
- **Signed PDF / native DOCX export** (current export is canvas PNG / browser print).
- **Template catalog** (Premium / University co-branded).
- **EXPIRED / INVALID certificate states.**

## CV Builder
- **Native DOCX / server-rendered PDF**, LinkedIn / Europass export.
- **Drag-to-reorder sections & inline summary editing.**
- **Persistent projects collection**; editable academic achievements.

## Platform / UX
- **Top-level navigation** unifying student + management + admin surfaces.
- **Notifications center** (in-app).

## Community / Feed — vs-Reddit gaps (added 2026-07-10)
> Shipped 2026-07-10: all five items below.
- [x] **Pinned posts + community rules** — leaders pin up to 3 posts to the top of the community page; community rules card on the profile tab (founder-editable).
- [x] **Feed sort tabs** — New / Top / Hot sorting on the home feed (Top = engagement over last 7 days, Hot = ranked).
- [x] **Nested comments** — one level of threaded replies (`parentId` on comments) with reply UI.
- [x] **Per-community mod queue** — leaders see reports on their community's posts/comments and can hide content or dismiss reports (delegated moderation) at `/dashboard/moderation`.
- [x] **Trending module on /home** — trending upcoming events + fast-growing communities.

## Platform audit — remaining items (added 2026-07-15)
> From the community/event/student surface audit. Shipped same day (top-5): event cloning ("Run again"),
> certificate OG meta + share buttons, community announcements, INVITE dead-end removal, post-event feedback surveys.
> Also shipped: gzip compression, public-user cache (N+1 fix), `npm run preview` prod-mode script.

### Community management
- **Leadership handover UI** — `transferCommunityOwnership` exists on the backend (`PATCH /api/communities/:id/ownership`); needs a guided handover flow in the UI (pick successor, confirm, notify).
- **Member analytics** — growth chart, active vs dormant members, join/leave trends (data already in memberships + attendance).
- **Community setup checklist** — completeness meter (logo ✓ rules ✓ first event ✗ knowledge hub ✗) to fight empty-community cold start.
- **Move "Delete community" out of the sidebar** — destructive action one click from Archive; belongs behind settings with confirmation.
- **Knowledge Hub starter templates** — pre-seeded resource packs per community category (GDSC, MLSA, engineering society…).

### Event management
- **Event invites** — build a real invite flow if the INVITE registration policy is ever wanted back (option currently hidden from the wizard).
- **Wizard step-splitting** — the create page is ~12 sections on one scroll; collapse into steps or an accordion.
- **Paid ticketing + commission** — see Sponsorship / Revenue section above (first revenue lever).

### Multi-day events — deferred follow-ups (added 2026-07-15)
> Shipped same day: day agenda (theme/venue/times/facilitators/day-speakers), per-day QR attendance,
> day-quota certificates ("Attended 2 of 3 days"), timezone-aware day buckets, forgot-scan-out minutes crediting,
> scanner "Day X of Y" pulse, per-day RSVP, day-2+ reminders.
- **Per-day capacity** — RSVP data shows expected headcount per day, but capacity is still one number for the whole event (venues often differ per day).
- **ICS export as per-day VEVENTs** — the calendar file is currently one block spanning the whole event; export one entry per agenda day with its own time/venue.
- **Stable day IDs** — speaker `day` assignments and RSVP day numbers are positional; reordering/removing agenda days mid-event can drift them. Fine for now, fix with day IDs if it bites.
- **Attendance report UI** — the enriched report (daysAttended, plannedDays) is API-only (`GET /api/events/:id/attendance-report`); no dashboard table/CSV consumes it yet.
- **Event page decomposition** — `events/[slug]/page.tsx` is ~1000 lines; extract agenda card, feedback widgets, and registration block into `components/guildos/events/`.

### Student pages
- **Calendar view + iCal subscribe** — "my events" as a calendar; per-event .ics already exists, add a subscribe-all feed.
- **Saved / bookmarks** — for events and knowledge resources.
- **Weekly digest email** — Guild Score delta, upcoming events, new knowledge in joined communities (branded email system ready).
- **Identity page consolidation** — `/cv`, `/resume`, `/portfolio`, `/u/username` are four takes on one identity; make the public profile the hub, others become exports.
- **Profile view analytics** — see Public Profiles section above.
- **Dead code cleanup** — `frontend/app/guildos-page.tsx` is a 0-byte file.
