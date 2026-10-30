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
    const message = typeof payload === 'object' && payload && 'error' in payload && payload.error ? payload.error : 'Request failed';
    throw new Error(message);
  }
  return payload;
}

export type CvTemplate = 'PROFESSIONAL' | 'MODERN' | 'EXECUTIVE' | 'ACADEMIC' | 'TECHNICAL';
export type CvMode = 'INTERNSHIP' | 'SCHOLARSHIP' | 'LEADERSHIP' | 'TECHNICAL';

export type CvLeadershipItem = {
  title: string;
  organization: string;
  startDate: string | null;
  endDate: string | null;
  current: boolean;
  verified: boolean;
  bullets: string[];
};

export type CvExperienceItem = {
  kind: 'VOLUNTEER' | 'SPEAKER' | 'ORGANIZER' | 'PROJECT';
  title: string;
  organization: string;
  period: string;
  url: string;
  bullets: string[];
};

export type CvCertificationItem = {
  title: string;
  issuer: string;
  date: string | null;
  serial: string;
  verifyUrl: string;
  status: string;
};

export type CvContent = {
  header: { fullName: string; email: string; phone: string; location: string; publicProfileUrl: string };
  summary: string;
  education: { university: string; course: string; graduationYear: number | null; level: string; achievements: string[] };
  leadership: CvLeadershipItem[];
  experience: CvExperienceItem[];
  certifications: CvCertificationItem[];
  skills: string[];
  projects: Array<{ name: string; description: string; url: string; role: string }>;
  awards: string[];
  guildScore: { score: number; level: string } | null;
};

export type CvCustomization = { hideCertificates: boolean; hideGuildScore: boolean; sectionOrder: string[] };

export type CvSummary = {
  cvId: string;
  verificationId: string;
  template: CvTemplate;
  mode: CvMode;
  publicUrl: string;
  aiGenerated: boolean;
  createdAt: string;
  refreshedAt: string | null;
  refreshCount: number;
};

export type CvDetail = CvSummary & { customization: CvCustomization; content: CvContent };

export type CvFreshness = {
  stale: boolean;
  generatedAt: string;
  refreshedAt: string | null;
  storedGuildScore: number;
  currentGuildScore: number;
  storedSource: { certificates: number; roles: number; events: number; credentials: number };
  currentSource: { certificates: number; roles: number; events: number; credentials: number };
};

export type CvVerification = {
  verified: boolean;
  status: 'AUTHENTIC';
  cvId: string;
  verificationId: string;
  template: CvTemplate;
  mode: CvMode;
  ownerName: string;
  profileUrl: string;
  generatedAt: string;
  refreshedAt: string | null;
  certificateCount: number;
  leadershipCount: number;
  eventCount: number;
  content: CvContent;
};

export type ProjectInput = { name: string; description?: string; url?: string; role?: string };

export async function generateCv(payload: {
  template: CvTemplate;
  mode: CvMode;
  customization?: Partial<CvCustomization>;
  projects?: ProjectInput[];
}) {
  return requestJson<{ cvId: string; verificationId: string; template: CvTemplate; mode: CvMode; publicUrl: string; aiGenerated: boolean; status: string }>(
    '/api/cv/generate',
    { method: 'POST', body: JSON.stringify(payload) },
  );
}

export async function getMyCvs() {
  return requestJson<{ cvs: CvSummary[] }>('/api/cv/my-cvs');
}

export async function getCv(cvId: string) {
  return requestJson<{ cv: CvDetail }>(`/api/cv/${encodeURIComponent(cvId)}`);
}

export async function deleteCv(cvId: string) {
  return requestJson<{ message: string }>(`/api/cv/${encodeURIComponent(cvId)}`, { method: 'DELETE' });
}

/** Update hide flags / drag-to-reorder section order on an existing CV. */
export async function updateCvCustomization(cvId: string, input: Partial<CvCustomization>) {
  return requestJson<{ customization: CvCustomization }>(`/api/cv/${encodeURIComponent(cvId)}/customization`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

/** The user's persistent projects collection (pre-fills the builder). */
export async function getCvProjects() {
  return requestJson<{ projects: ProjectInput[] }>('/api/cv/projects');
}

export async function saveCvProjects(projects: ProjectInput[]) {
  return requestJson<{ projects: ProjectInput[] }>('/api/cv/projects', { method: 'PUT', body: JSON.stringify({ projects }) });
}

export async function verifyCv(verificationId: string) {
  return requestJson<{ cv: CvVerification }>(`/api/cv/verify/${encodeURIComponent(verificationId)}`);
}

/** Re-baselines an existing CV against current reputation/certificates/skills/credentials — same cvId/link. */
export async function refreshCv(cvId: string) {
  return requestJson<{ cvId: string; verificationId: string; template: CvTemplate; mode: CvMode; publicUrl: string; aiGenerated: boolean; refreshedAt: string; refreshCount: number; status: string }>(
    `/api/cv/${encodeURIComponent(cvId)}/refresh`,
    { method: 'POST' },
  );
}

/** Cheap check for whether a CV is behind the user's current reputation/activity (no AI call). */
export async function getCvFreshness(cvId: string) {
  return requestJson<CvFreshness>(`/api/cv/${encodeURIComponent(cvId)}/freshness`);
}

async function downloadPdf(path: string, filename: string) {
  const response = await fetch(`${API_BASE_URL}${path}`, { credentials: 'include' });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || 'Unable to download PDF');
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function downloadOwnerCvPdf(cvId: string) {
  await downloadPdf(`/api/cv/${encodeURIComponent(cvId)}/pdf`, cvId);
}

export async function downloadVerifiedCvPdf(verificationId: string, fallbackName = 'verified-cv') {
  await downloadPdf(`/api/cv/verify/${encodeURIComponent(verificationId)}/pdf`, fallbackName);
}
