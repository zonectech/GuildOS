# GuildOS — Changelog (Social, Community, Profile & Dashboard)

> Record of work completed on the social feed, community experience, profiles, cover
> images, and the community-mode dashboard. Continues from the feature PRDs and
> `BACKLOG.md`. Dated 2026-07-03.

---

## 0. Multi-Platform Chat Links & Unverified Community Tier (2026-08-30)

### Multi-platform chat links
Communities are no longer WhatsApp-only — clubs on Discord, Telegram, Slack, or anywhere
else can register their real home.

- **Backend**: `utils/chat-links.ts` — `normalizeChatLinks` validates platform
  (`WHATSAPP | DISCORD | TELEGRAM | SLACK | OTHER`), https-only URLs, and per-platform
  host allow-lists; max **5 links** per community. `community.model.ts` gained
  `chatLinks[] {platform, url, label}`; legacy `whatsappLink`/`channelLink` stay synced
  for old clients. Create/update require at least one chat link of any platform.
- **Frontend**: creation and edit wizards replaced the required WhatsApp field with a
  repeatable platform-dropdown + URL editor (add/remove up to 5). The community page
  renders one branded button per platform (member-gated); shared validation helpers in
  `community-api.ts` (`CHAT_PLATFORM_OPTIONS`, `isValidChatLink`, `MAX_CHAT_LINKS`).

### Unverified community tier
Founders without an endorsement letter or matching school email can now create an
**`UNVERIFIED`** community (verification method `NONE`) instead of being blocked.

- Allowed: public directory listing, follow, join, **free events only**.
- Restricted until verified: **no certificates** (already VERIFIED-gated everywhere),
  **no reputation points for anyone** (central gate in `awardReputation` skips awards
  tied to non-VERIFIED communities), **no leadership roles** (`updateMemberRole`
  rejects anything above `MEMBER`), **no paid tickets** (enforced on event create and
  update), posts stay out of the main feed, no event partnerships.
- UI: "Skip for now — create unverified" option in the wizard verification step with a
  restrictions summary; amber **Unverified** pill on the community page header.

---

## 1. Social Feed & Posts

A LinkedIn/X-style activity feed for students.

**Backend** (`backend/src/`)
- `models/post.model.ts` — `posts` collection: `userId`, `communityId` (nullable),
  `authorType` (`USER` | `COMMUNITY`), `kind` (`TEXT` | `MILESTONE`), `content`,
  `milestone {type,label,refId}`, `likeCount`, `commentCount`. Partial unique index on
  `{userId, milestone.type, milestone.refId}` to de-duplicate milestone posts.
- `models/post-like.model.ts`, `models/post-comment.model.ts` — likes and comments with
  uniqueness on `{postId,userId}`.
- `services/feed.service.ts` — `createPost`, `createMilestonePost` (auto-posted on
  achievements), `getFeed` (scopes: `FORYOU` / `COMMUNITIES`), `getPost`, `toggleLike`,
  `addComment`, `listComments`, `deletePost`.
- `routes/feed.routes.ts` — mounted at `/api/feed` (create, list, like, comment, delete).
- Milestone posts are emitted automatically when a leadership role is assigned
  (`community.service.ts`) and when an event certificate is issued (`event.service.ts`).

**Frontend** (`frontend/components/guildos/`)
- `feed-api.ts` — typed client (`FeedPost`, `FeedScope`, CRUD + like/comment helpers).
- `feed/feed.tsx` — `Feed` component with composer, **For you / My communities** scope
  tabs, and an exported `PostCard` (like, comment, delete-own, milestone styling).

---

## 2. Community Follow

- **Backend**: `models/community-follow.model.ts`, `services/follow.service.ts`
  (`toggleFollow` with `followerCount` `$inc`, `listFollowedCommunityIds`),
  `routes/follow.routes.ts` at `/api/follow`. `community.model.ts` gained `followerCount`.
- **Frontend**: `follow-api.ts` (`getFollowedCommunityIds`, `toggleCommunityFollow`).
- Follow toggles appear on community cards, the community detail page, and on
  community-authored posts in the feed.

---

## 3. Community Posts (Announcements)

- **Backend**: `feed.service.ts#createCommunityPost` (manager-only, `authorType=COMMUNITY`)
  and `getCommunityPosts`; routes `POST`/`GET /api/feed/community/:communityId`.
- **Frontend**: `feed/community-composer.tsx` (manager-only composer) and
  `feed/community-posts.tsx` (list). These are now combined so a newly posted announcement
  is **prepended to the list instantly** (no reload needed).
- Manager roles: `COORDINATOR, SECRETARY, TREASURER, VICE_PRESIDENT, PRESIDENT, FOUNDER`.

---

## 4. Community WhatsApp / Channel Links

- **Backend**: `community.model.ts` gained `whatsappLink` and `channelLink`; wired through
  `community.service.ts` (create/update) and `communities.routes.ts`.
