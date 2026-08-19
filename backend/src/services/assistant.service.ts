import { aiChat, isAiConfigured } from './ai-provider';
import { findKnowledgeForAssistant, assistantQueryTerms, escapeRegex } from './knowledge.service';
import { EventModel } from '../models/event.model';
import { CommunityModel } from '../models/community.model';
import { EventRegistrationModel, type EventRegistrationStatus } from '../models/event-registration.model';
import { MembershipModel } from '../models/membership.model';
import { CertificateModel } from '../models/certificate.model';
import { getReputationProfileSummary } from './reputation.service';
import {
  GUILDOS_MISSION,
  STUDENT_CAPABILITIES,
  LEADER_CAPABILITIES,
  capabilitiesToBullets,
} from './guildos-capabilities';

export type AssistantMessage = { role: 'user' | 'assistant'; content: string };
export type AssistantMode = 'student' | 'leader';

// Prompts are BUILT FROM the capabilities manifest (guildos-capabilities.ts) — the single
// source of truth. To teach the assistant a new feature, edit that file, not this prompt.
const STUDENT_SYSTEM_PROMPT =
  `You are GuildBot, the friendly in-app assistant for GuildOS. ${GUILDOS_MISSION} ` +
  'Answer clearly and concisely (2-5 sentences, plain text, no markdown headings) and point to the exact page path. ' +
  'Never invent user data or fake verifications. You can only answer and guide — you cannot perform actions ' +
  '(register, cancel, post, edit) on the user\'s behalf; when asked to do something, say so briefly and give the exact ' +
  'page path and steps so they can do it themselves. What students can do on GuildOS:\n' +
  `${capabilitiesToBullets(STUDENT_CAPABILITIES)}\n` +
  'If a question is outside GuildOS, answer briefly and helpfully.';

const LEADER_SYSTEM_PROMPT =
  `You are Guild Captain, the in-app assistant for GuildOS community leaders. ${GUILDOS_MISSION} ` +
  'Leaders run their communities from Community Mode at /dashboard. Answer clearly and concisely (2-5 sentences, plain ' +
  'text, no markdown headings), point to the exact /dashboard path, and encourage good practice (accurate attendance, ' +
  'no fake certificates). Never invent data or fabricate verifications. You can only answer and guide — you cannot ' +
  'perform actions (create, cancel, publish, approve) on the leader\'s behalf; when asked to do something, say so ' +
  'briefly and give the exact page path and steps. What leaders can do:\n' +
  `${capabilitiesToBullets(LEADER_CAPABILITIES)}\n` +
  "Well-run events and verified leadership raise members' Guild Scores and your community's standing.";

