import { EventOverlay } from '@/components/events/overlay';

// An event opened from a list (client navigation) lands here and shows over the list.
export default async function EventOverlayPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <EventOverlay slug={slug} />;
}
