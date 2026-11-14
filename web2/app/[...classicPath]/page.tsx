import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { CLASSIC_URL } from '@/lib/api/client';
import { web2LinkFor } from '@/lib/api/session';
import { ClassicUnavailable } from '@/components/shell/classic-unavailable';

type SearchParams = Record<string, string | string[] | undefined>;

// What the tab says when this ends in "page not found" (the old-site areas redirect before anything shows).
export const metadata: Metadata = { title: 'Page not found' };

/**
 * Parts of the previous site that web2 has not rebuilt yet. Only addresses under these open on the
 * previous site; everything else that web2 doesn't have is a real "page not found".
 */
const CLASSIC_AREAS = ['dashboard', 'oauth', 'scan', 'og', 'wallet', 'recruiter', 'opportunities', 'cv'];

/** Addresses from the previous site, and the ones web2 never had. */
export default async function UnknownAddress({
  params,
  searchParams,
}: {
  params: Promise<{ classicPath: string[] }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ classicPath }, query] = await Promise.all([params, searchParams]);
  const path = '/' + classicPath.map(encodeURIComponent).join('/');
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) for (const item of value) search.append(key, item);
    else if (value !== undefined) search.set(key, value);
  }
  const qs = search.toString();

  // An old address with a web2 equivalent (e.g. /my-events, /dashboard/events/create) goes there.
  const mapped = web2LinkFor(qs ? `${path}?${qs}` : path);
  if (mapped && mapped !== path && mapped !== `${path}?${qs}`) redirect(mapped);
  if (path === '/profile' || path.startsWith('/profile/')) redirect('/me');

  if (!CLASSIC_AREAS.includes(classicPath[0] ?? '')) notFound();
  if (!CLASSIC_URL) return <ClassicUnavailable requestedPath={path} />;
  const target = new URL(CLASSIC_URL);
  target.pathname = path;
  target.search = qs;
  redirect(target.toString());
}