const STUDENT_FALLBACK_RULES: { match: RegExp; reply: string }[] = [
  {
    match: /\bpost\b|feed|share|comment|reply|\blike\b|discussion|timeline/i,
    reply:
      'Yes — you can post on GuildOS. On the home feed (/home) you can share text or images, like, comment and reply (threaded), ' +
      'and repost, plus post inside any community you have joined. Use the New / Top / Hot tabs to change how the feed is sorted.',
  },
  {
    match: /event|register|rsvp|check ?in|attend/i,
    reply:
      'You can discover and register for events under Events (/events), and see the ones you signed up for at /my-events. ' +
      'Attendance is confirmed with a QR check-in and check-out at the event, which is what makes your certificate verifiable.',
  },
  {
    match: /communit|club|group|society/i,
    reply:
      'Browse and join student communities at /communities — the home feed also suggests communities based on your school, ' +
      'faculty, and interests. If you run one, switch to Community Mode at /dashboard to manage members and host events.',
  },
  {
    match: /certificate|credential/i,
    reply:
      'Certificates are issued when you complete an event with verified attendance. You can view and share them from /certificates, ' +
      'and each one has a public verification link.',
  },
  {
    match: /guild ?score|reputation|points|level|rank/i,
    reply:
      'Your Guild Score grows as you attend events, take on leadership, earn certificates, and stay active. It maps to levels ' +
      '(Explorer → Bronze → Silver → Gold → Platinum → Elite). See the full breakdown at /reputation.',
  },
  {
    match: /\bcv\b|resume|portfolio/i,
    reply:
      'Head to /cv to generate a verifiable CV from your GuildOS activity. Your portfolio and resume also appear on your public ' +
      'profile so recruiters can confirm every entry.',
  },
  {
    match: /opportunit|internship|job|hire|recruit/i,
    reply:
      'Check /opportunities for internships and jobs matched to your profile and interests. Keep your availability and interests ' +
      'updated in /account to improve the matches.',
  },
  {
    match: /connect|friend|follow|network/i,
    reply:
      'Find people and manage requests at /connections — the home feed also shows "People you may know". Once connected, you can ' +
      'message each other at /messages.',
  },
  {
    match: /message|chat|inbox|dm/i,
    reply:
      'Your conversations live at /messages. You can message your connections, and recruiters can reach out to candidates directly.',
  },
  {
    match: /profile|account|avatar|bio|privacy|username/i,
    reply:
      'Edit your profile, availability, and privacy settings at /account. Your public profile (what others see) is at ' +
      '/u/your-username, and you can control what sections are visible.',
  },
  {
    match: /verif/i,
    reply:
      'GuildOS verifies attendance via QR check-in/out, and leadership/certificates are verified through your communities. ' +
      'Public profiles show which achievements are verified.',
  },
];

const LEADER_FALLBACK_RULES: { match: RegExp; reply: string }[] = [
  {
    match: /member|join request|approve|reject|role|president|treasurer|secretary|coordinator/i,
    reply:
      'Manage your members at /dashboard/members — approve or reject join requests and assign roles like President, ' +
      'Vice President, Treasurer, Secretary, or Coordinator. Verified leadership roles boost members\' Guild Scores.',
  },
  {
    match: /event|attend|check ?in|check ?out|\bqr\b|host|publish/i,
    reply:
      'Create and publish events at /dashboard/events — you can even generate a draft with the AI event assistant. ' +
      'Each event gets a QR code for check-in and check-out, which verifies attendance and unlocks certificates.',
  },
  {
    match: /certificate|issue|award|credential/i,
    reply:
      'After an event, issue verifiable certificates to attendees who checked in and out, from /dashboard/certificates. ' +
      'Every certificate gets a public verification link.',
  },
  {
    match: /verif|approve.*communit|get.*verified|endors/i,
    reply:
      'Get your community verified using your university email or endorsements from other verified leaders. ' +
      'Manage verification and community details at /dashboard/settings.',
  },
  {
    match: /grow|follower|promote|engage|post|reach|active/i,
    reply:
      'Grow your community by posting updates to the feed, hosting regular events, and collaborating with or endorsing ' +
      'other communities. Active, verified communities appear in student discovery and attract more members.',
  },
  {
    match: /create|start|new communit|set ?up/i,
    reply:
      'Start a new community from Community Mode at /dashboard — add its name, description, category, and school, then ' +
      'get it verified so it appears in public discovery.',
  },
  {
    match: /analytic|insight|report|stat|overview|dashboard/i,
    reply:
      'Your dashboard overview at /dashboard summarises members, events, and activity so you can track how your ' +
      'community is growing.',
  },
];

// Generic event-question filler — these words alone must never match an event title.
const EVENT_FILLER_TERMS = new Set([
  'event', 'events', 'holding', 'hold', 'held', 'happening', 'happen', 'happens',
  'date', 'dates', 'time', 'times', 'start', 'starts', 'starting', 'schedule', 'scheduled',
  'take', 'taking', 'place', 'venue', 'location', 'register', 'ticket', 'tickets',
]);

type AssistantEvent = {
  title: string;
  slug: string;
  communityName: string;
  whenLabel: string;
  whereLabel: string;
  statusLabel: string;
  about: string;
  /** The current user's registration state for this event ('' = signed out / unknown). */
  viewerStatus: string;
};

