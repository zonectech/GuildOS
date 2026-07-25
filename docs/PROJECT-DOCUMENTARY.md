# GuildOS: The Campus Platform That Wants to Make Your Certificate Actually Mean Something

*A documentary-style deep dive into the project — written for anyone, technical or not.*

---

## Prologue: The Problem Nobody Solved

Picture a university campus anywhere in Nigeria — or anywhere in the world. Student societies, tech clubs, and professional guilds run events every week: workshops, hackathons, seminars. Attendees show up (or say they did), someone designs a certificate in Canva, and a PDF gets emailed around.

Then the certificate goes on a CV. And here's the uncomfortable truth: **nobody can verify it.** Did the person really attend? Did they stay for five minutes or five hours? Was the event even real?

Meanwhile, the organizers running these events burn money on venues and refreshments with no way to earn anything back. And the students who *do* show up consistently — who genuinely build skills event after event — have no way to prove it beyond a folder of unverifiable PDFs.

**GuildOS** is a bet that all three of these problems are actually one problem — and that one platform can solve it.

---

## Act I: What GuildOS Is

GuildOS is a **community-and-events platform for student and professional guilds**. In one sentence: communities host events, members attend with *verified* check-in and check-out, earn *tamper-proof certificates*, build a reputation score, and generate AI-assisted CVs — while organizers earn money through event sponsorships.

Think of it as a fusion of several familiar ideas:

- The **community layer** of Reddit or Discord (feeds, posts, nested comments, moderation, pinned posts, community rules)
- The **events machinery** of Eventbrite or Luma (creation, registration, RSVP, reminders)
- A **credentialing engine** unlike either — where certificates carry a QR code and serial number that anyone can scan to verify, backed by an attendance chain the platform itself witnessed
- A **reputation system** ("Guild Score") that turns verified participation into a public, portable track record

The chain of trust is the core insight:

```
Real event → verified check-in/check-out → certificate issued →
QR + serial anyone can verify → reputation that compounds → a CV that's provable
```

Every link is recorded by the platform, so the certificate at the end isn't a claim — it's a receipt.

---

## Act II: The Cast of Characters

GuildOS serves four kinds of people, each with their own doors into the platform:

**The Student.** Joins communities, attends events, checks in and out, collects verifiable certificates on a public profile (`/u/username`), watches their Guild Score grow from a personal command-center home page, and eventually exports an AI-assisted CV built from things that actually happened.

**The Community Leader.** Founds and runs a guild. Creates events through a full wizard — theme and topic, a features list, contact persons, speakers, volunteers — designs certificates (12 professional designs, free), manages members and roles, moderates the feed, pins posts, sets community rules, opens events to sponsorship, and can even invite **other communities to co-host** an event as partners.

**The Sponsor.** A local business or brand that wants eyes on campus. Browses open sponsorship opportunities at `/sponsors` — *without even needing an account* — picks a package (Gold, Silver, Bronze), and gets real deliverables: a logo on the event page, a logo printed on every certificate issued, a social shout-out, an attendance report.

**The Platform Admin.** Oversees everything from a dashboard: moderation, audit logs, broadcast messaging (in-app and branded email), premium grants, payment-gateway toggling, and the sponsorship-fee pipeline.

*(A fifth character — the Recruiter — has a portal designed on paper but waits in the wings. The strategy: build the student mass first, then sell access to verified talent.)*

---

## Act III: The Certificate — The Star of the Show

If GuildOS has a signature feature, it's the certificate system. This is where the most engineering care has gone.

**Verification first.** Every certificate has a unique serial (like `GLD-2026-000001`) and a QR code. Scan it, and you land on a public verification page that re-renders the exact certificate and confirms: this person, this event, this community, this date. No Photoshop forgery survives that.

**Design without a designer.** Organizers pick from **12 professionally designed templates** — Classic, Modern, Minimal, Corporate, Art Deco, Geometric, Ribbon, Laurel, Tech, Wave and more — all free. The philosophy is deliberate: *no student organization should have to hire a designer to issue a beautiful certificate.*

**Premium personalization.** What costs money is customization: 9 background palettes, 8 typefaces (including script and elegant serifs), custom accent colors, custom wording, an organization logo (as an emblem, corner mark, or watermark), and up to three signatories with uploaded signature images. There's even an AI assistant that writes the certificate wording for you.

