import { Suspense } from 'react';
import { ForgotPassword } from '@/components/auth-pages';

export default function Page() {
  return <Suspense><ForgotPassword /></Suspense>;
}
