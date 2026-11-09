import type { Metadata } from 'next';
import { Suspense } from 'react';
import { RequestStatusView } from './view';

export const metadata: Metadata = { title: 'Your community requests' };

export default function RequestStatusPage() {
  return <Suspense fallback={null}><RequestStatusView /></Suspense>;
}
