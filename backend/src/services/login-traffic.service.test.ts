import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getLoginTrafficSummary } from './login-traffic.service';
import { LoginAuditModel } from '../models/login-audit.model';

vi.mock('../models/login-audit.model', () => ({
  LoginAuditModel: {
    countDocuments: vi.fn(),
    distinct: vi.fn(),
    aggregate: vi.fn(),
  },
}));

describe('getLoginTrafficSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns last-24h totals and per-user activity', async () => {
    vi.mocked(LoginAuditModel.countDocuments).mockImplementation(async (query) => {
      if (query?.loginAt?.$gte) return 9;
      return 3;
    });
    vi.mocked(LoginAuditModel.distinct).mockResolvedValue(['u1', 'u2']);
    vi.mocked(LoginAuditModel.aggregate).mockResolvedValue([
      { _id: 'u1', loginCount: 5, lastLoginAt: new Date('2024-01-05T10:00:00.000Z') },
      { _id: 'u2', loginCount: 3, lastLoginAt: new Date('2024-01-05T08:00:00.000Z') },
    ]);

    const summary = await getLoginTrafficSummary();

    expect(summary.totalLoginsLast24Hours).toBe(9);
    expect(summary.activeSessions).toBe(3);
    expect(summary.uniqueUsers).toBe(2);
    expect(summary.users).toHaveLength(2);
    expect(summary.users[0]).toMatchObject({ userId: 'u1', loginCount: 5 });
    expect(summary.users[0].lastLoginAt).toBe('2024-01-05T10:00:00.000Z');
  });
});
