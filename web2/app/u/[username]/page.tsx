import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isNotFound } from '@/lib/api/client';
import { loadPublicPassport } from '@/lib/api/public';
import { PublicPassport } from './view';

type Props = { params: Promise<{ username: string }> };

/** What a visitor sees, or null if the API couldn't be reached (the browser then tries). */
async function load(username: string) {
  try { return await loadPublicPassport(username); }
  catch (e) { if (isNotFound(e)) notFound(); return null; }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const initial = await load(username);
  return { title: initial?.data ? initial.data.profile.fullName : `@${username}` };
}

export default async function PublicProfilePage({ params }: Props) {
  const { username } = await params;
  // An unknown username is a real 404; a private profile still renders (it says it's private).
  const initial = await load(username);
  return <PublicPassport username={username} initial={initial} />;
}
