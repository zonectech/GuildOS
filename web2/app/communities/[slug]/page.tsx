import type { Metadata } from 'next';
import { API_BASE_URL } from '@/lib/api/client';
import { CommunityView } from './view';

type Props = { params: Promise<{ slug: string }> };

// The link preview gets the real community name and bio.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const r = await fetch(`${API_BASE_URL}/api/communities/${encodeURIComponent(slug)}`, { next: { revalidate: 300 } });
    if (!r.ok) return { title: 'Community' };
    const { community } = (await r.json()) as { community: { name: string; shortDescription?: string } };
    return { title: community.name, description: community.shortDescription || undefined };
  } catch { return { title: 'Community' }; }
}

export default async function CommunityPage({ params }: Props) {
  const { slug } = await params;
  return <CommunityView slug={slug} />;
}
