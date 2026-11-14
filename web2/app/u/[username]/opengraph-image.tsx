import { publicProfile } from '@/lib/api/profile';
import { brandCard, OG_SIZE, OG_TYPE, shareCard } from '@/lib/og';

export const alt = 'Profile on OnTheRoll';
export const size = OG_SIZE;
export const contentType = OG_TYPE;

/**
 * A profile's link preview. Only what the public profile shows: the name, and the school if they share
 * it. A private profile gets the plain brand card (no name).
 */
export default async function Image({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  try {
    const p = await publicProfile(username);
    if (p.visibility === 'PRIVATE') return brandCard();
    return shareCard({ kicker: 'Event passport', title: p.fullName, lines: [p.showSchool && p.school ? p.school : '', `@${p.username}`], stamp: 'PASSPORT' });
  } catch { return brandCard(); }
}
