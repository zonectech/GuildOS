import { getEvent } from '@/lib/api/events';
import { fmtWhen } from '@/lib/format';
import { typeStyle } from '@/lib/events';
import { brandCard, OG_SIZE, OG_TYPE, shareCard } from '@/lib/og';

export const alt = 'Event on OnTheRoll';
export const size = OG_SIZE;
export const contentType = OG_TYPE;

/** An event's link preview: what it is, when, and who hosts it (all public). */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const { event } = await getEvent(slug);
    const cancelled = event.status === 'ARCHIVED' && Boolean(event.cancellationReason);
    return shareCard({
      kicker: cancelled ? 'Cancelled' : typeStyle(event.type).label,
      title: event.title,
      lines: [event.startDate ? fmtWhen(event.startDate, event.timezone) : '', `Hosted by ${event.community.name}`],
      stamp: cancelled ? 'CANCELLED' : event.certificate !== 'NONE' ? 'CERTIFICATE' : 'ATTEND',
      accent: cancelled ? '#5B6660' : undefined,
    });
  } catch { return brandCard(); }
}
