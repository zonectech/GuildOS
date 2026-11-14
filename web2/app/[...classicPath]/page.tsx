import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { web2LinkFor } from '@/lib/api/session';

type SearchParams = Record<string, string | string[] | undefined>;

// What the tab says when this ends in "page not found".
export const metadata: Metadata = { title: 'Page not found' };

/**
 * Any address web2 has no page for. Old addresses with a web2 equivalent (/home, /my-events, /profile,
 * old dashboard links…) go there; everything else is a real "page not found". Nothing is sent to the
 * previous site any more.
 */
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
  const mapped = web2LinkFor(qs ? `${path}?${qs}` : path);
  if (mapped && mapped !== path && mapped !== `${path}?${qs}`) redirect(mapped);
  notFound();
}
