import { shareCard } from '@/lib/og-card';
import { fetchPublic } from '@/lib/share';
import type { VerifiedCertificate } from '@/lib/account';

export async function GET(_req: Request, { params }: { params: { serial: string } }) {
  const data = await fetchPublic<{ certificate: VerifiedCertificate }>(`/api/certificates/verify/${encodeURIComponent(params.serial)}`);
  const cert = data?.certificate;
  if (!cert) return shareCard({ kicker: 'Certificate', title: 'Certificate not found' });
  if (cert.status !== 'VERIFIED') return shareCard({ kicker: `Certificate ${cert.status.toLowerCase()}`, title: cert.serial, lines: ['This certificate is no longer valid.'] });
  return shareCard({
    kicker: 'Verified certificate',
    title: cert.attendeeName,
    lines: [cert.eventTitle, `Issued by ${cert.communityName}`],
    tag: cert.serial,
    stamp: true,
  });
}

// The image generator's Node build cannot find its font on Windows; the edge build bundles it.
export const runtime = 'edge';
