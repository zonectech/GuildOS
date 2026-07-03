# GuildOS — Backlog & Roadmap

> Consolidated list of planned / not-yet-built items pulled from the feature PRDs. Review later.

## Marketplace / Recruiters
- **Applicant messaging** — in-app recruiter ↔ candidate outreach (a review `note` exists, no messaging).
- **Team accounts** — multi-seat company accounts (currently one recruiter profile per user).
- **Billing / posting limits** — monetization, quotas, featured listings.
- **Response-time & recency metrics** — response *rate* ships; median response *time* + listing recency scoring pending.

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
