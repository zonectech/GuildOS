import { aiChat, isAiConfigured, parseJsonLoose } from './ai-provider';

export type EventDraft = {
  title: string;
  description: string;
  agenda: string[];
  audience: string;
  outcomes: string[];
};

/** Extended draft returned when parsing a document — includes structured fields the AI can extract. */
export type RichEventDraft = EventDraft & {
  /** Punchy 1–2 sentence card blurb — distinct from the full description. */
  summary?: string;
  theme?: string;
  date?: string;                // YYYY-MM-DD
  startTime?: string;           // HH:mm
  endTime?: string;             // HH:mm
  venue?: string;
  /** Full street/building address (distinct from the venue name). */
  address?: string;
  /** Zoom / Teams / Google Meet URL for virtual or hybrid events. */
  meetingLink?: string;
  type?: string;                // EventType
  mode?: string;                // EventMode
  timezone?: string;            // IANA or abbreviated timezone
  tags?: string[];
  /** "What to expect" highlights (wifi, refreshments, certificates, swag…). */
  features?: string[];
  /** true when the document says refreshments will be provided. */
  refreshments?: boolean;
  /** Maximum number of participants mentioned in the document (0 = not mentioned). */
  capacity?: number;
  /** Registration close date as YYYY-MM-DD, if stated in the document. */
  registrationDeadline?: string;
  /** Ticket price in NGN (0 = free or not mentioned). */
  ticketPrice?: number;
  /** Contact persons extracted from the document. */
  contacts?: Array<{ name: string; phone: string; email: string }>;
  /** Day-by-day agenda for multi-day events. */
  days?: RichEventDay[];
  /** Speakers and trainers extracted from the document. */
  people?: RichEventPerson[];
};

export type RichEventDay = {
  date: string;      // YYYY-MM-DD or ''
  theme: string;
  venue: string;
  startTime: string; // HH:mm or ''
  endTime: string;   // HH:mm or ''
  sessions: { time: string; title: string; venue: string; facilitator: string }[];
};

export type RichEventPerson = {
  fullName: string;
  title: string;
  organization: string;
  bio: string;
  /** WORKSHOP | PANEL | GUEST | TRAINER */
  speakerType: string;
};

function titleCase(value: string) {
  return value.replace(/\b\w/g, (c) => c.toUpperCase());
}

function heuristicDraft(prompt: string): EventDraft {
  const clean = prompt.trim().replace(/\s+/g, ' ');
  const topicMatch = clean.match(/(?:teach|learn|about|on|for|introduce|cover)\s+(.*)/i);
  const topic = (topicMatch?.[1] ?? clean).replace(/[.?!]+$/, '');
  const audienceMatch = clean.match(/(first[- ]?year|second[- ]?year|final[- ]?year|freshers?|beginners?|students?|developers?|members?)/i);
  const audience = audienceMatch ? titleCase(audienceMatch[0]) : 'Students and community members';
  const shortTopic = topic.split(/,| and | using | with /i)[0].trim();

  const title = titleCase(shortTopic.length > 4 ? shortTopic : clean).slice(0, 90);

  const description =
    `This session introduces participants to ${topic}. ` +
    `Through guided, hands-on activities, attendees will build practical skills they can apply immediately. ` +
    `Come ready to learn, collaborate, and leave with real experience.`;

  const agenda = [
    'Welcome & introductions',
    `Fundamentals of ${shortTopic}`,
    'Hands-on walkthrough / live demo',
    'Guided practice & Q&A',
    'Wrap-up, next steps, and resources',
  ];

  const outcomes = [
    `Understand the core concepts of ${shortTopic}`,
    'Apply what they learned in a practical exercise',
    'Know where to go next to keep improving',
  ];

  return { title, description, agenda, audience, outcomes };
}

