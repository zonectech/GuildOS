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
