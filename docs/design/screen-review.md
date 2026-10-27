# GuildOS interface refresh

Local review only. This design pass has not been deployed.

Shared system: Inter typography, compact navigation, 8–12px panels, flat page surfaces, restrained indigo actions, quiet scrollbars and visible focus indicators. Semantic status colours, user media, chart encodings, certificate artwork and exported CV layouts remain distinct.

Source-level styling coverage is not an end-to-end browser test of each protected flow.

## Route inventory

- `/` — shared visual system applied; role/data-dependent browser review pending.
- `/account` — shared visual system applied; role/data-dependent browser review pending.
- `/certificates/[serial]` — shared visual system applied; role/data-dependent browser review pending.
- `/communities` — shared visual system applied; role/data-dependent browser review pending.
- `/communities/[slug]` — shared visual system applied; role/data-dependent browser review pending.
- `/communities/[slug]/leaders` — shared visual system applied; role/data-dependent browser review pending.
- `/communities/[slug]/leaders/certificates` — shared visual system applied; role/data-dependent browser review pending.
- `/communities/[slug]/people` — shared visual system applied; role/data-dependent browser review pending.
- `/communities/join/[token]` — shared visual system applied; role/data-dependent browser review pending.
- `/connections` — shared visual system applied; role/data-dependent browser review pending.
- `/cv` — shared visual system applied; role/data-dependent browser review pending.
- `/cv/verify/[verificationId]` — shared visual system applied; role/data-dependent browser review pending.
- `/dashboard` — shared visual system applied; role/data-dependent browser review pending.
- `/dashboard/admin` — shared visual system applied; role/data-dependent browser review pending.
- `/dashboard/admin/audit` — shared visual system applied; role/data-dependent browser review pending.
- `/dashboard/admin/broadcast` — shared visual system applied; role/data-dependent browser review pending.
- `/dashboard/admin/communities` — shared visual system applied; role/data-dependent browser review pending.
- `/dashboard/admin/community-access` — shared visual system applied; role/data-dependent browser review pending.
- `/dashboard/admin/content` — shared visual system applied; role/data-dependent browser review pending.
- `/dashboard/admin/inactive` — shared visual system applied; role/data-dependent browser review pending.
- `/dashboard/admin/moderation` — shared visual system applied; role/data-dependent browser review pending.
- `/dashboard/admin/moderation/statuses` — shared visual system applied; role/data-dependent browser review pending.
- `/dashboard/admin/recruiters` — shared visual system applied; role/data-dependent browser review pending.
- `/dashboard/admin/reports` — shared visual system applied; role/data-dependent browser review pending.
- `/dashboard/admin/sponsorship` — shared visual system applied; role/data-dependent browser review pending.
- `/dashboard/admin/tickets` — shared visual system applied; role/data-dependent browser review pending.
- `/dashboard/admin/users` — shared visual system applied; role/data-dependent browser review pending.
- `/dashboard/admin/verification` — shared visual system applied; role/data-dependent browser review pending.
- `/dashboard/admin/watchtower` — shared visual system applied; role/data-dependent browser review pending.
- `/dashboard/certificates` — shared visual system applied; role/data-dependent browser review pending.
- `/dashboard/communities` — shared visual system applied; role/data-dependent browser review pending.
- `/dashboard/communities/[slug]/edit` — shared visual system applied; role/data-dependent browser review pending.
- `/dashboard/communities/create` — shared visual system applied; role/data-dependent browser review pending.
- `/dashboard/communities/history` — shared visual system applied; role/data-dependent browser review pending.
- `/dashboard/events` — shared visual system applied; role/data-dependent browser review pending.
- `/dashboard/events/attendees` — shared visual system applied; role/data-dependent browser review pending.
- `/dashboard/events/create` — shared visual system applied; role/data-dependent browser review pending.
- `/dashboard/events/hackathon` — shared visual system applied; role/data-dependent browser review pending.
- `/dashboard/events/projector` — shared visual system applied; role/data-dependent browser review pending.
- `/dashboard/events/scanner` — shared visual system applied; role/data-dependent browser review pending.
- `/dashboard/members` — shared visual system applied; role/data-dependent browser review pending.
- `/dashboard/moderation` — shared visual system applied; role/data-dependent browser review pending.
- `/dashboard/playbook` — shared visual system applied; role/data-dependent browser review pending.
- `/dashboard/premium` — shared visual system applied; role/data-dependent browser review pending.
- `/dashboard/settings` — shared visual system applied; role/data-dependent browser review pending.
- `/dashboard/wallet` — shared visual system applied; role/data-dependent browser review pending.
- `/docs` — shared visual system applied; role/data-dependent browser review pending.
- `/events` — shared visual system applied; role/data-dependent browser review pending.
- `/events/[slug]` — shared visual system applied; role/data-dependent browser review pending.
- `/events/[slug]/hackathon` — shared visual system applied; role/data-dependent browser review pending.
- `/events/[slug]/sponsor-report` — shared visual system applied; role/data-dependent browser review pending.
- `/events/saved` — shared visual system applied; role/data-dependent browser review pending.
- `/for-clubs` — shared visual system applied; role/data-dependent browser review pending.
- `/forgot-password` — shared visual system applied; role/data-dependent browser review pending.
- `/hackathon/judge/[token]` — shared visual system applied; role/data-dependent browser review pending.
- `/home` — shared visual system applied; role/data-dependent browser review pending.
- `/login` — shared visual system applied; role/data-dependent browser review pending.
- `/messages` — shared visual system applied; role/data-dependent browser review pending.
- `/my-events` — shared visual system applied; role/data-dependent browser review pending.
- `/notifications` — shared visual system applied; role/data-dependent browser review pending.
- `/oauth/google/callback` — shared visual system applied; role/data-dependent browser review pending.
- `/opportunities` — shared visual system applied; role/data-dependent browser review pending.
- `/opportunities/[id]` — shared visual system applied; role/data-dependent browser review pending.
- `/opportunities/saved` — shared visual system applied; role/data-dependent browser review pending.
- `/portfolio/[username]` — shared visual system applied; role/data-dependent browser review pending.
- `/portfolio/kolawole-abubakar-abiodun` — shared visual system applied; role/data-dependent browser review pending.
- `/posts/[id]` — shared visual system applied; role/data-dependent browser review pending.
- `/privacy` — shared visual system applied; role/data-dependent browser review pending.
- `/profile` — shared visual system applied; role/data-dependent browser review pending.
- `/profile-setup` — shared visual system applied; role/data-dependent browser review pending.
- `/profile/[username]` — shared visual system applied; role/data-dependent browser review pending.
- `/recruiter` — shared visual system applied; role/data-dependent browser review pending.
- `/recruiter/signup` — shared visual system applied; role/data-dependent browser review pending.
- `/reputation` — shared visual system applied; role/data-dependent browser review pending.
- `/reset-password` — shared visual system applied; role/data-dependent browser review pending.
- `/resume/[username]` — shared visual system applied; role/data-dependent browser review pending.
- `/scan/[token]` — shared visual system applied; role/data-dependent browser review pending.
- `/search` — shared visual system applied; role/data-dependent browser review pending.
- `/signup` — shared visual system applied; role/data-dependent browser review pending.
- `/signup-success` — shared visual system applied; role/data-dependent browser review pending.
- `/sponsors` — shared visual system applied; role/data-dependent browser review pending.
- `/status` — shared visual system applied; role/data-dependent browser review pending.
- `/status/[id]` — shared visual system applied; role/data-dependent browser review pending.
- `/status/new` — shared visual system applied; role/data-dependent browser review pending.
- `/support` — shared visual system applied; role/data-dependent browser review pending.
- `/terms` — shared visual system applied; role/data-dependent browser review pending.
- `/u/[username]` — shared visual system applied; role/data-dependent browser review pending.
- `/verification` — shared visual system applied; role/data-dependent browser review pending.
- `/verify-email` — shared visual system applied; role/data-dependent browser review pending.

## Verification completed

- Frontend type check passed after the broad visual changes (before final drawer improvements).
- Browser: organizer preview at 390px had no horizontal overflow.
- Browser: desktop admin preview had one sidebar and no horizontal overflow.
- Browser: public landing page rendered without horizontal overflow.
- Browser: sign-in password visibility control worked.
- Browser: light/dark switching worked in organizer preview; both screenshots saved.
- Preview uses labelled sample content and normal access checks on real-page links. Production returns 404 for the preview route.

Final frontend type check passed, including the mobile drawer focus and Escape-key changes.

Production build passed: all 75 static pages generated and dynamic routes compiled successfully. No backend logic or live data was modified by this visual pass.
