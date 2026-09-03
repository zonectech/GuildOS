'use client';

// PUBLIC "collect your certificate" page for a dissolved leadership session.
// One shareable link goes to the whole outgoing executive group — each person finds
// their name and opens/downloads their own verified certificate. No account needed.

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Award, ExternalLink, GraduationCap, Search } from 'lucide-react';

import { LogoSpinner } from '../../../../../components/guildos/ui/loading';
import { getLeaderSessionCertificates, resolveAvatarUrl } from '../../../../../components/guildos/community-list-api';

type SessionCertificates = Awaited<ReturnType<typeof getLeaderSessionCertificates>>;

export default function LeaderSessionCertificatesPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? '';

  const [data, setData] = useState<SessionCertificates | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!slug) return;
    // window.location.search instead of useSearchParams — avoids the Suspense requirement.
    const session = new URLSearchParams(window.location.search).get('session') ?? '';
    getLeaderSessionCertificates(slug, session)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load certificates'))
      .finally(() => setIsLoading(false));
  }, [slug]);

  if (isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-100 dark:bg-slate-950">
        <LogoSpinner />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-100 dark:bg-slate-950 px-4">
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/50 dark:text-red-300">{error || 'Not found'}</div>
      </div>
    );
  }

  const q = query.trim().toLowerCase();
  const visible = q ? data.certificates.filter((c) => c.name.toLowerCase().includes(q) || c.title.toLowerCase().includes(q)) : data.certificates;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <main className="mx-auto max-w-2xl px-4 py-10">
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex items-center gap-3">
            {data.community.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={resolveAvatarUrl(data.community.logo)} alt={data.community.name} className="h-12 w-12 shrink-0 rounded-2xl border border-slate-200 dark:border-slate-800 object-cover" />
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-lg font-bold text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
                {data.community.name.slice(0, 1)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="flex items-center gap-2 text-lg font-extrabold text-slate-950 dark:text-white">
                <Award className="h-5 w-5 text-indigo-500" /> Leadership Certificates
              </h1>
              <p className="truncate text-sm text-slate-500 dark:text-slate-400">
                {data.community.name}
                {data.session ? ` · ${data.session} Session` : ''}
              </p>
            </div>
          </div>

          <p className="mt-4 rounded-2xl bg-indigo-50/70 px-4 py-3 text-xs text-indigo-800">
            Thank you for your service. Find your name below, open your certificate, and download or share it —
            every certificate is independently verifiable through its serial and QR code.
          </p>

          {data.certificates.length > 6 && (
            <div className="relative mt-4">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search your name…"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-indigo-400"
              />
            </div>
          )}

          <div className="mt-4 space-y-2">
            {visible.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                {data.certificates.length === 0 ? 'No certificates have been issued for this session yet.' : 'No name matches your search.'}
              </p>
            ) : (
              visible.map((cert) => (
                <a
                  key={cert.serial}
                  href={cert.verificationUrl}
                  className="group flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3 transition hover:border-indigo-200 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm"
                >
                  <GraduationCap className="h-5 w-5 shrink-0 text-indigo-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-900 dark:text-slate-100">{cert.name}</p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {cert.title ? `${cert.title} · ` : ''}
                      {cert.serial}
                    </p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-indigo-600 group-hover:underline">
                    View certificate <ExternalLink className="h-3 w-3" />
                  </span>
                </a>
              ))
            )}
          </div>

          <p className="mt-6 text-center text-[11px] text-slate-400 dark:text-slate-500">
            Verified by GuildOS — each certificate has a unique serial and public verification page.
          </p>
        </div>
      </main>
    </div>
  );
}
