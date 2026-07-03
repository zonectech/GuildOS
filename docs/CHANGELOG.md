# GuildOS — Changelog (Social, Community, Profile & Dashboard)

> Record of work completed on the social feed, community experience, profiles, cover
> images, and the community-mode dashboard. Continues from the feature PRDs and
> `BACKLOG.md`. Dated 2026-07-03.

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

## Verification

All changes keep both type-check gates green:
- `cd backend; npx tsc --noEmit` → exit 0
- `cd frontend; npx tsc --noEmit` → exit 0
