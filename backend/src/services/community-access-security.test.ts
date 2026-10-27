import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ user: {} as any, smtpHost: 'test', modified: 1 }));
vi.mock('../config', () => ({ config: { get smtpHost() { return state.smtpHost; } } }));
vi.mock('../utils/email', () => ({ sendEmail: vi.fn(async () => {}), communityAccessCodeEmail: (_name: string, code: string) => ({ subject: 'Code', text: code, html: code }) }));
vi.mock('./notification.service', () => ({ createNotification: vi.fn(async () => {}) }));
vi.mock('../models/user.model', () => ({ UserModel: {
  findById: vi.fn(() => ({ select: () => ({ lean: async () => state.user }), then: (resolve: any) => Promise.resolve(state.user).then(resolve) })),
  findOneAndUpdate: vi.fn(async (_query, update) => {
    const u = state.user; if (u.status !== 'ACTIVE' || !u.emailVerified || u.deletedAt) return null;
    if (update.$set) {
      if (u.communityAccessEmailCodeSentAt && Date.now() - u.communityAccessEmailCodeSentAt.getTime() < 60000) return null;
      Object.assign(u, update.$set); return u;
    }
    if (!u.communityAccessEmailCode || u.communityAccessEmailCodeExpires <= new Date() || u.communityAccessEmailCodeAttempts >= 5) return null;
    u.communityAccessEmailCodeAttempts++; return u;
  }),
  updateOne: vi.fn(async (_query, update) => { if (state.modified) Object.assign(state.user, update.$set); return { modifiedCount: state.modified }; }),
} }));
import { sendSchoolEmailCode, verifySchoolEmailCode, setCommunityAccess, requestCommunityAccess, schoolEmailVerification } from './community-access.service';
import { UserModel } from '../models/user.model';
import { sendEmail } from '../utils/email';
beforeEach(() => { vi.clearAllMocks(); vi.mocked(sendEmail).mockResolvedValue(undefined); state.smtpHost = 'test'; state.modified = 1; state.user = { _id: 'user', role: 'STUDENT', fullName: 'Test', status: 'ACTIVE', emailVerified: true, deletedAt: null, communityAccessStatus: 'NONE', communityAccessEmailCodeAttempts: 0, save: vi.fn(async () => {}) }; });
describe('Community Mode school verification security', () => {
  it('stores a bound hash, consumes a valid code, and still requires admin approval', async () => {
    await sendSchoolEmailCode('user', 'TEST@SCHOOL.EDU'); const code = vi.mocked(sendEmail).mock.calls[0][1].text;
    expect(code).toMatch(/^\d{6}$/); expect(state.user.communityAccessEmailCode).toHaveLength(64); expect(state.user.communityAccessEmailCode).not.toBe(code);
    await verifySchoolEmailCode('user', code); expect(state.user.communityAccessEmailVerified).toBe(true); expect(state.user.communityAccessEmailCode).toBe(''); expect(state.user.communityAccessStatus).toBe('NONE');
    await expect(verifySchoolEmailCode('user', code)).rejects.toThrow(/expired/);
  });
  it('enforces the resend cooldown and five guesses per challenge', async () => {
    await sendSchoolEmailCode('user', 'test@school.edu'); await expect(sendSchoolEmailCode('user', 'test@school.edu')).rejects.toThrow(/one minute/);
    for (let n = 0; n < 5; n++) await expect(verifySchoolEmailCode('user', '000000')).rejects.toThrow();
    const correct = vi.mocked(sendEmail).mock.calls[0][1].text; await expect(verifySchoolEmailCode('user', correct)).rejects.toThrow(/expired/);
    expect(state.user.communityAccessEmailVerified).toBe(false);
  });
  it('rejects expired codes and codes bound to another email', async () => {
    await sendSchoolEmailCode('user', 'test@school.edu'); const correct = vi.mocked(sendEmail).mock.calls[0][1].text;
    state.user.communityAccessEmail = 'other@school.edu'; await expect(verifySchoolEmailCode('user', correct)).rejects.toThrow();
    state.user.communityAccessEmail = 'test@school.edu'; state.user.communityAccessEmailCodeExpires = new Date(0); await expect(verifySchoolEmailCode('user', correct)).rejects.toThrow();
  });
  it('does not report success after a resend replaced the challenge', async () => {
    await sendSchoolEmailCode('user', 'test@school.edu'); const correct = vi.mocked(sendEmail).mock.calls[0][1].text; state.modified = 0;
    await expect(verifySchoolEmailCode('user', correct)).rejects.toThrow(/replaced/);
  });
  it('requires verified primary email, a school domain and configured delivery', async () => {
    await expect(sendSchoolEmailCode('user', 'test@gmail.com')).rejects.toThrow(/school email/);
    state.user.emailVerified = false; await expect(sendSchoolEmailCode('user', 'test@school.edu')).rejects.toThrow(/account email/);
    await expect(requestCommunityAccess('user', 'A detailed explanation of a community leader role')).rejects.toThrow(/account email/);
    state.smtpHost = ''; await expect(sendSchoolEmailCode('user', 'test@school.edu')).rejects.toThrow(/unavailable/);
    expect(sendEmail).not.toHaveBeenCalled();
  });
  it('distinguishes account verification from a resend cooldown', async () => {
    state.user.emailVerified = false;
    await expect(sendSchoolEmailCode('user', 'test@school.edu')).rejects.toMatchObject({ code: 'ACCOUNT_EMAIL_UNVERIFIED' });
    expect(sendEmail).not.toHaveBeenCalled();
    state.user.emailVerified = true;
    await sendSchoolEmailCode('user', 'test@school.edu');
    await expect(sendSchoolEmailCode('user', 'test@school.edu')).rejects.toMatchObject({ code: 'SCHOOL_EMAIL_COOLDOWN', retryAfterSeconds: expect.any(Number) });
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });
  it('invalidates a failed delivery and lets the user retry without a false cooldown', async () => {
    vi.mocked(sendEmail).mockRejectedValueOnce(new Error('SMTP unavailable'));
    await expect(sendSchoolEmailCode('user', 'test@school.edu')).rejects.toMatchObject({ code: 'SCHOOL_EMAIL_DELIVERY_FAILED' });
    expect(state.user.communityAccessEmailCodeSentAt).toBeNull();
    expect(state.user.communityAccessEmailCode).toBe('');
    expect(UserModel.updateOne).toHaveBeenCalledWith(expect.objectContaining({ _id: 'user', communityAccessEmailCode: expect.any(String) }), expect.any(Object));
    await expect(sendSchoolEmailCode('user', 'test@school.edu')).resolves.toMatchObject({ sent: true, resendAvailableAt: expect.any(String) });
  });
  it('can resend after an old school code expires without unverifying the account email', async () => {
    await sendSchoolEmailCode('user','test@school.edu');
    state.user.communityAccessEmailCodeSentAt = new Date(Date.now()-16*60000);
    state.user.communityAccessEmailCodeExpires = new Date(Date.now()-60000);
    await expect(sendSchoolEmailCode('user','test@school.edu')).resolves.toMatchObject({ sent:true });
    expect(state.user.emailVerified).toBe(true);
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(state.user.communityAccessEmailCodeExpires.getTime()).toBeGreaterThan(Date.now());
  });
  it('reuses a verified school signup email without granting Community Mode', async () => {
    state.user.email = 'member@school.edu';
    expect(schoolEmailVerification(state.user)).toMatchObject({ verified:true, reusedAccountEmail:true, email:'member@school.edu' });
    await expect(requestCommunityAccess('user','')).resolves.toEqual({status:'PENDING'});
    expect(state.user.communityAccessStatus).toBe('PENDING');
    expect(state.user.communityAccessEmailVerified).toBe(true);
    expect(state.user.communityAccessEmail).toBe(state.user.email);
    expect(sendEmail).not.toHaveBeenCalled();
  });
  it('does not reuse an unverified or non-academic signup address',()=>{
    expect(schoolEmailVerification({email:'member@school.edu',emailVerified:false}).verified).toBe(false);
    expect(schoolEmailVerification({email:'member@gmail.com',emailVerified:true}).verified).toBe(false);
    expect(schoolEmailVerification({email:'member@gmail.com',emailVerified:true,communityAccessEmail:'other@school.edu',communityAccessEmailVerified:false}).verified).toBe(false);
  });
  it('rejects self-approval without administrator authority', async () => {
    await expect(setCommunityAccess('user', 'user', true)).rejects.toThrow(/permissions/); expect(state.user.save).not.toHaveBeenCalled();
  });
});
