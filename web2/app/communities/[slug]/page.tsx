import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCommunity, memberPreview } from '@/lib/api/communities';
import { listEvents } from '@/lib/api/events';
import { isNotFound } from '@/lib/api/client';
import { CommunityView, type CommunityInitial } from './view';

type Props = { params: Promise<{ slug: string }> };

/** The public copy of the community, or null if the API couldn't be reached (the browser then tries). */
async function loadCommunity(slug: string) {
  try { return await getCommunity(slug); }
  catch (e) { if (isNotFound(e)) notFound(); return null; }
}

// The link preview gets the real community name and bio. Same request as the page's (fetched once).
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const ctx = await loadCommunity(slug);
  return ctx ? { title: ctx.community.name, description: ctx.community.summary || undefined } : { title: 'Community' };
}

export default async function CommunityPage({ params }: Props) {
  const { slug } = await params;
  // A missing community is a real 404.
  const ctx = await loadCommunity(slug);
  let initial: CommunityInitial | null = null;
  if (ctx) {
    const [events, faces] = await Promise.all([
      listEvents(ctx.community.id).catch(() => null),
      memberPreview(ctx.community.id).catch(() => []),
    ]);
    initial = { ctx, events, faces };
  }
  return <CommunityView slug={slug} initial={initial} />;
}
