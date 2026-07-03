# GuildOS Feature PRD — Membership & Role Management

> Status: **Implemented** (backend). Reconciled with the codebase
> (`backend/src/models/membership.model.ts`, `leadership-role.model.ts`,
> `membership-activity.model.ts`, `backend/src/services/community.service.ts`,
> and the `communities` / `memberships` / `roles` / `users` routers).

## Goal
Allow communities to manage members, assign responsibilities, delegate authority, and maintain
organizational structure with accountability and traceability.

---

## Business Objective
Membership is the relationship layer between users and communities. Roles determine who can create
events, manage members, issue certificates, and verify participation. One user can belong to many
communities with a different role in each (one membership per community).

---

## Membership Status
`Membership.status`: `ACTIVE`, `SUSPENDED`, `REMOVED`, `LEFT`.

- Live membership rows are `ACTIVE` or `SUSPENDED`.
- `REMOVED` and `LEFT` are terminal: the membership row is deleted (to preserve the unique
  `{userId, communityId}` index and accurate counters), and the transition is preserved in the
  **MembershipActivity** log (`MEMBER_REMOVED` / `MEMBER_LEFT`) plus closed **LeadershipRole** history.
- A pending join is tracked in the separate `CommunityJoinRequest` collection
  (`PENDING`/`APPROVED`/`REJECTED`), not on the membership.

---

## Joining Methods
Determined by `visibility` (`PUBLIC`/`PRIVATE`) and, for public communities, the `autoApprove` flag.

- **Open (public + `autoApprove`):** `POST /api/communities/:id/join` creates an `ACTIVE` `MEMBER`
  membership immediately (`MEMBER_JOINED`, join request auto-marked `APPROVED`).
- **Approval-based (public, default):** `POST /api/communities/:id/join` creates a `PENDING`
  `CommunityJoinRequest`; leadership (`PRESIDENT`+) approves → `ACTIVE` `MEMBER` (`MEMBER_JOINED`).
- **Invite-only (private):** founder issues a link (`POST /api/communities/:id/invite-link`);
  accepting via `POST /api/communities/join/:token` creates an `ACTIVE` `MEMBER` immediately.

`autoApprove` is set in the creation/edit wizard (Visibility step) and via `POST`/`PATCH` community payloads.

---

## Community Roles
Ranked lowest → highest:

`MEMBER` < `VOLUNTEER` < `COORDINATOR` < `SECRETARY` < `TREASURER` < `VICE_PRESIDENT` < `PRESIDENT` < `FOUNDER`

`MEMBER` is the default; the rest are leadership roles. Role metadata (rank, description,
isLeadership) is served by `GET /api/communities/roles` (and the alias `GET /api/communities/:id/roles`).

---

## Permission Model
Permissions are **rank-based** (`hasCommunityPermission` = at-or-above the required role):

| Capability | Required |
|---|---|
| View public info / join / leave | Authenticated |
| View member list | `COORDINATOR`+ (members-only for private) |
| Suspend / remove members | `VICE_PRESIDENT`+ (and must outrank the target) |
| Assign / change roles | `VICE_PRESIDENT`+ (and must outrank both current and new role) |
| Approve / reject join requests | `PRESIDENT`+ |
| Verify / archive leadership records | `PRESIDENT`+ |
| Edit settings, invite link, archive, delete, transfer ownership | **Founder only** |
| Verify / reject a community | Platform `ADMIN` |

### Role Assignment Rules (enforced)
`updateMemberRole` / `POST /api/memberships/:membershipId/roles` enforce:
- Assigner rank **strictly greater** than the target's current role, **and** strictly greater than
  the new role.
- `FOUNDER` cannot be assigned via role endpoints (only via **Transfer Ownership**).
- The founder's role cannot be changed here.

> This closes a prior privilege-escalation gap where any `PRESIDENT` could assign any role
> (including `FOUNDER`).

> **Capability matrix scope:** the per-role capability lists below (event drafting, announcements,
> report export, financial records, event approval, certificate *verification*) are **product intent**.
> Today only the **rank hierarchy** above is enforced; those feature-specific permissions activate as
> their features ship. Certificate *issuance* is enforced now (`VERIFIED` community + `PRESIDENT`+).

---

## Leadership History & Verification
`LeadershipRole` records are append-only history (never hard-deleted):

```json
{
  "membershipId": "ObjectId",
  "communityId": "ObjectId",
  "userId": "ObjectId",
  "role": "CommunityRole",
  "startDate": "Date",
  "endDate": "Date | null (null = current)",
  "assignedBy": "ObjectId<User> | null",
  "verificationStatus": "PENDING | VERIFIED",
  "createdAt": "Date"
}
```

