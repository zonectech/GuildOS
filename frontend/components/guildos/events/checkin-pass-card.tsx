'use client';

import { useRef, useState } from 'react';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import { Download, Send } from 'lucide-react';
import { getCurrentUser } from '../auth-api';
import { drawTicketCard } from '../ticket-canvas';
import type { EventRegistration, EventSummary } from '../event-api';

/** Renders the branded (or organizer-designed) ticket card with the check-in QR and downloads it as PNG. */
export function TicketDownload({ event, qrToken, communityName, communityLogo = '', daysLabel = '' }: { event: EventSummary; qrToken: string; communityName: string; communityLogo?: string; daysLabel?: string }) {
  const qrWrapRef = useRef<HTMLDivElement | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleDownload() {
    try {
      setBusy(true);
      const user = await getCurrentUser().catch(() => null);
      const qrCanvas = qrWrapRef.current?.querySelector('canvas') ?? null;
      const canvas = document.createElement('canvas');
      const dateLabel = event.startDate
        ? new Date(event.startDate).toLocaleDateString('en-NG', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
        : '';
      await drawTicketCard(canvas, {
        eventTitle: event.title,
        communityName,
        attendeeName: user?.fullName ?? 'Attendee',
        dateLabel,
        venueLabel: event.mode === 'VIRTUAL' ? 'Online event' : event.venue || '',
        priceLabel: (event.ticketPrice ?? 0) > 0 ? `₦${(event.ticketPrice ?? 0).toLocaleString('en-NG')}` : 'FREE ENTRY',
        // Untiered events are all General Admission; for tiered events the viewer's
        // tier isn't known client-side, so the type line is omitted rather than guessed.
        tierLabel: (event.ticketTiers ?? []).length ? '' : 'General Admission',
        reference: '',
        qrCanvas,
        templateImage: event.ticketTemplate || '',
        qrPlacement: event.ticketQrPlacement,
        style: event.ticketStyle,
        accent: event.ticketAccent,
        logoImage: communityLogo,
        daysLabel,
      });
      const link = document.createElement('a');
      link.download = `ticket-${event.slug}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Hidden QR canvas — the drawn ticket copies pixels from it. */}
      <div ref={qrWrapRef} className="hidden" aria-hidden>
        <QRCodeCanvas value={qrToken} size={512} includeMargin />
      </div>
      <button
        onClick={() => void handleDownload()}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
      >
        <Download className="h-3.5 w-3.5" /> {busy ? 'Preparing…' : 'Download ticket'}
      </button>
    </>
  );
}

/**
 * The attendee's QR check-in pass: QR + token + ticket download + (for paid,
 * unused tickets) the inline transfer-to-a-friend flow. The transfer API call
 * stays with the page (`onTransfer`); this component owns the small form state.
 */
export function CheckinPassCard({
  event,
  registration,
  viewerName,
  communityName,
  communityLogo = '',
  isMultiDay,
  isPaidEvent,
  onTransfer,
}: {
  event: EventSummary;
  registration: EventRegistration;
  viewerName: string;
  communityName: string;
  communityLogo?: string;
  isMultiDay: boolean;
  isPaidEvent: boolean;
  onTransfer: (to: string) => Promise<void>;
}) {
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTo, setTransferTo] = useState('');
  const [transferBusy, setTransferBusy] = useState(false);

  async function handleTransfer() {
    if (!transferTo.trim()) return;
    try {
      setTransferBusy(true);
      await onTransfer(transferTo.trim());
      setTransferOpen(false);
      setTransferTo('');
    } finally {
      setTransferBusy(false);
    }
  }

  const totalDays = event.days?.length ?? 0;
  const planned = registration.plannedDays ?? [];
  // "Day 2 only" / "Days 1 & 3" chip for day-scoped RSVPs on multi-day events.
  const daysLabel =
    isMultiDay && planned.length > 0 && totalDays > 1 && planned.length < totalDays
      ? planned.length === 1
        ? `Day ${planned[0]} only`
        : `Days ${planned.join(' & ')}`
      : '';

  return (
    <section id="checkin-pass" className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-950 dark:text-white">Your Check-In Pass</h2>
      {viewerName ? <p className="mt-0.5 text-sm font-medium text-indigo-700">Ticket holder: {viewerName}</p> : null}
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{isMultiDay ? 'Show this QR to an organizer each day to check in — the same pass works for every day of the event.' : 'Show this QR to an organizer to check in. Check out at the end to earn your certificate.'}</p>
      <div className="mt-3 flex flex-col items-center gap-2">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
          <QRCodeSVG value={registration.qrToken} size={150} includeMargin />
        </div>
        <p className="break-all text-center font-mono text-xs text-slate-500 dark:text-slate-400">{registration.qrToken}</p>
        <TicketDownload event={event} qrToken={registration.qrToken} communityName={communityName} communityLogo={communityLogo} daysLabel={daysLabel} />
        {isPaidEvent && registration.status === 'CONFIRMED' && !registration.checkInAt ? (
          transferOpen ? (
            <div className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Transfer this ticket — enter their GuildOS email or username. They get their own QR pass; this one stops working.</p>
              <div className="mt-2 flex gap-2">
                <input
                  value={transferTo}
                  onChange={(e) => setTransferTo(e.target.value)}
                  placeholder="email or @username"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs"
                />
                <button onClick={() => void handleTransfer()} disabled={transferBusy || !transferTo.trim()} className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                  <Send className="h-3 w-3" /> {transferBusy ? 'Sending…' : 'Transfer'}
                </button>
              </div>
              <button onClick={() => setTransferOpen(false)} className="mt-1.5 text-xs text-slate-400 dark:text-slate-500 hover:underline">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setTransferOpen(true)} className="text-xs font-medium text-indigo-600 hover:underline">
              Can&apos;t make it? Transfer this ticket to someone else
            </button>
          )
        ) : null}
      </div>
    </section>
  );
}