async function openAiDraft(prompt: string): Promise<EventDraft | null> {
  if (!isAiConfigured()) return null;
  try {
    const content = await aiChat({
      temperature: 0.7,
      jsonMode: true,
      messages: [
        {
          role: 'system',
          content:
            'You are an assistant that drafts community event details. ' +
            'Respond ONLY with a JSON object: { "title": string, "description": string, ' +
            '"agenda": string[], "audience": string, "outcomes": string[] }.',
        },
        { role: 'user', content: prompt },
      ],
    });

    const parsed = parseJsonLoose<Partial<EventDraft>>(content);
    if (!parsed) return null;
    return {
      title: String(parsed.title ?? '').slice(0, 120),
      description: String(parsed.description ?? ''),
      agenda: Array.isArray(parsed.agenda) ? parsed.agenda.map(String) : [],
      audience: String(parsed.audience ?? ''),
      outcomes: Array.isArray(parsed.outcomes) ? parsed.outcomes.map(String) : [],
    };
  } catch {
    return null;
  }
}

export async function generateEventDraft(prompt: string): Promise<EventDraft & { source: 'ai' | 'template' }> {
  const trimmed = prompt.trim();
  if (!trimmed) {
    throw new Error('Describe the event you want to create');
  }

  const ai = await openAiDraft(trimmed);
  if (ai && ai.title) {
    return { ...ai, source: 'ai' };
  }
  return { ...heuristicDraft(trimmed), source: 'template' };
}

// ---------------------------------------------------------------------------
// Document parsing — extract event details from PDF / DOCX / TXT
// ---------------------------------------------------------------------------

const ALLOWED_DOC_MIMES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
] as const;

export type AllowedDocMime = (typeof ALLOWED_DOC_MIMES)[number];

export function isAllowedDocMime(mime: string): mime is AllowedDocMime {
  return (ALLOWED_DOC_MIMES as readonly string[]).includes(mime);
}

async function extractDocText(buffer: Buffer, mimetype: string): Promise<string> {
  if (mimetype === 'application/pdf') {
    // pdf-parse v2 API: class-based parser (see community-upload.routes.ts).
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      return result.text.trim();
    } finally {
      await parser.destroy();
    }
  }
  if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return result.value.trim();
  }
  // plain text / markdown
  return buffer.toString('utf-8').trim();
}

async function aiParseDoc(text: string, dayMode: 'single' | 'multi' | 'auto'): Promise<RichEventDraft | null> {
  if (!isAiConfigured()) return null;
  try {
    // TWO smaller calls instead of one giant schema: this Gemma thinking model
    // burns its whole output budget on <thought> when asked for the full schema
    // at once (finish_reason: length, no JSON) — smaller prompts finish reliably.
    // Run them in PARALLEL: sequential calls can exceed the 5-minute no-headers
    // fetch timeout of the CALLER hitting our route (browser/Node alike).
    const [core, days] = await Promise.all([
      aiParseDocCore(text),
      dayMode === 'single' ? Promise.resolve<RichEventDay[]>([]) : aiParseDocDays(text),
    ]);
    if (!core) return null;
    return { ...core, days };
  } catch {
    return null;
  }
}

