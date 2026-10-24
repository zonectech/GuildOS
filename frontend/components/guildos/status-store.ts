import { getMyCertificates, getMyEventRegistrations } from './event-api';

export type StatusStoryKind =
  | 'event'
  | 'update'
  | 'milestone';

export type StatusStory = {
  id: string;
  userId: string | null;

  name: string;
  avatar?: string;

  label: string;
  description: string;

  kind: StatusStoryKind;
  accent: string;

  href: string;

  createdAt: string;
  expiresAt?: string;

  viewed: boolean;

  /** True when the signed-in user posted this story. */
  isOwner?: boolean;

  /** Set when a leader posted on behalf of a community (name/avatar are the community's). */
  community?: { id: string; slug: string; name: string; logo: string } | null;

  /** Stories group per person, or per community for community posts. */
  groupKey?: string | null;

  /** Event, ticket or certificate card shown on the story (built by the server). */
  attachment?: StatusAttachment | null;
};

/** What a status can carry. *_UPLOAD = an image the user uploaded themselves (not verified by GuildOS). */
export type StatusAttachmentType = 'EVENT' | 'TICKET' | 'CERTIFICATE' | 'TICKET_UPLOAD' | 'CERTIFICATE_UPLOAD';

/** The tabs of the composer's picker. */
export type StatusPickerType = 'EVENT' | 'TICKET' | 'CERTIFICATE';

export type StatusAttachment = {
  type: StatusAttachmentType;
  /** Event _id, or the certificate serial. */
  refId: string;
  slug: string;
  title: string;
  subtitle: string;
  image: string;
  startsAt: string | null;
  mode: string;
  venue: string;
  /** In-app link opened when the card is tapped. */
  href: string;
  /** Certificates only: the detail used to draw the certificate. */
  snapshot: Record<string, unknown> | null;
};

/** What the client sends: the server rebuilds the card from this. */
export type StatusAttachmentInput = {
  type: StatusAttachmentType;
  /** Event id or slug, a certificate serial, or (uploads) the /uploads path. */
  id: string;
  /** Uploads only: what to call it. */
  title?: string;
};

/** One row in the composer's picker. */
export type StatusAttachmentOption = {
  type: StatusPickerType;
  id: string;
  title: string;
  subtitle?: string;
  image?: string;
  startsAt?: string | null;
};

export type StatusViewerEntry = {
  id: string;
  name: string;
  avatar?: string;
  viewedAt: string;
};

export const STATUS_MAX_LENGTH = 500;

export const STATUS_COLORS = [
  { name: 'Teal', accent: 'from-emerald-500 to-teal-500', color: '#059669' },
  { name: 'Purple', accent: 'from-violet-500 to-purple-500', color: '#7c3aed' },
  { name: 'Amber', accent: 'from-amber-500 to-orange-500', color: '#d97706' },
  { name: 'Pink', accent: 'from-rose-500 to-pink-500', color: '#db2777' },
  { name: 'Blue', accent: 'from-sky-500 to-cyan-500', color: '#0284c7' },
  { name: 'Red', accent: 'from-red-500 to-orange-500', color: '#dc2626' },
];

/** One entry per person: their first story plus a seen/unseen flag for each of their stories. */
export type StatusPerson = StatusStory & {
  /** One entry per story, oldest first (the order they play): true = already seen. */
  segments: boolean[];
};

export function getStatusPeople(stories: StatusStory[]): StatusPerson[] {
  const groups = new Map<string, StatusStory[]>();

  for (const story of stories) {
    const key = story.groupKey ?? story.userId ?? `story-${story.id}`;
    const list = groups.get(key);

    if (list) {
      list.push(story);
    } else {
      groups.set(key, [story]);
    }
  }

  return Array.from(groups.values()).map((list) => {
    const oldestFirst = [...list].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    return {
      ...list[0],
      viewed: list.every((story) => story.viewed),
      segments: oldestFirst.map((story) => story.viewed),
    };
  });
}

export function statusShareHref(input: {
  content?: string;
  title?: string;
  kind?: StatusStoryKind;
  /** Pre-select an event, ticket or certificate in the composer. */
  attach?: StatusAttachmentInput;
  /** Pre-select "Post as" this community (leaders only — the server checks). */
  asCommunity?: string;
}): string {
  const params = new URLSearchParams();
  if (input.asCommunity) params.set('as', input.asCommunity);
  if (input.content) params.set('content', input.content);
  if (input.kind) params.set('kind', input.kind);
  if (input.title) params.set('title', input.title);
  if (input.attach) {
    params.set('attach', input.attach.type.toLowerCase());
    params.set('id', input.attach.id);
  }
  const query = params.toString();
  return query ? `/status/new?${query}` : '/status/new';
}

