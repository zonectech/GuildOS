import type { Metadata } from 'next';
import { EditEvent } from './view';

export const metadata: Metadata = { title: 'Edit event' };

export default async function EditEventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <EditEvent slug={slug} />;
}
