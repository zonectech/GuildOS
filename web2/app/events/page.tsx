import type { Metadata } from 'next';
import { listEvents } from '@/lib/api/events';
import { Discover } from './discover';

export const metadata: Metadata = { title: 'Events' };
// Rebuilt at most every 15 seconds; the list is the same for everyone.
export const revalidate = 15;

export default async function EventsPage() {
  // Rendered with the list, so it shows before any script runs. If the API can't be reached here,
  // the page still renders and the browser loads the list itself (with its own error and Try again).
  const initial = await listEvents().catch(() => null);
  return <Discover initial={initial} />;
}