const REGISTRATION_LABELS: Record<EventRegistrationStatus, string> = {
  PENDING_APPROVAL: 'registered — awaiting organizer approval',
  CONFIRMED: 'registered (confirmed)',
  WAITLISTED: 'on the waitlist',
  CHECKED_IN: 'checked in',
  CHECKED_OUT: 'attended (checked out)',
  COMPLETED: 'attended and completed',
  PARTIAL_ATTENDANCE: 'attended partially',
  CANCELLED: 'registration cancelled',
  REJECTED: 'registration declined',
  NO_SHOW: 'registered but did not attend',
};

function fmtEventDay(date: Date, timezone?: string): string {
  const opts: Intl.DateTimeFormatOptions = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
  try {
    return new Intl.DateTimeFormat('en-US', { ...opts, timeZone: timezone || undefined }).format(date);
  } catch {
    return new Intl.DateTimeFormat('en-US', opts).format(date);
  }
}

function fmtEventTime(date: Date, timezone?: string): string {
  const opts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
  try {
    return new Intl.DateTimeFormat('en-US', { ...opts, timeZone: timezone || undefined }).format(date);
  } catch {
    return new Intl.DateTimeFormat('en-US', opts).format(date);
  }
}

/**
 * Live-event retrieval for the assistant: matches PUBLIC published/live/past events by
 * title so date/venue questions are answered from real records, never guessed.
 */
async function findEventsForAssistant(query: string, userId?: string, limit = 3): Promise<AssistantEvent[]> {
  const terms = assistantQueryTerms(query).filter((t) => !EVENT_FILLER_TERMS.has(t));
  if (!terms.length) return [];
  const rx = new RegExp(terms.map(escapeRegex).join('|'), 'i');

  const candidates = await EventModel.find({
    deletedAt: null,
    visibility: 'PUBLIC',
    title: rx,
    $or: [
      { status: { $in: ['PUBLISHED', 'CHECK_IN', 'CHECK_OUT', 'COMPLETED'] } },
      // Organizer-cancelled events stay findable (so the bot can say "cancelled"),
      // moderation removals stay hidden.
      { status: 'ARCHIVED', cancellationReason: { $nin: ['', 'Removed by GuildOS moderation'] } },
    ],
  })
    .sort({ startDate: -1 })
    .limit(40)
    .select('title slug status mode venue address meetingLink startDate endDate timezone communityId shortDescription cancellationReason')
    .lean();
  if (!candidates.length) return [];

  const now = Date.now();
  const titleHits = (title: string) => terms.filter((t) => title.toLowerCase().includes(t)).length;
  const ranked = candidates
    .map((e) => ({ e, hits: titleHits(e.title) }))
    .filter((r) => r.hits > 0)
    .sort((a, b) => {
      if (b.hits !== a.hits) return b.hits - a.hits;
      const aUpcoming = a.e.startDate && a.e.startDate.getTime() >= now ? 1 : 0;
      const bUpcoming = b.e.startDate && b.e.startDate.getTime() >= now ? 1 : 0;
      if (bUpcoming !== aUpcoming) return bUpcoming - aUpcoming;
      return (b.e.startDate?.getTime() ?? 0) - (a.e.startDate?.getTime() ?? 0);
    })
    .slice(0, limit);

  const communities = await CommunityModel.find({ _id: { $in: ranked.map((r) => r.e.communityId) } })
    .select('name')
    .lean();
  const communityById = new Map(communities.map((c) => [c._id.toString(), c.name]));

  // The viewer's own registration state per matched event ("am I registered for X?").
  const registrationByEvent = new Map<string, EventRegistrationStatus>();
  if (userId) {
    const regs = await EventRegistrationModel.find({ userId, eventId: { $in: ranked.map((r) => r.e._id) } })
      .select('eventId status')
      .lean();
    for (const r of regs) registrationByEvent.set(r.eventId.toString(), r.status);
  }

  return ranked.map(({ e }) => {
    const tz = e.timezone || undefined;
    let whenLabel = 'Date not announced yet';
    if (e.startDate) {
      const startDay = fmtEventDay(e.startDate, tz);
      const endDay = e.endDate ? fmtEventDay(e.endDate, tz) : '';
      whenLabel = endDay && endDay !== startDay
        ? `${startDay} – ${endDay}`
        : `${startDay} at ${fmtEventTime(e.startDate, tz)}`;
    }

    const physical = [e.venue, e.address].filter(Boolean).join(', ');
    const whereLabel =
      e.mode === 'VIRTUAL' ? 'Online' : physical ? (e.mode === 'HYBRID' ? `${physical} (also online)` : physical) : 'Venue to be announced';

    let statusLabel = 'Upcoming';
    if (e.status === 'ARCHIVED' && e.cancellationReason) statusLabel = `Cancelled — ${e.cancellationReason}`;
    else if (e.status === 'CHECK_IN' || e.status === 'CHECK_OUT') statusLabel = 'Happening now';
    else if (e.status === 'COMPLETED' || (e.endDate && e.endDate.getTime() < now)) statusLabel = 'Already took place';

    const regStatus = registrationByEvent.get(e._id.toString());
    const viewerStatus = userId ? (regStatus ? REGISTRATION_LABELS[regStatus] : 'not registered') : '';

    return {
      title: e.title,
      slug: e.slug,
      communityName: communityById.get(e.communityId.toString()) ?? '',
      whenLabel,
      whereLabel,
      statusLabel,
      about: (e.shortDescription ?? '').slice(0, 200),
      viewerStatus,
    };
  });
}

