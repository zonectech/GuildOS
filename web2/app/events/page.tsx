import type { Metadata } from 'next';
import { Discover } from './discover';

export const metadata: Metadata = { title: 'Events' };

export default function EventsPage() {
  return <Discover />;
}