**Rendered live, in the browser.** Certificates aren't static images sitting on a server — they're drawn on an HTML canvas at a fixed 1600×1450 print size, from a single shared rendering module, every time someone views or downloads one. The sponsor strip ("SPONSORED BY" with logos) is painted automatically for sponsors who bought that perk — and when an event is co-hosted, an **"IN PARTNERSHIP WITH"** strip carries the partner communities' logos onto every certificate too.

**Built to be shared.** A certificate nobody sees is a certificate wasted. Every certificate page now ships server-side Open Graph metadata — so pasting a link into LinkedIn, WhatsApp or X unfurls into a proper preview card — plus one-tap share buttons for each. The share is the growth loop: a student posts their cert, a classmate scans the QR, and GuildOS acquires its next user.

**And it survives a conference.** Events aren't always one afternoon. GuildOS handles **multi-day events** with a day-by-day agenda (per-day themes, venues, times, activities, facilitators, even per-day speakers), per-day attendance tracked with the *same* QR pass all week, and a **day quota** on certificates: attend, say, 2 of 3 days to qualify. The certificate itself prints "attended X of Y days" — the honesty is the feature. The finalize sweep even credits attendees who forgot to scan out, up to that day's scheduled end.

---

## Interlude: Better Together — Partnerships and the Guild Score Ledger

Two newer systems tie the whole story into a loop.

**Event partnerships.** A big event is rarely one club's work. Organizers can now invite other communities as **co-hosts** (a formal invite → accept/decline flow; accepted partners get full event-management powers) and list **external partners** — an NGO, a company, a faculty. Partners appear on the public event page and, as noted above, on the certificates themselves.

**The Guild Score ledger.** Reputation isn't a vibe — it's an itemized ledger. An attendee who checks in *and stays to the end* earns +10. When an event completes, the platform sweeps through every role and pays out idempotent awards: organizers, speakers, volunteers, co-hosting partner communities (**+30** for a partnership hosted), and organizers who landed sponsors (**+20 per sponsorship secured**). Publishing a knowledge resource earns **+15**. Every point traces back to a recorded activity — which is exactly what makes the score worth showing a recruiter.

---

## Act III½: The Knowledge Hub — A Cure for Institutional Amnesia

Every student organization suffers the same disease: the executive committee graduates, and everything they learned walks out the door with them. How to book the auditorium. Which sponsor said yes last year. The template for the budget proposal.

GuildOS's answer is the **Knowledge Hub** — a knowledge tab on every community page where coordinators and above publish **markdown articles, external links, and file uploads** (PDFs, images) across seven categories. It's the guild's institutional memory, finally living somewhere other than a departing president's laptop.

Three details elevate it beyond a shared folder:

- **It's searchable platform-wide.** Global search has a Knowledge group with deep links straight to resources.
- **It feeds the AI assistant.** The in-app assistant is *grounded* in Knowledge Hubs — ask it a question and it answers from your own communities' documents first, citing the source community. It works with or without an OpenAI key.
- **It's measured and rewarded.** Leaders get an analytics strip (resources, views, opens, most-viewed), and every published resource earns its author +15 Guild Score.

Knowledge compounds the same way reputation does — and now both are on the ledger.

---

## Act III¾: Keeping the Flywheel Spinning

A cluster of smaller features exists purely to reduce friction for organizers who come back:

- **"Run it again"** — any past event can be **cloned** into a fresh draft: content, settings and speakers copied; dates and counters reset. Annual events become a two-click ritual.
- **Community announcements** — vice-presidents and above can broadcast to all members, in-app and optionally by branded email.
- **Post-event feedback** — checked-in attendees leave 1–5 star ratings and comments; the public sees the average, organizers see the full distribution. The attendance verification does double duty here: only people who *actually came* can review.
- **Per-day RSVP and reminders** — multi-day registrants pick which days they plan to attend, feeding an "expected today" count on the organizer's scanner dashboard ("Day 2 of 3 — 41 checked in / 78 expected"), with reminder emails before each agenda day.

---

## Act IV: Follow the Money

GuildOS is not a charity, and its business model is unusually grounded for a student platform. Two revenue engines run today:

### 1. Sponsorship Commission

Organizers open an event to sponsorship and define packages with prices and system-defined perks (logo on event page, logo on certificates, social announcement, attendance report, stage mention, booth, venue banner). Sponsors inquire publicly. Organizers work the pipeline — New → Contacted → **Won** → Closed — and when a deal closes, GuildOS takes a **configurable percentage fee**, tracked through an admin pipeline until the organizer remits it.

