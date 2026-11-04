import type { Metadata } from 'next';
import { certificateMetadata } from '@/lib/share';
import CertificateView from './view';

// The page itself runs in the browser; this server part only adds the link preview.
export function generateMetadata({ params }: { params: { serial: string } }): Promise<Metadata> {
  return certificateMetadata(decodeURIComponent(params.serial));
}

export default function Page() {
  return <CertificateView />;
}
