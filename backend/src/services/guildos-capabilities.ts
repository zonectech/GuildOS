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
};

/** Things any signed-in student can do. */
export const STUDENT_CAPABILITIES: Capability[] = [
  {
    area: 'Home feed',
    path: '/home',
    detail:
      'See posts from communities you have joined or follow, plus suggestions. You CAN create your own posts ' +
      '(text and images), like, comment and reply (threaded), and repost/share. Sort the feed by New, Top or Hot. ' +
      'A Trending panel highlights hot events and fast-growing communities.',
  },
  {
    area: 'Events',
    path: '/events',
    detail:
      'Discover and register/RSVP for events — some are instant, some need organizer approval; multi-day events let ' +
      'you pick which days you will attend. You get a QR pass, and attendance is verified by checking IN and OUT at the ' +
      'event (online events reveal their meeting link at check-in). See your registrations at /my-events and add events ' +
      'to your calendar. Event pages show the agenda, speakers, sponsors, partners, contacts and post-event ratings.',
  },
  {
    area: 'Communities',
    path: '/communities',
    detail:
      'Browse, follow, or join student communities (some need a join request or an access code). Each community page ' +
      'has Profile, Posts, and a Knowledge tab — a Knowledge Hub of guides, tutorials, past questions and resources. ' +
      'If you run one, manage it in Community Mode at /dashboard.',
  },
  {
    area: 'Certificates',
    path: '/certificates',
    detail:
      'Earned automatically when you complete an event with verified attendance. View, download and share them; each ' +
      'has a public verification link and also appears on your profile.',
  },
  {
    area: 'Guild Score & reputation',
    path: '/reputation',
    detail:
      'Attendance, completion, leadership and certificates earn points, levels (Explorer → Bronze → Silver → Gold → ' +
      'Platinum → Elite) and badges.',
  },
  {
    area: 'CV & profile',
    detail:
      'Generate a verifiable CV at /cv; your public profile (/u/your-username) shows your posts, profile and certificates. ' +
      'Edit details, availability, career preferences and privacy at /account.',
  },
  {
    area: 'Opportunities',
    path: '/opportunities',
    detail: 'Internships and jobs matched to your verified profile, each with the reasons it matches.',
  },
  {
    area: 'Connections, messages & search',
    detail:
      'Connect with people at /connections and chat at /messages. The notification bell (/notifications) alerts you to ' +
      'reminders, approvals and earned certificates. Search people, communities, events and knowledge at /search.',
  },
];

/** Things a community leader can do from Community Mode (/dashboard). */
export const LEADER_CAPABILITIES: Capability[] = [
  {
    area: 'Community setup & verification',
    detail:
      'Create a community (name, description, category, school, rules), then get it verified via university email or admin ' +
      'review so it appears in discovery. Edit details at /dashboard/settings. Premium (a monthly plan or a one-off ' +
      'per-event unlock) unlocks certificate customization.',
  },
  {
    area: 'Members & roles',
    path: '/dashboard/members',
    detail:
      'Approve or reject join requests and assign roles — Founder, President, Vice President, Treasurer, Secretary, ' +
      'Coordinator, Volunteer, Member. You can transfer ownership; Coordinator and above see the full member list.',
  },
  {
    area: 'Events',
    path: '/dashboard/events',
    detail:
      'Create with a step-by-step wizard (optional AI draft, banner, schedule, multi-day agenda with timed sessions, ' +
      'location or online link, contacts, capacity, registration policy, speakers, sponsors, partners and a thank-you ' +
      'email). Publish, then run the lifecycle Open Check-In → Open Check-Out → Complete. Scan QR passes at ' +
      '/dashboard/events/scanner, open the attendee Report (with CSV download), and reuse a past event with "Run again".',
  },
  {
    area: 'Certificates',
    detail:
      'Design them (many styles, colours, AI-written wording, signatures and your org logo) and issue verifiable ' +
      'certificates to attendees who checked in and out — each gets a public verification link (full customization needs ' +
      'Premium).',
  },
  {
    area: 'Sponsorship & partnerships',
    detail:
      'Open events to sponsors with tiered packages and manage inquiries, and invite other communities to co-host or add ' +
      'external partners.',
  },
  {
    area: 'Knowledge Hub',
    detail:
      "Publish guides, tutorials, past questions and resources on your community's Knowledge tab so members (and this " +
      'assistant) can find them; moderate reported content at /dashboard/moderation.',
  },
  {
    area: 'Feed & announcements',
    detail:
      'Post updates, pin important posts, and send announcements to members. Your /dashboard overview summarises members, ' +
      'events and activity.',
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
