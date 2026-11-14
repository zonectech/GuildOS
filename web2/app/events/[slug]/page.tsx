import type { Metadata } from 'next';
import { EventView } from '@/components/events/event-view';
import { BackBar } from '@/components/events/back-bar';
import { API_BASE_URL } from '@/lib/api/client';

type Props = { params: Promise<{ slug: string }> };

// The link preview gets the real event title.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const r = await fetch(`${API_BASE_URL}/api/events/${encodeURIComponent(slug)}`, { next: { revalidate: 300 } });
    if (!r.ok) return { title: r.status === 404 ? 'Event not found' : 'Event' };
    const { event } = (await r.json()) as { event: { title: string; shortDescription?: string } };
    return { title: event.title, description: event.shortDescription || undefined };
  } catch { return { title: 'Event' }; }
}

export default async function EventPage({ params }: Props) {
  const { slug } = await params;
  // Events always open as a full page, with a back arrow to the list.
  return <div className="pt-1 lg:pt-4"><BackBar slug={slug} /><EventView slug={slug} /></div>;
}
