import { createHash, randomUUID } from 'node:crypto';
import { Types } from 'mongoose';
import { AuthTokenModel } from '../models/auth-token.model';
import { UserModel } from '../models/user.model';
import { ReputationScoreModel } from '../models/reputation-score.model';
import type { ProfileData, PublicUser, UserRole } from '../types';
import { hashPassword } from '../utils/password';
import { createRandomToken, createToken, verifyToken } from '../utils/token';

function toObjectId(value: string) {
  return new Types.ObjectId(value);
}

function normalizeAvatarUrl(avatar?: string) {
  if (!avatar) return '';
  if (avatar.startsWith('http://') || avatar.startsWith('https://') || avatar.startsWith('/')) {
    return avatar;
  }
  return `/uploads/${avatar}`;
}

function normalizeProfile(profile?: Partial<ProfileData>): ProfileData {
  return {
    username: profile?.username?.trim() ?? '',
    phoneNumber: profile?.phoneNumber?.trim() ?? '',
    bio: profile?.bio?.trim() ?? '',
    location: profile?.location?.trim() ?? '',
    socialLinks: profile?.socialLinks ?? [],
    graduationYear: profile?.graduationYear ?? null,
    profileVisibility: profile?.profileVisibility ?? 'PUBLIC',
    showUniversity: profile?.showUniversity ?? true,
    showLeadership: profile?.showLeadership ?? true,
    showCertificates: profile?.showCertificates ?? true,
    showTimeline: profile?.showTimeline ?? true,
    availability: profile?.availability ?? 'CLOSED',
    jobSeeking: profile?.jobSeeking ?? false,
    internshipSeeking: profile?.internshipSeeking ?? false,
    openToRelocation: profile?.openToRelocation ?? false,
    preferredIndustries: profile?.preferredIndustries ?? [],
    university: profile?.university?.trim() ?? '',
    faculty: profile?.faculty?.trim() ?? '',
    department: profile?.department?.trim() ?? '',
    level: profile?.level?.trim() ?? '',
    interests: profile?.interests ?? [],
    avatar: normalizeAvatarUrl(profile?.avatar?.trim() ?? ''),
    coverImage: normalizeAvatarUrl(profile?.coverImage?.trim() ?? ''),
  };
}