/**
 * A compact snapshot of the signed-in user's own GuildOS data (score, communities,
 * registrations, certificates) so the assistant can answer personal questions from
 * real records. Only ever contains the viewer's OWN data.
 */
async function buildViewerContext(userId: string): Promise<string | undefined> {
  const [summary, memberships, registrations, certificates] = await Promise.all([
    getReputationProfileSummary(userId).catch(() => null),
    MembershipModel.find({ userId, status: 'ACTIVE' }).select('communityId role').limit(10).lean(),
    EventRegistrationModel.find({ userId, status: { $nin: ['CANCELLED', 'REJECTED'] } })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('eventId status')
      .lean(),
    CertificateModel.find({ userId, status: 'VERIFIED' })
      .sort({ createdAt: -1 })
      .limit(3)
      .select('eventTitle serial')
      .lean(),
  ]);

  const [memberCommunities, regEvents] = await Promise.all([
    memberships.length
      ? CommunityModel.find({ _id: { $in: memberships.map((m) => m.communityId) } }).select('name slug').lean()
      : Promise.resolve([]),
    registrations.length
      ? EventModel.find({ _id: { $in: registrations.map((r) => r.eventId) }, deletedAt: null })
          .select('title slug startDate timezone')
          .lean()
      : Promise.resolve([]),
  ]);
  const communityById = new Map(memberCommunities.map((c) => [c._id.toString(), c]));
  const eventById = new Map(regEvents.map((e) => [e._id.toString(), e]));

  const lines: string[] = [];
  if (summary) {
    lines.push(
      `Guild Score: ${summary.reputation.guildScore} (${summary.reputation.level})` +
        ` · ${summary.stats.eventsCompleted} events completed · ${summary.stats.certificatesEarned} certificates · ${summary.stats.communitiesJoined} communities`,
    );
  }
  if (memberships.length) {
    const parts = memberships
      .map((m) => {
        const c = communityById.get(m.communityId.toString());
        return c ? `${c.name} (${m.role.toLowerCase()}, /communities/${c.slug})` : '';
      })
      .filter(Boolean);
    if (parts.length) lines.push(`Communities: ${parts.join('; ')}`);
  }
  if (registrations.length) {
    const parts = registrations
      .map((r) => {
        const e = eventById.get(r.eventId.toString());
        if (!e) return '';
        const when = e.startDate ? ` on ${fmtEventDay(e.startDate, e.timezone || undefined)}` : '';
        return `"${e.title}"${when} — ${REGISTRATION_LABELS[r.status] ?? r.status} (/events/${e.slug})`;
      })
      .filter(Boolean);
    if (parts.length) lines.push(`Event registrations: ${parts.join('; ')}`);
  }
  if (certificates.length) {
    lines.push(`Recent certificates: ${certificates.map((c) => `"${c.eventTitle}" (/certificates/${c.serial})`).join('; ')}`);
  }
  return lines.length ? lines.join('\n') : undefined;
}

