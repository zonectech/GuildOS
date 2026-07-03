'use client';

import Link from 'next/link';
import { AuthSuccessCard } from './auth-pages';

export function SignupSuccessPage() {
  return (
    <AuthSuccessCard
      title="Account created successfully"
      subtitle="Welcome to GuildOS"
      message="Your account is ready. Start building your student portfolio today."
      actions={<Link href="/profile-setup" className="auth-button auth-button-primary">Go to your dashboard</Link>}
    />
  );
}
