# GuildOS Feature PRD — AI Verifiable CV Builder

> Status: **Implemented** (backend + frontend), with documented open items. Reconciled with the
> codebase (`models/cv-document.model.ts`, `models/cv-generation-log.model.ts`,
> `services/cv.service.ts`, `services/cv-ai.service.ts`, `routes/cv.routes.ts`; frontend
> `components/guildos/cv-api.ts`, `components/guildos/cv/cv-document-view.tsx`, `app/cv/page.tsx`,
> `app/cv/verify/[verificationId]/page.tsx`).

## Goal
Automatically turn a student's **verified** activities — leadership, certificates, events,
speaking/volunteering, reputation — into professional, ATS-friendly, verifiable CVs. Reputation data
becomes career opportunity.

---

## Core philosophy — proof, not claims
Every line on a GuildOS CV is backed by a verified record. The generator only rephrases facts it can
prove; it never invents skills, experience, impact, or roles.

---

## Evidence sources (all verified)
`cv.service.ts` aggregates, per user:
- **Profile** — name, email, phone, location, public profile URL (`/u/:username`), university,
  course/department, level, graduation year, interests.
- **Reputation** — Guild Score, level, badges (via `reputation.service`).
- **Certificates** — VERIFIED certificates (`listUserCertificates`).
- **Leadership roles** — with community names and VERIFIED/PENDING status (`getUserLeadershipHistory`).
- **Event organization** — events created by the user.
- **Speaking** — `EventSpeaker` rows linked to the user (with speaker type).
- **Volunteering** — `EventVolunteer` rows linked to the user (with role).
- **Completed events** — count for source metrics.
- **Projects** — supplied by the student at generation time.

---

## AI transformation (evidence-locked)
`cv-ai.service.ts` mirrors the event-AI pattern:
- Builds a deterministic **baseline** (summary + bullet facts) purely from evidence.
- If `OPENAI_API_KEY` is set, an OpenAI call **rephrases** the summary and the leadership/experience
  bullets under strict rules (no new facts, no invented numbers), returning JSON validated by array
  length; on any mismatch/failure it **falls back to the baseline**.
- **Skills are never altered by AI** — they are derived only from verified activities (interests +
  leadership → Leadership/Community Management/Event Coordination, speaking → Public Speaking,
  volunteering → Teamwork/Volunteering, organizing → Event Management).
- `promptVersion` (`cv-v1`) and `aiGenerated` are recorded for auditing.

---

## CV sections
Header (name, email, phone, location, public profile URL, **verification QR**), Professional Summary,
Education, Leadership Experience (verified badge + dates + bullets), Experience (organizer / speaker /
volunteer / project), Certifications (with per-cert verify links), Skills, Projects, and Awards &
Recognition (Guild level + reputation badges).

---

## Templates & writing modes
- **Templates** (accent + styling): `PROFESSIONAL`, `MODERN`, `EXECUTIVE`, `ACADEMIC`, `TECHNICAL`.
- **Writing modes** (AI guidance): `INTERNSHIP`, `SCHOLARSHIP`, `LEADERSHIP`, `TECHNICAL`.

---

## Customization
- Hide certificates, hide Guild Score (both honored in the preview **and** the public verification
  view).
- Add manual projects (name, role, URL, description).
- `sectionOrder` is stored for future drag-to-reorder.

---

## Verification layer
- Each CV carries a **QR code** + verification URL + identifiers.
- `cvId` format **`CV-YYYY-NNNNNN`** (sequential, collision-checked); `verificationId` format
  **`VER-XXXXXXXX`**.
- Public page **`/cv/verify/:verificationId`** shows authenticity, owner name, generation date,
  certificate/leadership/event counts, a link to the public profile, and the full rendered CV
  (respecting the owner's hide-toggles).

---

## Export
- **PDF** via a print-optimized layout (`@media print` hides controls; `.cv-document` prints clean) →
  browser "Save as PDF", producing ATS-friendly output.
- DOCX / LinkedIn / Europass export are future work (see Open Items).

---

## Data model
`cv_documents`: `userId`, `cvId`, `verificationId`, `template`, `mode`, `publicUrl`, `content`
(full structured CV), `customization`, `source { certificates, roles, events }`, `aiGenerated`,
timestamps. `cv_generation_logs`: `userId`, `cvId`, `promptVersion`, `mode`, `template`,
`sourceCertificates`, `sourceRoles`, `sourceEvents`, `aiGenerated`, `generatedAt`.

---

## API endpoints (`/api/cv`)
- `POST   /generate` — generate a CV from evidence (auth). Returns `{ cvId, verificationId, template,
  mode, publicUrl, aiGenerated, status }`.
- `GET    /my-cvs` — the signed-in student's CVs (auth).
- `GET    /:cvId` — full CV for the owner (auth).
- `GET    /verify/:verificationId` — public verification + rendered content.
- `DELETE /:cvId` — delete a CV (owner).

---

## Permissions
- **Students** — generate, download, share, delete their CVs.
- **Recruiters** — verify public CVs via the verification URL/QR.
- **Platform admins** — generation logs support audit of abuse cases.

---

## AI constraints (enforced)
The AI never invents skills, fabricates experience, exaggerates impact, or creates false roles. Bullets
originate from verified facts; the AI only rephrases them, and skills stay evidence-derived. Any AI
deviation (bad JSON, wrong counts) is discarded in favor of the deterministic baseline.

---

## Success criteria
- ✓ One-click generation from verified data.
- ✓ Every generated statement is evidence-backed.
- ✓ Recruiters can verify authenticity (QR + public page).
- ✓ Multiple templates and writing modes.
- ✓ ATS-friendly, printable output.
- ✓ Bridges campus activity and professional opportunity.

---

## Open Items / Planned
- **Native DOCX / server-rendered PDF** — current export is browser print-to-PDF.
- **LinkedIn / Europass export.**
- **Drag-to-reorder sections & inline summary editing** — `sectionOrder` is stored but the UI reorder
  is not built; generated summaries aren't yet editable in place.
- **Persistent projects collection** — projects are captured per generation, not stored on the profile.
- **Academic achievements input** — the Education `achievements` array is modeled but not yet
  user-editable.
- **Feeds into Feature 14 (AI Opportunity Matching)** — the same verified evidence + Guild Score can
  drive internship/scholarship/fellowship recommendations.
