# GuildOS Feature PRD — Community Creation & Management

> Status: **Implemented** (backend). This PRD is reconciled with the current codebase
> (`backend/src/models`, `backend/src/routes`, `backend/src/services/community.service.ts`)
> so it accurately reflects shipped behavior. Where the product intent extends beyond
> what is built, items are marked **(Planned)**.

## Feature Name
Community Creation & Management

## Goal
Allow verified users to create, manage, and grow student communities while maintaining
trust in the GuildOS ecosystem.

---

## Business Objective
Communities are the producers of value inside GuildOS.

Communities create:

- events
- certificates
- leadership opportunities
- participation records

Students consume and contribute to these activities.

---

## User Stories

- As a **student leader**, I want to create a community, so that I can organize members and host events.
- As a **community founder**, I want to manage members and leadership roles, so that responsibilities can be distributed.
- As a **student**, I want to discover communities, so that I can participate in activities relevant to me.
- As a **community founder**, I want to invite people directly via a link, so that private communities can grow without a public request queue.
- As a **verified community leader**, I want to endorse another pending community, so that trustworthy communities reach verification faster.
- As a **GuildOS administrator**, I want to review and verify or reject pending communities, so that only legitimate communities gain official status.

---

## Community Creation Requirements
- Only authenticated users can create communities (`requireAuth`).
- Creators must have approved Community Mode access backed by a verified school email.
- The university must be selected from the administrator-managed institution registry; arbitrary institution names are rejected.
- Automatic university-email verification is fail-closed: the verified email domain must match a domain registered for the selected institution.
- A founder may create at most 2 communities per UTC day, must wait 6 hours between creations, and may manage at most 5 active communities.
- Exact and confusingly similar names are blocked within the same institution. A database unique index closes concurrent duplicate-creation races.
- Names claiming `official`, `verified`, `authorized`, or administrator status and common promotional spam patterns are blocked.
- Successful and blocked creation attempts are written to the administrator audit trail.
- Every new community automatically creates a `FOUNDER` membership for its creator and starts with `memberCount = 1`.
- Verification is driven by a **verification method** chosen at creation time. Supported methods:
  - `UNIVERSITY_EMAIL` — the creator's verified school-email domain is checked against the selected registry institution. A match is immediately `VERIFIED`; a mismatch is downgraded to `PENDING` with method `MANUAL`.
  - `ENDORSEMENT` — community starts `PENDING`; requires at least one endorsement from a verified community leader before an admin can verify it.
  - `MANUAL` — community starts `PENDING` and awaits admin review.
  - If no method is supplied: a verified university email auto-verifies; otherwise it falls back to `PENDING` / `MANUAL`.

### Verification status meanings
- `PENDING` — awaiting verification; cannot issue official certificates.
- `VERIFIED` — trusted; may issue official certificates.
- `REJECTED` — verification denied (with admin notes).

---

## Community Creation Wizard

### Step 1 — Basic Information
Fields:

- Community Name *(required, ≤ 100 chars)*
- Short Description *(required, ≤ 160 chars)*
- Category *(required, free text, ≤ 50 chars)*
- Description *(optional, ≤ 2000 chars)*

Example — Name: `Microsoft Learn Student Ambassadors FUTMINNA`;
Short Description: `Building technical communities through learning and collaboration.`

> Field lengths are validated server-side in `createCommunity` / `updateCommunity`
> (`name` 100, `shortDescription` 160, `description` 2000, `category` 50,
> `university`/`faculty`/`department` 120). Category is intentionally free text (not an enum)
> to match the frontend wizard input.

### Step 2 — Identity
Fields:

- Community Logo — **required**
- Cover Image — optional

Images are uploaded via `POST /api/communities/upload` (multipart, fields `logo` and `coverImage`).
The endpoint returns stored paths (`/uploads/<file>`) that are then saved on the community.

### Step 3 — Academic Scope
Fields:

- University *(required)*
- Faculty *(optional)*
- Department *(optional)*

Example — University: `Federal University of Technology Minna`; Faculty: `Agriculture`;
Department: `Agricultural Economics`.

