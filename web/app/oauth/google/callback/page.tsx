import { Suspense } from 'react';
import { GoogleCallback } from '@/components/auth-pages';

export default function Page() {
  return <Suspense><GoogleCallback /></Suspense>;
}
