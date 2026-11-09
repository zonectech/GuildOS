import type { Metadata } from 'next';
import { CertificateView } from './view';

export async function generateMetadata({ params }: { params: Promise<{ serial: string }> }): Promise<Metadata> {
  const { serial } = await params;
  return { title: `Certificate ${serial}` };
}

export default async function CertificatePage({ params }: { params: Promise<{ serial: string }> }) {
  const { serial } = await params;
  return <CertificateView serial={serial} />;
}
