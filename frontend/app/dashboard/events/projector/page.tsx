'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';

import { getEvent, type EventSummary } from '../../../../components/guildos/event-api';

export default function ProjectorModePage() {
  return (
    <Suspense fallback={null}>
      <ProjectorModePageInner />
    </Suspense>
  );
}

function ProjectorModePageInner() {
  const params = useSearchParams();
  const slug = params.get('slug') ?? '';
  const [event, setEvent] = useState<EventSummary | null>(null);
  const [communityName, setCommunityName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!slug) return;
    let active = true;
    async function load() {
      try {
        const detail = await getEvent(slug);
        if (!active) return;
        setEvent(detail.event);
        setCommunityName(detail.community?.name ?? '');
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load event');
      }
    }
    void load();
    const interval = setInterval(() => void load(), 10000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [slug]);

  const eventUrl = useMemo(() => {
    if (typeof window === 'undefined' || !slug) return '';
    return `${window.location.origin}/events/${slug}`;
  }, [slug]);

  if (!slug) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-center text-white">
        <p className="text-slate-300">Open projector mode from an event (add <span className="font-mono">?slug=event-slug</span> to the URL).</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col justify-between gap-8 px-6 py-8 lg:px-12">
        <header className="flex items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Projector Mode</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">{event?.title ?? 'Loading…'}</h1>
            <p className="mt-2 text-sm text-slate-400">{[communityName, event?.venue].filter(Boolean).join(' · ') || '—'}</p>
          </div>
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-right">
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Live Checked-In</p>
            <p className="text-3xl font-semibold text-white">{event?.checkedInCount ?? 0}</p>
          </div>
        </header>

        {error ? <p className="text-sm text-rose-300">{error}</p> : null}

        <section className="grid flex-1 items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm text-slate-400">Registrations</p>
              <p className="mt-2 text-4xl font-semibold">{event?.registrationCount ?? 0}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm text-slate-400">Status</p>
              <p className="mt-2 text-2xl font-semibold">{(event?.status ?? '').replace(/_/g, ' ') || '—'}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm text-slate-400">Completed</p>
              <p className="mt-2 text-4xl font-semibold">{event?.completedCount ?? 0}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm text-slate-400">Certificates</p>
              <p className="mt-2 text-4xl font-semibold">{event?.certificatesIssued ?? 0}</p>
            </div>
          </div>

          <div className="flex items-center justify-center rounded-[2rem] border border-white/10 bg-white p-8 text-slate-950">
            <div className="flex w-full max-w-[32rem] flex-col items-center gap-6">
              <div className="text-center">
                <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Scan to open &amp; register</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight">{event?.title ?? ''}</h2>
              </div>
              <div className="grid place-items-center rounded-[2rem] bg-white p-6">
                {eventUrl ? <QRCodeSVG value={eventUrl} size={320} includeMargin /> : null}
              </div>
              <p className="text-center text-sm text-slate-500">Students scan to open the event, register, and get their own check-in pass.</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