/** Call 1 — everything except the day-by-day agenda. */
async function aiParseDocCore(text: string): Promise<Omit<RichEventDraft, 'days'> | null> {
  try {
    const content = await aiChat({
      temperature: 0.2,
      jsonMode: true,
      // Stream so long generations don't die on Node's 5-minute no-headers fetch timeout.
      stream: true,
      messages: [
        {
          role: 'system',
          content:
            'You extract structured event information from documents. ' +
            'Respond ONLY with a JSON object: ' +
            '{ "title": string, "summary": string, "description": string, "agenda": string[], ' +
            '"audience": string, "outcomes": string[], "features": string[], "theme": string, ' +
            '"date": "YYYY-MM-DD or empty string", ' +
            '"startTime": "HH:mm or empty string", "endTime": "HH:mm or empty string", ' +
            '"venue": string, ' +
            '"address": "full street/building address or empty string", ' +
            '"meetingLink": "Zoom/Teams/Meet URL or empty string", ' +
            '"type": "WORKSHOP|SEMINAR|WEBINAR|HACKATHON|BOOTCAMP|COMPETITION|CONFERENCE|MEETUP|TRAINING|VOLUNTEER|FIELD_TRIP|OTHER", ' +
            '"mode": "PHYSICAL|VIRTUAL|HYBRID", ' +
            '"timezone": "IANA timezone or abbreviation or empty string", ' +
            '"tags": string[], ' +
            '"refreshments": true or false, ' +
            '"capacity": number (0 if not stated), ' +
            '"registrationDeadline": "YYYY-MM-DD or empty string", ' +
            '"ticketPrice": number in NGN (0 if free or not stated), ' +
            '"contacts": [ { "name": string, "phone": string, "email": string } ], ' +
            '"people": [ { "fullName": string, "title": string, "organization": string, "bio": string, ' +
            '"speakerType": "WORKSHOP|PANEL|GUEST|TRAINER" } ] }. ' +
            '"summary" is a punchy 1-2 sentence blurb (max 160 characters) for event cards — write it yourself, do NOT copy the description. ' +
            '"description" is the full about-text. ' +
            '"features" are attendee-facing perks/highlights (e.g. refreshments, certificates, swag, wifi, hands-on labs). ' +
            '"refreshments" is true only if the document explicitly mentions food/drinks/refreshments being provided. ' +
            '"contacts" are the organizer contact persons listed for attendee inquiries — extract name, phone, and email for each. ' +
            'For multi-day events, "date" is the FIRST day and "endTime" the last day\'s end. ' +
            '"people" contains every speaker, trainer, panelist or facilitator mentioned in the document. ' +
            'Use "TRAINER" for trainers/facilitators, "PANEL" for panelists, "WORKSHOP" for workshop speakers, "GUEST" for all others. ' +
            'Use empty string or empty array for any field not present in the document. Never guess dates.',
        },
        {
          role: 'user',
          content: `Extract all event details from this document:\n\n${text.slice(0, 8000)}`,
        },
      ],
    });
    const parsed = parseJsonLoose<Partial<RichEventDraft> & { people?: unknown[]; contacts?: unknown[] }>(content);
    if (!parsed) return null;

    const VALID_TYPES = ['WORKSHOP','SEMINAR','WEBINAR','HACKATHON','BOOTCAMP','COMPETITION','CONFERENCE','MEETUP','TRAINING','VOLUNTEER','FIELD_TRIP','OTHER'];
    const VALID_MODES = ['PHYSICAL', 'VIRTUAL', 'HYBRID'];
    const VALID_SPEAKER_TYPES = ['WORKSHOP', 'PANEL', 'GUEST', 'TRAINER'];

    const people: RichEventPerson[] = Array.isArray(parsed.people)
      ? (parsed.people as unknown[])
          .filter((p): p is Record<string, unknown> => typeof p === 'object' && p !== null)
          .map((p) => ({
            fullName: String(p.fullName ?? '').slice(0, 120),
            title: String(p.title ?? '').slice(0, 120),
            organization: String(p.organization ?? '').slice(0, 120),
            bio: String(p.bio ?? '').slice(0, 600),
            speakerType: VALID_SPEAKER_TYPES.includes(String(p.speakerType ?? '').toUpperCase())
              ? String(p.speakerType).toUpperCase()
              : 'GUEST',
          }))
          .filter((p) => p.fullName)
      : [];

    const contacts = Array.isArray(parsed.contacts)
      ? (parsed.contacts as unknown[])
          .filter((c): c is Record<string, unknown> => typeof c === 'object' && c !== null)
          .map((c) => ({
            name: String(c.name ?? '').slice(0, 60),
            phone: String(c.phone ?? '').slice(0, 30),
            email: String(c.email ?? '').slice(0, 120),
          }))
          .filter((c) => c.name || c.phone || c.email)
          .slice(0, 3)
      : [];

    const rawCapacity = Number(parsed.capacity ?? 0);
    const capacity = Number.isFinite(rawCapacity) && rawCapacity > 0 ? Math.round(rawCapacity) : 0;

    const rawPrice = Number(parsed.ticketPrice ?? 0);
    const ticketPrice = Number.isFinite(rawPrice) && rawPrice > 0 ? Math.round(rawPrice) : 0;

    return {
      title: String(parsed.title ?? '').slice(0, 120),
      summary: String(parsed.summary ?? '').slice(0, 160),
      description: String(parsed.description ?? ''),
      agenda: Array.isArray(parsed.agenda) ? parsed.agenda.map(String) : [],
      audience: String(parsed.audience ?? ''),
      outcomes: Array.isArray(parsed.outcomes) ? parsed.outcomes.map(String) : [],
      features: Array.isArray(parsed.features) ? parsed.features.map((f) => String(f).slice(0, 80)).filter(Boolean).slice(0, 10) : [],
      theme: String(parsed.theme ?? '').slice(0, 120),
      date: /^\d{4}-\d{2}-\d{2}$/.test(String(parsed.date ?? '')) ? String(parsed.date) : '',
      startTime: /^\d{2}:\d{2}$/.test(String(parsed.startTime ?? '')) ? String(parsed.startTime) : '',
      endTime: /^\d{2}:\d{2}$/.test(String(parsed.endTime ?? '')) ? String(parsed.endTime) : '',
      venue: String(parsed.venue ?? '').slice(0, 200),
      address: String(parsed.address ?? '').slice(0, 300),
      meetingLink: String(parsed.meetingLink ?? '').slice(0, 500),
      type: VALID_TYPES.includes(String(parsed.type ?? '').toUpperCase()) ? String(parsed.type).toUpperCase() : '',
      mode: VALID_MODES.includes(String(parsed.mode ?? '').toUpperCase()) ? String(parsed.mode).toUpperCase() : '',
      timezone: String(parsed.timezone ?? '').slice(0, 80),
      tags: Array.isArray(parsed.tags) ? parsed.tags.map(String).slice(0, 10) : [],
      refreshments: Boolean(parsed.refreshments),
      capacity,
      registrationDeadline: /^\d{4}-\d{2}-\d{2}$/.test(String(parsed.registrationDeadline ?? '')) ? String(parsed.registrationDeadline) : '',
      ticketPrice,
      contacts,
      people,
    };
  } catch {
    return null;
  }
}

