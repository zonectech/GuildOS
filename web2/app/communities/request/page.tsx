import type { Metadata } from 'next';
import { RequestFlow } from './flow';

export const metadata: Metadata = { title: 'Request a community' };

export default function RequestCommunityPage() {
  return <RequestFlow />;
}
