/**
 * GuildOS capabilities manifest — the SINGLE SOURCE OF TRUTH for what the in-app
 * assistant (GuildBot / Guild Captain) knows about the product.
 *
 * WHY THIS FILE: the assistant answers from a prompt, not from reading source code
 * (that would be a security risk, expensive, and full of implementation noise that
 * isn't user-facing). Instead, describe every USER-FACING capability here in plain
 * language. The system prompts are built from this list, so keeping the assistant
 * current is a one-file edit — add/adjust a bullet here when you ship a feature.
 *
 * KEEP IT: user-facing ("what can I do" + the page path), accurate, and concise.
 * LEAVE OUT: internal services, DB models, secrets, half-built/experimental features.
 */

export type CapabilityAudience = 'student' | 'leader';

export type Capability = {
  /** Short feature name, e.g. "Home feed". */
  area: string;
  /** Primary page path, e.g. "/home" (omit if not a single page). */
  path?: string;
  /** One or two plain-language sentences describing what the user can do. */
  detail: string;
  /**
   * Optional long-form help article (markdown) for the GuildOS Help hub / docs page.
   * When present, seed-help-hub.ts uses it as the article body instead of `detail`.
   * Assistant prompts always use `detail` only — keep `detail` concise.
   */
  guide?: string;
};

