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

**The Student.** Joins communities, attends events, checks in and out, collects verifiable certificates on a public profile (`/u/username`), watches their Guild Score grow, and eventually exports an AI-assisted CV built from things that actually happened.

**The Community Leader.** Founds and runs a guild. Creates events through a full wizard, designs certificates (12 professional designs, free), manages members and roles, moderates the feed, pins posts, sets community rules — and crucially, opens events to sponsorship.

**The Sponsor.** A local business or brand that wants eyes on campus. Browses open sponsorship opportunities at `/sponsors` — *without even needing an account* — picks a package (Gold, Silver, Bronze), and gets real deliverables: a logo on the event page, a logo printed on every certificate issued, a social shout-out, an attendance report.

**The Platform Admin.** Oversees everything from a dashboard: moderation, audit logs, broadcast messaging (in-app and branded email), premium grants, payment-gateway toggling, and the sponsorship-fee pipeline.

*(A fifth character — the Recruiter — has a portal designed on paper but waits in the wings. The strategy: build the student mass first, then sell access to verified talent.)*

---

## Act III: The Certificate — The Star of the Show

If GuildOS has a signature feature, it's the certificate system. This is where the most engineering care has gone.

**Verification first.** Every certificate has a unique serial (like `GLD-2026-000001`) and a QR code. Scan it, and you land on a public verification page that re-renders the exact certificate and confirms: this person, this event, this community, this date. No Photoshop forgery survives that.

**Design without a designer.** Organizers pick from **12 professionally designed templates** — Classic, Modern, Minimal, Corporate, Art Deco, Geometric, Ribbon, Laurel, Tech, Wave and more — all free. The philosophy is deliberate: *no student organization should have to hire a designer to issue a beautiful certificate.*

**Premium personalization.** What costs money is customization: 9 background palettes, 8 typefaces (including script and elegant serifs), custom accent colors, custom wording, an organization logo (as an emblem, corner mark, or watermark), and up to three signatories with uploaded signature images. There's even an AI assistant that writes the certificate wording for you.

**Rendered live, in the browser.** Certificates aren't static images sitting on a server — they're drawn on an HTML canvas at a fixed 1600×1450 print size, from a single shared rendering module, every time someone views or downloads one. The sponsor strip ("SPONSORED BY" with logos) is painted automatically for sponsors who bought that perk.

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
- **Email** is fully branded: a shared HTML shell with category chips (🎉 congrats, ⚠️ warning, ✓ confirmation, info) wraps everything from email verification to certificate-earned notifications, sent instantly via SMTP.
- **Realtime** notifications flow over WebSockets.
- **Feeds** offer New / Top / Hot sorting with a decay-based ranking formula, one-level nested comments, pinned posts (max three per community), and a community-scoped moderation queue.
- **Everything degrades gracefully**: no payment keys? Payments show as "not set up." No OpenAI key? AI wording falls back to polished templates. No R2? Local disk. No SMTP? The app still runs.
- **Testing** began with an 18-test Vitest suite covering payment fee math, password hashing, and JWT tokens — hermetic, no database required — with integration tests for the certificate/attendance chain identified as the next priority.

---

## Act VI: The Road Ahead

The project's own documents are candid about what's not done:

- **Production hardening** — CI/CD, deployment config, and a deeper test suite are committed priorities.
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

*Compiled from the GuildOS codebase, README, product requirement documents, and development history — July 2026.*
