import { beforeEach, describe, it, expect, vi } from 'vitest';
const state = vi.hoisted(() => ({ entry: null as any, conflict: false, count: 0, modifiedCount: 1, smtpHost: 'test-smtp' }));
vi.mock('../../config', () => ({ config: { get smtpHost() { return state.smtpHost; } } }));
vi.mock('../../utils/email', () => ({ sendEmail: vi.fn(async () => {}) }));
vi.mock('../../models/user.model', () => ({ UserModel: { exists: vi.fn(async () => state.conflict) } }));
vi.mock('../../models/member-email.model', () => ({ MemberEmailModel: {
  findOne: vi.fn(async () => state.entry), countDocuments: vi.fn(async () => state.count), deleteMany: vi.fn(async () => ({})),
  findOneAndUpdate: vi.fn((query, update) => {
    if (update.$inc) return { select: async () => state.entry };
    state.entry = { _id: 'email-id', ...update, verifiedAt: null }; return Promise.resolve(state.entry);
  }),
  updateOne: vi.fn(async () => ({ modifiedCount: state.modifiedCount })),
  find: vi.fn(() => ({ select: () => ({ lean: async () => [{ email: state.entry?.email, verifiedAt: new Date() }] }) })),
} }));
import { requestMemberEmail, verifyMemberEmail } from './member-email.service';
import { MemberEmailModel } from '../../models/member-email.model';
import { sendEmail } from '../../utils/email';
beforeEach(() => { vi.clearAllMocks(); state.entry = null; state.conflict = false; state.count = 0; state.modifiedCount = 1; state.smtpHost = 'test-smtp'; });
describe('alternate event email verification', () => {
  it('sends a code while retaining only its hash', async () => {
    await requestMemberEmail('member', ' SCHOOL@EXAMPLE.EDU ');
    const sent = vi.mocked(sendEmail).mock.calls[0]; const code = /\b\d{6}\b/.exec(sent[1].text)![0];
    expect(sent[0]).toBe('school@example.edu'); expect(state.entry.codeHash).not.toContain(code); expect(state.entry.codeHash).toHaveLength(64);
    expect(state.entry.expiresAt.getTime() - state.entry.sentAt.getTime()).toBeCloseTo(600000, -2);
  });
  it('accepts the correct code and consumes it atomically', async () => {
    await requestMemberEmail('member', 'school@example.edu');
    const code = /\b\d{6}\b/.exec(vi.mocked(sendEmail).mock.calls[0][1].text)![0];
    await verifyMemberEmail('member', 'school@example.edu', code);
    expect(MemberEmailModel.findOneAndUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ userId: 'member', attempts: { $lt: 5 }, expiresAt: expect.any(Object) }), { $inc: { attempts: 1 } }, { new: true });
    expect(MemberEmailModel.updateOne).toHaveBeenCalledWith(expect.objectContaining({ userId: 'member', codeHash: state.entry.codeHash }), { $set: { verifiedAt: expect.any(Date), codeHash: '' } });
  });
  it('rejects incorrect, expired and exhausted codes', async () => {
    await requestMemberEmail('member', 'school@example.edu');
    await expect(verifyMemberEmail('member', 'school@example.edu', '000000')).rejects.toThrow(/Invalid or expired/);
    state.entry = null; await expect(verifyMemberEmail('member', 'school@example.edu', '123456')).rejects.toThrow(/Invalid or expired/);
    expect(MemberEmailModel.updateOne).not.toHaveBeenCalled();
  });
  it('does not claim success when a resend replaced the code', async () => {
    await requestMemberEmail('member', 'school@example.edu'); const code = /\b\d{6}\b/.exec(vi.mocked(sendEmail).mock.calls[0][1].text)![0]; state.modifiedCount = 0;
    await expect(verifyMemberEmail('member', 'school@example.edu', code)).rejects.toThrow(/replaced or expired/);
  });
  it('rejects addresses owned by another account', async () => {
    state.conflict = true; await expect(requestMemberEmail('member', 'school@example.edu')).rejects.toThrow(/cannot be linked/); expect(sendEmail).not.toHaveBeenCalled();
  });
  it('throttles resend requests', async () => {
    await requestMemberEmail('member', 'school@example.edu'); await expect(requestMemberEmail('member', 'school@example.edu')).rejects.toThrow(/one minute/); expect(sendEmail).toHaveBeenCalledTimes(1);
  });
  it('reports unavailable delivery and rejects invalid addresses', async () => {
    await expect(requestMemberEmail('member', 'not-an-email')).rejects.toThrow(/valid email/);
    state.smtpHost = ''; await expect(requestMemberEmail('member', 'school@example.edu')).rejects.toThrow(/unavailable/); expect(sendEmail).not.toHaveBeenCalled();
  });
});
