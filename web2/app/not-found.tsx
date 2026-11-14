import type { Metadata } from 'next';
import { NotFoundPanel } from '@/components/ui/not-found-panel';

export const metadata: Metadata = { title: 'Page not found' };

/** Any address OnTheRoll doesn't have: said plainly, with a way back. */
export default function NotFound() {
  return <NotFoundPanel title="This page doesn’t exist" body="The link may be old or mistyped. Here’s a way back." href="/events" label="Browse events" secondary={{ href: '/communities', label: 'Communities' }} />;
}
