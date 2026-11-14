import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EventView } from '@/components/events/event-view';
import { BackBar } from '@/components/events/back-bar';
import { getEvent } from '@/lib/api/events';
import { isNotFound } from '@/lib/api/client';

type Props = { params: Promise<{ slug: string }> };

/** The public copy of the event, or null if the API couldn't be reached (the browser then tries). */
async function load(slug: string) {
  try { return await getEvent(slug); }
  catch (e) { if (isNotFound(e)) notFound(); return null; }
}

// The link preview gets the real event title. Same request as the page's (fetched once).
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const detail = await load(slug);
  return detail ? { title: detail.event.title, description: detail.event.summary || undefined } : { title: 'Event' };
}

export default async function EventPage({ params }: Props) {
  const { slug } = await params;
  // A missing event is a real 404 (the not-found page, with a 404 status).
  const detail = await load(slug);
  // Events always open as a full page, with a back arrow to the list.
  return <div className="pt-1 lg:pt-4"><BackBar slug={slug} /><EventView slug={slug} initial={detail} /></div>;
}
