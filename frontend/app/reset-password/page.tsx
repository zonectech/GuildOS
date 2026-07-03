'use client';

import { Suspense } from 'react';
import { ResetPasswordPage } from '../../components/guildos/reset-password-page';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordPage />
    </Suspense>
  );
}