/** Call 2 — day-by-day agenda only (small schema so the thinking model finishes). Best-effort: [] on any failure. */
async function aiParseDocDays(text: string): Promise<RichEventDay[]> {
  try {
    const content = await aiChat({
      temperature: 0.2,
      jsonMode: true,
      stream: true,
      messages: [
        {
          role: 'system',
          content:
            'You extract the day-by-day programme of an event from a document. ' +
            'Respond ONLY with a JSON object: ' +
            '{ "days": [ { "date": "YYYY-MM-DD or empty", "theme": string, "venue": string, ' +
            '"startTime": "HH:mm or empty", "endTime": "HH:mm or empty", ' +
            '"sessions": [ { "time": "HH:mm or empty", "title": string, "venue": string, "facilitator": string } ] } ] }. ' +
            'One entry per event day, in order. "theme" is that day\'s sub-theme/focus if stated. ' +
            'If the event is a single day or no per-day programme is given, return { "days": [] }. Never guess dates.',
        },
        {
          role: 'user',
          content: `Extract the day-by-day programme from this document:\n\n${text.slice(0, 8000)}`,
        },
      ],
    });
    const parsed = parseJsonLoose<{ days?: unknown[] }>(content);
    if (!parsed || !Array.isArray(parsed.days)) return [];

    const TIME = /^\d{2}:\d{2}$/;
    const cleanTime = (v: unknown) => (TIME.test(String(v ?? '')) ? String(v) : '');
    return parsed.days
      .filter((d): d is Record<string, unknown> => typeof d === 'object' && d !== null)
      .slice(0, 14)
      .map((d) => ({
        date: /^\d{4}-\d{2}-\d{2}$/.test(String(d.date ?? '')) ? String(d.date) : '',
        theme: String(d.theme ?? '').slice(0, 120),
        venue: String(d.venue ?? '').slice(0, 160),
        startTime: cleanTime(d.startTime),
        endTime: cleanTime(d.endTime),
        sessions: Array.isArray(d.sessions)
          ? d.sessions
              .filter((s): s is Record<string, unknown> => typeof s === 'object' && s !== null)
              .slice(0, 8)
              .map((s) => ({
                time: cleanTime(s.time),
                title: String(s.title ?? '').slice(0, 120),
                venue: String(s.venue ?? '').slice(0, 160),
                facilitator: String(s.facilitator ?? '').slice(0, 80),
              }))
              .filter((s) => s.title)
          : [],
      }));
  } catch {
    return [];
  }
}

