import { aiChat, isAiConfigured } from './ai-provider';
import { findKnowledgeForAssistant } from './knowledge.service';
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
  'Never invent user data or fake verifications. What students can do on GuildOS:\n' +
  `${capabilitiesToBullets(STUDENT_CAPABILITIES)}\n` +
  'If a question is outside GuildOS, answer briefly and helpfully.';

const LEADER_SYSTEM_PROMPT =
  `You are Guild Captain, the in-app assistant for GuildOS community leaders. ${GUILDOS_MISSION} ` +
  'Leaders run their communities from Community Mode at /dashboard. Answer clearly and concisely (2-5 sentences, plain ' +
  'text, no markdown headings), point to the exact /dashboard path, and encourage good practice (accurate attendance, ' +
  'no fake certificates). Never invent data or fabricate verifications. What leaders can do:\n' +
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

async function openAiChat(messages: AssistantMessage[], mode: AssistantMode, userName?: string, knowledgeContext?: string): Promise<string | null> {
  if (!isAiConfigured()) return null;
  try {
    const base = mode === 'leader' ? LEADER_SYSTEM_PROMPT : STUDENT_SYSTEM_PROMPT;
    let systemContent = userName ? `${base}\nThe current user's name is ${userName}.` : base;
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
      // an empty reply. The reasoning is stripped, so user-facing replies still stay short.
      maxTokens: 1500,
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

  // Knowledge Hub retrieval: community resources answer before the internet does.
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  const knowledge = lastUser ? await findKnowledgeForAssistant(lastUser.content, options.userId).catch(() => []) : [];
  const knowledgeContext = knowledge.length
    ? knowledge
        .map((k, i) => `[${i + 1}] "${k.title}" — from ${k.communityName}'s Knowledge Hub (/communities/${k.communitySlug})\n${k.summary}\n${k.type === 'LINK' ? `External link: ${k.url}` : k.content}`)
        .join('\n\n')
    : undefined;

  const ai = await openAiChat(messages, mode, options.name, knowledgeContext);
  if (ai) return { reply: ai, source: 'ai' };

  // No AI available: a strong knowledge match still beats a generic rule reply.
  if (knowledge.length) {
    const top = knowledge[0];
    const more = knowledge.length > 1 ? ` (${knowledge.length - 1} more related resource${knowledge.length > 2 ? 's' : ''} there too)` : '';
    return {
      reply:
        `From ${top.communityName}'s Knowledge Hub: "${top.title}"${top.summary ? ` — ${top.summary}` : ''} ` +
        `Open the Knowledge tab at /communities/${top.communitySlug} to read it${more}.`,
      source: 'knowledge',
    };
  }

  return { reply: heuristicReply(messages, mode, options.name), source: 'fallback' };
}