- **Frontend**: inputs added to the community **create** and **edit** wizards; links render
  as prominent pill buttons ("Join WhatsApp group" / "Open channel") on the community page.

---

## 5. Community Detail Page — Redesign

`frontend/app/communities/[slug]/page.tsx`

- **X (Twitter)-style header**: cover banner with only the logo overlapping; the name,
  verification badge, category/university, and stat badges sit **below** the cover (fixed the
  name overlapping the cover image via `relative z-10` stacking).
- **Profile ⇄ Posts switch** (sticky segmented control) like the student profile:
  *Profile* = About, Leadership, Endorsements, Events; *Posts* = announcements + composer.
- Management sidebar (Actions, Members, Join Requests) visible on both tabs.
- **Adaptive chrome**: community members/founders see the community-mode `DashboardShell`;
  non-member students see the student-mode `StudentNav` — so browsing a community no longer
  forces students into community mode.
- Fixed a pre-existing broken JSX nesting (Endorsements panel was nested inside Leadership).

---

## 6. Communities Index

`frontend/app/communities/page.tsx`

- Student-facing grid with **Join** (seeded from the viewer's active memberships) and
  **Follow** toggles per card, plus member/follower counts.

---

## 7. Student Home Feed

`frontend/app/home/page.tsx`

- Three-column LinkedIn-style layout: left profile card, center `Feed`, right rail
  (Community Mode CTA, certificates, upcoming events, recommendations).
- **Cover image** shown on the left profile card.
- Left and right rails are **sticky** (`lg:sticky lg:top-16 lg:self-start`); only the center
  feed scrolls.

---

## 8. User Profile — Redesign (`/u/[username]`)

`frontend/app/u/[username]/page.tsx` (was a redirect stub)

- Own-account profile in **Instagram/LinkedIn hybrid, X-style** layout: cover banner, avatar
  overlapping, name/handle/bio/meta below the cover (`relative z-10` fixes overlap).
- **Profile ⇄ Posts switch**: *Posts* = the user's own posts (`getUserPosts`); *Profile
  details* = guild-score banner + badges, academic info, interests/social links, leadership
  history, certificates, activity timeline.
- Shows private fields since it's the owner's own view; **share** copies the public link.
- Viewing another user's `/u/{username}` redirects to the public, privacy-limited
  `/profile/{username}` (kept as-is).
- **Backend support**: `feed.service.ts#getUserPosts` + `GET /api/feed/user/:userId`
  (`optionalAuth`); client `getUserPosts`.

---

## 9. Cover Image Upload (User)

- **Backend**: `coverImage` added to `ProfileData` (`types.ts`), the user schema, the
  auth-store normalize/public serialization, and preserved across **all** `updateProfile`
  paths (profile save, avatar upload, privacy update, onboarding). New upload route
  `PATCH /api/profile/cover`.
- **Frontend**: `AuthUser.profile.coverImage` + `uploadCover()`; inline cover upload button
  on the `/u` profile page ("Add cover / Change cover").

---

## 10. Community-Mode Dashboard — Real Data Redesign

`frontend/app/dashboard/page.tsx` (previously hardcoded numbers)

- Aggregates **real** data across the communities the user manages: fetches reputation
  summary, memberships, communities, and each managed community's events.
- **Stat cards**: Communities Managed (+verified), Total Members, Events Hosted
  (+registrations), Certificates Issued (+real completion rate).
- **Profile header stats** from the reputation summary (with a memberships fallback).
- New **"Your Communities"** quick-access grid.
- **Upcoming Events** (real, status-aware, falls back to most recent) with working Manage /
  Scanner / Projector links; **Recent Activity** from real membership activity; **Community
  Health** aggregates with a status pill.
- Supporting components refactored to take typed props with empty states:
  `dashboard-upcoming-events.tsx`, `dashboard-activity-feed.tsx`,
  `dashboard-community-health.tsx`.

---

## 11. Bug Fixes

- **Founder/manager could not post as community** — the permission check required
  `status: 'ACTIVE'` via strict equality, which missed legacy membership docs with no
  `status` field. Relaxed to reject only `SUSPENDED/REMOVED/LEFT` (and applied the same to
  the "My communities" feed scope).
- **Member list showed FOUNDER as "MEMBER"** — `FOUNDER` wasn't a `<select>` option; now
  renders a static FOUNDER badge.
- **Cover image covering the profile picture** (community page, `/u`, and home) — the
  `relative` cover banner painted over the non-positioned avatar; fixed with `relative z-10`
  on the content/avatar containers.
- **Students jumping into community mode** when viewing community details — chrome is now
  chosen based on membership.
- **Community-mode "View Community"** opened a stripped-down inline view that didn't
  recognize the owner — now navigates to the full community page.

---

## 12. Admin Frontend — Console & Navigation

The backend admin surface already existed (community verification, recruiter
verification, opportunity moderation, opportunity sync); this adds a central,
role-gated admin front end.

**Frontend**
- `components/guildos/admin-api.ts` — new client for community verification
  (`getPendingCommunities`, `verifyCommunity`, `rejectCommunity`).
- `app/dashboard/admin/page.tsx` — **Admin Console** hub (ADMIN-gated; non-admins see an
  "Admins only" notice). Loads the three live pending queues (communities, recruiters,
  opportunities), shows count stat cards, quick-action tool cards, per-queue previews, and a
  one-click **Sync opportunities** action.
- `components/guildos/dashboard-sidebar.tsx` and `dashboard-mobile-menu.tsx` — added an
  **Administration** section (Admin Console, Recruiter Verification, Opportunity Moderation)
  rendered only for `ADMIN` users. The previously unlinked Moderation page is now reachable.

**Existing admin pages reused** (already real): community verification
(`/dashboard/verification`), recruiter verification (`/dashboard/recruiters`), opportunity
moderation (`/dashboard/moderation`). Backend admin endpoints live under
`/api/admin/communities/*`, `/api/admin/recruiters/*`, and `/api/opportunities/*`
(moderation + sync), all protected by `requireRole('ADMIN')`.

---

## 13. Admin Reports & Analytics (real data)

Replaced the mock Reports page with a real platform-analytics pipeline.

**Backend**
- `services/analytics.service.ts` — `getPlatformAnalytics(months)` aggregates, per month
  (last 8), **attendance** (event check-ins by `checkInAt`), **event growth** (events by
  `createdAt`), **membership growth** (memberships by `joinedAt`), and **certificate
  issuance** (by `issuedAt`) via MongoDB aggregation, plus platform totals (users,
  communities, events, verified certificates, opportunities, total check-ins).
- `routes/admin.analytics.routes.ts` — `GET /api/admin/analytics/overview?months=`
  (`requireRole('ADMIN')`); mounted in `server.ts`.

**Frontend**
- `admin-api.ts` — `getPlatformAnalytics()` + `PlatformAnalytics` type.
- `app/dashboard/reports/page.tsx` — now ADMIN-gated, loads real analytics, renders a totals
  strip (6 metric cards) and the four trend charts from live monthly series (was hardcoded).

---

## 14. Admin — Bootstrap & Role Management

**Admin bootstrap (env-based)**
- `config.ts` — `adminEmail` / `adminPassword` / `adminName` from `ADMIN_EMAIL` /
  `ADMIN_PASSWORD` / `ADMIN_NAME`.
- `services/admin-seed.service.ts` — `seedAdminIfConfigured()`: on startup, creates a
  verified ADMIN with those credentials, or promotes an existing user with that email to
  ADMIN (and verifies the email). Wired into `server.ts`.
- `backend/.env` — added the `ADMIN_*` placeholders (change the password).

**Role management (UI)**
- `store/auth-store.ts` — `searchUsersForAdmin(query)` (returns role, verified, createdAt)
  and `setUserRole(id, role)`.
- `routes/admin.users.routes.ts` — `GET /api/admin/users?search=` and
  `PATCH /api/admin/users/:userId/role` (`requireRole('ADMIN')`; blocks self-demotion);
  mounted at `/api/admin/users`.
- `admin-api.ts` — `searchAdminUsers`, `setUserRole`, `AdminUser` type.
- `app/dashboard/admin/users/page.tsx` — searchable user list with an inline role dropdown
  (Student / Community Leader / Recruiter / Admin); can't change your own role. Linked from
  the Admin Console and the sidebar/mobile "Administration" section.

---

## 15. Notifications Center (Feature 15)

A persisted notification system replacing the old client-side derived bell.

**Backend**
- `models/notification.model.ts` — `notifications` collection (recipient `userId`, `actorId`,
  `type`, `title`, `body`, `link`, `read`), indexed on `{userId, createdAt}` and `{userId, read}`.
- `services/notification.service.ts` — `createNotification` (no-ops on self-notify; never
  throws into the caller), `listNotifications` (cursor paged, resolves actor name/avatar),
  `getUnreadCount`, `markRead`, `markAllRead`.
- `routes/notification.routes.ts` at `/api/notifications` — `GET /`, `GET /unread-count`,
  `POST /read-all`, `POST /:id/read`.
- **Emit triggers** wired into existing flows: post **like** and **comment** notify the post
  author (`feed.service`); **community follow** notifies the founder (`follow.service`);
  **certificate issued** notifies the recipient (`event.service`); **join request approved**
  notifies the requester (`community.service`).

**Frontend**
- `notification-api.ts` — `getNotifications`, `getUnreadCount`, `markNotificationRead`,
  `markAllNotificationsRead`, `AppNotification` type.
- `student-nav.tsx` — real notification **bell** with an unread-count badge (polls every 60s),
  a dropdown of recent items (avatar/type icon, opening marks all read), and a "See all" link.
- `app/notifications/page.tsx` — full notifications page with read/unread styling, mark-all-read,
  and cursor-based "Load more".

---

## 16. Saved Opportunities (Feature 16 — student side)

Saving already existed as an `OpportunityAction` (`SAVED`); this adds a first-class saved
list.
- **Backend**: `opportunity.service.ts#getSavedOpportunities(userId)` + `GET
  /api/opportunities/saved` (defined before `/:id`).
- **Frontend**: `opportunity-api.ts#getSavedOpportunities`; a **Saved** link on the
  opportunities header and a new `app/opportunities/saved/page.tsx` that reuses
  `OpportunityCard` (un-saving drops the item) with an empty state.
- Recruiter "save candidate" is deferred — per-opportunity shortlisting already exists via
  applicant review; a cross-opportunity saved-candidates list would need new infra.

## 18. Platform Search — People (Feature 18)

Extended global search beyond communities/events/opportunities to include **people**.
- **Backend**: `auth-store.ts#searchPublicPeople(query)` (public, non-private profiles with a
  username; returns name/username/avatar/headline) + `GET /api/users/search?q=` (`requireAuth`).
- **Frontend**: `auth-api.ts#searchPeople` + `PersonResult`; the `/search` page now shows a
  **People** group (avatar, name, @username, headline) linking to public profiles.
- Post search is deferred (lower signal / privacy considerations).

---

## 19. AI Reputation Insights (Feature 19)

Makes the Guild Score actionable with human-readable, generated insight lines.
- **Backend**: `models/reputation-snapshot.model.ts` (monthly `{userId, period}` score
  snapshot, unique) + `services/reputation-insights.service.ts#getReputationInsights` which
  upserts the current month's snapshot and derives insights from the reputation breakdown,
  month-over-month delta (from the previous snapshot), next-level gap, and strong opportunity
  matches. Route `GET /api/reputation/insights` (`requireAuth`, self).
  Examples: "Your Guild Score grew 12% (+48) since June.", "Leadership activities drive 48%
  of your Guild Score.", "You're 120 points away from Silver Guild.", "Your profile strongly
  matches 7 open opportunities."
- **Frontend**: `reputation-api.ts#getReputationInsights` + `ReputationInsight`; the
  `/reputation` page shows an **Insights for you** card (linkable items) under the score hero.
- Note: month-over-month growth only appears once there's a prior month's snapshot; the other
  insights work immediately.

---

## 17. Verification Center + View Tracking (Feature 17)

New view-tracking foundation and a student transparency page.
- **Backend**: `models/profile-view.model.ts` (records profile/certificate views with viewer +
  role); `services/profile-view.service.ts` — `recordProfileView` (self-view no-op; when a
  **recruiter** views, creates a throttled "A recruiter viewed your profile" notification, ≤1
  per recruiter/target per 24h), `recordCertificateView`, and `getVerificationCenter`.
- **Hooks**: `GET /api/profile/:username` records a profile view (non-owner);
  `GET /api/certificates/verify/:serial` (now `optionalAuth`) records a certificate view for
  the owner.
- **Route**: `GET /api/verification/center` (`requireAuth`, self) → verified-certificate count,
  total/30-day profile views, recruiter views, certificate checks, and recent viewers
  (recruiter identities shown; others kept anonymous for privacy).
- **Frontend**: `verification-api.ts` + `app/verification/page.tsx` (stat cards + recent-views
  list); linked from the own-profile (`/u`) actions row.

---

## 20. Recruiter Trust Layer (Feature 20)

Most of the trust layer already existed and was surfaced/completed here:
- **Already present**: verified-recruiter badge on opportunity cards and the detail page's
  "Posted by" panel (employer **tier** — Verified Recruiter / Trusted Employer / Top Campus
  Employer — plus successful hires, response rate, active-since), backed by
  `computeRecruiterReputation` and `GET /api/recruiter/public/:userId`.
- **New — report / scam signal**: `models/opportunity-report.model.ts` (one report per
  user/opportunity) + `opportunity.service.ts#reportOpportunity` which counts distinct reports,
  stores `reportCount` on the opportunity, and **auto-flags** it to `FLAGGED` (re-entering the
  admin moderation queue) once ≥3 distinct users report it. Route
  `POST /api/opportunities/:id/report` (`requireAuth`).
- **Frontend**: `opportunity-api.ts#reportOpportunity` (+ `reportCount` on the type); a
  "⚑ Report listing" action on the opportunity detail page; and a report-count badge on the
  admin moderation cards.

---

## 21. Demo Seed (distribution / onboarding)

An idempotent, admin-triggered demo dataset so a fresh install shows the network effect
immediately.
- **Backend**: `services/demo-seed.service.ts#seedDemoData` creates 4 demo students, 2
  verified communities (AI Innovators Club, AgriConnect Society) with founders, cross-
  memberships, 3 published upcoming events, 1 **verified recruiter** (TechFarm Labs) with 2
  auto-verified opportunities, and 3 feed posts. Guarded by a marker account (`demo.ada@…`) so
  re-running is a no-op. Route `POST /api/admin/seed/demo` (`requireRole('ADMIN')`).
- **Frontend**: `admin-api.ts#seedDemoData`; a **Seed demo data** button on the Admin Console
  (with a confirm + result summary).
- Demo accounts use a shared password (`DemoPass!123`) and are email-verified/onboarded.

---

## 22. Connections (mutual) + People You May Know (Feature 22)

Adds the **relationship graph** (people ↔ people) alongside the existing interest graph
(Follow → communities). LinkedIn-style mutual **Connect**, chosen to fit the professional
positioning and to later gate direct messaging.

**Backend**
- `models/connection.model.ts` — `{ requesterId, addresseeId, pairKey (unique), status:
  PENDING|ACCEPTED }`; `connectionPairKey` makes the pair order-independent.
- `services/connection.service.ts` — send/accept/decline/remove, `getConnectionState`
  (NONE/PENDING_OUTGOING/PENDING_INCOMING/CONNECTED/SELF), connection count, **mutual count**,
  list connections, list pending requests, and **getPeopleYouMayKnow** (ranked by shared
  communities, then same-university — real signals, no demo data). Sending to someone who
  already requested you auto-accepts. Emits `CONNECTION_REQUEST` / `CONNECTION_ACCEPTED`
  notifications (Feature 15).
- `routes/connection.routes.ts` at `/api/connections` — list, requests, suggestions,
  state/:userId, request, respond, delete. `notification.model.ts` gained the two types.

**Frontend**
- `connection-api.ts` client.
- `app/connections/page.tsx` — requests, People You May Know, and your connections.
- `ConnectButton` on the public profile (`/profile/[username]`): Connect / Pending·Cancel /
  Accept·Ignore / ✓ Connected, with a **mutual count**.
- **People you may know** card on the home right rail (real cold-start engine).
- Links: "Connections" in the nav avatar menu and the own-profile (`/u`) actions row.
- Connection notification icons in the bell and notifications page.

Next natural step: **connection-gated direct messaging** (only connections — or verified
recruiters — can DM), which closes the biggest remaining product gap.

---

## 23. Public Profile Posts + Recruiter Messaging (Feature 23)

**Other users' profiles now show details AND posts.**
- `components/guildos/feed/user-posts.tsx` — reusable `UserPosts` (reuses `PostCard`,
  `getUserPosts`).
- `app/profile/[username]/page.tsx` — a **Profile / Posts** toggle; Profile shows the reputation
  details, Posts shows the user's own posts.

**Recruiter → candidate messaging** (recruiters/admins only; no student↔student DM yet).
- **Backend**: `models/conversation.model.ts` + `models/message.model.ts`;
  `services/messaging.service.ts` — `startConversation` (recruiter/admin only, upserts a
  conversation), `sendMessage` (participants only, updates unread + emits a `MESSAGE`
  notification), `listConversations`, `getConversation` (marks read), `getUnreadMessageCount`.
  Routes `routes/message.routes.ts` at `/api/messages` (`start` gated by
  `requireRole(['RECRUITER','ADMIN'])`); `notification.model.ts` gained `MESSAGE`.
- **Frontend**: `message-api.ts`; `app/messages/page.tsx` — two-pane conversation list + chat
  thread (mobile shows one pane at a time), read receipts by unread counts, Enter-to-send.
  A recruiter-only **Message** button on the candidate profile opens/creates the conversation.
  "Messages" added to the nav menu; `MESSAGE` notification icon wired into the bell + page.

---

## 24. Connection-Gated Peer Messaging (Feature 24)

Extended messaging from recruiter-only to **connections**, using the mutual graph from
Feature 22 as the DM gate.
- **Backend**: generalized `conversation.model.ts` from `recruiterId`/`candidateId` to a
  symmetric `participants: [ObjectId, ObjectId]` with a unique `pairKey`, a `kind`
  (`RECRUITER` | `PEER`), and per-user `unread` (Map). `messaging.service.ts` rewritten to be
  participant-based; `startConversation(userId, otherId)` now allows the initiator when they're
  a **RECRUITER/ADMIN** *or* **connected** (`getConnectionState === CONNECTED`) — otherwise
  "You can only message your connections". The `/api/messages/start` route dropped the
  recruiter-only role gate (the service enforces the rule).
- **Frontend**: the profile **Message** button now also appears for connected peers (not just
  recruiters); the connections page gained a **Message** action per connection; message-api
  `ConversationSummary` now carries `kind`.

Net effect: recruiters can DM any candidate; students can DM anyone they're connected to.
Spam is naturally gated by the mutual-connection requirement.

---

## 25. Approval-Gated Community Mode (Feature 25)

Community Mode is now **strictly admin-approved** — students can't create/manage communities
until verified.
- **Backend**: user gained `communityAccessStatus` (`NONE`/`PENDING`/`APPROVED`/`REJECTED`) +
  `communityAccessNote` (exposed via `toPublicUser`). `community-access.service.ts` —
  `hasCommunityAccess` (admin, or approved, or grandfathered existing community managers),
  `requestCommunityAccess`, `getMyCommunityAccess`, `listPendingCommunityAccess`,
  `setCommunityAccess` (approve promotes STUDENT→COMMUNITY_LEADER, notifies the user).
  `createCommunity` now rejects without access. Routes: `/api/community-access` (`/me`,
  `/request`) and admin `/api/admin/community-access` (`/pending`, `/:id/approve|reject`).
- **Frontend**: `community-access-api.ts`; the **/dashboard** entry gates on access — users
  without it see a "Community Mode is approval-only" screen (Request / Pending / Rejected
  states) instead of the dashboard. New admin page `app/dashboard/admin/community-access` to
  approve/decline, linked from the admin console (tool card + queue) and the sidebar/mobile
  Administration section.

---

## 26. School-Email Verification for Community Access (Feature 26)

The community-access request is now a **single multi-step form** that verifies the user's
school email via an emailed code before submission.
- **Backend**: user gained `communityAccessEmail`, `communityAccessEmailVerified`,
  `communityAccessEmailCode` (sha256 hash), `communityAccessEmailCodeExpires`. New email
  template `communityAccessCodeEmail` (6-digit code, 15-min expiry). `community-access.service.ts`
  — `sendSchoolEmailCode` (validates email, stores hashed code + expiry, emails it),
  `verifySchoolEmailCode` (checks hash/expiry, marks verified), and `requestCommunityAccess`
  now **requires a verified school email**. `getMyCommunityAccess` and
  `listPendingCommunityAccess` expose `schoolEmail` + `schoolEmailVerified`. Routes:
  `POST /api/community-access/email/send` and `/email/verify`.
- **Frontend**: `community-access-api.ts` gains `sendSchoolEmailCode`/`verifySchoolEmailCode`.
  The **/dashboard** gate now shows a guided form — enter school email → send code → enter
  6-digit code → verify → describe your community role → submit, all at once. The admin
  community-access page shows each request's verified school email with a verified/unverified
  badge.

---

## 27. School-Email Domain Enforcement + Endorsement Submission UI (Feature 27)

- **School-email domain enforcement**: `community-access.service.ts` now runs `isSchoolEmail`
  before sending a code — rejects free/consumer providers (Gmail, Outlook, Yahoo, iCloud,
  Proton, …) and requires an academic domain (`.edu`, `.ac.<cc>`, `.edu.<cc>`, `.sch.<cc>`).
  The dashboard form mirrors the same check for instant feedback. Admin approval is still
  required after verification (a verified email does not auto-grant access).
- **Endorsement submission UI**: verified community leaders can now endorse a `PENDING`
  community directly from its profile. Added `createCommunityEndorsement` /
  `getCommunityEndorsements` clients and an "Endorse this community" form (optional note) in
  the community page's Endorsements panel. Guards: hidden for the founder, for archived or
  non-pending communities, and once the viewer has already endorsed; the backend still
  enforces that only verified community leaders may endorse (`POST
  /api/communities/:id/endorsements`, body `{ note }`). Founders see guidance to collect
  endorsements.

---

## 28. Management Data Scoping + Dedicated Admin Area (Features 28)

- **Leaders only see their own data (#2–#5)**: new `GET /api/communities/managed`
  (`listManagedCommunities`) returns only communities the signed-in user holds a leadership
  role in. The Community-Mode dashboard, `/dashboard/communities`, `/dashboard/events`,
  `/dashboard/members`, and `/dashboard/certificates` now use it instead of fetching every
  community and filtering client-side. Public discovery (`/communities`, search) stays open;
  backend management endpoints were already permission-guarded
  (`listCommunityEventsForManager`, `getCommunityContext` members/join-requests, certificate
  issuing).
- **Login stays in student mode (#1)**: confirmed community-approved users land on `/home`;
  Community Mode remains a deliberate, gated opt-in.
- **Dedicated admin area (#6)**: admin-only pages are consolidated under `/dashboard/admin/*`
  with a distinct layout. New `AdminShell` + `AdminSidebar` (rose "Admin console" theme) and
  an admin `layout.tsx` that guards `role === 'ADMIN'` for the whole subtree. Moved
  `verification`, `recruiters`, and `moderation` under `/dashboard/admin/`; existing admin
  pages (console, users, community-access) now render content-only inside the admin shell.
  The leader dashboard sidebar and mobile menu no longer show admin links or the admin-only
  Verification page — admin tools are fully separated from the community-leader dashboard.

---

## 29. Trust-Anchored Community Verification (Feature 29)

- **Reports separation**: the platform-analytics reports page (admin-only, real
  `getPlatformAnalytics` data) was moved from `/dashboard/reports` into `/dashboard/admin/reports`
  and removed from the community-leader nav — admins reached it through leader chrome before,
  which mixed the two areas.
- **School-email-anchored verification (#7)**: `canCreateCommunity` now derives
  `UNIVERSITY_EMAIL` auto-verification from the founder's **verified school email** on an
  academic domain (`isVerifiedUniversityEmail` uses `communityAccessEmailVerified` +
  `isAcademicEmail`), replacing the hard-coded single-university check.
- **Stronger "verified leader" definition**: `isVerifiedCommunityLeader` now requires proven
  identity — the endorser must have a verified school email **and** hold a leadership role in a
  community that is itself VERIFIED, with an optional **same-university** filter. Self-assigned
  roles alone no longer grant endorsement power.
- **Endorsements as accelerator**: `createCommunityEndorsement` blocks founders from endorsing
  their own community, requires same-university verified leaders, and auto-verifies a community
  once it reaches `ENDORSEMENT_THRESHOLD` (2) endorsements; progress is tracked in
  `verificationNotes` (`n/2 endorsements collected`). Community-page copy updated accordingly.

---

## 30. Verified-Only Visibility + Owner History (Feature 30)

Only verified communities are exposed to students, and rejected/archived ones move to a
separate owner history so the active view stays safe.
- **Public discovery** (`listCommunities`) now returns only `VERIFIED` + `PUBLIC` +
  non-archived communities — pending, rejected, and private communities are never listed for
  students (public `/communities` and search included).
- **Action guards**: joining (`joinCommunity`), following (`toggleFollow`), and hosting events
  (`createEvent`) now require the community to be `VERIFIED` and not archived — pending/rejected
  communities can't be joined, followed, or host events.
- **Owner views split**: `listManagedCommunities` shows only active communities (verified +
  pending); new `listManagedCommunityHistory` returns rejected + archived. New route
  `GET /api/communities/managed/history` and a new owner page
  `/dashboard/communities/history` (linked "View history" from the communities page). Rejected
  communities disappear from the owner's normal list and appear only in history.

---

## 31. Cascade Cleanup on Reject/Archive (Feature 31)

When a community is rejected or archived it is now fully deactivated, not just hidden:
- **`deactivateCommunityContent`** (run by `rejectCommunity` and `archiveCommunity`) deletes the
  community's posts, deletes its followers (resets `followerCount`), removes regular members
  (`status: REMOVED`, keeps leadership for history), drops pending join requests, and
  soft-deletes its events (`deletedAt`). `memberCount` is recalculated.
- **Posting blocked**: `createCommunityPost` now rejects posts unless the community is
  `VERIFIED` and not archived — and any existing posts are removed by the cleanup above.
- Combined with the earlier join/follow/host guards, rejected and archived communities can no
  longer be joined, followed, posted to, or host events, and their existing content is purged.

---

## 32. Reopen Archived Communities + Login Redirect Fix (Feature 32)

- **Reopen archived communities**: new founder-only `reopenCommunity` service +
  `PATCH /api/communities/:id/reopen` route clears the archived flags so the community becomes
  active again under its existing verification status. A "Reopen" button appears on archived
  entries in the owner's `/dashboard/communities/history` page (client
  `reopenCommunity`). Rejected communities still require admin re-verification (not reopenable
  this way).
- **Login redirect fix**: complete-profile, non-recruiter/non-admin users now land on `/home`
  after sign-in. Fixed the Google OAuth `nextRoute` in `oauth.routes.ts` (and the frontend
  callback fallback) which previously defaulted to `/dashboard`; email login already routed to
  `/home`.

---

## 33. Archive = Reversible Soft-Hide (Feature 33)

Archiving is now fully reversible, while rejection stays a permanent purge:
- **Archive no longer purges**: `archiveCommunity` only sets the archived flags — members,
  followers, posts, and events are all retained. `deactivateCommunityContent` (hard purge) now
  runs for `rejectCommunity` only.
- **Content hidden at read time**: `getFeed` excludes posts from archived communities (both
  For-You and Communities scopes) and `listEvents` excludes their events from public listings —
  so an archived community goes dark everywhere, but nothing is destroyed.
- **Reopen restores everything**: because content is retained and only hidden, reopening an
  archived community brings back its members, followers, posts, and events automatically. The
  existing join/follow/host/post guards still block activity while it's archived.

---

## 34. Member-Based & Bulk Certificate Issuance (Feature 34)

The Certificate Center now issues to community members by name/username instead of raw IDs,
validates membership, and supports bulk issuance.
- **Pick members, not IDs**: the "Recipient User ID" text box is gone. After choosing a verified
  community, leaders see a searchable member list (by name or `@username`) with checkboxes, a
  **role filter** (e.g. only VOLUNTEERs), and **Select all**.
- **Membership enforced**: the single `POST /api/certificates` now rejects recipients who aren't
  active members of the community; inactive (removed/left/suspended) members are excluded.
- **Bulk issuance**: new `POST /api/certificates/bulk` (`{ communityId, userIds?, role?, title,
  description }`) issues to many members at once — by explicit selection and/or by role — and
  returns `issued` count plus any `skipped`. Frontend client `issueCertificatesBulk`; the button
  reads "Issue N certificates" and a success summary lists any skips.

---

## 35. Live People Search in Student Nav (Feature 35)

The student-nav search now shows results as you type instead of only navigating on Enter.
- A debounced (250 ms, 2+ chars) live dropdown calls `searchPeople` and lists matching people
  with avatar, name, and `@username`; clicking opens `/u/<username>`. A "See all results" row
  opens the full `/search` page. Backend already matched both `fullName` and `profile.username`
  — the nav simply never surfaced them.

---

## 36. Trust & Safety Watchtower (Feature 36)

An automated, admin-only monitoring surface that proactively flags risk instead of waiting for
reports. All rules are cheap and rule-based (no LLM) for v1.
- **Backend**: `watchtower.service.ts` computes categorized `WatchAlert`s with severity —
  (1) **stale pending communities** (14+ days, no events / few members), (2) **impersonation**
  (a non-verified community reusing the exact name of a verified one, different founder),
  (3) **reciprocal endorsement rings** (two owners endorsing each other's communities),
  (4) **membership bursts** (25+ joins in 24h), and (5) **certificate bursts** (30+ event
  certs by one issuer in 24h). Route `GET /api/admin/watchtower` (admin-only).
- **Frontend**: new `/dashboard/admin/watchtower` page with severity summary cards
  (High/Medium/Low/Total, click to filter), per-alert cards showing signals and a Review link,
  and refresh. Client `admin-watchtower-api.ts`. Linked from the admin sidebar, mobile nav, and
  a console tool card.

---

## 37. Watchtower v2 — Actions, Dismiss/Snooze, Scam Detection, Alerts (Feature 37)

- **Scam-opportunity detector**: a weighted rule-based classifier (`SCAM_PATTERNS`) scans live
  opportunities for scam indicators (upfront fees, untraceable payment, bank/ID requests,
  guaranteed income, off-platform contact, urgency) and raises `OPPORTUNITY` alerts. Structured
  so an LLM classifier can be dropped in later.
- **One-click actions**: alerts now carry `entityType`/`entityId`/`actions`. From the board an
  admin can **Verify/Reject** a community or **Flag/Archive** an opportunity —
  `POST /api/admin/watchtower/action` calls the existing services and auto-dismisses the alert.
- **Dismiss & snooze**: new `WatchAlertState` model + routes (`/:key/dismiss`, `/:key/snooze`,
  `/:key/reopen`). `getWatchtower` computes fresh alerts and overlays state, hiding dismissed and
  actively-snoozed ones (7-day snooze from the UI). Summary now includes a `dismissed` count.
- **Admin notification**: `GET /api/admin/watchtower/summary`; the Admin Console shows a red
  "N high-risk signals need review" banner and a live high-severity count on the Watchtower card.

---

## 38. Post Images + People/Community Tagging (Feature 38)

Feed posts (user and community) can now include an image and tag people or public communities,
including inline `@` tagging while writing.
- **Backend**: `post.model` gains `imageUrl` and a `tags` sub-array (`USER`/`COMMUNITY` refs).
  `createPost`/`createCommunityPost` accept an image + tags; `resolveTags` validates each target
  (users must exist; communities must be public + verified + non-archived) and tagged users get a
  new `MENTION` notification. Feed routes use `upload.single('image')` (5MB, jpg/png/webp) and
  parse a `tags` JSON field. Posts may be image-only (no text required).
- **Frontend**: `createPost`/`createCommunityPost` send `FormData`. New `PostAttachments`
  (photo picker + preview) and `MentionTextarea` — typing `@` opens a live people/community
  autocomplete and inserts the mention inline (e.g. "I attended @DevClub at Abuja"), with
  removable tag chips. `PostCard` renders the image and clickable tag chips (people → `/u/...`,
  communities → `/communities/...`). `MENTION` added to the notification type + a 🏷️ icon.

---

## 39. Gap Fixes — Editing, Load-More, Tag Notifs, Cert Names (Feature 39)

- **Post editing**: new `editPost` service + `PATCH /api/feed/:id` (author-only, text posts).
  The feed post card gets a pencil → inline edit textarea with Save/Cancel.
- **Feed load-more**: the feed now uses the API's `nextCursor` — a "Load more" button appends
  the next page instead of truncating long feeds.
- **Tagged communities notified**: `resolveTags` now also returns tagged communities' owners, and
  `notifyMentioned` sends the founder a `MENTION` notification ("X tagged <community> in a post").
- **Certificate recipient names**: the bulk-issue result now shows each recipient's name in the
  preview (mapped from the community member list) instead of the raw user id.
- **Topbar functional**: the community-dashboard topbar search now navigates to `/search`, the
  bell links to `/notifications` with a live unread badge, and the placeholder avatar/label were
  replaced with the real user initial + a Student-mode link.

Still outstanding (need infrastructure/credentials, not code): real **email delivery** (SMTP/
provider), **WebSocket real-time**, cloud **file storage** (S3/Cloudinary), automated **tests**,
and **error tracking** (Sentry).

---

## Verification

All changes keep both type-check gates green:
- `cd backend; npx tsc --noEmit` → exit 0
- `cd frontend; npx tsc --noEmit` → exit 0