/** Things any signed-in student can do. */
export const STUDENT_CAPABILITIES: Capability[] = [
  {
    area: 'Home feed',
    path: '/home',
    detail:
      'See posts from communities you have joined or follow, plus suggestions. You CAN create your own posts ' +
      '(text and images), attach a poll (2-6 options) for others to vote on, like, comment and reply (threaded), and ' +
      'repost/share. Sort the feed by New, Top or Hot. A Trending panel highlights hot events and fast-growing communities.',
    guide: [
      'Your home feed at /home shows posts from communities you have joined or follow, plus suggested content.',
      '',
      '## Posting',
      '- Write a post from the composer at the top — text, with optional images.',
      '- Attach a **poll** to any post: 2–6 options, one vote per person. Voters can change or retract their vote; results show live percentages.',
      '- Like posts, comment, and reply to comments (replies are threaded one level deep).',
      '- Repost to share something with your own followers.',
      '',
      '## Sorting the feed',
      '- **New** — most recent first.',
      '- **Top** — most liked and commented over the last week.',
      '- **Hot** — a mix of engagement and freshness over the last two weeks.',
      '- Tap an active sort pill again to return to the default ranked feed.',
      '',
      '## Trending',
      'The Trending panel on the right highlights upcoming events with the most registrations and communities growing fastest this week.',
      '',
      '## Milestones',
      'Some achievements (like earning a certificate or being appointed to a leadership role) automatically appear on the feed as milestone cards.',
    ].join('\n'),
  },
  {
    area: 'Events',
    path: '/events',
    detail:
      'Discover and register/RSVP for events — some are instant, some need organizer approval; multi-day events let ' +
      'you pick which days you will attend, and some events have parallel sections/tracks (e.g. Data Science vs Coding) ' +
      'where you pick exactly one at registration (you can switch later if there is space). You get a QR pass, and ' +
      'attendance is verified by checking IN and OUT at the event (online events reveal their meeting link at check-in). ' +
      'See your registrations at /my-events, save events for later (/events/saved), and subscribe your phone calendar ' +
      'once from /my-events ("Subscribe in calendar") so every registered event syncs automatically. On paid events, ' +
      'sharing from the event page gives you a personal referral link — tickets bought through it are credited to you on ' +
      'the organizer\'s sales card. Event pages show the agenda, speakers, sponsors, partners, contacts and post-event ratings.',
    guide: [
      'Browse events at /events — filter by type, and by status (Upcoming & Live, Ended, Cancelled).',
      '',
      '## Registering',
      '- **Free events**: tap Register. Some events are instant; others need organizer approval (you will get a notification when approved).',
      '- **Multi-day events**: pick which days you plan to attend with the day picker. This is informational — it never blocks your check-in.',
      '- **Sectioned events**: some events run parallel tracks (e.g. "Data Science" vs "Coding") with their own trainers, venues and seat caps. You pick exactly ONE section when registering and follow it for the whole event — shared sessions (like a joint opening keynote) are marked for everyone. If your section is full you can join its waitlist or pick another, and you can switch sections later from the event page while space allows.',
      '- **Invite-only events**: you need the invite link from the organizers.',
      '- If an event is full and has a waitlist, you can join it — you are promoted automatically when a spot opens (with a notification).',
      '',
      '## Your QR pass and attendance',
      '- After registering you get a personal QR pass on the event page (also emailed for paid tickets).',
      '- Attendance is verified by scanning IN when you arrive and OUT when you leave — both scans matter for certificates.',
      '- Online events reveal their meeting link once you check in.',
      '- On multi-day events, the same QR pass works every day.',
      '',
      '## Managing your events',
      '- /my-events lists everything you are registered for, plus events saved for later.',
      '- Save any event with the bookmark button; find saved ones at /events/saved.',
      '- "Subscribe in calendar" on /my-events gives you a personal calendar link — add it once to Google Calendar or your phone and every registered event stays in sync.',
      '- "Add to calendar" on an event page downloads that single event (multi-day events export one entry per day).',
      '',
      '## Cancelling',
      'You can cancel a registration from the event page or /my-events (you will be asked why). If the organizers cancel the event or a specific day, you are notified — and paid tickets are refunded automatically. Postponed events keep your registration and ticket valid; you are notified when the new date is announced.',,
      '',
      '## After the event',
      'If you checked in, you can rate the event (1-5 stars with an optional comment) once it ends. Multi-day events are rated day by day — each day\'s rating opens as soon as that day ends, so organizers can improve the very next day.',
    ].join('\n'),
  },
  {
    area: 'Tickets & paid events',
    detail:
      'Some events are paid — buy a ticket right on the event page (card, bank transfer, or USSD). Pick a ticket type ' +
      '(tiers), apply a promo code, or buy multiple tickets at once and share guest links with friends. Your ticket is a ' +
      'personal QR pass, also emailed to you as a designed ticket image. You can transfer an unused ticket to someone else, ' +
      'and refunds are automatic if the event is cancelled.',
    guide: [
      'Paid events show a ticket panel on the event page instead of a plain Register button.',
      '',
      '## Buying a ticket',
      '1. Pick a ticket type if the event has several (some tiers cover only specific days of a multi-day event, or a specific section/track — this is shown on the tier; your ticket registers you into that track).',
      '2. Choose a quantity (up to 10). Some events give a group discount when you buy enough tickets — the page tells you.',
      '3. Have a promo code? Enter it and press Apply — the total updates immediately. If a group discount is bigger than your promo, the bigger discount is used (they never stack).',
      '4. Tap "Get ticket" — you are taken to a secure payment page that accepts cards, bank transfer, and USSD.',
      '5. After paying you are brought back and confirmed automatically. If your payment went through but nothing changed (closed tab, network), use "Already paid? Check payment status" on the event page — it re-verifies and applies your payment instantly. Buying again never double-charges.',
      '',
      '## Your ticket',
      '- Your ticket is a personal QR pass shown on the event page — you can also download it as a designed ticket card image.',
      '- A receipt with the ticket image attached is emailed to you.',
      '',
      '## Buying for friends (group buy)',
      'When you buy more than one ticket, the extras become guest links under "Your guest tickets" on the event page. Send a link to each friend — opening it gives them their own registration and personal QR pass. If a guest cancels, the link becomes reusable.',
      '',
      '## Transferring a ticket',
      "Can't make it? Use \"Transfer this ticket\" on your QR pass section to hand your ticket to another GuildOS user (by email or username) — before it has been used.",
      '',
      '## Refunds',
      'If the organizers cancel the event (or the specific days your ticket covers), your money is refunded automatically to your original payment method and you are notified. Cancelling your own registration does not refund the ticket.',
    ].join('\n'),
  },
  {
    area: 'Communities',
    path: '/communities',
    detail:
      'Browse, follow, or join student communities (some need a join request or an access code). Each community page ' +
      'has Profile, Posts, and a Knowledge tab — a Knowledge Hub of guides, tutorials, past questions and resources. ' +
      'If you run one, manage it in Community Mode at /dashboard.',
    guide: [
      'Find communities at /communities or via /search.',
      '',
      '## Following vs joining',
      '- **Follow** any public community to see its posts in your feed — no approval needed.',
      '- **Join** to become a member. Depending on the community this is instant, needs a join request approved by leaders, or needs an access code they share with you.',
      '- Leave a community anytime from the /communities page (hover the Joined badge).',
      '',
      '## The community page',
      '- **Profile** — description, rules, upcoming events, the leadership team, and member analytics.',
      '- **Posts** — the community feed; members can post, leaders can pin.',
      '- **Knowledge** — the Knowledge Hub: guides, tutorials, documentation, past questions and useful links published by the community.',
      '- **Chat links & channels** — once you are a member, the community\'s chat buttons appear in the About section: WhatsApp, Discord, Telegram, Slack, or other platforms (a community can list up to 5). Broadcast channel links are visible to everyone.',
      '',
      '## Verified vs unverified communities',
      '- A blue badge means GuildOS verified the community (via a matching university email or an endorsement letter).',
      '- Communities with an amber **Unverified** tag are real but not yet verified: you can follow, join, and attend their **free** events, but they cannot issue certificates, award Guild Score points, assign leadership roles, or sell tickets until they verify.',
      '',
      '## Leadership team',
      'Communities list their leadership with session-specific titles (e.g. "President — 2026/2027 Session"). Past leadership sessions and their leadership certificates are viewable on the community\'s Leaders page.',
      '',
      '## Running your own',
      'Create a community from /dashboard/communities/create. Management (members, events, certificates, wallet) happens in Community Mode at /dashboard.',
    ].join('\n'),
  },
  {
    area: 'Certificates',
    path: '/certificates',
    detail:
      'Earned automatically when you complete an event with verified attendance. View, download and share them; each ' +
      'has a public verification link and also appears on your profile.',
    guide: [
      'Certificates on GuildOS are issued by real communities and are verifiable — every certificate has a unique serial number, a public verification link, and a QR code.',
      '',
      '## Earning a certificate',
      '- Attend an event that issues certificates: register, check IN at the door, and check OUT when it ends.',
      '- Multi-day events may require a minimum number of days attended — the certificate then shows "Attended: N of M days".',
      '- Once the organizers finalize the event, your certificate is issued automatically and you are notified by bell and email.',
      '- Leadership certificates are issued by your community when a leadership session ends.',
      '',
      '## Viewing and sharing',
      '- Find your certificates on /my-events and on your public profile.',
      '- Each certificate page lets you download it as an image and share to LinkedIn, WhatsApp, or X.',
      '- Anyone with the link (or scanning the QR) sees the live verification page — if a certificate was revoked by its issuer, the page says so.',
      '',
      '## Trust',
      'Certificates cannot be edited by the holder. The verification page always reflects the current status, so a screenshot can never fake one.',
    ].join('\n'),
  },
  {
    area: 'Guild Score & reputation',
    path: '/reputation',
    detail:
      'Attendance, completion, leadership and certificates earn points, levels (Explorer → Bronze → Silver → Gold → ' +
      'Platinum → Elite) and badges.',
    guide: [
      'Your Guild Score is a single number that grows with verified activity — visible at /reputation.',
      '',
      '## How you earn points',
      '- Attending and completing events (verified by QR check-in/out).',
      '- Earning certificates.',
      '- Holding leadership roles and serving full leadership terms.',
      '- Organizing: hosting events, publishing knowledge, securing sponsorships and partnerships.',
      '',
      '## Levels',
      'Points move you through levels: Explorer → Bronze → Silver → Gold → Platinum → Elite.',
      '',
      '## Badges and insights',
      'The reputation page shows badges you have unlocked and personalised insights on how to grow. Your score also appears on your public profile and CV — it is one of the signals recruiters see.',
    ].join('\n'),
  },
  {
    area: 'CV & profile',
    detail:
      'Generate a verifiable CV at /cv; your public profile (/u/your-username) shows your posts, profile and certificates. ' +
      'Edit details, availability, career preferences, skills and privacy at /account. You can also add self-reported ' +
      'external credentials (with file uploads) that appear on your profile and CV, clearly marked as self-reported.',
    guide: [
      'GuildOS turns your verified activity into a professional identity.',
      '',
      '## Your public profile',
      '- Lives at /u/your-username with tabs for Posts, Profile, and Certificates.',
      '- Shows your academic details, interests, skills, social links, and verified certificates.',
      '- Control what is visible (including certificate visibility) from /account privacy settings.',
      '',
      '## Skills and credentials',
      '- Add your skills at /account — they appear on your profile and flow into your CV.',
      '- Add "Other credentials" for certificates earned outside GuildOS (upload the file, name the issuer). These appear on your profile and CV clearly marked as self-reported — never presented as GuildOS-verified.',
      '',
      '## The verifiable CV',
      '1. Go to /cv and generate — your verified certificates, leadership roles, event history, Guild Score, skills, and credentials are assembled automatically (with optional AI polish).',
      '2. Every CV gets a public verification link a recruiter can open to confirm it against live GuildOS records.',
      '3. Your activity keeps growing after you share the link — when the CV goes stale, you get a notification and a "Refresh" button updates the content while the link stays the same.',
      '4. Export as text (ATS-friendly) or DOCX.',
    ].join('\n'),
  },
  {
    area: 'Opportunities',
    path: '/opportunities',
    detail: 'Internships and jobs matched to your verified profile, each with the reasons it matches.',
    guide: [
      'The /opportunities page lists internships and jobs matched to your verified profile.',
      '',
      '- Each opportunity shows **why** it matches you (your skills, interests, activity).',
      '- Save opportunities for later at /opportunities/saved.',
      '- Set your availability and career preferences at /account so matching improves.',
      '- Apply through the opportunity page — your verified GuildOS profile does the talking.',
    ].join('\n'),
  },
  {
    area: 'Connections, messages & search',
    detail:
      'Connect with people at /connections and chat at /messages. The notification bell (/notifications) alerts you to ' +
      'reminders, approvals and earned certificates. Search people, communities, events and knowledge at /search. ' +
      'You can block or report anyone from a chat if needed.',
    guide: [
      '## Connections',
      'Send connection requests from profiles or /connections. Once connected you can message each other directly.',
      '',
      '## Messages',
      '- Chat at /messages — conversations with connections, plus community threads.',
      '- **Safety**: from any chat menu you can Block (they can no longer message you, and it is not revealed to them) or Report a user to GuildOS admins.',
      '',
      '## Notifications',
      'The bell (/notifications) collects everything: event reminders (including a last-call an hour before start), registration approvals, certificates earned, waitlist promotions, venue or date changes, cancellations, and ticket receipts. Realtime while you are online, email for the important ones.',
      '',
      '## Search',
      '/search finds people, communities, events, and Knowledge Hub articles across all public communities.',
    ].join('\n'),
  },
  {
    area: 'GuildBot assistant & docs',
    path: '/docs',
    detail:
      'The floating GuildBot assistant answers from live GuildOS records — real event dates, venues and status, whether ' +
      'YOU are registered for an event, your Guild Score, communities and certificates — plus community Knowledge Hubs. ' +
      'It cannot take actions for you (register, cancel, post); it tells you exactly where to do it yourself. Full written ' +
      'guides live at /docs.',
    guide: [
      'GuildBot is the floating assistant in the bottom-right corner of every page (Guild Captain while you are in Community Mode).',
      '',
      '## What it can answer',
      '- **Live event facts** — dates, venues, status ("when is Tech Week holding?") straight from real event records.',
      '- **Your own records** — whether you are registered for an event, your Guild Score and level, your communities, your recent certificates.',
      '- **How-to questions** — grounded in community Knowledge Hubs first (it cites the community), then general GuildOS guidance.',
      '',
      '## What it cannot do',
      'It never performs actions on your behalf — it will not register, cancel, or post for you. Instead it points you to the exact page and steps.',
      '',
      '## Written documentation',
      'Prefer reading? /docs has the full platform guides for both students and community leaders, searchable by topic.',
    ].join('\n'),
  },
];

