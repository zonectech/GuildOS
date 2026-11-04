import { shareCard } from '@/lib/og-card';
import { TAGLINE } from '@/lib/share';

export function GET() {
  return shareCard({ kicker: 'Events and communities', title: 'See what is happening at your school.', lines: [TAGLINE.split('. ')[1] ?? ''] });
}

// The image generator's Node build cannot find its font on Windows; the edge build bundles it.
export const runtime = 'edge';
