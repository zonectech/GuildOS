# GuildOS — Backlog & Roadmap

> Consolidated list of planned / not-yet-built items pulled from the feature PRDs. Review later.

## Marketplace / Recruiters
- **Applicant messaging** — in-app recruiter ↔ candidate outreach (a review `note` exists, no messaging).
- **Team accounts** — multi-seat company accounts (currently one recruiter profile per user).
- **Billing / posting limits** — monetization, quotas, featured listings.
- **Response-time & recency metrics** — response *rate* ships; median response *time* + listing recency scoring pending.

## Sponsorship / Revenue
> Shipped 2026-07-06: sponsorship packages on events, public `/sponsors` browse page, no-account inquiry form (honeypot + per-email caps + dedupe), organizer inquiry inbox (NEW → CONTACTED → WON/CLOSED), convert-inquiry-to-sponsor with package + amount + logo upload, platform fee settings + bank remittance instructions, admin sponsorship pipeline with fee tracking, admin-editable tiered package templates (pre-fill organizer editor), system-defined perk catalog, and perk delivery automation (sponsor logos/names on standard certificates, auto thank-you community post, public verified sponsor report at `/events/[slug]/sponsor-report`).
- **Post-event sponsor report (SHIPPED)** — public verified attendance report per event at `/events/[slug]/sponsor-report` (no PII; registered vs checked-in vs completed). University/faculty split still possible later.
- **Sponsor cancellation notices (SHIPPED 2026-08-04)** — event cancelled → WON sponsors get a "settle payments with the organizers directly" email with organizer contacts; open inquiries get a "not proceeding" note. (Sponsorship money is off-platform by design — nothing for GuildOS to refund.)
- **On-platform sponsorship payments** — Paystack/Flutterwave; escrow-style release after event completion, sponsor report as proof of delivery; platform takes commission automatically (solves deal-leakage).
- **Paid event ticketing + commission (SHIPPED 2026-08-02)** — `ticketPrice` (NGN) on events; paid checkout via existing Paystack/Flutterwave gateway abstraction with `TKT-` references (webhooks route by prefix, reconcile job covers missed callbacks). `TicketPayment` model stores kobo amounts with commission split (`ticketCommissionPercent` on PlatformSettings, default 10%, backend setter clamps 0–50); gateway fee grossed up onto the buyer so the organizer nets the ticket price minus commission. Paid events: free registration blocked ("get a ticket"), no waitlist (hard sold-out), instant CONFIRMED on payment (one paid ticket per user, idempotent verify), walk-ins still allowed (cash at door). UI: price field in the event wizard, "Get ticket — ₦total" buyer flow with verify-on-return, organizer sales card (sold/gross/commission/net). Follow-ups: refunds on event cancellation, automated transfers via gateway payout APIs (payouts are manual bank transfers marked by admin for now).
- **Wallet + payouts + admin ticket oversight (SHIPPED 2026-08-02)** — community ticket wallet at /dashboard/wallet (Treasurer+): available/earned/paid-out/pending cards, per-sale ledger, payout request to bank (min ₦1,000, one pending at a time, amount ≤ available, bank details prefilled from last payout). Admin console /dashboard/admin/tickets: platform totals (sold, gross incl. gateway fees, commission = platform revenue, owed to organizers), commission % editor, payout request approval (Mark paid / Reject, audit-logged), sales-by-event table. Buyers get a payment receipt (bell + branded email with amount/reference/QR-pass pointer); organizers get a "Ticket sold" bell linking to the Wallet. Wizard shows the live commission % + worked example (public GET /api/events/ticket-settings).
- **Ticketing follow-ups (captured 2026-08-02)**:
  - *Ticket tiers (SHIPPED 2026-08-02)* — up to 5 named price levels per event (`ticketTiers[{name,price,capacity}]`, capacity 0 = unlimited, ₦0 tier = free ticket); tier picker with live per-tier availability on the event page; per-tier sold counts on the organizer sales card; `ticketPrice` auto-syncs to the cheapest paid tier so all "is paid?" checks work unchanged.
  - *Promo codes (SHIPPED 2026-08-02)* — up to 10 codes per event (`ticketPromoCodes[{code,percentOff,maxUses,usedCount}]`); buyer applies at checkout with live re-quote; redemption counted once on payment success; a 100% code (or free tier) skips the gateway entirely and confirms instantly.
  - *Group buy (SHIPPED 2026-08-02)* — buy up to 10 tickets in one checkout; extras become shareable claim links (`TicketClaim` model, `?ticket_claim=` on the event page); each guest gets their own registration + personal check-in QR; claimed links are locked to the claimer.
  - *Group-buy discount (SHIPPED 2026-08-02, Selar-style)* — `ticketGroupDiscount {minQuantity, percentOff}` per event ("buy 3+, save 15% each"); upsell hint below the qty picker, green applied-chip with the ₦before → ₦after math; promo codes and the group rule never stack — the buyer gets whichever is bigger, and a promo only burns a use when it actually priced the order.
  - *Auto disbursement (SHIPPED 2026-08-02, admin-toggleable — E2E-verified on Flutterwave v4 sandbox, transfer ref trf_fDsli1F9NZ3kY4)* — `payoutMode MANUAL|AUTO` on PlatformSettings with a Manual/Auto toggle on the admin Tickets page. AUTO fires the gateway Transfers API (Paystack transferrecipient+transfer / Flutterwave v3 or v4, bank code resolved from the typed bank name with ambiguity failing loudly) the moment an organizer requests a payout; success = payout PAID instantly with the transfer ref in the note; ANY failure (no key, OTP-locked Paystack account, unmatched bank, low balance) falls back to a PENDING request for manual settlement — organizers never dead-end.
  - *Flutterwave v4 (SHIPPED 2026-08-02, sandbox)* — OAuth adapter (`flutterwave-v4.service.ts`) behind the gateway abstraction; real E2E sandbox payment verified (hosted OTP page → verify → wallet) plus instant auto-payout transfer. **Go-live TODO**: v4 has NO hosted checkout — real card collection needs Flutterwave's client-side inline SDK (PCI scope). The sandbox mocked-card path is now hard-blocked in production (throws, telling ops to set FLUTTERWAVE_SECRET_KEY for the v3 hosted checkout — the supported production path today). v4 webhook signatures SHIPPED 2026-08-03 (HMAC-SHA256 base64 of raw body, `flutterwave-signature` header, unit-tested; route accepts v3 `verif-hash` too).
  - *Transfer-status webhook (SHIPPED 2026-08-03)* — `transfer.*` webhook events settle the matching auto payout by transfer ref (`transferRef`/`transferReference` now stored on WalletPayout): success confirms PAID, failed/reversed flips the payout back to PENDING with a note so an admin retries — money never silently disappears.
  - *Refunds on event cancellation (SHIPPED 2026-08-03, sandbox-verified refund rfd_32qCRcb9ps)* — archiving/deleting a PUBLISHED or CHECK_IN paid event auto-refunds every buyer via the gateway (Paystack / FLW v3 / FLW v4 — v4 refund reasons are enums, `requested_by_customer`); failed gateway refunds queue as `REFUND_DUE` in a "Refunds to settle" list on the admin Tickets console (Mark refunded, audit-logged); registrations cancelled, guest claim links voided, wallet earnings reversed automatically (organizer can go negative if already paid out — visible as debt), buyers notified by bell + email with refund timelines. COMPLETED/CHECK_OUT events never refund on archive.
  - *Ticket email attachment* — attach the designed ticket PNG to the receipt email (needs server-side canvas, e.g. `@napi-rs/canvas`); today the email links to the QR pass/download.
  - *Sales analytics (basic, SHIPPED 2026-08-03)* — organizer sales card now shows a sold-per-day mini bar chart (last 14 days) + promo-code conversion chips (uses × gross) from `getTicketSales.salesByDay/promos`. Still open: page views → checkout conversion funnel.
  - *Ticket transfer (SHIPPED 2026-08-03)* — "Can't make it? Transfer this ticket" on the QR pass: confirmed, unused tickets move to another account by email/username (fresh QR, old pass dies, recipient notified w/ bell+email); payment stays with the original buyer so refunds always go back to the card that paid; day-scoped coverage follows the registration; blocked after any check-in.
  - *Affiliate/referral selling* — tracked referral links with a cut or discount (Selar's growth lever, campus-fit: class-rep links).
  - *Guest checkout* — buy with just an email, claim the account later. **Product decision 2026-08-03: NOT building** — students belong inside the platform (verified identity, refunds, QR passes protect them); staying outside means missing the flywheel.
  - *Designed ticket (SHIPPED 2026-08-02; styles + branding 2026-08-05)* — "Download ticket" on the attendee's QR pass renders a branded PNG via frontend/components/guildos/ticket-canvas.ts: STANDARD = GuildOS landscape ticket in one of 4 looks (`ticketStyle` Midnight/Daylight/Bold/Minimal + `ticketAccent` hex, wizard picker w/ live preview) with the community logo, tier chip and day-scope chip ("Day 2 only"); CUSTOM = organizer uploads their own artwork in the wizard (`ticketTemplate` + `ticketQrPlacement` on the event) and the buyer's personal check-in QR is composited onto it on a white card (5 positions), so any flyer design becomes a scannable ticket. QR encodes the registration qrToken — downloaded ticket and on-page pass are interchangeable at the scanner.
  - *Refunds on event cancellation* — reverse gateway charge or wallet-credit the buyers; block payouts of refundable funds.
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
- **Profile analytics (SHIPPED)** — profile/recruiter/certificate view counts + verification center (`recordProfileView` on profile & certificate routes).
- **AI-inferred Skills** traceable to verified activities.
- **Opportunity Readiness Score.**
- **Username reservation/immutability policy (SHIPPED 2026-08-16)** — username is normalized (`lowercase`), validated on update, and becomes immutable after first successful reservation.
- **`/u/:username` canonical profile path (SHIPPED 2026-08-16)** — `/u` remains the canonical public profile URL; legacy `/profile/:username` links redirect to `/u/:username` on page load.

## Certificates
- **PDF / native DOCX export (SHIPPED 2026-08-05)** — "Download PDF" on the certificate page (dependency-free single-page PDF wrapping the canvas render, `ui/canvas-pdf.ts`); cryptographically *signed* PDF still open.
- **Template catalog (SHIPPED 2026-08-05)** — curated one-click looks in the certificate designer (3 free style presets + 6 premium colour/font bundles, premium-gated). University co-branded templates still open.
- **Cryptographically signed certificate PDF (SHIPPED 2026-08-16)** — backend-issued signed PDF (`GET /api/certificates/:serial/pdf`) embeds an HMAC-SHA256 attestation payload/signature.
- **EXPIRED / INVALID certificate states (SHIPPED 2026-08-16)** — status lifecycle now supports VERIFIED / REVOKED / EXPIRED / INVALID with admin endpoints for invalidation and expiry.

## CV Builder
- **Native DOCX / LinkedIn / Europass export (SHIPPED 2026-08-05)** — dependency-free OOXML builder (`cv/cv-export.ts`): editable .docx in the CV's section order, Europass-structured .docx variant, and "Copy for LinkedIn" (clipboard blocks per profile section). Server-rendered PDF still open (browser print remains).
- **Server-rendered CV PDF export (SHIPPED 2026-08-16)** — backend-generated PDF endpoints for owner and verification views (`GET /api/cv/:cvId/pdf`, `GET /api/cv/verify/:verificationId/pdf`), exposed in the UI.
- **Drag-to-reorder sections (SHIPPED 2026-08-05)** — draggable section chips above the preview; order persists via `PATCH /api/cv/:cvId/customization` and drives preview, print and DOCX. Inline summary editing still open.
- **Persistent projects collection (SHIPPED 2026-08-05)** — `CvProject` model + `GET/PUT /api/cv/projects`; builder pre-fills saved projects and auto-saves on generate. Editable academic achievements still open.

## Platform / UX
- **Top-level navigation** unifying student + management + admin surfaces.
- **Notifications center (SHIPPED)** — /notifications page with pagination + mark-read.
- **Modern dropdowns (SHIPPED 2026-08-05)** — every native `<select>` app-wide gets a consistent custom chevron, rounded corners, and hover/focus states via a scoped `globals.css` rule (no JS, no per-page changes needed). The few selects whose options carry extra context (descriptions, colour swatches, locked/premium badges) — certificate type, certificate design, template catalog, event registration policy — were upgraded to a new reusable `SelectMenu` popover component (`components/guildos/ui/select-menu.tsx`) with keyboard nav, outside-click close, and a checkmark on the selected option.

## Inline WYSIWYG editor — scoped (added 2026-07-25)
> Context: event About + Knowledge Hub articles are written in markdown via `MarkdownTextarea`
> (toolbar + Write/Preview tabs + link dialog). This project replaces the Write/Preview split with
> a true rich-text surface where **bold shows bold while typing** — like Docs/Notion.

**Goal.** A `RichTextEditor` component that edits rich text inline but keeps **markdown as the
stored format** (drop-in replacement for `MarkdownTextarea`: same `value: string` / `onChange`
contract). No backend or DB changes; existing markdown content must load and re-save losslessly.

**Approach.** Tiptap (ProseMirror) + `tiptap-markdown` for serialization. Alternative considered:
Lexical (lighter but younger markdown story); hand-rolled contentEditable rejected (deprecated
`execCommand`, cursor/serialization bugs). Editor loaded via `next/dynamic` (client-only, keeps it
out of the shared bundle).

**Feature set (matches `renderMarkdown` exactly — nothing more).**
Headings (h1–h3), bold, italic, inline code, bullet list, links (dialog UI reused), bare-URL
autolink, paragraphs. Markdown typing shortcuts (`**x**`, `# `, `- `) keep working inline.

**Milestones.**
1. **M1 — Round-trip spike (decision gate).** Install deps; load the seeded dawah-week-demo
   description; verify markdown → editor → markdown is idempotent for the whole feature set
   (bullets stay `- `, no stray escapes). *If lossy → stop, keep Write/Preview.*
2. **M2 — Component.** `components/guildos/ui/rich-text-editor.tsx`: toolbar (same icons),
   link dialog, placeholder, `ev-input` styling, paste-from-Word/Docs sanitized to markdown.
3. **M3 — Event wizard.** Swap into Full Description behind a small "Rich / Markdown" toggle
   (escape hatch for power users + safety valve if an edge case corrupts content).
4. **M4 — Knowledge Hub.** Same swap for article content (largest editor surface, 40k cap).
5. **M5 — Hardening.** Round-trip unit tests (vitest, string in/out), mobile behavior pass,
   length caps enforced client-side, remove toggle if no issues after real use.

**Out of scope.** Images/tables/embeds/mentions, collaborative editing, storing HTML, comments/posts
(short plain text is fine there).

**Risks.** Serializer output drifting from our minimal `renderMarkdown` dialect (mitigate: configure
serializer + M1 gate); bundle weight on slow dev machine (mitigate: dynamic import); Tiptap major-version
churn (pin versions).

**Estimate.** ~2–3 working sessions: M1 half-session, M2+M3 one, M4+M5 one.
**When.** After the field-research pause lifts; M1 spike is safe to run anytime.

## Community / Feed — vs-Reddit gaps (added 2026-07-10)
> Shipped 2026-07-10: all five items below.
- [x] **Pinned posts + community rules** — leaders pin up to 3 posts to the top of the community page; community rules card on the profile tab (founder-editable).
- [x] **Feed sort tabs** — New / Top / Hot sorting on the home feed (Top = engagement over last 7 days, Hot = ranked).
- [x] **Nested comments** — one level of threaded replies (`parentId` on comments) with reply UI.
- [x] **Per-community mod queue** — leaders see reports on their community's posts/comments and can hide content or dismiss reports (delegated moderation) at `/dashboard/moderation`.
- [x] **Trending module on /home** — trending upcoming events + fast-growing communities.

## Leadership sessions & certificates — follow-ups (added 2026-08-02)
> Shipped 2026-08-01/02: session-based CommunityLeader roster (independent of Membership), AI PDF bulk import,
> session browsing + dissolve, end-of-term LEADERSHIP certificates (GuildOS design w/ premium customization +
> signatures, or custom template), public "collect your certificate" group page, per-leader cert reference links,
> reissue-on-redissolve, random collision-proof serials, revoke side-effects (post + reputation rollback),
> paginated/searchable member management, join-mode toggle.
- **Custom template name placement editor (SHIPPED 2026-08-04)** — dissolve dialog's CUSTOM mode has the live-preview slider editor (x/y/size/colour/align); sanitized server-side; reissue keeps serials.
- **Certificate delivery for account-less leaders (SHIPPED 2026-08-04)** — per-row + detail-modal "Send via WhatsApp" (wa.me with intl-normalized phone). Optional email-a-certificate still open (needs an email field on the roster).
- **Session-end reminder (SHIPPED 2026-08-04)** — daily scheduler nudges the founder from Aug 1 of the session's end year (bell, 30-day dedupe).
- **Roster → Membership role bridge** — see "Dissolve → permission handover bridge" under Community management (same item, listed there).
- **Archived-exco certificates (SHIPPED 2026-08-04)** — explicit per-person "Issue anyway" action in the leader detail modal (VP+, idempotent, refuses still-serving leaders); the archived-get-nothing dissolve default is unchanged.

## Platform audit — remaining items (added 2026-07-15)
> Event-tools wave SHIPPED 2026-08-03: Close/Reopen registration toggle, per-day cancellation (+ notifications + day-scoped refunds), day-scoped tickets ("Day 2 only" w/ scanner enforcement), waitlist-promotion notification, organizer "Message attendees" blast (bell + branded email), ticket transfer, invite-only events (shareable secret link, regenerable), event bookmarks ("Save" + my-events Saved section), basic sales analytics, v4 + transfer webhooks, day-removal guard after publish (day numbers are load-bearing), `npm run test:live` aggregator (10 suites). Still open below.
> From the community/event/student surface audit. Shipped same day (top-5): event cloning ("Run again"),
> certificate OG meta + share buttons, community announcements, INVITE dead-end removal, post-event feedback surveys.
> Also shipped: gzip compression, public-user cache (N+1 fix), `npm run preview` prod-mode script.

### Community management
- **Leadership handover UI (SHIPPED)** — dissolve flow offers role assignment for linked accounts + optional ownership transfer (`/leaders/handover`).
- **Dissolve → permission handover bridge (SHIPPED)** — `demoteOutgoing` steps outgoing linked leaders down; `assignRole` on link gives incoming excos real Membership roles.
- **Bulk member import (SHIPPED 2026-08-04)** — "Invite by email": paste up to 50 addresses per batch (rate-limited to 4 batches/30min), branded join-link emails, existing members skipped. AI extraction from a members register still open.
- **Member analytics (SHIPPED 2026-08-04)** — growth chart (12-mo), engaged vs dormant, role mix, followers on the community page (Coordinator+).
- **Community setup checklist (SHIPPED 2026-08-04)** — founder-only completeness card with progress bar; hides when complete.
- **Move "Delete community" out of the sidebar (SHIPPED 2026-08-04)** — deletion now requires typing the community name, refuses while live events or wallet money exist, and members are notified.
- **Knowledge Hub starter templates (SHIPPED 2026-08-04)** — category-aware starter pack (base 4 + TECH/ACADEMIC/RELIGIOUS extras) seeded into an empty hub as editable drafts.

### Event management
- **Event invites** — build a real invite flow if the INVITE registration policy is ever wanted back (option currently hidden from the wizard).
- **Wizard step-splitting (SHIPPED 2026-08-04)** — create/edit is a 4-step wizard (Basics / Logistics & tickets / Certificates & email / Speakers & partners); steps hide/show so state survives switching.
- **Paid ticketing + commission (SHIPPED 2026-08-02)** — see Sponsorship / Revenue section above.

### Multi-day events — deferred follow-ups (added 2026-07-15)
> Shipped same day: day agenda (theme/venue/times/facilitators/day-speakers), per-day QR attendance,
> day-quota certificates ("Attended 2 of 3 days"), timezone-aware day buckets, forgot-scan-out minutes crediting,
> scanner "Day X of Y" pulse, per-day RSVP, day-2+ reminders.
- **Per-day capacity (SHIPPED 2026-08-04)** — per-day seat caps enforced at RSVP; "N left / Full" in the day picker; wizard input.
- **ICS export as per-day VEVENTs (SHIPPED)** — both the on-page export and the personal iCal feed emit one VEVENT per agenda day.
- **Stable day IDs** — speaker `day` assignments and RSVP day numbers are positional; reordering/removing agenda days mid-event can drift them. Day removal is blocked after publish, so this only bites on reorders — fix with day IDs if it does.
- **Attendance report UI (SHIPPED)** — attendees page renders days-attended/planned-days columns + the rich CSV download.
- **Event page decomposition (SHIPPED 2026-08-03)** — events/[slug] split into components/guildos/events/* (1,530 → 775 lines).

### Student pages
- **Calendar view + iCal subscribe (SHIPPED; visual view 2026-08-05)** — personal iCal subscription feed + a List/Calendar toggle on /my-events with a month-grid view (registered = indigo, saved = amber, multi-day spans).
- **Saved / bookmarks (SHIPPED; knowledge 2026-08-05)** — event bookmarks + /events/saved page; knowledge-resource bookmarks (Save on hub cards/reader, `KnowledgeBookmark` model, "Saved resources" section on /my-events).
- **Weekly digest email (SHIPPED; Guild Score delta 2026-08-05)** — weekly scheduler; digest now includes the week's Guild Score movement (+delta → current score/level with top activity highlights, from the reputation activity ledger).
- **Identity page consolidation** — `/cv`, `/resume`, `/portfolio`, `/u/username` are four takes on one identity; make the public profile the hub, others become exports.
- **Profile view analytics (SHIPPED)** — see Public Profiles section above.
- **Dead code cleanup (SHIPPED 2026-08-04)** — guildos-page.tsx removed.

## Production readiness (added 2026-07-15, expanded 2026-08-02)
> Standing pre-launch items — none block local development. The 2026-08-02 audit concluded features are
> now ahead of infrastructure; the items marked HIGH are the ones that hurt first.
- **Rate limiting + abuse protection (SHIPPED 2026-08-02)** — hand-rolled fixed-window limiters in `backend/src/middleware/rate-limit.ts` (no deps, in-memory; move to Redis when multi-instance):
  - Global baseline (already existed): 40 req/min per IP+path.
  - `authAttemptLimiter` (15/5min per IP): login, signup, recruiter-signup, reset-password.
  - `emailSenderLimiter` (5/15min per IP): forgot-password, resend-verification.
  - `aiLimiter` (20/10min per user): assistant chat, event AI draft, certificate wording, CV generate, PDF leader extraction.
  - `uploadLimiter` (60/10min per user): event/community/leader-photo/knowledge/avatar/cover uploads.
  - Live-tested: 16th bad login → 429 with Retry-After.
- **Error monitoring (partially shipped 2026-08-02)** — shipped the minimum: Express last-resort error middleware (structured log, no stack leaks to clients) + process-level `unhandledRejection` (log-and-continue) / `uncaughtException` (log-and-exit) handlers in server.ts. STILL TODO: Sentry (or similar) with alerting — needs an account/DSN decision.
- **Database backups (SHIPPED 2026-08-03, local; verified exact round trip)** — dependency-free scripts (no mongotools needed): `npm run backup [-- --uploads]` dumps every collection to gzipped EJSON-lines (ObjectId/Date-faithful) under `backend/backups/<db>-<timestamp>/` with a manifest + doc counts, optional uploads-folder snapshot, and 14-backup retention; `npm run restore -- <dir> --yes` drops/reinserts exactly (restart backend after so mongoose rebuilds indexes). Verified: 52 collections / 1,196 docs backed up, restored into a scratch DB, counts + spot-check doc byte-identical. Schedule daily via `schtasks /Create /SC DAILY /ST 02:00 /TN "GuildOS DB Backup" /TR "cmd /c cd /d <backend> && npm run backup -- --uploads"`. STILL TODO for prod: ship the backup folder off-machine (R2/Atlas continuous backups) — a local backup doesn't survive the disk dying.
- **Test coverage for the leadership/certificate stack (SHIPPED 2026-08-04)** — unit tests for `assertValidSessionLabel` (incl. Jan/Feb grace window) + `sanitizeNamePlacement` (XSS/clamping); the dissolve→certificate→issue-anyway chain is covered end-to-end by live-test-engagement.ts (46 checks).
- **CI/CD pipeline** — run `tsc --noEmit` (both projects) + `npm test` on every push; deploy config for frontend + backend. Live-test scripts (`live-test-*.ts`) need a running server + DB, so keep them as a manual/staging step.
- **Cloud storage env vars** — R2 integration is built with local-disk fallback; set the 5 `R2_*` vars in `backend/.env` and add a CORS policy on the bucket (certificate canvas draws cross-origin images).
- **Payment gateway key** — premium checkout is built for Paystack + Flutterwave with an admin toggle; `paymentsEnabled` stays false until `PAYSTACK_SECRET_KEY` (or `FLUTTERWAVE_SECRET_KEY` + `FLUTTERWAVE_SECRET_HASH`) is set and the webhook URL is configured in the gateway dashboard. **Wallet fallback (SHIPPED 2026-08-05)**: communities with ticket-sale earnings can pay for premium (monthly or per-event unlock) straight from their wallet balance — no gateway needed, no processing fee, instant activation. "Pay from wallet" buttons appear on `/dashboard/premium` and in the certificate designer's premium-unlock card whenever the released balance covers the price; previously the upgrade button vanished entirely when no gateway key was set — the "Go Premium monthly" link is now always visible too.
- **`NEXT_PUBLIC_SITE_URL` in prod (added 2026-08-02)** — OG tags/canonical URLs and certificate share links default to localhost:3000 until this is set.
- **Migrate legacy local uploads to R2** — one-off copy of existing `backend/uploads` files once R2 is live (new uploads go to R2 automatically).
- **Legacy demo data institution links (added 2026-08-02)** — communities seeded before the institution registry fail founder updates ("legacy community must be linked to a verified institution") and may lack `normalizedName`; `backend/link-demo-institution.ts` shows the fix pattern — a one-off migration should sweep all pre-registry communities.

## Mobile / PWA (added 2026-08-02; PWA SHIPPED 2026-08-06)
> `mobile/` is still an empty Expo shell (revisit only if PWA limits bite — camera QR scanning already
> works fine in the browser). The web PWA itself is done: `app/manifest.ts` (icons incl. maskable),
> `public/sw.js` (push notifications + notification-click tab reuse/focus, deliberately no fetch
> caching since the app is highly dynamic), `PwaProvider` (SW registration, push subscription sync,
> dismissable install banner). Nothing left to scaffold here.
- **Native app later** — revisit the Expo shell only if PWA limits bite (camera QR scanning works in the browser today).
- **Offline support** — service worker intentionally skips fetch caching for now; revisit once the dynamic-content risk is worth trading off.

## Polish — dark mode, locale, self-service data export (added/SHIPPED 2026-08-06)
- **Dark mode (SHIPPED)** — `tailwind.config.ts` `darkMode: 'class'`; `ThemeScript` (render-blocking
  inline script in `<head>`, no flash-of-wrong-theme) + `ThemeToggle` button in the student nav,
  persisted to `localStorage`. Tailwind `dark:` variants swept across 150+ app/component files;
  the custom (non-Tailwind) CSS classes used by the auth flow and marketing landing page
  (`.auth-card`, `.glass-card`, `.metric-card`, `.problem-card`, etc.) got a dedicated `.dark`
  override block in `globals.css` since they don't respond to Tailwind utilities.
- **Locale (SHIPPED)** — scope is hardcoded English + Nigeria locale (not full multi-language i18n,
  not warranted for the current target market). Standardized on `'en-NG'` for every
  `toLocaleDateString`/`toLocaleString`/`Intl.NumberFormat` call and `₦`/NGN for currency; the
  codebase was already ~100% consistent, only 2 stray `'en-US'` usages found and fixed.
- **GDPR-style self-service data export (SHIPPED)** — `GET /api/profile/export` (rate-limited,
  3/hour) returns a JSON dump of everything GuildOS holds about the requesting user (posts,
  certificates, reputation, memberships, connections, CV documents). "Export my data" button on
  `/account` triggers a browser download via `exportMyData()`.
- **OpenAPI/Swagger docs** — not started; hand-written OpenAPI 3.0 spec covering the core endpoint
  groups (auth, events, communities, certificates, reputation, feed) is the lower-effort path vs.
  auto-generating from JSDoc.

## Discovery / field research (added 2026-07-16)
> Feature work deliberately paused. Next milestone is validation with real community owners, event planners,
> and attendees before the next upgrade cycle. Log findings under each question as they come in.

### How to run it
- **Live demo > pitch deck** — the app runs fully on a laptop (local MongoDB): create an event *with* the organizer, have them scan in on their phone, and hand them a certificate with their logo within 5 minutes.
- **Attend events as an observer** — watch the door, the check-in queue, and what organizers do at closing time. Take notes on paper; don't intervene.
- After each conversation/event, drop findings in this file (or a `docs/research/` note) with date + who.

### Questions to validate — organizers / community owners
- [ ] Will organizers actually run **check-in AND check-out** at a real event? (The whole trust chain depends on this one behavior — if check-out fails in practice, rethink completion criteria.)
- [ ] Is the event creation wizard survivable for a first-time user without help? Where do they stall?
- [ ] Do they care more about **certificates**, **sponsorship money**, or **member growth**? (Determines the pitch order.)
- [ ] Is the **₦5,000/month premium** viable, or is the **per-event unlock** the only model students will touch?
- [ ] What certificates do they issue today, and what does it cost them (designer, printing)?
- [ ] Leadership handover: how do they do it today, and would the Knowledge Hub actually get used for it?

### Questions to validate — sponsors / event planners
- [ ] Which perks do sponsors *actually* value — logo on certificates? attendance report? social post? Something not in the catalog?
- [ ] Are the seeded package prices (₦30k / ₦75k / ₦150k) in the right range for campus events?
- [ ] Would a sponsor trust the **verified attendance report** as proof of delivery? What would make it credible?

### Questions to validate — students / attendees
- [ ] Does the QR check-in flow survive a real venue: bad Wi-Fi, one tired volunteer, a queue of 80 people?
- [ ] Do attendees share their certificates unprompted? On which platform (LinkedIn / WhatsApp / X)?
- [ ] Does anyone *scan* a certificate QR to verify it — does the trust story land?
- [ ] Does the Guild Score mean anything to them yet, or does it need levels/badges to feel real?

### Exit criteria for this phase
- 5+ organizer conversations, 2+ events attended live, 1+ event run end-to-end on GuildOS by someone who isn't the founder.
- A written list of the top 5 friction points, ranked — that list becomes the next upgrade cycle.
