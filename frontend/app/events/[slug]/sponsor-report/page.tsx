'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { BadgeCheck, CalendarDays, Clock, Download, MapPin, Users, Video } from 'lucide-react';

import { getSponsorReport, resolveEventImageUrl, verifySponsorshipPayment, type SponsorReport } from '../../../../components/guildos/event-api';

function formatDate(value?: string | null) {
  if (!value) return 'TBA';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'TBA';
  return d.toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function formatDuration(minutes: number) {
  if (!minutes || minutes <= 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

export default function SponsorReportPage() {
  return (
    <Suspense fallback={null}>
      <SponsorReportInner />
    </Suspense>
  );
}

function SponsorReportInner() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const slug = typeof params?.slug === 'string' ? params.slug : '';
  const paymentReference = searchParams?.get('reference') ?? '';
  const [report, setReport] = useState<SponsorReport | null>(null);
  const [error, setError] = useState('');
  const [justPaid, setJustPaid] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    void (async () => {
      try {
        // Gateway redirect after a sponsor checkout — confirm the payment first so
        // the report the sponsor is about to see is already unlocked.
        if (paymentReference.startsWith('SPN-')) {
          const result = await verifySponsorshipPayment(paymentReference).catch(() => null);
          if (!cancelled && result?.status === 'PAID') setJustPaid(true);
        }
        const response = await getSponsorReport(slug);
        if (!cancelled) setReport(response.report);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load report');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, paymentReference]);

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      </main>
    );
  }

  if (!report) {
    return <main className="mx-auto max-w-3xl px-4 py-10"><p className="text-slate-500 dark:text-slate-400">Loading report…</p></main>;
  }

  const { event, community, sponsors, stats } = report;
  const statCards = [
    { label: 'Registered', value: stats.registered, icon: Users },
    { label: 'Checked in (verified)', value: stats.checkedIn, icon: BadgeCheck },
    { label: 'Completed attendance', value: stats.completed, icon: Clock },
    { label: 'Check-in rate', value: `${stats.checkInRate}%`, icon: Users },
    { label: 'Completion rate', value: `${stats.completionRate}%`, icon: BadgeCheck },
    { label: 'Avg. time attended', value: formatDuration(stats.averageAttendanceMinutes), icon: Clock },
  ];

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-10 print:py-4">
      {justPaid ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 print:hidden">
          <span className="font-semibold">Payment confirmed — thank you for sponsoring!</span> Your deal is settled through GuildOS: refund-protected if the event is cancelled, and this verified reach report is yours to share.
        </div>
      ) : null}
      {/* Header */}
      <div className="overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm print:border-0 print:shadow-none">
        <div className="relative h-36 bg-gradient-to-r from-indigo-700 to-sky-600">
          {event.bannerImage ? <img src={resolveEventImageUrl(event.bannerImage)} alt={event.title} className="h-full w-full object-cover opacity-60" /> : null}
          <div className="absolute inset-0 flex items-end p-6">
            <p className="rounded-full bg-white/90 px-3 py-1 text-xs font-bold uppercase tracking-widest text-indigo-700 backdrop-blur">Sponsor Report · GuildOS Verified</p>
          </div>
        </div>
        <div className="p-6">
          <h1 className="text-2xl font-semibold text-slate-950 dark:text-white">{event.title}</h1>
          {community ? (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
              Organized by {community.name}
              {community.verificationStatus === 'VERIFIED' ? <BadgeCheck className="h-4 w-4 text-indigo-500" /> : null}
            </p>
          ) : null}
          <div className="mt-4 grid gap-2 text-sm text-slate-600 dark:text-slate-400 sm:grid-cols-2">
            <p className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-slate-400 dark:text-slate-500" /> {formatDate(event.startDate)}</p>
            <p className="flex items-center gap-2">
              {event.mode === 'VIRTUAL' ? <Video className="h-4 w-4 text-slate-400 dark:text-slate-500" /> : <MapPin className="h-4 w-4 text-slate-400 dark:text-slate-500" />}
              {event.mode === 'VIRTUAL' ? 'Online event' : event.venue || 'Venue TBA'}
            </p>
          </div>
          {!report.final ? (
            <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
              This event is still in progress — figures are live and will grow until attendance is finalized.
            </p>
          ) : null}
          {report.locked ? (
            <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <span className="font-semibold">Verified reach stats are locked.</span> They unlock once the event&apos;s
              sponsorship platform fee is confirmed by GuildOS — organizers can find payment details in their dashboard.
            </p>
          ) : null}
        </div>
      </div>

      {/* Verified stats */}
      <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm print:border-slate-300 print:shadow-none">
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Verified reach</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Attendance is verified through GuildOS check-in/check-out — these are real people who showed up, not just sign-ups.
        </p>
        {report.locked ? (
          <div className="mt-4 rounded-2xl border border-dashed border-amber-300 bg-amber-50/60 p-6 text-center">
            <p className="text-sm font-semibold text-amber-800">Stats locked pending fee confirmation</p>
            <p className="mt-1 text-xs text-amber-700">The organizer's sponsorship platform fee has not been confirmed yet. Full verified reach figures appear here as soon as GuildOS confirms it.</p>
          </div>
        ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {statCards.map((s) => (
            <div key={s.label} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 text-center">
              <s.icon className="mx-auto h-4 w-4 text-indigo-500" />
              <p className="mt-2 text-2xl font-bold tabular-nums text-slate-950 dark:text-white">{s.value}</p>
              <p className="mt-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">{s.label}</p>
            </div>
          ))}
        </div>
        )}
        {event.certificatesIssued > 0 ? (
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            {event.certificatesIssued} verifiable certificate{event.certificatesIssued === 1 ? '' : 's'} issued to attendees
            {sponsors.some((s) => s.logo) ? ' — carrying sponsor branding' : ''}.
          </p>
        ) : null}
      </section>

      {/* Sponsors */}
      {sponsors.length ? (
        <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm print:border-slate-300 print:shadow-none">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Event sponsors</h2>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            {sponsors.map((s) => (
              <div key={s.name} className="flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-800 px-4 py-2.5">
                {s.logo ? <img src={resolveEventImageUrl(s.logo)} alt={s.name} className="h-8 w-auto object-contain" /> : null}
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{s.name}</span>
                {s.paidViaPlatform ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700" title="This sponsorship was paid through GuildOS — verified and refund-protected">
                    <BadgeCheck className="h-3 w-3" /> Paid via GuildOS
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Footer + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="text-xs text-slate-400 dark:text-slate-500">
          Generated {new Date(report.generatedAt).toLocaleString('en-NG')} · Data verified by GuildOS attendance tracking
        </p>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          <Download className="h-4 w-4" /> Save as PDF
        </button>
      </div>
      <p className="hidden text-center text-xs text-slate-400 dark:text-slate-500 print:block">
        Generated {new Date(report.generatedAt).toLocaleString('en-NG')} · guildos.app/events/{event.slug}/sponsor-report
      </p>
    </main>
  );
}
