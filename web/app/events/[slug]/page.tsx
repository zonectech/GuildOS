import type { Metadata } from 'next';
import { eventMetadata } from '@/lib/share';
import EventView from './view';

// The page itself runs in the browser; this server part only adds the link preview.
export function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  return eventMetadata(decodeURIComponent(params.slug));
}

export default function Page() {
  return <EventView />;
}
