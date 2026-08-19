import { LoginAuditModel } from '../models/login-audit.model';

export type LoginTrafficUserSummary = {
  userId: string;
  email: string;
  role: string;
  loginCount: number;
  lastLoginAt: string | null;
};

export type LoginTrafficSummary = {
  totalLoginsLast24Hours: number;
  uniqueUsers: number;
  activeSessions: number;
  users: LoginTrafficUserSummary[];
};

export async function recordLoginAudit(input: {
  userId: string;
  email: string;
  role: string;
  sessionId?: string;
}) {
  const loginAt = new Date();
  await LoginAuditModel.create({
    userId: input.userId,
    email: (input.email ?? '').trim().toLowerCase(),
    role: input.role ?? 'STUDENT',
    sessionId: input.sessionId ?? '',
    loginAt,
    lastSeenAt: loginAt,
    isActive: true,
  });
}

export async function getLoginTrafficSummary(): Promise<LoginTrafficSummary> {
  const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [totalLoginsLast24Hours, activeSessions, uniqueUsers, users] = await Promise.all([
    LoginAuditModel.countDocuments({ loginAt: { $gte: windowStart } }),
    LoginAuditModel.countDocuments({ isActive: true, lastSeenAt: { $gte: new Date(Date.now() - 15 * 60 * 1000) } }),
    LoginAuditModel.distinct('userId', { loginAt: { $gte: windowStart } }).then((ids) => ids.length),
    LoginAuditModel.aggregate([
      { $match: { loginAt: { $gte: windowStart } } },
      { $group: { _id: '$userId', loginCount: { $sum: 1 }, lastLoginAt: { $max: '$loginAt' }, email: { $last: '$email' }, role: { $last: '$role' } } },
      { $sort: { lastLoginAt: -1, loginCount: -1 } },
    ]),
  ]);

  return {
    totalLoginsLast24Hours,
    uniqueUsers,
    activeSessions,
    users: users.map((row) => ({
      userId: String(row._id),
      email: String(row.email ?? ''),
      role: String(row.role ?? 'STUDENT'),
      loginCount: Number(row.loginCount ?? 0),
      lastLoginAt: row.lastLoginAt ? new Date(row.lastLoginAt).toISOString() : null,
    })),
  };
}
