import type { Metadata } from 'next';
import { ManageView } from './view';

export const metadata: Metadata = { title: 'Manage community' };

export default async function ManageCommunityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ManageView slug={slug} />;
}
