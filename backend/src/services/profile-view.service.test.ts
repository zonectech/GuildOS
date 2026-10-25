import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recordProfileView } from './profile-view.service';
import { ProfileViewModel } from '../models/profile-view.model';
import { NotificationModel } from '../models/notification.model';
import { createNotification } from './notification.service';

vi.mock('../models/profile-view.model', () => ({
  ProfileViewModel: { create: vi.fn() },
}));
vi.mock('../models/notification.model', () => ({
  NotificationModel: { findOne: vi.fn() },
}));
vi.mock('../models/certificate.model', () => ({
  CertificateModel: { findOne: vi.fn() },
}));
vi.mock('../store/auth-store', () => ({
  authStore: { getPublicUserById: vi.fn().mockResolvedValue({ fullName: 'Rita Recruiter' }) },
}));
vi.mock('./notification.service', () => ({
  createNotification: vi.fn(),
}));

const target = '65a000000000000000000001';
const viewer = '65a000000000000000000002';

describe('recordProfileView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(NotificationModel.findOne).mockReturnValue({ lean: vi.fn().mockResolvedValue(null) } as never);
  });

  it('keys signed-in viewers by user id and stamps the UTC day', async () => {
    await recordProfileView({ targetUserId: target, viewerId: viewer, viewerRole: 'STUDENT', ip: '1.2.3.4' });

    const doc = vi.mocked(ProfileViewModel.create).mock.calls[0][0] as unknown as Record<string, unknown>;
    expect(doc.viewerKey).toBe(`u:${viewer}`);
    expect(doc.viewDay).toBe(new Date().toISOString().slice(0, 10));
  });

  it('keys anonymous viewers by a hashed IP, never the raw address', async () => {
    await recordProfileView({ targetUserId: target, ip: '1.2.3.4' });
    await recordProfileView({ targetUserId: target, ip: '1.2.3.4' });
    await recordProfileView({ targetUserId: target, ip: '5.6.7.8' });

    const keys = vi.mocked(ProfileViewModel.create).mock.calls.map((c) => (c[0] as unknown as { viewerKey: string }).viewerKey);
    expect(keys[0]).toMatch(/^ip:[0-9a-f]{32}$/);
    expect(keys[0]).not.toContain('1.2.3.4');
    expect(keys[1]).toBe(keys[0]);
    expect(keys[2]).not.toBe(keys[0]);
  });

  it('treats a duplicate-key error as an already-counted view and skips the recruiter notification', async () => {
    vi.mocked(ProfileViewModel.create).mockRejectedValueOnce(Object.assign(new Error('dup'), { code: 11000 }));

    await expect(recordProfileView({ targetUserId: target, viewerId: viewer, viewerRole: 'RECRUITER' })).resolves.toBeUndefined();
    expect(createNotification).not.toHaveBeenCalled();
  });

  it('notifies on a first recruiter view', async () => {
    await recordProfileView({ targetUserId: target, viewerId: viewer, viewerRole: 'RECRUITER' });
    expect(createNotification).toHaveBeenCalledTimes(1);
  });

  it('ignores self-views', async () => {
    await recordProfileView({ targetUserId: target, viewerId: target });
    expect(ProfileViewModel.create).not.toHaveBeenCalled();
  });
});