/**
 * Parse an uploaded document buffer and extract event details using AI.
 * Falls back to a heuristic draft when AI is not configured or returns nothing useful.
 */
export async function parseDocumentForEvent(
  buffer: Buffer,
  mimetype: string,
  dayMode: 'single' | 'multi' | 'auto' = 'auto',
): Promise<RichEventDraft & { source: 'ai' | 'template' }> {
  const text = await extractDocText(buffer, mimetype);
  if (!text) throw new Error('Could not extract text from the uploaded document');

  const ai = await aiParseDoc(text, dayMode);
  if (ai && ai.title) {
    return { ...ai, source: 'ai' };
  }

  // Fallback — use the first non-empty line as a prompt seed
  const firstLine = text.split('\n').find((l) => l.trim()) ?? 'Event';
  return {
    ...heuristicDraft(firstLine),
    summary: '',
    theme: '',
    date: '',
    startTime: '',
    endTime: '',
    venue: '',
    address: '',
    meetingLink: '',
    type: '',
    mode: '',
    timezone: '',
    tags: [],
    features: [],
    refreshments: false,
    capacity: 0,
    registrationDeadline: '',
    ticketPrice: 0,
    contacts: [],
    days: [],
    people: [],
    source: 'template',
  };
}

type CertificateWordingInput = { eventTitle: string; type?: string; communityName?: string };

function certificateWordingTemplate(input: CertificateWordingInput) {
  const typeMap: Record<string, string> = {
    ATTENDANCE: 'active participation in',
    COMPLETION: 'the successful completion of',
    LEADERSHIP: 'outstanding leadership at',
    VOLUNTEER: 'dedicated volunteer service at',
  };
  const reason = typeMap[input.type ?? 'ATTENDANCE'] ?? 'participation in';
  const org = input.communityName ? `, organized by ${input.communityName}` : '';
  return {
    presentation: `in recognition of ${reason}`.slice(0, 90),
    message: `Awarded in appreciation of exceptional commitment, effort and contribution to ${input.eventTitle}${org}.`.slice(0, 260),
  };
}

export async function generateCertificateWording(
  input: CertificateWordingInput,
): Promise<{ presentation: string; message: string; source: 'ai' | 'template' }> {
  const fallback = certificateWordingTemplate(input);
  if (!isAiConfigured()) {
    return { ...fallback, source: 'template' };
  }
  try {
    const content = await aiChat({
      temperature: 0.8,
      jsonMode: true,
      messages: [
        {
          role: 'system',
          content:
            'You write elegant, formal certificate wording. Respond ONLY with a JSON object: ' +
            '{ "presentation": string, "message": string }. ' +
            '"presentation" is a short lead-in phrase shown before the event name (max ~70 chars, e.g. "in recognition of outstanding participation in"). ' +
            '"message" is one refined sentence of praise (max ~220 chars). No names, no placeholders, no quotes.',
        },
        {
          role: 'user',
          content: `Event: ${input.eventTitle}\nCertificate type: ${input.type ?? 'ATTENDANCE'}\nCommunity: ${input.communityName ?? ''}`,
        },
      ],
    });
    const parsed = parseJsonLoose<{ presentation?: string; message?: string }>(content);
    if (!parsed) return { ...fallback, source: 'template' };
    const presentation = String(parsed.presentation ?? '').replace(/\s+/g, ' ').trim().slice(0, 90);
    const message = String(parsed.message ?? '').replace(/\s+/g, ' ').trim().slice(0, 260);
    if (!presentation && !message) return { ...fallback, source: 'template' };
    return {
      presentation: presentation || fallback.presentation,
      message: message || fallback.message,
      source: 'ai',
    };
  } catch {
    return { ...fallback, source: 'template' };
  }
}
