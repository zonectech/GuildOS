import { createHash, randomInt } from 'node:crypto';
import { config } from '../config';
import { UserModel } from '../models/user.model';
import { hasApprovedCommunityAccess } from './community-access-policy';
import { authStore } from '../store/auth-store';
import { createNotification } from './notification.service';
import { sendEmail, communityAccessCodeEmail } from '../utils/email';


export class CommunityEmailError extends Error {
  constructor(message: string, public code: string, public retryAfterSeconds?: number) { super(message); }
}

function hashCode(userId: string, email: string, code: string) {
  return createHash('sha256').update(userId + ':' + email + ':' + code).digest('hex');
}

function looksLikeEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Consumer / free mailbox providers that are never a school email.
const BLOCKED_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'ymail.com', 'outlook.com', 'hotmail.com',
  'live.com', 'msn.com', 'icloud.com', 'me.com', 'aol.com', 'proton.me', 'protonmail.com',
  'gmx.com', 'mail.com', 'zoho.com', 'yandex.com', 'pm.me', 'fastmail.com',
]);

// Academic domain patterns: .edu, .edu.<cc>, .ac.<cc>, .sch.<cc>, .uni-*.de etc.
const ACADEMIC_DOMAIN = /(^|\.)(edu|ac|sch)(\.[a-z]{2,})?$/i;

/**
 * A school email must (a) be a valid address, (b) not be a known free/consumer
 * provider, and (c) sit on an academic-looking domain (.edu, .ac.uk, .edu.ng, …).
 */
function isSchoolEmail(email: string): boolean {
  if (!looksLikeEmail(email)) return false;
  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  if (!domain || BLOCKED_EMAIL_DOMAINS.has(domain)) return false;
  return ACADEMIC_DOMAIN.test(domain);
}

/** Mailbox verification can be reused only for the same verified academic signup address. */
export function schoolEmailVerification(user: { email?: string; emailVerified?: boolean; communityAccessEmail?: string; communityAccessEmailVerified?: boolean }) {
  if (user.communityAccessEmailVerified && isSchoolEmail(user.communityAccessEmail ?? '')) return { email: user.communityAccessEmail!, verified: true, reusedAccountEmail: false };
  const email = (user.email ?? '').trim().toLowerCase();
  if (user.emailVerified === true && isSchoolEmail(email)) return { email, verified: true, reusedAccountEmail: true };
  return { email: user.communityAccessEmail ?? '', verified: false, reusedAccountEmail: false };
}

/** Personal approval is required even when another leader assigns a management role. */
export async function hasCommunityAccess(userId: string): Promise<boolean> {
  return hasApprovedCommunityAccess(userId);
}
export async function canCreateCommunity(userId: string): Promise<boolean> {
  return hasApprovedCommunityAccess(userId);
}

export async function getMyCommunityAccess(userId: string) {
  const user = await UserModel.findById(userId).select('role email emailVerified communityAccessStatus communityAccessNote communityAccessEmail communityAccessEmailVerified communityAccessEmailCodeSentAt communityAccessEmailCodeExpires communityAccessEmailCodeAttempts').lean();
  const status = user?.role === 'ADMIN' ? 'APPROVED' : user?.communityAccessStatus ?? 'NONE';
  const hasAccess = await hasCommunityAccess(userId);
  const school = schoolEmailVerification(user ?? {});
  return {
    status,
    hasAccess,
    // Both management and community creation require current personal approval.
    canCreate: await canCreateCommunity(userId),
    note: user?.communityAccessNote ?? '',
    schoolEmail: school.email,
    schoolEmailVerified: school.verified,
    schoolEmailReusedFromAccount: school.reusedAccountEmail,
    accountEmail: user?.email ?? '',
    accountEmailVerified: Boolean(user?.emailVerified),
    retryAfterSeconds: user?.communityAccessEmailCodeSentAt ? Math.min(60, Math.max(0, Math.ceil((user.communityAccessEmailCodeSentAt.getTime() + 60000 - Date.now()) / 1000))) : 0,
    resendAvailableAt: user?.communityAccessEmailCodeSentAt ? new Date(user.communityAccessEmailCodeSentAt.getTime() + 60000).toISOString() : null,
    schoolCodePending: Boolean(!school.verified && user?.communityAccessEmailCodeExpires && user.communityAccessEmailCodeExpires.getTime() > Date.now() && (user.communityAccessEmailCodeAttempts ?? 0) < 5),
  };
}

