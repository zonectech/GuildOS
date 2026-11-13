import { redirect } from 'next/navigation';
import { CLASSIC_URL } from '@/lib/api/client';
import { ClassicUnavailable } from '@/components/shell/classic-unavailable';

type SearchParams = Record<string, string | string[] | undefined>;

/** Pages not rebuilt in web2 remain available on the existing site. */
export default async function ClassicFallback({
  params,
  searchParams,
}: {
  params: Promise<{ classicPath: string[] }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ classicPath }, query] = await Promise.all([params, searchParams]);
  if (!CLASSIC_URL) {
    return <ClassicUnavailable requestedPath={`/${classicPath.join('/')}`} />;
  }

  const target = new URL(CLASSIC_URL);
  target.pathname = '/' + classicPath.map(encodeURIComponent).join('/');

  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      for (const item of value) target.searchParams.append(key, item);
    } else if (value !== undefined) {
      target.searchParams.set(key, value);
    }
  }

  redirect(target.toString());
}
