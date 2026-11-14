import type { Metadata } from 'next';
import { HostingView } from '@/components/events/my-lists';

export const metadata: Metadata = { title: 'Hosting' };
export default function HostingPage() { return <HostingView />; }