function toPublicUser(user: {
  _id: Types.ObjectId;
  fullName: string;
  email: string;
  role: UserRole;
  emailVerified: boolean;
  profile: ProfileData;
  onboardingCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}): PublicUser {
  return {
    id: user._id.toString(),
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    emailVerified: user.emailVerified,
    profileComplete: Boolean(
      user.profile.university &&
      user.profile.interests.length &&
      user.onboardingCompleted,
    ),
    profile: user.profile,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

function toPublicProfile(user: {
  _id: Types.ObjectId;
  fullName: string;
  profile: ProfileData;
  createdAt: Date;
  updatedAt: Date;
}) {
  const profile = user.profile;
  const isPrivate = profile.profileVisibility === 'PRIVATE';

  if (isPrivate) {
    return {
      id: user._id.toString(),
      fullName: user.fullName,
      profileVisibility: profile.profileVisibility,
      avatar: normalizeAvatarUrl(profile.avatar),
      createdAt: user.createdAt.toISOString(),

      updatedAt: user.updatedAt.toISOString(),
    };
  }

  return {
    id: user._id.toString(),
    fullName: user.fullName,
    profileVisibility: profile.profileVisibility,
    avatar: normalizeAvatarUrl(profile.avatar),
    coverImage: normalizeAvatarUrl(profile.coverImage),
    university: profile.showUniversity ? profile.university : '',
    faculty: profile.faculty,
    department: profile.department,
    level: profile.level,
    interests: profile.interests,
    bio: profile.bio,
    location: profile.location,
    socialLinks: profile.socialLinks,
    graduationYear: profile.graduationYear,
    showLeadership: profile.showLeadership,
    showCertificates: profile.showCertificates,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

class AuthStore {
  async createUser(input: {
    fullName: string;
    email: string;
    password: string;
    role?: UserRole;
    profile?: Partial<ProfileData>;
  }) {
    const normalizedEmail = input.email.toLowerCase();

    const existing = await UserModel.findOne({ email: normalizedEmail });
    if (existing) {
      throw new Error('Email is already registered');
    }

    const { salt, hash } = hashPassword(input.password);
    const user = await UserModel.create({
      fullName: input.fullName.trim(),
      email: normalizedEmail,
      passwordHash: hash,
      passwordSalt: salt,
      role: input.role ?? 'STUDENT',
      emailVerified: false,
      profile: normalizeProfile(input.profile),
    });

    return user;
  }

  async getUserByEmail(email: string) {
    return UserModel.findOne({ email: email.toLowerCase() });
  }

  async getUserByUsername(username: string) {
    return UserModel.findOne({ 'profile.username': username.trim().toLowerCase() });
  }

  async getUserById(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }

    return UserModel.findById(toObjectId(id));
  }

  async searchPublicUsers(query: string, limit = 10) {
    const q = query.trim();
    if (q.length < 2) {
      return [] as Array<{ id: string; fullName: string; email: string; username: string }>;
    }
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const users = await UserModel.find({
      $or: [{ fullName: re }, { email: re }, { 'profile.username': re }],
    }).limit(limit);
    return users.map((user) => ({
      id: user._id.toString(),
      fullName: user.fullName,
      email: user.email,
      username: user.profile?.username ?? '',
    }));
  }

  async searchUsersForAdmin(query: string, limit = 25) {
    const q = query.trim();
    let filter: Record<string, unknown> = {};
    if (q.length >= 2) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter = { $or: [{ fullName: re }, { email: re }, { 'profile.username': re }] };
    }
    const users = await UserModel.find(filter).sort({ createdAt: -1 }).limit(Math.min(Math.max(limit, 1), 50));
    return users.map((user) => ({
      id: user._id.toString(),
      fullName: user.fullName,
      email: user.email,
      username: user.profile?.username ?? '',
      role: user.role,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt.toISOString(),
    }));
  }

  async setUserRole(id: string, role: UserRole) {
    const user = await this.getUserById(id);
    if (!user) {
      return null;
    }
    user.role = role;
    await user.save();
    return user;
  }

  async searchPublicPeople(query: string, limit = 10) {
    const q = query.trim();
    if (q.length < 2) return [];
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const users = await UserModel.find({
      'profile.username': { $nin: ['', null] },
      'profile.profileVisibility': { $ne: 'PRIVATE' },
      $or: [{ fullName: re }, { 'profile.username': re }],
    }).limit(Math.min(Math.max(limit, 1), 20));
    return users.map((user) => ({
      id: user._id.toString(),
      fullName: user.fullName,
      username: user.profile?.username ?? '',
      avatar: normalizeAvatarUrl(user.profile?.avatar ?? ''),
      headline: [user.profile?.department, user.profile?.university].filter(Boolean).join(' · '),
    }));
  }

  async verifyEmail(id: string) {
    const user = await this.getUserById(id);
    if (!user) {
      return null;
    }

    user.emailVerified = true;
    await user.save();
    return user;
  }

  async updateProfile(id: string, input: ProfileData & { fullName?: string }) {
    const user = await this.getUserById(id);
    if (!user) {
      return null;
    }

    if (input.fullName) {
      user.fullName = input.fullName.trim();
    }

    const { fullName: _fullName, ...profile } = input;
    user.profile = normalizeProfile(profile);
    await user.save();
    return user;
  }

  async updateCareerPreferences(
    id: string,
    prefs: {
      availability?: 'OPEN' | 'CASUAL' | 'CLOSED';
      jobSeeking?: boolean;
      internshipSeeking?: boolean;
      openToRelocation?: boolean;
      preferredIndustries?: string[];
    },
  ) {
    const user = await this.getUserById(id);
    if (!user) {
      return null;
    }
    if (prefs.availability !== undefined && ['OPEN', 'CASUAL', 'CLOSED'].includes(prefs.availability)) {
      user.profile.availability = prefs.availability;
    }
    if (prefs.jobSeeking !== undefined) user.profile.jobSeeking = Boolean(prefs.jobSeeking);
    if (prefs.internshipSeeking !== undefined) user.profile.internshipSeeking = Boolean(prefs.internshipSeeking);
    if (prefs.openToRelocation !== undefined) user.profile.openToRelocation = Boolean(prefs.openToRelocation);
    if (prefs.preferredIndustries !== undefined && Array.isArray(prefs.preferredIndustries)) {
      user.profile.preferredIndustries = prefs.preferredIndustries.map(String).filter(Boolean).slice(0, 10);
    }
    user.markModified('profile');
    await user.save();

    // Keep the reputation aggregate's denormalized availability in sync for candidate search.
    await ReputationScoreModel.updateOne(
      { userId: id },
      { $set: { availability: user.profile.availability, jobSeeking: user.profile.jobSeeking } },
    );

    return user;
  }

  async setPassword(id: string, password: string) {
    const user = await this.getUserById(id);
    if (!user) {
      return null;
    }

    const { salt, hash } = hashPassword(password);
    user.passwordHash = hash;
    user.passwordSalt = salt;
    await user.save();
    return user;
  }

  async issueOpaqueToken(userId: string, purpose: 'email-verification' | 'password-reset', ttlMs: number) {
    const token = createRandomToken();
    const tokenHash = createHash('sha256').update(token).digest('hex');

    await AuthTokenModel.create({
      userId: toObjectId(userId),
      purpose,
      tokenHash,
      expiresAt: new Date(Date.now() + ttlMs),
    });

    return token;
  }

  async issueRefreshToken(userId: string, ttlMs: number) {
    const token = createToken(
      {
        sub: userId,
        purpose: 'refresh',
        jti: randomUUID(),
      },
      ttlMs,
    );
    const tokenHash = createHash('sha256').update(token).digest('hex');

    await AuthTokenModel.create({
      userId: toObjectId(userId),
      purpose: 'refresh',
      tokenHash,
      expiresAt: new Date(Date.now() + ttlMs),
    });

    return token;
  }

  async consumeToken(token: string, purpose: 'email-verification' | 'password-reset') {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const record = await AuthTokenModel.findOne({ tokenHash, purpose });

    if (!record || record.revokedAt || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
      return null;
    }

    record.usedAt = new Date();
    await record.save();
    return record;
  }

  async consumeRefreshToken(token: string) {
    const payload = verifyToken(token);
    if (!payload || payload.purpose !== 'refresh') {
      return null;
    }

    const tokenHash = createHash('sha256').update(token).digest('hex');
    const record = await AuthTokenModel.findOne({ tokenHash, purpose: 'refresh' });

    if (!record || record.revokedAt || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
      return null;
    }

    record.usedAt = new Date();
    await record.save();
    return { payload, record };
  }

  async revokeTokensForUser(userId: string, purpose?: 'refresh' | 'email-verification' | 'password-reset') {
    await AuthTokenModel.updateMany(
      {
        userId: toObjectId(userId),
        ...(purpose ? { purpose } : {}),
        revokedAt: null,
        usedAt: null,
      },
      {
        $set: { revokedAt: new Date() },
      },
    );
  }

  async getPublicUserById(id: string) {
    const user = await this.getUserById(id);
    return user ? toPublicUser(user) : null;
  }

  async getPublicProfileByUsername(username: string) {
    const user = await this.getUserByUsername(username);
    if (!user) {
      return null;
    }

    if (user.profile.profileVisibility === 'PRIVATE') {
      return null;
    }

    return toPublicProfile(user);
  }

  async getProfileByUsernameForAdmin(username: string) {
    const user = await this.getUserByUsername(username);
    if (!user) {
      return null;
    }

    return {
      user,
      publicProfile: toPublicProfile(user),
      publicUser: toPublicUser(user),
    };
  }

  async deleteUser(id: string) {
    await UserModel.findByIdAndDelete(toObjectId(id));
    await AuthTokenModel.deleteMany({ userId: toObjectId(id) });
  }

  toPublicUser(user: NonNullable<Awaited<ReturnType<AuthStore['getUserById']>>>) {
    return toPublicUser(user);
  }
}

export const authStore = new AuthStore();
export { toPublicUser };
