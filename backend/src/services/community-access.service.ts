import { createHash } from 'node:crypto';
import { UserModel } from '../models/user.model';
import { MembershipModel } from '../models/membership.model';
import { authStore } from '../store/auth-store';
import { createNotification } from './notification.service';
import { sendEmail, communityAccessCodeEmail } from '../utils/email';

const MANAGER_ROLES = ['COORDINATOR', 'SECRETARY', 'TREASURER', 'VICE_PRESIDENT', 'PRESIDENT', 'FOUNDER'];

function hashCode(code: string) {
  return createHash('sha256').update(code).digest('hex');
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

/**
 * Whether a user may enter Community Mode / create & manage communities.
 * Admins always; explicitly approved users; and existing community managers
 * (grandfathered so current owners aren't locked out).
 */
export async function hasCommunityAccess(userId: string): Promise<boolean> {
  const user = await UserModel.findById(userId).select('role communityAccessStatus').lean();
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  if (user.communityAccessStatus === 'APPROVED') return true;
  const managerMembership = await MembershipModel.findOne({
    userId,
    role: { $in: MANAGER_ROLES },
    status: { $nin: ['REMOVED', 'LEFT'] },
  }).select('_id').lean();
  return Boolean(managerMembership);
}

export async function getMyCommunityAccess(userId: string) {
  const user = await UserModel.findById(userId).select('role communityAccessStatus communityAccessNote communityAccessEmail communityAccessEmailVerified').lean();
  const status = user?.role === 'ADMIN' ? 'APPROVED' : user?.communityAccessStatus ?? 'NONE';
  const hasAccess = await hasCommunityAccess(userId);
  return {
    status,
    hasAccess,
    note: user?.communityAccessNote ?? '',
    schoolEmail: user?.communityAccessEmail ?? '',
    schoolEmailVerified: Boolean(user?.communityAccessEmailVerified),
  };
}

export async function sendSchoolEmailCode(userId: string, email: string) {
  const clean = (email ?? '').trim().toLowerCase();
  if (!looksLikeEmail(clean)) throw new Error('Enter a valid email address');
  if (!isSchoolEmail(clean)) {
    throw new Error('Use your official school email (e.g. name@university.edu). Free providers like Gmail or Outlook are not accepted.');
  }
  const user = await UserModel.findById(userId);
  if (!user) throw new Error('User not found');

  const code = String(Math.floor(100000 + Math.random() * 900000));
  user.communityAccessEmail = clean;
  user.communityAccessEmailVerified = false;
  user.communityAccessEmailCode = hashCode(code);
  user.communityAccessEmailCodeExpires = new Date(Date.now() + 1000 * 60 * 15);
  await user.save();

  await sendEmail(clean, communityAccessCodeEmail(user.fullName, code));
  return { sent: true };
}

export async function verifySchoolEmailCode(userId: string, code: string) {
  const user = await UserModel.findById(userId);
  if (!user) throw new Error('User not found');
  if (!user.communityAccessEmailCode || !user.communityAccessEmailCodeExpires) {
    throw new Error('Request a code first');
  }
  if (user.communityAccessEmailCodeExpires.getTime() < Date.now()) {
    throw new Error('Code expired. Request a new one.');
  }
  if (hashCode((code ?? '').trim()) !== user.communityAccessEmailCode) {
    throw new Error('Incorrect code');
  }
  user.communityAccessEmailVerified = true;
  user.communityAccessEmailCode = '';
  user.communityAccessEmailCodeExpires = null;
  await user.save();
  return { verified: true, email: user.communityAccessEmail };
}

export async function requestCommunityAccess(userId: string, note = '') {
  const user = await UserModel.findById(userId);
  if (!user) throw new Error('User not found');
  if (user.role === 'ADMIN' || user.communityAccessStatus === 'APPROVED') {
    return { status: 'APPROVED' as const };
  }
  if (!user.communityAccessEmailVerified) {
    throw new Error('Verify your school email before submitting.');
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
    schoolEmail: u.communityAccessEmail ?? '',
    schoolEmailVerified: Boolean(u.communityAccessEmailVerified),
    note: u.communityAccessNote ?? '',
    requestedAt: u.updatedAt,
  }));
}

export async function setCommunityAccess(actorId: string, userId: string, approve: boolean, note = '') {
  const user = await UserModel.findById(userId);
  if (!user) throw new Error('User not found');
  user.communityAccessStatus = approve ? 'APPROVED' : 'REJECTED';
  if (note) user.communityAccessNote = note.slice(0, 500);
  if (approve && user.role === 'STUDENT') user.role = 'COMMUNITY_LEADER';
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
