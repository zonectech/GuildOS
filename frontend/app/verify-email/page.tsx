'use client';

import { Suspense } from 'react';
import { VerifyEmailPage } from '../../components/guildos/verify-email-page';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailPage />
    </Suspense>
  );
}
