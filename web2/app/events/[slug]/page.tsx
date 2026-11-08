import type { Metadata } from 'next';
import { EventView } from '@/components/events/event-view';
import { API_BASE_URL } from '@/lib/api/client';

type Props = { params: Promise<{ slug: string }> };

// A shared link or a refresh shows the full page; the link preview gets the real title.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const r = await fetch(`${API_BASE_URL}/api/events/${encodeURIComponent(slug)}`, { next: { revalidate: 300 } });
    if (!r.ok) return { title: 'Event' };
    const { event } = (await r.json()) as { event: { title: string; shortDescription?: string } };
    return { title: event.title, description: event.shortDescription || undefined };
  } catch { return { title: 'Event' }; }
}

export default async function EventPage({ params }: Props) {
  const { slug } = await params;
  return <div className="pt-2 lg:pt-6"><EventView slug={slug} /></div>;
}
