import { shareCard } from '@/lib/og-card';
import { fetchPublic, previewText } from '@/lib/share';
import type { CommunityContext } from '@/lib/api';

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const data = await fetchPublic<CommunityContext>(`/api/communities/${encodeURIComponent(params.slug)}`);
  const c = data?.community;
  if (!c) return shareCard({ kicker: 'Community', title: 'This community is not available' });
  return shareCard({
    kicker: [c.category, c.verificationStatus === 'VERIFIED' ? 'Verified community' : 'Community'].filter(Boolean).join(' · '),
    title: c.name,
    lines: [previewText(c.shortDescription, 70), [c.university, c.memberCount ? `${c.memberCount} members` : ''].filter(Boolean).join(' · ')].filter(Boolean),
  });
}

// The image generator's Node build cannot find its font on Windows; the edge build bundles it.
export const runtime = 'edge';
