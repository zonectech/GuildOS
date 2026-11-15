# Kintriva email recommendations

The existing weekly-digest scheduler now runs event/community discovery. It does not send the legacy jobs or reputation digest alongside it.

Students opt in at **Notifications → Settings → Events and communities you might like**. Existing accounts are not silently subscribed. Security, bookings and existing community event alerts keep their separate settings and delivery paths.

- At most one recommendation email per student in any seven-day period, including restarts and overlapping workers. A forced digest call cannot bypass this cap.
- No email without a relevant, available event. Interest/skill phrases and exact school names determine relevance. A short interest such as AI cannot match a substring in “training”.
- Up to three events created in the previous seven days and starting in the next 30 days, plus up to two verified public communities. Private, invite-only, closed, past, cancelled and suspended content is excluded.
- Joined communities, removed/suspended memberships and previously registered events are excluded from discovery. Recent recommendation IDs prevent repeated picks (bounded to 500 IDs per student).
- The per-user window and selected IDs are reserved before SMTP. An ambiguous delivery failure consumes that window rather than risking repeated mail. No automatic immediate retry.
- The footer has a signed unsubscribe link and preference link. GET shows confirmation; POST switches off only recommendations. This also supports List-Unsubscribe one-click POST. No login is needed for a signed unsubscribe link.

## Deployment

Set `BRAND_NAME=Kintriva`, `BRAND_COLOR=#137D78`, `FRONTEND_URL` to the public student website and **`PUBLIC_API_URL` to the publicly reachable backend origin**. The unsubscribe endpoint must be reachable over HTTPS. Configure `EMAIL_FROM` with the Kintriva display name and your verified sending address. SMTP and sender authentication use the existing mail configuration.

Local defaults are for development; they must not be used as public email URLs. HTML previews do not send emails. The scheduler runs only when the backend is running and its database and SMTP are configured.

The template uses inline styles, presentation tables, a single-column mobile layout and plain-text alternatives. Browser previews are provided; Outlook, Gmail and other inbox rendering should be checked with a test account before production rollout.
