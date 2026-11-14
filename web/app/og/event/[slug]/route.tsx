import { shareCard } from '@/lib/og-card';
import { fetchPublic } from '@/lib/share';
import { bucketOf, longDate, placeLabel } from '@/lib/events';
import type { EventDetail } from '@/lib/api';

const TAG = { INSTANT: 'Instant certificate', AFTER_EVENT: 'Certificate after the event', NONE: '' } as const;

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const data = await fetchPublic<EventDetail>(`/api/events/${encodeURIComponent(params.slug)}`);
  if (!data?.event) return shareCard({ kicker: 'Event', title: 'This event is not available' });
  const { event, community } = data;
  const when = longDate(event);
  const past = bucketOf(event) === 'ENDED';
  return shareCard({
    kicker: [event.type.replace(/_/g, ' '), past ? 'Past event' : when.day].join(' · '),
    title: event.title,
    lines: [[past ? when.day : when.time, placeLabel(event)].filter(Boolean).join(' · '), community?.name ? `Hosted by ${community.name}` : ''].filter(Boolean),
    tag: past ? undefined : TAG[data.certificateOffer ?? 'NONE'] || undefined,
  });
}

// The image generator's Node build cannot find its font on Windows; the edge build bundles it.
export const runtime = 'edge';