### Step 4 — Visibility
- **Public** — discoverable; joining creates a **pending join request** that leadership approves.
- **Private** — not joinable via public request; members join **only through an invite link**.

### Step 5 — Verification
- Select a **verification method** (`UNIVERSITY_EMAIL`, `ENDORSEMENT`, or `MANUAL`).
- Display current status: `PENDING`, `VERIFIED`, or `REJECTED`, plus `verificationNotes`.
- Verification determines whether the community can issue official certificates.

---

## Community Profile Page
The profile is served by `GET /api/communities/:slug`, which returns a **context object**:
`community`, `viewerMembership`, `viewerJoinRequest`, `leadership`, `endorsements`,
`members` (only if viewer is `COORDINATOR`+), and `joinRequests` (only if viewer is `PRESIDENT`+).

### Header
Display: Logo, Cover Image, Name, Category, Verification Badge, Member Count, Event Count.

Actions (visibility depends on viewer role/membership):

- Join Community / Request to Join (non-members, public communities)
- Invite Members (founder — manage invite link)
- Edit Community (founder)

### About Section
Displays: Description, University, Faculty, Department, Date Created.

### Leadership Team
Derived from memberships with roles `FOUNDER`, `PRESIDENT`, `VICE_PRESIDENT`, `SECRETARY`, `COORDINATOR`.
Display per leader: Name, Position (role), Join Date, Profile Link.

> Note: "Duration"/term dates are **(Planned)** — the current membership model stores only `joinedAt`.

### Events Section **(Planned integration)**
Displays: Upcoming Events, Completed Events, Attendance Statistics.
`eventCount` exists on the community; full event wiring is owned by the Events feature.

### Members Section
Displays: Member List, Roles, Join Date.
Visible only to `COORDINATOR`+ members (enforced in `getCommunityContext`). Private communities
additionally hide the member list from non-members via `GET /api/communities/:id/members`.

### Join Requests (leadership)
Pending join requests are visible to `PRESIDENT`+ and can be approved or rejected.

### Endorsements
Public list of endorsements from verified community leaders (used for `ENDORSEMENT` verification).

---

## Community Roles
Roles are scoped per community. A user may hold different roles in different communities
simultaneously, but **only one membership (one role) per community** (enforced by a unique
`{userId, communityId}` index).

Roles, from lowest to highest privilege:

`MEMBER` < `VOLUNTEER` < `COORDINATOR` < `SECRETARY` < `VICE_PRESIDENT` < `PRESIDENT` < `FOUNDER`

Example — Taye can be `FOUNDER` in MLSA, `MEMBER` in GDSC, and `COORDINATOR` in AgriConnect AI at the same time.

### Founder vs. Ownership
- `founder` is a single `ObjectId` on the community and is the **owner**.
- There is exactly one `FOUNDER` membership per community.
- Ownership is changed only via **Transfer Ownership**: the new owner's membership is promoted
  to `FOUNDER`, the previous owner is demoted to `PRESIDENT`, and `community.founder` is updated.

---

## Permissions Model
Permissions use a **hierarchical check**: a role satisfies a requirement if it is at or above the
required role in the order above (`hasCommunityPermission(current, required)`).

| Capability | Required |
|---|---|
| View public community info | Anyone |
| Request to join (public) / Join via invite | Authenticated |
| View member list | `COORDINATOR`+ (and members-only for private) |
| View / approve / reject join requests | `PRESIDENT`+ |
| Assign / change member roles | `PRESIDENT`+ |
| Edit community settings | **Founder only** |
| Manage invite link (create/revoke) | **Founder only** |
| Archive community | **Founder only** |
| Delete community | **Founder only** |
| Transfer ownership | **Founder only** |
| Endorse a pending community | Verified community leader (any of `FOUNDER/PRESIDENT/VICE_PRESIDENT/SECRETARY/COORDINATOR` in a verified community) |
| Verify / reject a community | Platform `ADMIN` |

> Certificate issuance rule (**implemented**): when a certificate is issued against a community
> (`POST /api/certificates` with `communityId`), the community must be `VERIFIED` **and** the acting
> user must be a `PRESIDENT`+ member; otherwise the request is rejected with `403`.

---

## Membership & Join Lifecycle

