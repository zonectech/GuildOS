import type { Metadata } from 'next';
import { Workspace } from './view';

export const metadata: Metadata = { title: 'Event workspace' };

export default async function EventWorkspacePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <Workspace slug={slug} />;
}