- On role change: the open record is closed (`endDate = now`) and a new one opened.
- `verificationStatus` is `VERIFIED` when the community is `VERIFIED` at assignment time, else `PENDING`.
- `DELETE /api/roles/:roleId` **archives** (sets `endDate`) rather than deleting, preserving history.
- Recruiters read a user's full history publicly at `GET /api/users/:userId/leadership-history`.

---

## Membership Activity (Audit Log)
`MembershipActivity` records every change for traceability:

Actions: `MEMBER_JOINED`, `MEMBER_LEFT`, `MEMBER_REMOVED`, `ROLE_ASSIGNED`, `ROLE_REMOVED`, `STATUS_CHANGED`.

```json
{ "membershipId": "ObjectId", "communityId": "ObjectId", "action": "String", "actorId": "ObjectId<User> | null", "metadata": "Object", "createdAt": "Date" }
```

---

## Database Models

### Membership
```json
{
  "userId": "ObjectId<User>",
  "communityId": "ObjectId<Community>",
  "role": "MEMBER | VOLUNTEER | COORDINATOR | SECRETARY | TREASURER | VICE_PRESIDENT | PRESIDENT | FOUNDER",
  "status": "ACTIVE | SUSPENDED | REMOVED | LEFT (default ACTIVE)",
  "joinedAt": "Date",
  "assignedBy": "ObjectId<User> | null",
  "invitedBy": "ObjectId<User> | null",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```
Unique compound index: `{ userId, communityId }`.

(See **LeadershipRole** and **MembershipActivity** above.)

---

## API Endpoints

### Communities
- `GET /api/communities/roles` — role catalog (rank, description, isLeadership).
- `POST /api/communities/:id/join` — request/join.
- `POST /api/communities/:id/leave` — leave (founder blocked; logs `MEMBER_LEFT`).
- `GET /api/communities/:id/members` — member list (`COORDINATOR`+).
- `GET /api/communities/roles` and `GET /api/communities/:id/roles` — role catalog.
- `GET /api/communities/:id/activity` — membership/role audit log (`PRESIDENT`+).
- `PATCH /api/communities/:id/members/:memberId/role` — change role (`VICE_PRESIDENT`+, rank-enforced).

### Memberships
- `PATCH /api/memberships/:membershipId/status` — `SUSPENDED` / `ACTIVE` / `REMOVED` (`VICE_PRESIDENT`+, must outrank target).
- `POST /api/memberships/:membershipId/roles` — assign role (rank-enforced).

### Roles (leadership history records)
- `PATCH /api/roles/:roleId` — update `endDate` / `verificationStatus` (`PRESIDENT`+).
- `DELETE /api/roles/:roleId` — archive (end) the record; never hard-deletes (`PRESIDENT`+).

### Users
- `GET /api/users/:userId/leadership-history` — public leadership history for recruiter verification.
- `GET /api/users/:userId/memberships` — a user's own community memberships (self-only, auth required).

---

## Security Rules
- Users can view their own memberships (`GET /api/users/:userId/memberships`, self-only) and leave voluntarily.
- Leaders can manage members strictly **below** their rank.
- Only founders can transfer ownership or delete/archive the community.
- Certificate issuance requires a `VERIFIED` community **and** `PRESIDENT`+ actor (Certificates feature).

---

## Success Criteria
- ✓ Students can join communities (open, approval, invite).
- ✓ Communities can approve members.
- ✓ Leaders can assign responsibilities, with rank-enforced authority.
- ✓ Leadership history is preserved and never hard-deleted.
- ✓ One user can hold different roles across multiple communities.
- ✓ Recruiters can verify leadership experience from public profiles.
- ✓ All membership/role changes are captured in an audit log.

---

## Open Items / Planned
- Feature-specific role permissions (event drafting/approval, announcements, report export,
  treasurer dues/financial records) — activate as those features ship; only rank hierarchy is enforced today.
- Reputation data generation (referenced in the lifecycle) — not yet implemented.
- Optional retention of `REMOVED`/`LEFT` membership rows (currently represented via audit log +
  closed history to preserve the unique index and counters).

### Recently completed
- ✓ Open communities: `autoApprove` flag enables instant `ACTIVE` join (create/edit wizard + API).
- ✓ `GET /api/users/:userId/memberships` (self-only) satisfies the "view own memberships" rule.
- ✓ `GET /api/communities/:id/roles` alias added to match the per-community roles path.
- ✓ Audit log surfaced: `GET /api/communities/:id/activity` + "Recent Activity" dashboard panel (traceability).
- ✓ Membership dashboard (promote/demote/suspend/remove) and public leadership-history display.
