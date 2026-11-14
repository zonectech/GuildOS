import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isNotFound } from '@/lib/api/client';
import { verifyCertificate } from '@/lib/api/public';
import { CertificateView } from './view';

type Props = { params: Promise<{ serial: string }> };

/** The certificate, or null if the API couldn't be reached (the browser then tries, and says so). */
async function load(serial: string) {
  try { return await verifyCertificate(serial); }
  catch (e) { if (isNotFound(e)) notFound(); return null; }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { serial } = await params;
  const cert = await load(serial);
  return { title: cert ? `${cert.attendeeName} · ${cert.eventTitle}` : `Certificate ${serial}` };
}

export default async function CertificatePage({ params }: Props) {
  const { serial } = await params;
  // A certificate number that doesn't exist is a real 404.
  const cert = await load(serial);
  return <CertificateView serial={serial} initial={cert} />;
}
