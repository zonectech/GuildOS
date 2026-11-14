import type { Metadata } from 'next';
import { profileMetadata } from '@/lib/share';
import ProfileView from './view';

// The page itself runs in the browser; this server part only adds the link preview.
export function generateMetadata({ params }: { params: { username: string } }): Promise<Metadata> {
  return profileMetadata(decodeURIComponent(params.username));
}

export default function Page() {
  return <ProfileView />;
}
