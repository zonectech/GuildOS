export type AuthUser = {
  id: string;
  fullName: string;
  email: string;
  role: 'STUDENT' | 'COMMUNITY_LEADER' | 'ADMIN' | 'RECRUITER';
  emailVerified: boolean;
  profileComplete: boolean;
  profile: {
    username: string;
    phoneNumber: string;
    showPhoneNumber: boolean;
    /** Spam control: recruiters may DM without a connection only when true. */
    allowRecruiterMessages?: boolean;
    /** What this user's delete button does in chats (account-wide preference). */
    messageDeleteScope?: 'EVERYONE' | 'ME';
    bio: string;
    location: string;
    showLocation: boolean;
    socialLinks: string[];
    showSocialLinks: boolean;
    graduationYear: number | null;
    profileVisibility: 'PUBLIC' | 'PRIVATE' | 'UNLISTED';
    showEmail: boolean;
    showUniversity: boolean;
    showLeadership: boolean;
    showCertificates: boolean;
    showTimeline: boolean;
    availability: 'OPEN' | 'CASUAL' | 'CLOSED';
    jobSeeking: boolean;
    internshipSeeking: boolean;
    openToRelocation: boolean;
    preferredIndustries: string[];
    university: string;
    faculty: string;
    department: string;
    level: string;
    interests: string[];
    skills: string[];
    avatar: string;
    coverImage: string;
  };
  createdAt: string;
  updatedAt: string;
};

