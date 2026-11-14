import type { Metadata } from 'next';
import { SavedView } from '@/components/events/my-lists';

export const metadata: Metadata = { title: 'Saved' };
export default function SavedPage() { return <SavedView />; }
