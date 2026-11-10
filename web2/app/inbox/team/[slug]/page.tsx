import type { Metadata } from 'next';
import { TeamInbox } from './view';

export const metadata: Metadata = { title: 'Community inbox' };
export default async function TeamInboxPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <TeamInbox slug={slug} />;
}
