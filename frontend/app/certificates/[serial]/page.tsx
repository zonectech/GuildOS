import type { Metadata } from 'next';
import { CertificateView } from './certificate-view';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const TYPE_LABEL: Record<string, string> = {
  ATTENDANCE: 'Certificate of Attendance',
  COMPLETION: 'Certificate of Completion',
  LEADERSHIP: 'Certificate of Leadership',
  VOLUNTEER: 'Certificate of Volunteering',
};

/**
 * Server-side metadata so shared certificate links unfurl properly on
 * LinkedIn/WhatsApp/X — every shared certificate is an ad for GuildOS.
 * Uses the counter-free /meta endpoint (crawlers must not inflate verifications).
 */
export async function generateMetadata({ params }: { params: { serial: string } }): Promise<Metadata> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/certificates/meta/${encodeURIComponent(params.serial)}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error('not found');
    const { certificate } = (await res.json()) as {
      certificate: { attendeeName: string; eventTitle: string; communityName: string; type: string; status: string };
    };
    const label = TYPE_LABEL[certificate.type] ?? 'Verified Certificate';
    const title = `${certificate.attendeeName} — ${label} | GuildOS`;
    const description =
      certificate.status === 'REVOKED'
        ? `This certificate has been revoked.`
        : `Verified ${label.toLowerCase()} for "${certificate.eventTitle}", issued by ${certificate.communityName} on GuildOS. Scan or click to verify authenticity.`;
    return {
      title,
      description,
      openGraph: { title, description, type: 'website', siteName: 'GuildOS' },
      twitter: { card: 'summary', title, description },
    };
  } catch {
    return { title: 'Certificate Verification — GuildOS' };
  }
}

export default function CertificatePage() {
  return <CertificateView />;
}
