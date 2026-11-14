import type { Metadata } from 'next';
import { communityMetadata } from '@/lib/share';
import CommunityView from './view';

// The page itself runs in the browser; this server part only adds the link preview.
export function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  return communityMetadata(decodeURIComponent(params.slug));
}

export default function Page() {
  return <CommunityView />;
}