### Public join
`POST /api/communities/:id/join` creates a **`PENDING` join request** (it does **not** grant
membership immediately). Responses:
- already a member → `alreadyMember`
- an existing pending request → `alreadyRequested`
- otherwise → new pending request

Leadership (`PRESIDENT`+) resolves it:
- `PATCH /api/communities/:id/join-requests/:requestId/approve` → creates a `MEMBER` membership, increments `memberCount`, marks request `APPROVED`.
- `PATCH /api/communities/:id/join-requests/:requestId/reject` → marks request `REJECTED`.

### Private / invite join
- Founder creates a link: `POST /api/communities/:id/invite-link` → returns `/communities/join/<token>`.
- Anyone with the link joins immediately: `POST /api/communities/join/:token` → creates a `MEMBER`
  membership, increments `memberCount`, and records an `APPROVED` join request.
- Founder revokes: `DELETE /api/communities/:id/invite-link` (disables the token).
- `POST /api/communities/:id/join` on a **private** community returns `403 Private communities require an invitation`.

### Leaving
`POST /api/communities/:id/leave` removes the membership and decrements `memberCount`.
**The founder cannot leave** (`403`); they must transfer ownership or delete/archive first.

---

## Community Settings
Editable by the founder:

- Community Name, Short Description, Description
- Logo, Cover Image
- Category
- University, Faculty, Department
- Visibility

Verification information (`verificationStatus`, `verificationMethod`, `verificationNotes`) is
read-only to leaders and controlled by the verification workflow / admins.

### Danger Zone (Founder only)
- **Transfer Ownership** — `PATCH /api/communities/:id/ownership`.
- **Archive Community** — `PATCH /api/communities/:id/archive` (soft): sets `archivedAt/By/Reason`,
  disables invite link. Archived communities reject edits, joins, endorsements, and role changes.
- **Delete Community** — `DELETE /api/communities/:id` (hard): removes the community and all its memberships.

---

## Verification Workflow

```
create (method) ──► PENDING ──► (ADMIN verify) ──► VERIFIED
                       │
                       └────── (ADMIN reject) ──► REJECTED
```

- `UNIVERSITY_EMAIL` with a matching institution domain skips `PENDING` and is created `VERIFIED`.
- `ENDORSEMENT` requires ≥ 1 endorsement (from a verified community leader) before an admin can verify.
- Endorsements:
  - `GET /api/communities/:id/endorsements` — public list.
  - `POST /api/communities/:id/endorsements` — verified leaders only; community must be `PENDING`;
    one endorsement per endorser (unique `{communityId, endorserId}`).
- Admin review:
  - `GET /api/admin/communities/pending`
  - `PATCH /api/admin/communities/:id/verify`
  - `PATCH /api/admin/communities/:id/reject`

---

## Database Model

