export type CommunityVisibility = 'PUBLIC' | 'PRIVATE';

export type ChatPlatform = 'WHATSAPP' | 'DISCORD' | 'TELEGRAM' | 'SLACK' | 'OTHER';
export type ChatLink = { platform: ChatPlatform; url: string; label?: string };

export const MAX_CHAT_LINKS = 5;

export const CHAT_PLATFORM_OPTIONS: Array<{ value: ChatPlatform; label: string; placeholder: string }> = [
  { value: 'WHATSAPP', label: 'WhatsApp', placeholder: 'https://chat.whatsapp.com/…' },
  { value: 'DISCORD', label: 'Discord', placeholder: 'https://discord.gg/…' },
  { value: 'TELEGRAM', label: 'Telegram', placeholder: 'https://t.me/…' },
  { value: 'SLACK', label: 'Slack', placeholder: 'https://join.slack.com/…' },
  { value: 'OTHER', label: 'Other', placeholder: 'https://…' },
];

// Mirrors the backend host allow-lists (defense in depth + instant feedback).
const CHAT_HOST_PATTERNS: Partial<Record<ChatPlatform, RegExp>> = {
  WHATSAPP: /^(chat\.|www\.)?whatsapp\.com$/i,
  DISCORD: /^(discord\.gg|(www\.)?discord\.com)$/i,
  TELEGRAM: /^(t\.me|telegram\.me)$/i,
  SLACK: /^([a-z0-9-]+\.)?slack\.com$/i,
};

export function isValidChatLink(link: ChatLink): boolean {
  try {
    const parsed = new URL(link.url.trim());
    if (parsed.protocol !== 'https:') return false;
    const pattern = CHAT_HOST_PATTERNS[link.platform];
    return pattern ? pattern.test(parsed.hostname) : true;
  } catch {
    return false;
  }
}

export type CommunityCreateInput = {
  name: string;
  shortDescription: string;
  description?: string;
  logo: string;
  coverImage?: string;
  category: string;
  university: string;
  faculty?: string;
  department?: string;
  whatsappLink?: string;
  channelLink?: string;
  chatLinks?: ChatLink[];
  rules?: string[];
  visibility: CommunityVisibility;
  autoApprove?: boolean;
  verificationMethod?: 'UNIVERSITY_EMAIL' | 'ENDORSEMENT' | 'MANUAL' | 'NONE';
  endorsementLetter?: string;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function toAbsoluteUploadUrl(path: string) {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (path.startsWith('/')) return `${API_BASE_URL}${path}`;
  return `${API_BASE_URL}/${path}`;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(init?.headers ?? {}),
    },
    credentials: 'include',
    ...init,
  });

  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };

  if (!response.ok) {
    const errorMessage = typeof payload === 'object' && payload && 'error' in payload && payload.error ? payload.error : 'Request failed';
    throw new Error(errorMessage);
  }

  return payload;
}

export async function uploadCommunityImages(payload: FormData) {
  const uploaded = await requestJson<{ logo: string; coverImage: string }>('/api/communities/upload', {
    method: 'POST',
    body: payload,
  });

  return {
    ...uploaded,
    logo: toAbsoluteUploadUrl(uploaded.logo),
    coverImage: toAbsoluteUploadUrl(uploaded.coverImage),
  };
}

export async function uploadEndorsementLetter(file: File) {
  const payload = new FormData();
  payload.append('letter', file);
  const uploaded = await requestJson<{ letter: string; fileName: string }>('/api/communities/upload/endorsement-letter', {
    method: 'POST',
    body: payload,
  });
  return { ...uploaded, letter: toAbsoluteUploadUrl(uploaded.letter) };
}

export async function createCommunity(payload: CommunityCreateInput) {
  return requestJson<{ community: unknown }>('/api/communities', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export type InstitutionOption = { _id: string; name: string; aliases: string[]; country: string };

export async function listInstitutions() {
  return requestJson<{ institutions: InstitutionOption[] }>('/api/institutions');
}
