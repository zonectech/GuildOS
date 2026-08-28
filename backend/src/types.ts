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
  /** Spam control: recruiters may open a DM without a connection only when true. */
  allowRecruiterMessages: boolean;
  /** What the user's delete button does in chats: placeholder for both sides, or hide for self only. */
  messageDeleteScope: 'EVERYONE' | 'ME';
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

/**
 * Global account role — ONE per user.
 *
 * NOTE on COMMUNITY_LEADER: this is an audience label, NOT a permission.
 * It is set when an admin approves Community Mode access (community-access.service)
 * and is only used for audience targeting (broadcasts, weekly digest) and admin display.
 * • Community permissions come from Membership.role (COORDINATOR..FOUNDER) per community.
 * • The ability to create communities is gated by user.communityAccessStatus === 'APPROVED'.
 * Never write `requireRole('COMMUNITY_LEADER')` or `user.role === 'COMMUNITY_LEADER'` as an authz check.
 */
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
  /** Global account role — informational claim for frontend route gating; backend authz always re-reads the user. */
  role?: UserRole;
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
