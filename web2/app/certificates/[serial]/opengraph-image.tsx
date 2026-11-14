import { verifyCertificate } from '@/lib/api/public';
import { brandCard, OG_SIZE, OG_TYPE, shareCard } from '@/lib/og';

export const alt = 'Certificate on OnTheRoll';
export const size = OG_SIZE;
export const contentType = OG_TYPE;

/** A certificate's link preview: who holds it, for which event, and whether it's valid (the page is public). */
export default async function Image({ params }: { params: Promise<{ serial: string }> }) {
  const { serial } = await params;
  try {
    const c = await verifyCertificate(serial);
    return shareCard({
      kicker: c.verified ? 'Verified certificate' : 'Certificate',
      title: c.attendeeName,
      lines: [c.eventTitle, `Issued by ${c.communityName}`],
      stamp: c.verified ? 'VALID' : c.status.slice(0, 9),
      accent: c.verified ? undefined : '#5B6660',
    });
  } catch { return brandCard(); }
}
