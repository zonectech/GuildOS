import type { Metadata } from 'next';
import { GoingView } from '@/components/events/my-lists';

export const metadata: Metadata = { title: 'Going' };
export default function GoingPage() { return <GoingView />; }