/** Things a community leader can do from Community Mode (/dashboard). */
export const LEADER_CAPABILITIES: Capability[] = [
  {
    area: 'Community setup & verification',
    detail:
      'Get Community Mode access (verify your school email, or explain your role for admin review if you don\u2019t have one), ' +
      'then create a community (name, description, category, school, rules, and chat links — WhatsApp, Discord, Telegram, Slack, or other; up to 5). Each community is verified ' +
      'instantly via a matching university email, or by uploading an endorsement letter from a recognized leader for admin ' +
      'review — or skip verification and start unverified with limited features (no certificates, points, leadership roles, or paid events). ' +
      'Edit details at /dashboard/settings. Premium (a monthly plan or a one-off per-event unlock) unlocks ' +
      'certificate customization.',
    guide: [
      '## Step 1 — Get Community Mode access (once per account)',
      'Creating communities is approval-only. From /dashboard, request access:',
      '- **With a school email** — verify it with a 6-digit code (academic domains only; free providers like Gmail are not accepted), add a short note, and submit.',
      '- **Without a school email** (student ambassadors, organizational leaders) — explain who you are in the note: your role, which community you represent, and how we can confirm it.',
      'A GuildOS admin reviews every request and you are notified when approved.',
      '',
      '## Step 2 — Create the community',
      'Go to /dashboard/communities/create — set the name, descriptions, category, logo, your institution (from the verified registry), and at least one **chat link** where members reach you: WhatsApp, Discord, Telegram, Slack, or any other https:// link. You can add up to 5 links across platforms; group links are only shown to members.',
      '',
      '## Step 3 — Verify the community',
      'Pick one of three routes in the wizard:',
      '- **University email (instant)** — if your verified school email matches the selected institution, the community is verified immediately.',
      '- **Endorsement letter** — upload a signed letter (PDF or photo) from a recognized leader: a professor, political office holder, SUG or MSSN leader, or other known institutional/organizational leadership. A GuildOS admin reviews it.',
      '- **Skip for now (unverified)** — no email or letter needed. Members can join and follow and you can host free events, but certificates, reputation points, leadership roles, and paid tickets stay locked until you verify. Great for getting started; verify any time later.',
      'Ambassador or organizational emails cannot prove an institution, so they use the endorsement letter route.',
      'A setup checklist on your community page then walks you through the essentials: cover, rules, leadership, first event, first members.',
      '',
      '## Settings',
      '- Edit details anytime at /dashboard/settings or the community edit page.',
      '- Choose how people join: free join (instant) or request to join (approval). Private communities can share an access code instead.',
      '',
      '## Premium',
      'Premium unlocks full certificate customization (wording, colours, fonts, multiple signatures). Two ways to get it: a monthly plan for the community (/dashboard/premium) or a one-off unlock for a single event. All certificate designs and your own org logo are free for everyone.',
    ].join('\n'),
  },
  {
    area: 'Members & roles',
    path: '/dashboard/members',
    detail:
      'Approve or reject join requests and assign roles — Founder, President, Vice President, Treasurer, Secretary, ' +
      'Organizer, Coordinator, Volunteer, Member. You can transfer ownership; Coordinator and above see the full member list, a ' +
      'member-analytics card (growth trend, engaged vs dormant, role mix) on the community page, and can bulk-invite new ' +
      'members by pasting email addresses ("Invite by email" — each gets a branded join link).',
    guide: [
      '## Roles',
      'Nine roles, from highest: Founder, President, Vice President, Treasurer, Secretary, Organizer, Coordinator, Volunteer, Member. Coordinator and above can see the member list and manage most things; role changes respect rank (you can only assign roles below your own).',
      '',
      '## Managing members',
      '- Approve or reject join requests from the community page or /dashboard/members.',
      '- Search and page through large member lists; change roles and statuses inline.',
      '- Bulk-invite by pasting email addresses ("Invite by email") — each address gets a branded join link.',
      '- Transfer ownership to another member when it is time to hand over (founder only).',
      '',
      '## Member analytics',
      'The community page shows Coordinator+ a member-analytics card: total members, new in the last 30 days, engaged vs dormant, role mix, and a 12-month growth chart.',
      '',
      '## Display titles',
      'Give leaders session-specific display titles (e.g. "PRO", "Director of Programs") and a display order — cosmetic labels on top of the fixed permission roles.',
    ].join('\n'),
  },
  {
    area: 'Leadership sessions & handover',
    detail:
      'Keep an official leadership roster per academic session (e.g. 2026/2027) on your community\'s Leaders page — ' +
      'leaders don\'t need GuildOS accounts, and you can bulk-import a roster from a PDF. When a session ends, dissolve it: ' +
      'outgoing leaders can receive verifiable leadership certificates (shareable in bulk), lose their permission roles, ' +
      'and you can assign roles to the incoming set in one flow.',
    guide: [
      'Your community\'s Leaders page (/communities/your-slug/leaders) keeps an official leadership roster per academic session (e.g. "2026/2027").',
      '',
      '## Building the roster',
      '- Add leaders manually (name, title, session, photo, phone, department) — they do NOT need GuildOS accounts.',
      '- Or bulk-import from a PDF: upload your excos list document and AI extracts the names, titles, and session for your review before saving.',
      '- Tag a leader\'s GuildOS account to link them — linked leaders can receive permission roles and get their certificates in-app.',
      '',
      '## Ending a session (dissolve)',
      'When a session ends, dissolve it from the Leaders page. In one flow you can:',
      '1. Mark the outgoing set as past leadership.',
      '2. Issue **verifiable leadership certificates** to everyone who served — GuildOS design or your own uploaded design, with a live preview. Each certificate has a serial and verification link; share them one by one (including via WhatsApp) or copy one group link for the whole session.',
      '3. Step outgoing linked leaders\' permission roles back down to Member.',
      '',
      '## Handover',
      'Use "Hand over roles" to assign permission roles (President, VP, Secretary, Treasurer, Coordinator) to the incoming session\'s linked leaders — and optionally transfer community ownership — in one screen.',
    ].join('\n'),
  },
  {
    area: 'Events',
    path: '/dashboard/events',
    detail:
      'Create with a step-by-step wizard (optional AI draft, banner, schedule, multi-day agenda with timed sessions, ' +
      'parallel sections/tracks with per-section trainers, venues and seat caps, location or online link, contacts, ' +
      'capacity, registration policy, speakers, sponsors, partners and a thank-you email). Publish, then run the ' +
      'lifecycle Open Check-In → Open Check-Out → Complete. Scan QR passes at /dashboard/events/scanner or hand out ' +
      'single-device door-scanner links for gate helpers, open the attendee Report (with CSV download), message all ' +
      'attendees or just one section, and reuse a past event with "Run again". Paid events show a sales card with a ' +
      'conversion funnel (page views → checkouts → sold) and top referrers.',
    guide: [
      '## Creating an event',
      'The 4-step wizard at /dashboard/events/create covers: Basics (title, AI draft, schedule, multi-day agenda with timed sessions and per-day venues/facilitators), Logistics & tickets (location or online link, contacts, capacity, registration policy, ticket setup, banner and gallery), Certificates & email (certificate designer, thank-you email), and Speakers & partners (speakers, sponsorship, co-hosts, external partners).',
      '',
      '## Sections / parallel tracks',
      'Running one workshop with parallel cohorts (e.g. "Data Science" and "Coding")? Define **sections** in the wizard — each with its own description, venue and seat cap:',
      '- Attendees pick exactly one section at registration; each section can waitlist independently when its cap fills, and attendees can switch sections while space allows.',
      '- Assign speakers/trainers to a specific section; agenda sessions can be tagged to a section or left shared (everyone attends).',
      '- Ticket tiers can be section-scoped (buying that tier registers the buyer into that track), the ticket stub prints the track, and certificates snapshot the section the attendee completed.',
      '- Message just one section\'s attendees from the events dashboard.',
      '- Once published, sections can be renamed but not removed — registrations depend on them.',
      '',
      '## Registration options',
      '- Open (instant) or approval-based registration; optional waitlist (auto-promotes when seats open, with notifications); walk-ins at the door; invite-only via a private invite link.',
      '- Multi-day events support per-day RSVP, per-day seat caps, and a minimum days requirement for certificates.',
      '- Close and reopen registration anytime from the events dashboard.',
      '',
      '## Running the event',
      '1. Publish. Registered attendees get reminders automatically (day before + last-call an hour before, per day for multi-day).',
      '2. Open Check-In when doors open. Scan QR passes at /dashboard/events/scanner, or mint up to 10 single-device door-scanner links for gate helpers — each locks to the first phone that opens it and can be revoked instantly.',
      '3. Open Check-Out near the end so attendance duration is captured.',
      '4. Complete the event — attendance settles and certificates can be issued.',
      '',
      '## After (and around) the event',
      '- The Report button opens attendee analytics with a rich CSV download (attendance, days attended, certificate eligibility).',
      '- Attendee feedback: checked-in attendees rate 1-5 with comments. Multi-day events are rated per day AS each day ends — watch the day-by-day breakdown on the event page and fix issues before the next morning.',
      '- "Plan the next event with AI" on the events dashboard digests every rating and comment across your past events into what went well, what to improve, concrete suggestions, and an outlook.',
      '- Message all attendees (bell + branded email) from the events dashboard.',
      '- "Run again" clones a past event — content, tickets, speakers — with fresh dates.',
      '- If plans change: edit the event (attendees are notified of venue/date changes), POSTPONE it (registrations and tickets stay valid and frozen — set the new date and republish when ready), cancel a specific day of a multi-day event, or cancel the whole event with a public reason — paid tickets refund automatically.',
    ].join('\n'),
  },
  {
    area: 'Ticketing & wallet',
    path: '/dashboard/wallet',
    detail:
      'Sell tickets on your events: set a price or multiple ticket types (tiers, optionally day-scoped), promo codes, and ' +
      'group discounts. Buyers pay by card, transfer or USSD; earnings (minus a small platform commission) accumulate in ' +
      'your community wallet and are released after each event takes place — then withdraw to your bank. A sales card ' +
      'shows sold/gross/net, a conversion funnel, per-tier sales, promo performance and top referrers.',
    guide: [
      '## Setting up paid tickets',
      '- In the event wizard, switch Entry from "Free event" to "Paid tickets", then set a price — or define up to 5 ticket types (tiers) with their own prices and capacities (e.g. Early Bird, Regular, VIP). On multi-day events a tier can cover specific days only; on sectioned events a tier can be scoped to one section/track.',
      '- Add promo codes (percentage off, optional usage cap) and an optional group discount ("buy 3+, each 15% off"). Discounts never stack — the buyer gets the best one.',
      '- Choose the ticket design buyers download: four GuildOS looks (Midnight, Daylight, Bold, Minimal) with a custom accent colour — or your own uploaded artwork with the QR placed where you want.',
      '',
      '## How the money flows',
      '1. Buyers pay by card, bank transfer, or USSD. A processing fee is added to the buyer\'s total, so the ticket price is what enters the pot.',
      '2. GuildOS keeps a small commission (shown in the wizard with a worked example); the rest is yours.',
      '3. Earnings are **held in escrow until the event takes place** — if you cancel, held funds go back to the buyers automatically.',
      '4. After the event completes, funds are released to your community wallet (/dashboard/wallet, Treasurer and above).',
      '5. Request a payout to your bank account from the wallet page.',
      '',
      '## Sales insight',
      'The event page shows organizers a sales card: tickets sold, gross, commission, net, a 14-day sales chart, a conversion funnel (page views → checkouts → sold), per-tier sales, promo-code performance, and top referrers (attendees who shared the event).',
      '',
      '## Refunds',
      'Cancelling an event (or a day that a day-scoped tier covers) refunds those buyers automatically to their original payment method.',
    ].join('\n'),
  },
  {
    area: 'Certificates',
    detail:
      'Design them (many styles, colours, AI-written wording, signatures and your org logo) and issue verifiable ' +
      'certificates to attendees who checked in and out — each gets a public verification link (full customization needs ' +
      'Premium).',
    guide: [
      '## Designing',
      'The certificate designer lives in the event wizard (Certificates & email step) with a live preview:',
      '- **Free for everyone**: 12 professional designs, your own organization logo (left/center/right), and one signature.',
      '- **Premium**: custom wording (with an AI writer), colours, backgrounds, fonts, and up to 3 signatures with signature images.',
      '- Or upload a fully custom certificate image — names are drawn onto your design.',
      '',
      '## Issuing',
      '- Attendees who checked in AND out (and met any multi-day minimum) become eligible when you complete the event.',
      '- Issue from the attendee Report page — each recipient gets a bell + email with their verification link.',
      '- Certificates carry sponsor logos automatically when a sponsorship package includes that perk, and partner/co-host attribution.',
      '',
      '## Verification & revocation',
      'Every certificate has a unique serial, QR code, and public verification page. If you ever need to, you can revoke a certificate — its page then permanently shows it was revoked.',
      '',
      '## Leadership certificates',
      'Separate from event certificates: issued from the Leaders page when you dissolve a leadership session (see "Leadership sessions & handover").',
    ].join('\n'),
  },
  {
    area: 'Sponsorship & partnerships',
    detail:
      'Open events to sponsors (open offers — no fixed price packages), manage inquiries, collect payment securely through ' +
      'GuildOS, and invite other communities to co-host or add external partners.',
    guide: [
      '## Sponsorship',
      '1. In the event wizard, open the event to sponsors and write a pitch. Companies propose their OWN offer and budget from the event page or the /sponsors marketplace — there are no public price packages, so every deal fits the sponsor.',
      '2. Sponsor inquiries arrive in your wizard inbox (sponsors don\'t need accounts) — track them as New/Contacted/Won/Closed. Reply within 72 hours: stale inquiries trigger a reminder, and communities that respond fast earn a "Responds quickly" badge on /sponsors.',
      '3. Converting a Won inquiry (with the agreed amount) lists the sponsor on the event page and delivers perks: certificate logos, a thank-you post, and the shareable verified attendance report.',
      '4. **Payment**: generate a secure payment link — the sponsor pays online, the platform fee settles automatically, their money is refund-protected if the event is cancelled, and their report unlocks instantly with a "Paid via GuildOS" badge. Earnings join your community wallet under the same held-until-the-event-happens escrow as ticket money. Bank-transfer deals are still allowed (an admin confirms the fee to unlock the report).',
      '5. If a deal falls through, revoke it — the sponsor listing is removed and any pending fee is cleared.',
      '',
      '## Co-host partnerships',
      'Invite another verified community (by their handle) to co-host. Once they accept, their leadership gets full event management access, the event shows "In partnership with", and co-hosts are credited on certificates.',
      '',
      '## External partners',
      'Add non-GuildOS partners (name + logo + website) — they appear on the event page and their logos render on certificates.',
    ].join('\n'),
  },
  {
    area: 'Knowledge Hub',
    detail:
      "Publish guides, tutorials, past questions and resources on your community's Knowledge tab so members (and this " +
      'assistant) can find them; moderate reported content at /dashboard/moderation.',
    guide: [
      'Every community has a Knowledge tab — a library of institutional memory that outlives each leadership session.',
      '',
      '## Publishing',
      '- Coordinator and above can publish three kinds of resources: **Articles** (written in markdown with a formatting toolbar and live preview), **Links**, and **Files** (PDFs and images).',
      '- Organize by category: Getting Started, Tutorial, Documentation, Roadmap, Opportunity, Past Questions, Other.',
      '- Empty hub? Use "Add starter pack" to scaffold common articles (welcome guide, FAQ, constitution, session plan) tailored to your community\'s category.',
      '- Publishing earns reputation points.',
      '',
      '## Reach',
      '- Members browse the tab; public communities\' knowledge is searchable from /search by anyone.',
      '- The GuildOS assistant reads public Knowledge Hubs to answer member questions — publishing good guides literally teaches the assistant about your community.',
      '- Leaders see view/open counts per resource.',
      '',
      '## Moderation',
      'Reported posts and comments from your community land at /dashboard/moderation — remove or dismiss.',
    ].join('\n'),
  },
  {
    area: 'Feed & announcements',
    detail:
      'Post updates (with images or polls), pin important posts, and send announcements to members. Your /dashboard ' +
      'overview summarises members, events and activity.',
    guide: [
      '## Posting and pinning',
      '- Post updates to your community feed like any member — including **polls** (2–6 options) to gather quick member opinions.',
      '- Pin up to 3 important posts — they stay at the top of the community\'s Posts tab.',
      '',
      '## Announcements',
      'Senior leaders (VP and above) can send an announcement from the community page: every active member gets a bell notification, optionally with a branded email. Use it for the things members must not miss.',
      '',
      '## Your dashboard',
      'The /dashboard overview summarises members, events, and recent activity across every community you manage. Switch between communities you lead from the selector.',
    ].join('\n'),
  },
];

/** One-liner about the product, reused in both prompts. */
export const GUILDOS_MISSION =
  'GuildOS is a platform that turns student campus activities into a verifiable professional portfolio — verified ' +
  'events, certificates and leadership become a CV and public profile recruiters can trust.';

/** Render a capability list as prompt bullets: "- Area (/path): detail". */
export function capabilitiesToBullets(capabilities: Capability[]): string {
  return capabilities
    .map((c) => `- ${c.area}${c.path ? ` (${c.path})` : ''}: ${c.detail}`)
    .join('\n');
}
