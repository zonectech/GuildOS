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
- **Paid event ticketing + commission (SHIPPED 2026-08-02)** — `ticketPrice` (NGN) on events; paid checkout via existing Paystack/Flutterwave gateway abstraction with `TKT-` references (webhooks route by prefix, reconcile job covers missed callbacks). `TicketPayment` model stores kobo amounts with commission split (`ticketCommissionPercent` on PlatformSettings, default 10%, backend setter clamps 0–50); gateway fee grossed up onto the buyer so the organizer nets the ticket price minus commission. Paid events: free registration blocked ("get a ticket"), no waitlist (hard sold-out), instant CONFIRMED on payment (one paid ticket per user, idempotent verify), walk-ins still allowed (cash at door). UI: price field in the event wizard, "Get ticket — ₦total" buyer flow with verify-on-return, organizer sales card (sold/gross/commission/net). Follow-ups: refunds on event cancellation, automated transfers via gateway payout APIs (payouts are manual bank transfers marked by admin for now).
- **Wallet + payouts + admin ticket oversight (SHIPPED 2026-08-02)** — community ticket wallet at /dashboard/wallet (Treasurer+): available/earned/paid-out/pending cards, per-sale ledger, payout request to bank (min ₦1,000, one pending at a time, amount ≤ available, bank details prefilled from last payout). Admin console /dashboard/admin/tickets: platform totals (sold, gross incl. gateway fees, commission = platform revenue, owed to organizers), commission % editor, payout request approval (Mark paid / Reject, audit-logged), sales-by-event table. Buyers get a payment receipt (bell + branded email with amount/reference/QR-pass pointer); organizers get a "Ticket sold" bell linking to the Wallet. Wizard shows the live commission % + worked example (public GET /api/events/ticket-settings).
- **Ticketing follow-ups (captured 2026-08-02)**:
  - *Ticket tiers (SHIPPED 2026-08-02)* — up to 5 named price levels per event (`ticketTiers[{name,price,capacity}]`, capacity 0 = unlimited, ₦0 tier = free ticket); tier picker with live per-tier availability on the event page; per-tier sold counts on the organizer sales card; `ticketPrice` auto-syncs to the cheapest paid tier so all "is paid?" checks work unchanged.
  - *Promo codes (SHIPPED 2026-08-02)* — up to 10 codes per event (`ticketPromoCodes[{code,percentOff,maxUses,usedCount}]`); buyer applies at checkout with live re-quote; redemption counted once on payment success; a 100% code (or free tier) skips the gateway entirely and confirms instantly.
  - *Group buy (SHIPPED 2026-08-02)* — buy up to 10 tickets in one checkout; extras become shareable claim links (`TicketClaim` model, `?ticket_claim=` on the event page); each guest gets their own registration + personal check-in QR; claimed links are locked to the claimer.
  - *Group-buy discount (SHIPPED 2026-08-02, Selar-style)* — `ticketGroupDiscount {minQuantity, percentOff}` per event ("buy 3+, save 15% each"); upsell hint below the qty picker, green applied-chip with the ₦before → ₦after math; promo codes and the group rule never stack — the buyer gets whichever is bigger, and a promo only burns a use when it actually priced the order.
  - *Auto disbursement (SHIPPED 2026-08-02, admin-toggleable — E2E-verified on Flutterwave v4 sandbox, transfer ref trf_fDsli1F9NZ3kY4)* — `payoutMode MANUAL|AUTO` on PlatformSettings with a Manual/Auto toggle on the admin Tickets page. AUTO fires the gateway Transfers API (Paystack transferrecipient+transfer / Flutterwave v3 or v4, bank code resolved from the typed bank name with ambiguity failing loudly) the moment an organizer requests a payout; success = payout PAID instantly with the transfer ref in the note; ANY failure (no key, OTP-locked Paystack account, unmatched bank, low balance) falls back to a PENDING request for manual settlement — organizers never dead-end.
  - *Flutterwave v4 (SHIPPED 2026-08-02, sandbox)* — OAuth adapter (`flutterwave-v4.service.ts`) behind the gateway abstraction; real E2E sandbox payment verified (hosted OTP page → verify → wallet) plus instant auto-payout transfer. **Go-live TODO**: swap the sandbox's mocked-card orchestrator charge for v4 payment links / hosted checkout with real card collection, and add webhook signature handling for v4 events.
  - *Transfer-status webhook* — auto-payouts trust the gateway's acceptance; add the `transfer.disburse` webhook so post-acceptance failures self-correct (mark payout back to PENDING + notify admin).
  - *Refunds on event cancellation* — reverse gateway charge or wallet-credit the buyers; block payouts of refundable funds. Needs production keys.
  - *Ticket email attachment* — attach the designed ticket PNG to the receipt email (needs server-side canvas, e.g. `@napi-rs/canvas`); today the email links to the QR pass/download.
  - *Sales analytics* — page views → checkout conversion, sales-over-time chart per event.
  - *Affiliate/referral selling* — tracked referral links with a cut or discount (Selar's growth lever, campus-fit: class-rep links).
  - *Guest checkout* — buy with just an email, claim the account later. Product decision: weigh conversion lift vs. the verified-identity flywheel.
  - *Designed ticket (SHIPPED 2026-08-02)* — "Download ticket" on the attendee's QR pass renders a branded PNG via frontend/components/guildos/ticket-canvas.ts: STANDARD = GuildOS landscape ticket (dark body, perforated QR stub, name, price chip); CUSTOM = organizer uploads their own artwork in the wizard (`ticketTemplate` + `ticketQrPlacement` on the event) and the buyer's personal check-in QR is composited onto it on a white card (5 positions), so any flyer design becomes a scannable ticket. QR encodes the registration qrToken — downloaded ticket and on-page pass are interchangeable at the scanner.
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
- **Custom template name placement editor** — the recipient's name is drawn at a fixed spot (centered, ~55% height); templates with the name area elsewhere need the drag-to-position editor event certificates already have (namePlacement is already stored on the certificate — UI only).
- **Certificate delivery for account-less leaders** — today the admin manually shares verification links. Add: (a) per-row "Share via WhatsApp" (phone numbers already captured by the PDF import — wa.me deep link with the cert URL), (b) optional "email this certificate" when an email is on file.
- **Session-end reminder** — around academic year end (or when a session label's end year passes), nudge admins: "2025/2026 looks finished — dissolve it and issue certificates?" (scheduler exists; bell + email).
- **Roster → Membership role bridge** — see "Dissolve → permission handover bridge" under Community management (same item, listed there).
- **Archived-exco certificates** — policy today: leaders archived (left early) get NO certificate at dissolve. If a society wants to honour partial service, add an explicit per-person "issue anyway" action rather than changing the default.

## Platform audit — remaining items (added 2026-07-15)
> From the community/event/student surface audit. Shipped same day (top-5): event cloning ("Run again"),
> certificate OG meta + share buttons, community announcements, INVITE dead-end removal, post-event feedback surveys.
> Also shipped: gzip compression, public-user cache (N+1 fix), `npm run preview` prod-mode script.

### Community management
- **Leadership handover UI** — `transferCommunityOwnership` exists on the backend (`PATCH /api/communities/:id/ownership`); needs a guided handover flow in the UI (pick successor, confirm, notify).
- **Dissolve → permission handover bridge (added 2026-08-02, HIGH)** — the CommunityLeader roster is deliberately cosmetic (people without accounts), but that means dissolving a session and importing the new excos gives the incoming President **no actual permissions**. Close the loop: (a) when a roster leader is linked to a GuildOS account, offer "also assign their Membership role" (Amirah → VICE_PRESIDENT etc.); (b) at dissolve time, prompt "hand management over to the new session's leaders?" — pick successors from linked accounts, assign roles, optionally transfer ownership, notify everyone. This is the year-end moment where real societies die; it should be one guided flow.
- **Bulk member import (added 2026-08-02)** — leaders can now be bulk-imported from a PDF; associations will immediately ask for the same for *members*: CSV/email-list invite (send join links), or AI extraction from a members register. Ties into the invite-link system that already exists.
- **Member analytics** — growth chart, active vs dormant members, join/leave trends (data already in memberships + attendance).
- **Community setup checklist** — completeness meter (logo ✓ rules ✓ first event ✗ knowledge hub ✗) to fight empty-community cold start.
- **Move "Delete community" out of the sidebar** — destructive action one click from Archive; belongs behind settings with confirmation.
- **Knowledge Hub starter templates** — pre-seeded resource packs per community category (GDSC, MLSA, engineering society…).

### Event management
- **Event invites** — build a real invite flow if the INVITE registration policy is ever wanted back (option currently hidden from the wizard).
- **Wizard step-splitting** — the create page is ~12 sections on one scroll; collapse into steps or an accordion.
- **Paid ticketing + commission (SHIPPED 2026-08-02)** — see Sponsorship / Revenue section above.

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
- **Database backups (HIGH, added 2026-08-02)** — no backup story for Mongo. If Atlas: turn on continuous backups; if self-hosted: nightly `mongodump` to R2 + retention policy. Certificates/reputation are the un-regenerable data.
- **Test coverage for the leadership/certificate stack (added 2026-08-02)** — everything from 2026-08-01/02 (roster CRUD, session validation, dissolve+issue, reissue, revoke side-effects, random serials, paginated members) is browser-verified only. Add unit tests for `assertValidSessionLabel`, serial generation, `issueLeaderCertificates` gating/idempotency, and a live-test script for the dissolve→certificate→revoke chain.
- **CI/CD pipeline** — run `tsc --noEmit` (both projects) + `npm test` on every push; deploy config for frontend + backend. Live-test scripts (`live-test-*.ts`) need a running server + DB, so keep them as a manual/staging step.
- **Cloud storage env vars** — R2 integration is built with local-disk fallback; set the 5 `R2_*` vars in `backend/.env` and add a CORS policy on the bucket (certificate canvas draws cross-origin images).
- **Payment gateway key** — premium checkout is built for Paystack + Flutterwave with an admin toggle; `paymentsEnabled` stays false until `PAYSTACK_SECRET_KEY` (or `FLUTTERWAVE_SECRET_KEY` + `FLUTTERWAVE_SECRET_HASH`) is set and the webhook URL is configured in the gateway dashboard.
- **`NEXT_PUBLIC_SITE_URL` in prod (added 2026-08-02)** — OG tags/canonical URLs and certificate share links default to localhost:3000 until this is set.
- **Migrate legacy local uploads to R2** — one-off copy of existing `backend/uploads` files once R2 is live (new uploads go to R2 automatically).
- **Legacy demo data institution links (added 2026-08-02)** — communities seeded before the institution registry fail founder updates ("legacy community must be linked to a verified institution") and may lack `normalizedName`; `backend/link-demo-institution.ts` shows the fix pattern — a one-off migration should sweep all pre-registry communities.
- **Untracked scratch file** — `probe_localhost.ps1` in the repo root (debug probe script); delete or gitignore.

## Mobile / PWA (added 2026-08-02)
> `mobile/` exists but is an empty Expo shell. Nigerian students are mobile-first; the QR check-in flow
> especially begs for a phone-native experience.
- **PWA first** — manifest + service worker + install prompt on the Next.js app is 90% of the value for 5% of the work of a native app; add push notifications (web-push) for event reminders/bells.
- **Native app later** — revisit the Expo shell only if PWA limits bite (camera QR scanning works in the browser today).

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
