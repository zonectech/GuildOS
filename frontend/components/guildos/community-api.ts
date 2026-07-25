export type CommunityVisibility = 'PUBLIC' | 'PRIVATE';

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
  rules?: string[];
  visibility: CommunityVisibility;
  autoApprove?: boolean;
  verificationMethod?: 'UNIVERSITY_EMAIL' | 'ENDORSEMENT' | 'MANUAL';
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
