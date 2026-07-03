const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    credentials: 'include',
    ...init,
  });
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    const message = typeof payload === 'object' && payload && 'error' in payload && payload.error ? payload.error : 'Request failed';
    throw new Error(message);
  }
  return payload;
}

export type VerificationViewer = { id: string; fullName: string; username: string; avatar: string };

export type VerificationRecentView = {
  id: string;
  source: 'PROFILE' | 'CERTIFICATE';
  viewerRole: 'STUDENT' | 'COMMUNITY_LEADER' | 'RECRUITER' | 'ADMIN' | 'ANON';
  createdAt: string;
  viewer: VerificationViewer | null;
  label: string;
};

export type VerificationCenter = {
  stats: {
    certificatesVerified: number;
    profileViews: number;
    profileViews30d: number;
    recruiterViews: number;
    certificateViews: number;
  };
  recent: VerificationRecentView[];
};

export async function getVerificationCenter() {
  return requestJson<VerificationCenter>('/api/verification/center');
}

export function resolveViewerAvatar(avatar?: string) {
  if (!avatar) return '';
  if (avatar.startsWith('http')) return avatar;
  if (avatar.startsWith('/')) return `${API_BASE_URL}${avatar}`;
  return `${API_BASE_URL}/uploads/${avatar}`;
}