function heuristicReply(messages: AssistantMessage[], mode: AssistantMode, userName?: string): string {
  const rules = mode === 'leader' ? LEADER_FALLBACK_RULES : STUDENT_FALLBACK_RULES;
  const botName = mode === 'leader' ? 'Guild Captain' : 'GuildBot';
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  const text = (lastUser?.content ?? '').trim();
  const greeting = userName ? `Hi ${userName.split(' ')[0]}! ` : 'Hi! ';

  if (/^(hi|hey|hello|yo|good (morning|afternoon|evening))\b/i.test(text) || !text) {
    return mode === 'leader'
      ? `${greeting}I'm ${botName}, your GuildOS leader assistant. I can help you approve members, assign roles, run events, verify attendance, issue certificates, and grow your community. What do you need?`
      : `${greeting}I'm ${botName}, your GuildOS assistant. I can help with events, communities, certificates, your Guild Score, CV, opportunities, and more. What would you like to do?`;
  }

  const rule = rules.find((r) => r.match.test(text));
  if (rule) return rule.reply;

  return mode === 'leader'
    ? `${greeting}I can help you run your community — ask about approving members, assigning roles, creating events, verifying attendance, issuing certificates, or growing your community. You can manage everything from /dashboard.`
    : `${greeting}I can help you get around GuildOS — try asking about events, communities, certificates, your Guild Score, the CV builder, opportunities, connections, or messaging. You can also explore /events, /communities, and /reputation directly.`;
}