export async function sendSchoolEmailCode(userId: string, email: string) {
  const clean = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (clean.length > 254 || !looksLikeEmail(clean)) throw new Error('Enter a valid email address');
  if (!isSchoolEmail(clean)) throw new Error('Use your official school email (e.g. name@university.edu). Free providers like Gmail or Outlook are not accepted.');
  if (!config.smtpHost) throw new Error('Email verification is unavailable until email delivery is configured');
  const code = String(randomInt(100000, 1000000));
  const now = new Date();
  const user = await UserModel.findOneAndUpdate({
    _id: userId, status: 'ACTIVE', deletedAt: null, emailVerified: true,
    $or: [{ communityAccessEmailCodeSentAt: null }, { communityAccessEmailCodeSentAt: { $lte: new Date(now.getTime() - 60000) } }],
  }, { $set: {
    communityAccessEmail: clean, communityAccessEmailVerified: false,
    communityAccessEmailCode: hashCode(userId, clean, code), communityAccessEmailCodeExpires: new Date(now.getTime() + 15 * 60000),
    communityAccessEmailCodeAttempts: 0, communityAccessEmailCodeSentAt: now,
  } }, { new: true });
  if (!user) {
    const current = await UserModel.findById(userId).select('status deletedAt emailVerified communityAccessEmailCodeSentAt').lean();
    if (!current || current.status !== 'ACTIVE' || current.deletedAt) throw new CommunityEmailError('Your account is unavailable. Sign in again or contact support.', 'ACCOUNT_UNAVAILABLE');
    if (!current.emailVerified) throw new CommunityEmailError('Verify your GuildOS account email first. School email verification is a separate step.', 'ACCOUNT_EMAIL_UNVERIFIED');
    const retryAfterSeconds = Math.min(60, Math.max(1, Math.ceil(((current.communityAccessEmailCodeSentAt?.getTime() ?? now.getTime()) + 60000 - Date.now()) / 1000)));
    throw new CommunityEmailError('Wait one minute between codes. Try again in ' + retryAfterSeconds + ' seconds.', 'SCHOOL_EMAIL_COOLDOWN', retryAfterSeconds);
  }
  try {
    await sendEmail(clean, communityAccessCodeEmail(user.fullName, code));
  } catch {
    // Invalidate only this failed delivery; never erase a concurrent replacement code.
    await UserModel.updateOne({ _id: userId, communityAccessEmailCode: hashCode(userId, clean, code) }, { $set: {
      communityAccessEmailCode: '', communityAccessEmailCodeExpires: null, communityAccessEmailCodeSentAt: null,
    } });
    throw new CommunityEmailError('We could not send the school email code. Please try again.', 'SCHOOL_EMAIL_DELIVERY_FAILED');
  }
  return { sent: true, retryAfterSeconds: 60, resendAvailableAt: new Date(now.getTime() + 60000).toISOString() };
}