/**
 * Share link for a registration (a ticket). A ticket card means "I'm going", so it
 * is only used while the event is still ahead or running; afterwards the event card.
 */
export function registrationShareHref(
  status: string,
  event: { slug: string; title: string; startDate?: string | null; endDate?: string | null },
): string {
  // No end date: a day of grace after the start (events run late).
  const endsAt = event.endDate || event.startDate;
  const ended = endsAt
    ? new Date(endsAt).getTime() + (event.endDate ? 0 : 24 * 60 * 60 * 1000) < Date.now()
    : false;
  const eventCard = { type: 'EVENT', id: event.slug } as const;

  if (status === 'COMPLETED') {
    return statusShareHref({ attach: eventCard, content: `I completed ${event.title}!` });
  }
  if (status === 'CHECKED_OUT' || (ended && status === 'PARTIAL_ATTENDANCE')) {
    return statusShareHref({ attach: eventCard, content: `I attended ${event.title}!` });
  }
  if (ended) {
    return statusShareHref({ attach: eventCard });
  }
  if (status === 'CHECKED_IN' || status === 'PARTIAL_ATTENDANCE') {
    return statusShareHref({ attach: { type: 'TICKET', id: event.slug }, content: `I'm attending ${event.title}!` });
  }
  // CONFIRMED: the composer pre-fills "I'm going to … See you there."
  return statusShareHref({ attach: { type: 'TICKET', id: event.slug } });
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:3001';

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(
    `${API_BASE}${path}`,
    {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers ?? {}),
      },
    },
  );

  if (!response.ok) {
    let message = 'Status request failed';

    try {
      const body = await response.json();

      if (body?.error) {
        message = body.error;
      }
    } catch {
      // Ignore invalid error responses.
    }

    throw new Error(message);
  }

  return response.json();
}

export async function readStatusStories(): Promise<StatusStory[]> {
  const response = await request<{ statuses: StatusStory[] }>('/api/status');

  return response.statuses ?? [];
}

export async function getStatusById(
  id: string,
): Promise<StatusStory | null> {
  try {
    const response = await request<{ status: StatusStory }>(
      `/api/status/${encodeURIComponent(id)}`,
    );

    return response.status ?? null;
  } catch {
    return null;
  }
}

export async function saveStatusStory(input: {
  content: string;
  title?: string;
  kind?: StatusStoryKind;
  accent?: string;
  attachment?: StatusAttachmentInput;
  /** Post on behalf of a community the user leads. */
  communityId?: string;
}): Promise<StatusStory> {
  const response = await request<{ status: StatusStory }>('/api/status', {
    method: 'POST',
    body: JSON.stringify({
      content: input.content,
      title: input.title,
      kind: input.kind ?? 'update',
      accent: input.accent,
      attachment: input.attachment,
      communityId: input.communityId || undefined,
    }),
  });

  return response.status;
}

/**
 * Records a view. Resolves to true when the server counted it
 * (it does not count when you view your own status).
 */
export async function markStatusViewed(id: string): Promise<boolean> {
  const response = await request<{ viewed?: boolean }>(
    `/api/status/${encodeURIComponent(id)}/view`,
    {
      method: 'POST',
      body: JSON.stringify({}),
    },
  );

  return Boolean(response?.viewed);
}

/**
 * Owner only: who has viewed one of your statuses.
 */
export async function getStatusViewers(
  id: string,
): Promise<{ count: number; viewers: StatusViewerEntry[] }> {
  const response = await request<{
    count?: number;
    viewers?: StatusViewerEntry[];
  }>(`/api/status/${encodeURIComponent(id)}/views`);

  return {
    count: response.count ?? 0,
    viewers: response.viewers ?? [],
  };
}

/**
 * Report someone else's status. Resolves with `already: true`
 * when this user has reported it before.
 */
export async function reportStatus(
  id: string,
  reason = '',
): Promise<{ reported: boolean; already: boolean }> {
  const response = await request<{ reported?: boolean; already?: boolean }>(
    `/api/status/${encodeURIComponent(id)}/report`,
    {
      method: 'POST',
      body: JSON.stringify({ reason }),
    },
  );

  return {
    reported: Boolean(response.reported),
    already: Boolean(response.already),
  };
}

