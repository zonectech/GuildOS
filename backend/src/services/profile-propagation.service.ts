import { authStore } from '../store/auth-store';

export type CanonicalProfileSnapshot = {
  id: string;
  fullName: string;
  username: string;
  avatar: string;
  bio: string;
  location: string;
  socialLinks: string[];
  university: string;
  faculty: string;
  department: string;
  level: string;
  interests: string[];
  skills: string[];
  graduationYear: number | null;
  profileVisibility: 'PUBLIC' | 'PRIVATE' | 'UNLISTED';
  showUniversity: boolean;
  showLeadership: boolean;
  showCertificates: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ResumeProfileData = CanonicalProfileSnapshot & {
  headline: string;
  summary: string;
  skills: string[];
};

export type PublicPortfolioData = {
  profile: CanonicalProfileSnapshot;
  visible: boolean;
  sections: Array<{
    key: string;
    title: string;
    enabled: boolean;
  }>;
};

export async function buildCanonicalProfileSnapshot(userId: string): Promise<CanonicalProfileSnapshot | null> {
  const user = await authStore.getUserById(userId);
  if (!user) return null;

  const profile = user.profile;

  return {
    id: user.id,
    fullName: user.fullName,
    username: profile.username,
    avatar: profile.avatar,
    bio: profile.bio,
    location: profile.location,
    socialLinks: profile.socialLinks,
    university: profile.university,
    faculty: profile.faculty,
    department: profile.department,
    level: profile.level,
    interests: profile.interests,
    skills: profile.skills,
    graduationYear: profile.graduationYear,
    profileVisibility: profile.profileVisibility,
    showUniversity: profile.showUniversity,
    showLeadership: profile.showLeadership,
    showCertificates: profile.showCertificates,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export async function buildResumeProfileData(userId: string): Promise<ResumeProfileData | null> {
  const snapshot = await buildCanonicalProfileSnapshot(userId);
  if (!snapshot) return null;

  const headline = [snapshot.department, snapshot.level].filter(Boolean).join(' • ') || snapshot.university || 'Student';
  const summary = [snapshot.bio, snapshot.location].filter(Boolean).join(' · ') || 'Profile summary unavailable';
  const skills = Array.from(new Set([...snapshot.skills, ...snapshot.interests].map((item) => item.trim()).filter(Boolean)));

  return {
    ...snapshot,
    headline,
    summary,
    skills,
  };
}

export async function buildPublicPortfolioData(userId: string): Promise<PublicPortfolioData | null> {
  const snapshot = await buildCanonicalProfileSnapshot(userId);
  if (!snapshot) return null;

  return {
    profile: snapshot,
    visible: snapshot.profileVisibility === 'PUBLIC',
    sections: [
      { key: 'profile', title: 'Profile', enabled: true },
      { key: 'certificates', title: 'Certificates', enabled: snapshot.showCertificates },
      { key: 'leadership', title: 'Leadership', enabled: snapshot.showLeadership },
      { key: 'academics', title: 'Academics', enabled: snapshot.showUniversity },
    ],
  };
}

export async function updatePropagationTargets(userId: string) {
  const snapshot = await buildCanonicalProfileSnapshot(userId);
  if (!snapshot) return null;

  return {
    resume: await buildResumeProfileData(userId),
    portfolio: await buildPublicPortfolioData(userId),
    profile: snapshot,
  };
}