import Link from 'next/link';
import { CalendarDays, MapPin, Users } from 'lucide-react';
import { imageUrl, type EventSummary } from '@/lib/api';
import { bucketOf, placeLabel, whenLabel } from '@/lib/events';
import { GeneratedCover } from './cover';
import { CertLabel, DateBadge } from './ui';

function StatusChip({ event }: { event: EventSummary }) {
  const bucket = bucketOf(event);
  if (bucket === 'LIVE') return <span className="chip live">Live now</span>;
  if (bucket === 'CANCELLED') return <span className="chip off">Cancelled</span>;
  if (bucket === 'ENDED') return <span className="chip off">Ended</span>;
  if (event.status === 'POSTPONED') return <span className="chip off">Postponed</span>;
  if (event.status === 'ANNOUNCED') return <span className="chip ok">Coming soon</span>;
  if (event.status === 'DRAFT') return <span className="chip off">Draft</span>;
  return null;
}

export function EventCard({ event }: { event: EventSummary }) {
  return (
    <Link href={`/events/${event.slug}`} className="card">
      <div className="media">
        {event.bannerImage ? <img src={imageUrl(event.bannerImage)} alt="" /> : <GeneratedCover seed={event.title} type={event.type} />}
        <span className="tl"><DateBadge value={event.startDate} tz={event.timezone} /></span>
        <span className="br"><StatusChip event={event} /></span>
      </div>
      <div className="stack" style={{ gap: 4 }}>
        <h3>{event.title}</h3>
        <span className="meta"><CalendarDays size={15} />{whenLabel(event.startDate, event.timezone)}</span>
        <span className="meta"><MapPin size={15} />{placeLabel(event)}</span>
        {event.communityName ? <span className="meta"><Users size={15} />{event.communityName}</span> : null}
        <span style={{ marginTop: 4 }}><CertLabel offer={event.certificateOffer} /></span>
      </div>
    </Link>
  );
}