The perks aren't just promises — several are **delivered automatically by the platform**: the certificate logo appears on every cert issued, a thank-you post publishes to the community feed, and a privacy-safe attendance report page is generated for the sponsor.

### 2. Premium Subscriptions

Communities pay **₦5,000/month** (admin-configurable) for premium certificate customization — or organizers can unlock a **single event** for a smaller one-time fee (~₦400 + gateway charges). Payment-gateway fees are grossed up so the platform always nets its price.

Payments run through **Paystack or Flutterwave** — a platform admin flips a switch to choose which is live. The payment code is defensive to a fault: webhook signature verification, amount-mismatch rejection (no underpaying your way to premium), idempotent verification, and a background reconciliation job that recovers payments the redirect flow missed — plus a "Check payment status" button for anxious users.

---

## Act V: Under the Hood

For the technically curious, GuildOS is an **npm workspaces monorepo**:

| Piece | Technology | Role |
|---|---|---|
| `backend/` | Express 4, Mongoose 8, TypeScript, WebSockets | REST API, realtime, schedulers, payments, email |
| `frontend/` | Next.js 14 (App Router), React 18, Tailwind CSS | The web app |
| `mobile/` | Expo / React Native | Early-stage mobile stub |
| `docs/` | Markdown | A PRD per feature, backlog, changelog |

Some notable engineering decisions:

- **~35 Mongoose models** cover everything from certificates and connections to sponsorship inquiries and admin audit logs.
- **File uploads** go to **Cloudflare R2** (S3-compatible, free egress via redirect) when configured — and gracefully fall back to local disk in development. The database only ever stores relative paths, so the storage backend can change without a migration.
- **Email** is fully branded: a shared HTML shell in the platform's indigo palette, with category chips (Achievement unlocked, Action needed, Confirmation, GuildOS update), wraps everything from email verification to certificate-earned notifications, sent instantly via SMTP.
- **Realtime** notifications flow over WebSockets.
- **Feeds** offer New / Top / Hot sorting with a decay-based ranking formula, one-level nested comments, pinned posts (max three per community), and a community-scoped moderation queue.
- **Everything degrades gracefully**: no payment keys? Payments show as "not set up." No OpenAI key? AI wording and the assistant fall back to grounded templates. No R2? Local disk. No SMTP? The app still runs.
- **Performance got a pass too**: gzip compression, a short public-user cache that killed an N+1 query, and a production preview script.
- **Testing** runs on two tracks: an 18-test hermetic Vitest suite (payment fee math, password hashing, JWT tokens — no database required), plus a growing family of **live end-to-end suites** against the real running API: the full event lifecycle in nine stages, draft → publish → co-host collab → registration → live QR check-in → check-out → finalize-with-awards → certificates → Guild Score verification (**58 checks**), plus dedicated suites for multi-day events (**47**), partnerships (**45**), and the Knowledge Hub (**28**). Together they prove the certificate chain of trust end to end.

---

## Act VI: The Road Ahead

The project's own documents are candid about what's not done:

- **Production readiness** — the backlog now names its launch checklist explicitly: CI/CD, cloud storage cutover to R2, live payment keys, and migrating existing local uploads.
- **The recruiter portal** — designed, deliberately deferred until student adoption justifies it.
- **AI opportunity matching** and the full **AI CV builder** — PRDs exist; the matching engine awaits its moment.
- **Mobile** — the Expo app is a stub.
- **Version control discipline** — a July 2026 incident in which 13 files of uncommitted work were accidentally reverted (and painstakingly recovered from editor local history) stands as the project's cautionary tale: *commit early, commit often.*

---

## Epilogue: Why It Might Work

Plenty of platforms do events. Plenty do communities. A few do certificates. GuildOS's wager is that **verification is the moat**: once a certificate can be trusted because the platform witnessed the attendance behind it, everything downstream — reputation scores, CVs, recruiter interest, sponsor confidence — inherits that trust.

And the go-to-market is refreshingly pragmatic: don't chase recruiters before there are students; earn commission on sponsorships that organizers *already want*; give away world-class certificate designs for free and charge for personalization.

Whether it becomes the operating system for guilds everywhere or stays a campus phenomenon, GuildOS is that rare student-platform project where the code, the business model, and the product philosophy all tell the same story: **make participation provable, and value follows.**

---

*Compiled from the GuildOS codebase, README, product requirement documents, and development history — last updated 15 July 2026 (multi-day events, Knowledge Hub, and the organizer-flywheel era).*
