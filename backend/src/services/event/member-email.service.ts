import { createHash, randomInt } from 'node:crypto';
import { MemberEmailModel } from '../../models/member-email.model';
import { UserModel } from '../../models/user.model';
import { config } from '../../config';
import { sendEmail } from '../../utils/email';
import { normalizeReportEmail } from '../../utils/external-report';
const hashCode = (userId: string, email: string, code: string) => createHash('sha256').update(userId + ':' + email + ':' + code).digest('hex');
export async function listMemberEmails(userId: string) {
  return MemberEmailModel.find({ userId, verifiedAt: { $ne: null } }).select('email verifiedAt -_id').lean();
}
export async function requestMemberEmail(userId: string, input: unknown) {
  if (typeof input !== 'string') throw new Error('Enter an email address');
  const email = normalizeReportEmail(input);
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address');
  if (!config.smtpHost) throw new Error('Email verification is unavailable until email delivery is configured');
  if (await UserModel.exists({ email, _id: { $ne: userId } })) throw new Error('This email cannot be linked to this account');
  const existing = await MemberEmailModel.findOne({ email });
  if (existing && String(existing.userId) !== userId && (existing.verifiedAt || existing.expiresAt.getTime() > Date.now())) throw new Error('This email cannot be linked to this account');
  if (existing?.verifiedAt) return { alreadyVerified: true };
  if (existing && Date.now() - existing.sentAt.getTime() < 60000) throw new Error('Wait one minute before requesting another code');
  await MemberEmailModel.deleteMany({ userId, verifiedAt: null, expiresAt: { $lt: new Date() } });
  if (await MemberEmailModel.countDocuments({ userId }) >= 5 && !existing) throw new Error('You can link up to five email addresses');
  const code = String(randomInt(100000, 1000000));
  await MemberEmailModel.findOneAndUpdate({ email, verifiedAt: null }, { userId, email, codeHash: hashCode(userId, email, code), expiresAt: new Date(Date.now() + 10 * 60000), sentAt: new Date(), attempts: 0 }, { upsert: true });
  await sendEmail(email, { subject: 'Verify your GuildOS event email', text: 'Your GuildOS verification code is ' + code + '. It expires in 10 minutes. Only enter it in GuildOS if you requested it.', html: '<p>Your GuildOS verification code is <strong>' + code + '</strong>.</p><p>It expires in 10 minutes. Only enter it in GuildOS if you requested it.</p>' });
  return { alreadyVerified: false };
}
export async function verifyMemberEmail(userId: string, input: unknown, code: unknown) {
  if (typeof input !== 'string' || typeof code !== 'string' || !/^\d{6}$/.test(code)) throw new Error('Enter the six-digit verification code');
  const email = normalizeReportEmail(input);
  // Claim an attempt atomically so parallel requests cannot bypass the limit.
  const entry = await MemberEmailModel.findOneAndUpdate({ userId, email, verifiedAt: null, expiresAt: { $gt: new Date() }, attempts: { $lt: 5 } }, { $inc: { attempts: 1 } }, { new: true }).select('+codeHash');
  if (!entry || entry.codeHash !== hashCode(userId, email, code)) throw new Error('Invalid or expired code. Request a new code if needed.');
  if (await UserModel.exists({ email, _id: { $ne: userId } })) throw new Error('This email cannot be linked to this account');
  const verified = await MemberEmailModel.updateOne({ _id: entry._id, userId, codeHash: entry.codeHash, verifiedAt: null, expiresAt: { $gt: new Date() } }, { $set: { verifiedAt: new Date(), codeHash: '' } });
  if (!verified.modifiedCount) throw new Error('This code was replaced or expired. Request a new code.');
  return listMemberEmails(userId);
}
