# GuildOS Feature PRD — Public Profiles & Verifiable Reputation Pages

> Status: **Implemented** (backend + frontend), with documented open items. Reconciled with the
> codebase (`routes/profile.routes.ts`, `routes/reputation.routes.ts`, `services/reputation.service.ts`,
> `store/auth-store.ts`, `models/user.model.ts`, `types.ts`; frontend `app/profile/[username]/`,
> `app/u/[username]/`, `components/guildos/reputation-api.ts`, `profile-metadata.ts`, and the settings
> page).

## Goal
Give every student a professional, shareable public profile that showcases **verified** achievements —
leadership, certificates, reputation, and activity — turning campus participation into a portable
professional identity.

---

## Profile URLs
- Canonical share URL: **`/u/:username`** (e.g. `/u/taye`).
- `/u/:username` currently client-redirects humans to `/profile/:username` (the rendered profile),
  while both routes expose crawler-visible SEO/OG metadata (see SEO below), so links posted to either
  URL preview correctly.
- Usernames are validated/normalized elsewhere (lowercase, trimmed, unique) on profile save.

---

## Sections rendered on the public profile
1. **Header** — photo, name, username, department/level, profile completion, visibility.
2. **Reputation banner** — Guild Score, Guild Level, global **Rank**, verification badges
   (Verified Student / Community Leader / Speaker / Volunteer / Certificate Holder), and reputation
   badges (👑 🎤 🤝 🔥 🚀 🌍).
3. **Reputation Summary** — Guild Score, Rank, Events Completed, Communities, Leadership Roles,
   Certificates.
4. **Academic Information & Interests** (existing) — gated by `showUniversity`.
5. **Leadership History** (existing) — gated by `showLeadership`, with VERIFIED/PENDING status.
6. **Certificates** — verifiable links to `/certificates/:serial`, gated by `showCertificates`.
7. **Activity Timeline** — chronological verified contributions with points, gated by `showTimeline`.

---

## Privacy controls
- **Profile visibility**: `PUBLIC` / `UNLISTED` / `PRIVATE` (`profileVisibility`). PRIVATE/UNLISTED
  are blocked for non-owners on the public routes; PRIVATE also blocks the reputation summary/timeline
  and certificates endpoints.
- **Section toggles**: `showUniversity`, `showLeadership`, `showCertificates`, and the new
  **`showTimeline`** (all default `true`). Managed on the settings page and enforced server-side.

---

## Data model (reconciled)
Rather than a separate `public_profiles` collection, public-profile fields live on the existing
`User.profile` subdocument: `username`, `bio`, `profileVisibility`, `showUniversity`, `showLeadership`,
`showCertificates`, `showTimeline`, plus academic fields, avatar, interests, social links. Reputation
lives in `reputation_scores` / `reputation_activities` (see the Guild Score PRD). Certificates live in
`certificates`.

---

## API endpoints
- `GET   /api/profile/me` (`GET /api/profile`) — the signed-in user's profile.
- `PATCH /api/profile` — update profile; `PATCH /api/profile/privacy` — update visibility + toggles.
- `GET   /api/profile/:username` — public profile (visibility-gated; `optionalAuth` so owner/admin see
  more).
- `GET   /api/profile/:username/certificates` — public certificates (gated by `showCertificates`).
- `GET   /api/reputation/:userId/summary` — reputation + stats + rank (visibility-gated).
- `GET   /api/reputation/:userId/timeline` — activity feed (visibility-gated + `showTimeline`).

Example summary response:
```json
{
  "reputation": { "guildScore": 2480, "level": "Gold Guild", "badges": [ ... ] },
  "stats": { "eventsCompleted": 24, "certificatesEarned": 18, "communitiesJoined": 5, "leadershipRoles": 3 },
  "rank": 12
}
```

---

## SEO / social previews
- Server-component `layout.tsx` files at `app/profile/[username]/` and `app/u/[username]/` export
  `generateMetadata`, sharing `components/guildos/profile-metadata.ts`.
- Emits **Open Graph** (`type: profile`, title, description, avatar image, canonical `/u/:username`)
  and **Twitter** card tags. Example preview: `Taye Idowu (@taye) · GuildOS — Gold Guild • Guild Score
  2480 — Community Leader | Speaker | Volunteer`.
- Server fetches are anonymous, so **private/unlisted profiles return generic, `noindex` metadata** —
  no data leaks.

---

## Recruiter view
Recruiters (any viewer of a PUBLIC profile) see verified information, certificates, leadership history,
and reputation metrics. They cannot access private communities, private certificates, or personal
contact details (phone/email are not surfaced on the public profile).

---

## Permissions
- **Students** — manage visibility/toggles, customize profile, share links.
- **Recruiters** — view public profiles, verify certificates.
- **Community leaders** — leadership records are verifiable on profiles.
- **Platform admins** — bypass visibility gates for moderation/investigation.

---

## Success criteria
- ✓ Every student has a public profile URL.
- ✓ Profiles showcase **verified** achievements (reputation, certificates, leadership).
- ✓ Recruiters can trust displayed credentials (each is backed by a verifiable record).
- ✓ Privacy controls (visibility + per-section toggles) are enforced server-side.
- ✓ Profiles are shareable with rich social previews.

---

## Open Items / Planned
- **Profile analytics** — `profile_views` (total/recruiter views, certificate views, verification
  requests) is not yet implemented.
- **Recruiter-only private links** — currently PUBLIC / UNLISTED / PRIVATE; a tokenized recruiter link
  tier is future work.
- **AI-inferred Skills** — skills traceable to verified activities (not built).
- **Opportunity Readiness Score** — explicitly a future feature in the PRD.
- **`/u/:username` as a true server-rendered profile** — it currently redirects to `/profile/:username`
  for humans (SEO metadata is served on both); rendering the profile directly at `/u` would drop the
  redirect hop.
- **Username reservation/immutability window** — validation exists; a formal immutable-after-reservation
  policy is not enforced.
