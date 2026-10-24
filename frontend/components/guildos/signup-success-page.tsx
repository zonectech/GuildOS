'use client';

import Link from 'next/link';
import { AuthSuccessCard } from './auth-pages';

export function SignupSuccessPage() {
  return (
    <AuthSuccessCard
      title="Account created successfully"
      subtitle="Welcome to GuildOS"
      message="Your account is ready. Set up your profile in about two minutes and start finding communities on your campus."
      actions={<Link href="/profile-setup" className="auth-button auth-button-primary">Set up my profile</Link>}
    />
  );
}
