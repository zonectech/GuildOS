import type { Metadata } from 'next';
import { ClassicUnavailable } from '@/components/shell/classic-unavailable';

export const metadata: Metadata = { title: 'Page unavailable' };

export default async function ClassicUnavailablePage({ searchParams }: {
  searchParams: Promise<{ path?: string }>;
}) {
  const { path } = await searchParams;
  return <ClassicUnavailable requestedPath={path} />;
}