async function openAiChat(
  messages: AssistantMessage[],
  mode: AssistantMode,
  userName?: string,
  knowledgeContext?: string,
  eventsContext?: string,
  viewerContext?: string,
): Promise<string | null> {
  if (!isAiConfigured()) return null;
  try {
    const base = mode === 'leader' ? LEADER_SYSTEM_PROMPT : STUDENT_SYSTEM_PROMPT;
    let systemContent = userName ? `${base}\nThe current user's name is ${userName}.` : base;
    if (viewerContext) {
      systemContent +=
        '\n\nThe current user\'s own GuildOS records (REAL data — use it to answer personal questions like ' +
        '"am I registered?", "what is my score?", "which communities am I in?"; it belongs only to this user):\n' +
        viewerContext;
    }
    if (eventsContext) {
      systemContent +=
        '\n\nLive GuildOS event records matching the question are below — this is REAL data. Use it to answer ' +
        'date/venue/status questions directly and link the event page path. Do not claim you lack event records ' +
        'when a matching record is listed here:\n' +
        eventsContext;
    }
    if (knowledgeContext) {
      systemContent +=
        '\n\nCommunity Knowledge Hub excerpts relevant to the question are below. PREFER these over generic answers, ' +
        'mention which community the answer comes from, and point the user to that community\'s Knowledge tab:\n' +
        knowledgeContext;
    }
    const content = await aiChat({
      temperature: 0.5,
      // Generous headroom for "thinking" models (e.g. Gemma *-it) that spend output tokens
      // on a <thought> block before the answer — too low and only the reasoning fits, leaving
      // an empty or truncated reply. Richer grounding (full Help articles, event/viewer data)
      // makes them think longer, so the budget scales with it. The reasoning is stripped,
      // so user-facing replies still stay short.
      maxTokens: 3000,
      messages: [
        { role: 'system', content: systemContent },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    });
    return content?.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Powers the floating in-app assistant. Answers are grounded in community
 * Knowledge Hubs first (the user's own communities rank highest), then general
 * GuildOS guidance. Uses OpenAI when OPENAI_API_KEY is set, otherwise falls
 * back to rule-based replies so the assistant always works.
 */
export async function chatWithAssistant(
  rawMessages: AssistantMessage[],
  options: { name?: string; mode?: AssistantMode; userId?: string } = {},
): Promise<{ reply: string; source: 'ai' | 'knowledge' | 'fallback' }> {
  const mode: AssistantMode = options.mode === 'leader' ? 'leader' : 'student';
  const messages = rawMessages
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, 2000) }))
    .filter((m) => m.content)
    .slice(-12);

  if (!messages.length) {
    return { reply: heuristicReply([], mode, options.name), source: 'fallback' };
  }

  // Knowledge Hub + live event + personal-data retrieval: real records answer before generic guidance does.
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  const [knowledge, events, viewerContext] = await Promise.all([
    lastUser ? findKnowledgeForAssistant(lastUser.content, options.userId).catch(() => []) : Promise.resolve([]),
    lastUser ? findEventsForAssistant(lastUser.content, options.userId).catch(() => [] as AssistantEvent[]) : Promise.resolve([] as AssistantEvent[]),
    options.userId ? buildViewerContext(options.userId).catch(() => undefined) : Promise.resolve(undefined),
  ]);
  const knowledgeContext = knowledge.length
    ? knowledge
        .map((k, i) => `[${i + 1}] "${k.title}" — from ${k.communityName}'s Knowledge Hub (/communities/${k.communitySlug})\n${k.summary}\n${k.type === 'LINK' ? `External link: ${k.url}` : k.content}`)
        .join('\n\n')
    : undefined;
  const eventsContext = events.length
    ? events
        .map(
          (e, i) =>
            `[${i + 1}] "${e.title}"${e.communityName ? ` — hosted by ${e.communityName}` : ''} (/events/${e.slug})\n` +
            `When: ${e.whenLabel}\nWhere: ${e.whereLabel}\nStatus: ${e.statusLabel}` +
            `${e.viewerStatus ? `\nCurrent user: ${e.viewerStatus}` : ''}${e.about ? `\nAbout: ${e.about}` : ''}`,
        )
        .join('\n\n')
    : undefined;

  const ai = await openAiChat(messages, mode, options.name, knowledgeContext, eventsContext, viewerContext);
  if (ai) return { reply: ai, source: 'ai' };

  // No AI available: a matching event record still gives a direct, factual answer.
  if (events.length) {
    const top = events[0];
    return {
      reply:
        `${top.title}${top.communityName ? ` (hosted by ${top.communityName})` : ''} — ${top.whenLabel}, ${top.whereLabel}. ` +
        `Status: ${top.statusLabel}.${top.viewerStatus ? ` You: ${top.viewerStatus}.` : ''} Full details at /events/${top.slug}.`,
      source: 'knowledge',
    };
  }

  // No AI available: a strong knowledge match still beats a generic rule reply.
  if (knowledge.length) {
    const top = knowledge[0];
    const more = knowledge.length > 1 ? ` (${knowledge.length - 1} more related resource${knowledge.length > 2 ? 's' : ''} there too)` : '';
    return {
      reply:
        `I couldn't generate a full answer just now, but this looks related — from ${top.communityName}'s Knowledge Hub: ` +
        `"${top.title}"${top.summary ? ` — ${top.summary}` : ''} ` +
        `Open the Knowledge tab at /communities/${top.communitySlug} to read it${more}.`,
      source: 'knowledge',
    };
  }

  return { reply: heuristicReply(messages, mode, options.name), source: 'fallback' };
}
