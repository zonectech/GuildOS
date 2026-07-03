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
    bio: string;
    location: string;
    socialLinks: string[];
    graduationYear: number | null;
    profileVisibility: 'PUBLIC' | 'PRIVATE' | 'UNLISTED';
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
  return requestJson<AuthSession>('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function login(payload: { email: string; password: string }) {
  return requestJson<AuthSession>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function recruiterSignup(payload: {
  fullName: string;
  email: string;
  password: string;
  company: string;
  position?: string;
  website?: string;
}) {
  return requestJson<{ user: AuthUser; message: string }>('/api/auth/recruiter-signup', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function refreshSession() {
  return requestJson<{ user: AuthUser; message: string }>('/api/auth/refresh', {
    method: 'POST',
  });
}

export async function logout() {
  return requestJson<{ message: string }>('/api/auth/logout', {
    method: 'POST',
  });
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
  bio?: string;
  location?: string;
  socialLinks?: string[];
  graduationYear?: number | null;
  profileVisibility?: 'PUBLIC' | 'PRIVATE' | 'UNLISTED';
  showUniversity?: boolean;
  showLeadership?: boolean;
  showCertificates?: boolean;
  showTimeline?: boolean;
  university: string;
  faculty?: string;
  department?: string;
  level: string;
  interests: string[];
  avatar?: string;
}) {
  return requestJson<{ user: AuthUser; message: string }>('/api/profile', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function getCurrentUser() {
  try {
    const result = await requestJson<{ user: AuthUser }>('/api/profile');
    return result.user;
  } catch {
    try {
      const refreshed = await refreshSession();
      return refreshed.user;
    } catch {
      return null;
    }
  }
}

export async function getProfile() {
  return requestJson<{ user: AuthUser }>('/api/profile');
}

export async function completeOnboarding() {
  return requestJson<{ user: AuthUser; message: string }>('/api/profile/onboarding/complete', {
    method: 'POST',
  });
}

export async function uploadAvatar(payload: FormData) {
  return requestJson<{ user: AuthUser; message: string }>('/api/profile/avatar', {
    method: 'PATCH',
    body: payload,
  });
}

export async function uploadCover(payload: FormData) {
  return requestJson<{ user: AuthUser; message: string }>('/api/profile/cover', {
    method: 'PATCH',
    body: payload,
  });
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