export async function deleteStatusStory(id: string): Promise<void> {
  await request(`/api/status/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

/**
 * Ask the server to build (and validate) the card for an event, ticket or
 * certificate. The preview is exactly what will be posted, plus the default caption.
 */
export async function previewStatusAttachment(
  input: StatusAttachmentInput,
): Promise<{ attachment: StatusAttachment; defaultCaption: string }> {
  return request<{ attachment: StatusAttachment; defaultCaption: string }>(
    '/api/status/attachment-preview',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

const TICKET_REGISTRATION_STATUSES = ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'COMPLETED', 'PARTIAL_ATTENDANCE'];

function toEventOption(
  raw: unknown,
  type: 'EVENT' | 'TICKET',
): StatusAttachmentOption | null {
  const entry = (raw ?? {}) as Record<string, unknown>;
  const event = (entry.event as Record<string, unknown> | undefined) ?? entry;

  // Tickets are registrations: waitlisted / pending / cancelled / rejected ones aren't shareable.
  const registrationStatus = str(entry.registrationStatus);
  if (type === 'TICKET' && registrationStatus && !TICKET_REGISTRATION_STATUSES.includes(registrationStatus)) {
    return null;
  }

  // Prefer the slug: the server accepts a slug or an id.
  const id = str(event.slug) || str(event._id) || str(event.eventId) || str(event.id);
  const title = str(event.title) || str(event.eventTitle);

  if (!id || !title) {
    return null;
  }

  return {
    type,
    id,
    title,
    image: str(event.bannerImage),
    startsAt: str(event.startDate) || str(event.startsAt) || null,
    subtitle: event.mode === 'VIRTUAL' ? 'Online' : str(event.venue),
  };
}

function toCertificateOption(raw: unknown): StatusAttachmentOption | null {
  const certificate = (raw ?? {}) as Record<string, unknown>;
  const serial = str(certificate.serial);
  const title = str(certificate.eventTitle) || str(certificate.title);
  const status = str(certificate.status);

  if (!serial || !title || (status && status !== 'VERIFIED')) {
    return null;
  }

  return {
    type: 'CERTIFICATE',
    id: serial,
    title,
    subtitle: str(certificate.communityName),
    startsAt: str(certificate.issuedAt) || str(certificate.issueDate) || null,
  };
}

/** A ticket is a registration for an event that is still ahead (or running). */
function toTicketOption(raw: unknown): StatusAttachmentOption | null {
  const entry = (raw ?? {}) as Record<string, unknown>;
  const registration = (entry.registration ?? {}) as Record<string, unknown>;
  const event = (entry.event ?? {}) as Record<string, unknown>;

  if (!TICKET_REGISTRATION_STATUSES.includes(str(registration.status))) {
    return null;
  }

  const endsAt = str(event.endDate) || str(event.startDate);
  if (endsAt) {
    // Tickets are for upcoming events. No end date: a day of grace after the start.
    const end = new Date(endsAt).getTime() + (event.endDate ? 0 : 24 * 60 * 60 * 1000);
    if (!Number.isNaN(end) && end < Date.now()) {
      return null;
    }
  }

  const id = str(event.slug) || str(event.id) || str(event._id);
  const title = str(event.title);

  if (!id || !title) {
    return null;
  }

  return {
    type: 'TICKET',
    id,
    title,
    image: str(event.bannerImage),
    startsAt: str(event.startDate) || null,
    subtitle: event.mode === 'VIRTUAL' ? 'Online' : str(event.venue),
  };
}

/** What the composer's picker lists for each tab. */
export async function listAttachmentOptions(
  type: StatusPickerType,
): Promise<StatusAttachmentOption[]> {
  if (type === 'CERTIFICATE') {
    const { certificates } = await getMyCertificates();
    return (certificates as unknown[])
      .map(toCertificateOption)
      .filter((option): option is StatusAttachmentOption => option !== null);
  }

  if (type === 'TICKET') {
    // Registrations for upcoming events, soonest first.
    const { registrations } = await getMyEventRegistrations();
    const seen = new Set<string>();

    return (registrations as unknown[])
      .map(toTicketOption)
      .filter((option): option is StatusAttachmentOption => option !== null)
      .filter((option) => {
        if (seen.has(option.id)) return false;
        seen.add(option.id);
        return true;
      })
      .sort(
        (a, b) =>
          (a.startsAt ? new Date(a.startsAt).getTime() : 0) -
          (b.startsAt ? new Date(b.startsAt).getTime() : 0),
      );
  }

  const { events } = await request<{ events: unknown[] }>('/api/events');
  return (events ?? [])
    .map((entry) => toEventOption(entry, 'EVENT'))
    .filter((option): option is StatusAttachmentOption => option !== null);
}

/**
 * Upload the user's own ticket / certificate image. Resolves to its /uploads path,
 * which is then attached with type TICKET_UPLOAD / CERTIFICATE_UPLOAD.
 */
export async function uploadStatusImage(file: File): Promise<string> {
  const body = new FormData();
  body.append('image', file);

  const response = await fetch(`${API_BASE}/api/status/upload`, {
    method: 'POST',
    body,
    credentials: 'include',
  });

  const payload = (await response.json().catch(() => ({}))) as { image?: string; error?: string };

  if (!response.ok || !payload.image) {
    throw new Error(payload.error || 'Upload failed');
  }

  return payload.image;
}