### Community
```json
{
  "name": "String (required)",
  "slug": "String (unique, auto: slugify(name)-<8char>)",
  "shortDescription": "String (required)",
  "description": "String",
  "logo": "String (required)",
  "coverImage": "String",
  "category": "String (required)",
  "university": "String (required)",
  "faculty": "String",
  "department": "String",
  "visibility": "PUBLIC | PRIVATE (default PUBLIC)",
  "autoApprove": "Boolean (default false; PUBLIC + true = open/instant join)",
  "verificationStatus": "PENDING | VERIFIED | REJECTED (default PENDING)",
  "verificationMethod": "UNIVERSITY_EMAIL | ENDORSEMENT | MANUAL | null",
  "verifiedBy": "ObjectId<User> | null",
  "verifiedAt": "Date | null",
  "verificationNotes": "String",
  "founder": "ObjectId<User> (required)",
  "archivedAt": "Date | null",
  "archivedBy": "ObjectId<User> | null",
  "archiveReason": "String",
  "memberCount": "Number (denormalized)",
  "eventCount": "Number (denormalized)",
  "inviteToken": "String",
  "inviteEnabled": "Boolean",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### Membership
```json
{
  "userId": "ObjectId<User> (required)",
  "communityId": "ObjectId<Community> (required)",
  "role": "MEMBER | VOLUNTEER | COORDINATOR | SECRETARY | VICE_PRESIDENT | PRESIDENT | FOUNDER (default MEMBER)",
  "joinedAt": "Date",
  "assignedBy": "ObjectId<User> | null"
}
```
Unique compound index: `{ userId, communityId }`.

### CommunityJoinRequest
```json
{
  "userId": "ObjectId<User> (required)",
  "communityId": "ObjectId<Community> (required)",
  "status": "PENDING | APPROVED | REJECTED (default PENDING)",
  "requestedAt": "Date",
  "resolvedAt": "Date | null",
  "resolvedBy": "ObjectId<User> | null",
  "notes": "String"
}
```
Unique compound index: `{ userId, communityId }`.

### CommunityEndorsement
```json
{
  "communityId": "ObjectId<Community> (required)",
  "endorserId": "ObjectId<User> (required)",
  "note": "String",
  "createdAt": "Date"
}
```
Unique compound index: `{ communityId, endorserId }`.

> Denormalized counters (`memberCount`, `eventCount`) are maintained in the service layer on
> join/leave/approve/invite operations and are not the source of truth.

---

## API Endpoints

Base path: `/api/communities` (admin: `/api/admin/communities`).

### Public
- `GET /api/communities` — list all communities.
- `GET /api/communities/:slug` — community context (profile).
- `GET /api/communities/:id/endorsements` — list endorsements.

### Authenticated
- `POST /api/communities` — create community.
- `POST /api/communities/upload` — upload `logo` / `coverImage` (multipart).
- `PATCH /api/communities/:id` — update settings *(founder)*.
- `DELETE /api/communities/:id` — hard delete *(founder)*.
- `PATCH /api/communities/:id/archive` — soft archive *(founder)*.
- `POST /api/communities/:id/invite-link` — create invite link *(founder)*.
- `DELETE /api/communities/:id/invite-link` — revoke invite link *(founder)*.
- `POST /api/communities/join/:token` — join via invite link.
- `POST /api/communities/:id/join` — request to join (public) / rejected for private.
- `POST /api/communities/:id/leave` — leave (founder blocked).
- `GET /api/communities/:id/members` — list members (`COORDINATOR`+; hidden for private non-members).
- `PATCH /api/communities/:id/members/:memberId/role` — change role *(`PRESIDENT`+)*.
- `PATCH /api/communities/:id/ownership` — transfer ownership *(founder)*.
- `GET /api/communities/:id/join-requests` — list pending requests *(`PRESIDENT`+)*.
- `PATCH /api/communities/:id/join-requests/:requestId/approve` — approve *(`PRESIDENT`+)*.
- `PATCH /api/communities/:id/join-requests/:requestId/reject` — reject *(`PRESIDENT`+)*.
- `POST /api/communities/:id/endorsements` — endorse *(verified leader; community must be `PENDING`)*.

### Admin
- `GET /api/admin/communities/pending` — list pending communities *(`ADMIN`)*.
- `PATCH /api/admin/communities/:id/verify` — verify *(`ADMIN`)*.
- `PATCH /api/admin/communities/:id/reject` — reject *(`ADMIN`)*.

---

## Success Criteria
- ✓ Authenticated users can create communities (auto `FOUNDER` membership).
- ✓ Communities can be discovered (list + profile by slug).
- ✓ Public join requests can be submitted, approved, and rejected by leadership.
- ✓ Private communities grow through invite links.
- ✓ Leadership roles can be assigned by `PRESIDENT`+.
- ✓ Ownership can be transferred; founders cannot silently abandon a community.
- ✓ Communities can be archived (soft) or deleted (hard) by the founder.
- ✓ Verification supports university-email auto-verify, endorsements, and manual admin review.
- ✓ Verified communities are eligible to issue official certificates.

---

## Open Items / Planned
- Leadership **term / duration** fields (currently only `joinedAt`).
- Full **Events section** wiring and attendance statistics on the profile.
- Additional university-email domain mappings beyond FUTMINNA.

### Recently completed
- ✓ **Max-length validation** at the API boundary (create/update); category kept as free text.
- ✓ **Certificate issuance enforcement** combining community `VERIFIED` status with `PRESIDENT`+ role.