export async function verifySchoolEmailCode(userId: string, code: string) {
  if (typeof code !== 'string' || !/^\d{6}$/.test(code.trim())) throw new Error('Enter the six-digit code');
  const user = await UserModel.findOneAndUpdate({
    _id: userId, status: 'ACTIVE', deletedAt: null, emailVerified: true,
    communityAccessEmailCode: { $nin: ['', null] }, communityAccessEmailCodeExpires: { $gt: new Date() },
    $or: [{ communityAccessEmailCodeAttempts: { $lt: 5 } }, { communityAccessEmailCodeAttempts: { $exists: false } }],
  }, { $inc: { communityAccessEmailCodeAttempts: 1 } }, { new: true });
  if (!user || hashCode(userId, user.communityAccessEmail, code.trim()) !== user.communityAccessEmailCode) throw new Error('Incorrect or expired code. Request a new code after five failed attempts.');
  const result = await UserModel.updateOne({
    _id: userId, communityAccessEmail: user.communityAccessEmail, communityAccessEmailCode: user.communityAccessEmailCode,
    communityAccessEmailCodeExpires: { $gt: new Date() },
  }, { $set: { communityAccessEmailVerified: true, communityAccessEmailCode: '', communityAccessEmailCodeExpires: null } });
  if (!result.modifiedCount) throw new Error('Code was replaced or expired. Request a new one.');
  return { verified: true, email: user.communityAccessEmail };
}

export async function requestCommunityAccess(userId: string, note = '') {
  const user = await UserModel.findById(userId);
  if (!user) throw new Error('User not found');
  if (user.status !== 'ACTIVE' || user.deletedAt) throw new Error('User not found');
  if (!user.emailVerified) throw new Error('Verify your account email before requesting Community Mode');
  if (user.role === 'ADMIN' || user.communityAccessStatus === 'APPROVED') {
    return { status: 'APPROVED' as const };
  }
  // Escape hatch for people without an academic email (student ambassadors,
  // organizational leaders): a substantial note lets the request reach admin
  // review, where the missing email verification is clearly flagged.
  const school = schoolEmailVerification(user);
  if (!school.verified && note.trim().length < 30) {
    throw new Error(
      'No school email? Tell us who you are in the note: your role (e.g. student ambassador, organization leader), which community you represent, and how we can confirm it.',
    );
  }
  if (school.reusedAccountEmail) {
    user.communityAccessEmail = school.email;
    user.communityAccessEmailVerified = true;
    user.communityAccessEmailCode = '';
    user.communityAccessEmailCodeExpires = null;
    user.communityAccessEmailCodeAttempts = 0;
    user.communityAccessEmailCodeSentAt = null;
  }
  user.communityAccessStatus = 'PENDING';
  user.communityAccessNote = note.slice(0, 500);
  await user.save();
  return { status: 'PENDING' as const };
}

export async function listPendingCommunityAccess() {
  const users = await UserModel.find({ communityAccessStatus: 'PENDING' }).sort({ updatedAt: -1 }).lean();
  return users.map((u) => ({
    userId: u._id.toString(),
    fullName: u.fullName,
    email: u.email,
    username: u.profile?.username ?? '',
    university: u.profile?.university ?? '',
    department: u.profile?.department ?? '',
    schoolEmail: schoolEmailVerification(u).email,
    schoolEmailVerified: schoolEmailVerification(u).verified,
    note: u.communityAccessNote ?? '',
    requestedAt: u.updatedAt,
  }));
}

export async function setCommunityAccess(actorId: string, userId: string, approve: boolean, note = '') {
  const actor = await UserModel.findById(actorId).select('role status deletedAt emailVerified').lean();
  if (!actor || actor.role !== 'ADMIN' || actor.status !== 'ACTIVE' || actor.deletedAt || !actor.emailVerified) throw new Error('Insufficient permissions');
  const user = await UserModel.findById(userId);
  if (!user) throw new Error('User not found');
  user.communityAccessStatus = approve ? 'APPROVED' : 'REJECTED';
  if (note) user.communityAccessNote = note.slice(0, 500);
  // Keep the audience label in sync with access (it is display/targeting only — never authz).
  if (approve && user.role === 'STUDENT') user.role = 'COMMUNITY_LEADER';
  if (!approve && user.role === 'COMMUNITY_LEADER') user.role = 'STUDENT';
  await user.save();

  await createNotification({
    userId,
    actorId,
    type: 'SYSTEM',
    title: approve ? 'Community Mode access approved' : 'Community Mode access declined',
    body: approve ? 'You can now create and manage communities.' : note || 'Your request was not approved.',
    link: approve ? '/dashboard' : '/dashboard',
  });

  return { userId, status: user.communityAccessStatus };
}