export type AuthSession = {
  user: AuthUser;
  needsVerification?: boolean;
  message: string;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const CURRENT_USER_STORAGE_KEY = 'guildos-current-user';

let currentUserCache: AuthUser | null | undefined;

/**
 * The API lives on another site (Azure), so its session cookie is invisible to
 * this app's middleware. Mirror a "signed in" marker on our own domain for page
 * gating only; the API still authenticates every request with its own cookie.
 */
export const SESSION_MARKER_COOKIE = 'guildos_session';
const SESSION_MARKER_MAX_AGE = 60 * 60 * 24 * 30; // matches the refresh-token lifetime

function writeSessionMarker(user: AuthUser | null) {
  if (typeof document === 'undefined') return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = user
    ? `${SESSION_MARKER_COOKIE}=${encodeURIComponent(user.role)}; Path=/; Max-Age=${SESSION_MARKER_MAX_AGE}; SameSite=Lax${secure}`
    : `${SESSION_MARKER_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
}

function writeCachedCurrentUser(user: AuthUser | null) {
  currentUserCache = user;
  if (typeof window === 'undefined') return;
  writeSessionMarker(user);
  if (!user) {
    window.sessionStorage.removeItem(CURRENT_USER_STORAGE_KEY);
    return;
  }
  window.sessionStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(user));
}

export function readCachedCurrentUser() {
  if (currentUserCache !== undefined) return currentUserCache;
  if (typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(CURRENT_USER_STORAGE_KEY);
  if (!raw) {
    currentUserCache = null;
    return currentUserCache;
  }
  try {
    currentUserCache = JSON.parse(raw) as AuthUser;
    return currentUserCache;
  } catch {
    currentUserCache = null;
    window.sessionStorage.removeItem(CURRENT_USER_STORAGE_KEY);
    return currentUserCache;
  }
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

export async function signup(payload: {
  fullName: string;
  email: string;
  password: string;
  university?: string;
  faculty?: string;
  department?: string;
}) {
  const result = await requestJson<AuthSession>('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  writeCachedCurrentUser(result.user);
  return result;
}

export async function login(payload: { email: string; password: string }) {
  const result = await requestJson<AuthSession>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  writeCachedCurrentUser(result.user);
  return result;
}

export async function recruiterSignup(payload: {
  fullName: string;
  email: string;
  password: string;
  company: string;
  position?: string;
  website?: string;
}) {
  const result = await requestJson<{ user: AuthUser; message: string }>('/api/auth/recruiter-signup', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  writeCachedCurrentUser(result.user);
  return result;
}

export async function refreshSession() {
  const result = await requestJson<{ user: AuthUser; message: string }>('/api/auth/refresh', {
    method: 'POST',
  });
  writeCachedCurrentUser(result.user);
  return result;
}

export async function logout() {
  const result = await requestJson<{ message: string }>('/api/auth/logout', {
    method: 'POST',
  });
  writeCachedCurrentUser(null);
  return result;
}

export async function resendVerification(payload: { email: string }) {
  return requestJson<{ message: string }>('/api/auth/resend-verification', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function confirmEmailVerification(payload: { token: string }) {
  return requestJson<{ user: AuthUser; message: string }>('/api/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function requestPasswordReset(payload: { email: string }) {
  return requestJson<{ message: string }>('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function resetPassword(payload: { token: string; password: string }) {
  return requestJson<{ message: string }>('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function saveProfile(payload: {
  fullName?: string;
  username: string;
  phoneNumber?: string;
  showPhoneNumber?: boolean;
  bio?: string;
  location?: string;
  showLocation?: boolean;
  socialLinks?: string[];
  showSocialLinks?: boolean;
  graduationYear?: number | null;
  profileVisibility?: 'PUBLIC' | 'PRIVATE' | 'UNLISTED';
  showEmail?: boolean;
  showUniversity?: boolean;
  showLeadership?: boolean;
  showCertificates?: boolean;
  showTimeline?: boolean;
  university: string;
  faculty?: string;
  department?: string;
  level: string;
  interests: string[];
  skills?: string[];
  avatar?: string;
}) {
  const result = await requestJson<{ user: AuthUser; message: string }>('/api/profile', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  writeCachedCurrentUser(result.user);
  return result;
}

export async function getCurrentUser() {
  const cached = readCachedCurrentUser();
  if (cached) return cached;
  try {
    const result = await requestJson<{ user: AuthUser }>('/api/profile');
    writeCachedCurrentUser(result.user);
    return result.user;
  } catch {
    try {
      const refreshed = await refreshSession();
      return refreshed.user;
    } catch {
      writeCachedCurrentUser(null);
      return null;
    }
  }
}

export async function getProfile() {
  const result = await requestJson<{ user: AuthUser }>('/api/profile');
  writeCachedCurrentUser(result.user);
  return result;
}

export async function completeOnboarding() {
  const result = await requestJson<{ user: AuthUser; message: string }>('/api/profile/onboarding/complete', {
    method: 'POST',
  });
  writeCachedCurrentUser(result.user);
  return result;
}

export async function uploadAvatar(payload: FormData) {
  const result = await requestJson<{ user: AuthUser; message: string }>('/api/profile/avatar', {
    method: 'PATCH',
    body: payload,
  });
  writeCachedCurrentUser(result.user);
  return result;
}

export async function uploadCover(payload: FormData) {
  const result = await requestJson<{ user: AuthUser; message: string }>('/api/profile/cover', {
    method: 'PATCH',
    body: payload,
  });
  writeCachedCurrentUser(result.user);
  return result;
}

export async function updateAvailability(payload: {
  availability?: 'OPEN' | 'CASUAL' | 'CLOSED';
  jobSeeking?: boolean;
  internshipSeeking?: boolean;
  openToRelocation?: boolean;
  preferredIndustries?: string[];
}) {
  return requestJson<{ user: AuthUser; message: string }>('/api/profile/availability', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function updatePrivacy(payload: {
  profileVisibility: 'PUBLIC' | 'PRIVATE' | 'UNLISTED';
  showEmail: boolean;
  showPhoneNumber: boolean;
  showLocation: boolean;
  showSocialLinks: boolean;
  showUniversity: boolean;
  showLeadership: boolean;
  showCertificates: boolean;
  showTimeline: boolean;
}) {
  return requestJson<{ user: AuthUser; message: string }>('/api/profile/privacy', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function updatePassword(payload: { currentPassword: string; newPassword: string }) {
  return requestJson<{ user: AuthUser; message: string }>('/api/profile/password', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteProfile() {
  return requestJson<{ message: string }>('/api/profile', {
    method: 'DELETE',
  });
}

/** Downloads the current user's full data export (posts, certificates, reputation, memberships, connections, CVs) as a JSON file. */
export async function exportMyData() {
  const response = await fetch(`${API_BASE_URL}/api/profile/export`, { credentials: 'include' });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error((payload as { error?: string }).error ?? 'Unable to export your data');
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `guildos-data-export-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function getPublicProfile(username: string) {
  return requestJson<{ user: AuthUser }>('/api/profile/' + encodeURIComponent(username));
}

export type PersonResult = { id: string; fullName: string; username: string; avatar: string; headline: string };

export async function searchPeople(q: string) {
  return requestJson<{ people: PersonResult[] }>('/api/users/search?q=' + encodeURIComponent(q));
}

export async function getPublicPortfolio(username: string) {
  return requestJson<{ portfolio: unknown; user?: AuthUser }>('/api/portfolio/' + encodeURIComponent(username));
}

export async function getResume(username: string) {
  return requestJson<{ resume: unknown; user?: AuthUser }>('/api/resume/' + encodeURIComponent(username));
}

export async function getGoogleAuthUrl() {
  const response = await fetch(`${API_BASE_URL}/api/oauth/google`, {
    method: 'GET',
    credentials: 'include',
  });

  const payload = await response.json().catch(() => ({} as { error?: string; authUrl?: string }));

  if (!response.ok) {
    throw new Error(payload.error ?? 'Unable to start Google sign-in');
  }

  if (!payload.authUrl) {
    throw new Error('Google sign-in URL missing');
  }

  return payload.authUrl;
}
