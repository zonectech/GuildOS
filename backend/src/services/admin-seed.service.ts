import { config } from '../config';
import { UserModel } from '../models/user.model';
import { authStore } from '../store/auth-store';

/**
 * Bootstraps a platform admin from environment variables.
 * Set ADMIN_EMAIL and ADMIN_PASSWORD (optionally ADMIN_NAME) and restart.
 * - If the email already exists, the account is promoted to ADMIN and email-verified.
 * - Otherwise a new verified ADMIN account is created.
 */
export async function seedAdminIfConfigured() {
  const email = config.adminEmail?.toLowerCase().trim();
  const password = config.adminPassword;
  if (!email || !password) return;

  const existing = await UserModel.findOne({ email });
  if (existing) {
    let changed = false;
    if (existing.role !== 'ADMIN') {
      existing.role = 'ADMIN';
      changed = true;
    }
    if (!existing.emailVerified) {
      existing.emailVerified = true;
      changed = true;
    }
    if (changed) {
      await existing.save();
      console.log(`[GuildOS] Promoted ${email} to ADMIN`);
    }
    return;
  }

  const user = await authStore.createUser({
    fullName: config.adminName,
    email,
    password,
    role: 'ADMIN',
  });
  user.emailVerified = true;
  await user.save();
  console.log(`[GuildOS] Created ADMIN account ${email}`);
}
