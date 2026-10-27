# Community Mode access and external event audit

Scope: real backend organizer routes, current personal approval, membership revocation, Community Mode verification, external attendance imports, public invite-token exposure, and direct dashboard URLs. Tests use the production route and service code with isolated identity/database fixtures. No production database, email provider or deployed host was changed.

## Confirmed gaps fixed

- Appointed COORDINATOR+ managers previously inherited Community Mode through a verified community without personal approval. Current approval is now required, including for appointed managers.
- Organizer routes previously relied on community roles without consistently checking current Community Mode approval. A shared guard now checks a fresh active account, verified primary email and APPROVED access, with the intended administrator exception, before organizer handlers, uploads and AI requests.
- Event-management helpers and actor membership queries now require ACTIVE membership; SUSPENDED, REMOVED and LEFT memberships cannot retain authority. Personal approval still grants no role in another community.
- Public event/community responses no longer reveal organizer-only member data or draft event access merely because a revoked account retains a role label.
- School-email challenges now use cryptographic random codes, hashes bound to the account and address, atomic attempt limits, expiry and one-time consumption. Resends are limited. Verification endpoints use user-based limits so a shared campus IP does not lock out the whole school.
- School-email verification does not grant Community Mode by itself. Approval remains a separate administrator decision, and non-administrators cannot call the approval service successfully.
- Private community invite tokens are excluded from normal database reads. The authorized invitation-email flow explicitly selects the token and enables newly created links.
- Delegated scanner links stop working when their issuing manager loses approval or event-management authority.
- Conditional attendance-import writes prevent a concurrent cancellation, issued certificate or another import from being overwritten silently. Conflicts remain available for review/retry.
- Nested dashboard pages check current access. The dashboard landing page remains available for approval onboarding. Unverified communities remain visible to their approved owners in management lists, with existing restricted-tier capabilities.

## Intended boundaries

Public event/community pages, participant registration, personal event records and member email linking remain participant features; they do not grant organizer access. A delegated scanner link is a restricted event capability, not a Community Mode session.

Community Mode account approval and a community's VERIFIED status are separate. An approved user can manage their own unverified community's permitted features; certificates and paid capabilities retain their separate community-verification checks.

## Remaining deployment and trust work

- These changes are local until deployed to the real backend and frontend. Confirm the deployed build and run smoke tests there before relying on the new policy.
- Rotate existing community invite links after deployment: hiding tokens prevents further exposure but cannot revoke copies that may already have been obtained. Existing legitimate invitation URLs will need to be redistributed after rotation.
- Organizers without personal approval will now need an access request approved, even if they were previously appointed to a role.
- Spreadsheet uploads remain organizer-reported evidence. Identity matching and certificate-rule checks do not authenticate a third-party report. Direct authorized provider connections are a separate future capability.
- Live email delivery, provider permissions and deployment configuration were not validated against production accounts in this audit.

This is a focused code audit and regression test pass, not a guarantee that every part of the application is free of vulnerabilities.

## Regression results

216 backend tests passed across 28 test files, including direct requests against protected organizer routers, personal approval revocation, active membership, school-email challenges, invite-token projection, and attendance import conflict handling.

## Verification request recovery and Google sign-in

The Google v2 userinfo endpoint returns verified_email. The adapter now normalizes that boolean into email_verified for the OAuth callback, preventing verified Google account emails from being left unverified. The callback clears its public account cache before building the returned session, and ordinary email confirmation clears that cache too. Accounts affected by the old Google field mismatch are corrected on a subsequent verified Google sign-in; there is no blanket verification bypass.

School-code request errors now distinguish an unverified account email, a resend cooldown (with retry seconds), an unavailable account, and a delivery failure. Failed SMTP delivery invalidates only its own challenge and resets that challenge’s cooldown. The dashboard provides account-verification resend/recheck actions, restores an active code challenge after reload, shows a resend countdown, and announces successful sends and resends. Code expiry never clears the account email verification flag.

Validation: expired-code resend and Google response-field regressions included in the 246-test suite. Browser checks used isolated sample data and no real email delivery; confirmed the account-email blocker, restored cooldown/code entry, and visible resend-success feedback.
