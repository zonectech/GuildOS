import { getCommunity } from '@/lib/api/communities';
import { brandCard, OG_SIZE, OG_TYPE, shareCard } from '@/lib/og';

export const alt = 'Community on OnTheRoll';
export const size = OG_SIZE;
export const contentType = OG_TYPE;

/** A community's link preview: name, school and members (all public). */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const { community: c } = await getCommunity(slug);
    return shareCard({
      kicker: c.verified ? 'Verified community' : 'Community',
      title: c.name,
      lines: [c.school ?? '', `${c.memberCount} ${c.memberCount === 1 ? 'member' : 'members'}`],
      stamp: 'JOIN',
    });
  } catch { return brandCard(); }
}
