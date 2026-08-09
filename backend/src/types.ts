export type ProfileData = {
  username: string;
  phoneNumber: string;
  showPhoneNumber: boolean;
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

export type UserRole = 'STUDENT' | 'COMMUNITY_LEADER' | 'ADMIN' | 'RECRUITER';

export type PublicUser = {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  emailVerified: boolean;
  profileComplete: boolean;
  profile: ProfileData;
  communityAccessStatus: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  updatedAt: string;
};

export type AuthTokenPurpose = 'access' | 'refresh' | 'email-verification' | 'password-reset';

export type AuthTokenPayload = {
  sub: string;
  purpose: AuthTokenPurpose;
  jti: string;
  exp: number;
};

export type SignupInput = {
  fullName: string;
  email: string;
  password: string;
  university?: string;
  faculty?: string;
  department?: string;
  level?: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type ProfileSetupInput = {
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
  availability?: 'OPEN' | 'CASUAL' | 'CLOSED';
  jobSeeking?: boolean;
  internshipSeeking?: boolean;
  openToRelocation?: boolean;
  preferredIndustries?: string[];
  university: string;
  faculty: string;
  department: string;
  level: string;
  interests: string[];
  skills?: string[];
  avatar?: string;
};

export type ResetPasswordInput = {
  token: string;
  password: string;
};

export type RequestPasswordResetInput = {
  email: string;
};

export type VerifyEmailInput = {
  token: string;
};
