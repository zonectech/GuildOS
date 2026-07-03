'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getPublicPortfolio } from './../../../components/guildos/auth-api';
import { Card } from './../../../components/guildos/ui/card';

export default function PortfolioPage() {
  const params = useParams<{ username: string }>();
  const username = typeof params?.username === 'string' ? decodeURIComponent(params.username) : '';
  const [portfolio, setPortfolio] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!username) return;

    let cancelled = false;

    void (async () => {
      try {
        const result = await getPublicPortfolio(username);
        if (!cancelled) setPortfolio(result.portfolio);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load portfolio');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [username]);

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <Card className="p-6">
          <p className="text-red-600">{error}</p>
        </Card>
      </main>
    );
  }

  if (!portfolio) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <Card className="p-6">
          <p>Loading portfolio...</p>
        </Card>
      </main>
    );
  }

  const profile = portfolio.profile ?? portfolio;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 space-y-6">
      <Card className="p-6">
        <h1 className="text-2xl font-semibold text-slate-950">{profile.fullName}</h1>
        <p className="text-sm text-slate-600">@{profile.username}</p>
        <p className="mt-2 text-slate-700">{profile.bio || 'No bio available'}</p>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {portfolio.sections?.map((section: any) => (
          <Card key={section.key} className="p-6">
            <h2 className="text-lg font-semibold text-slate-950">{section.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{section.enabled ? 'Enabled' : 'Hidden'}</p>
          </Card>
        ))}
      </div>
    </main>
  );
}
