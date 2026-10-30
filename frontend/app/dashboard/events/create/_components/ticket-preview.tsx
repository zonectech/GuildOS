'use client';

import { useEffect, useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';

import type { TicketQrPlacement, TicketStyle } from '../../../../../components/guildos/api/event-api';
import { drawTicketCard, type TicketQrBox } from '../../../../../components/guildos/ticket-canvas';

/** Live preview of the buyer's downloadable ticket (sample name + QR). */
export function TicketPreview(props: {
  eventTitle: string;
  communityName: string;
  dateLabel: string;
  venueLabel: string;
  priceLabel: string;
  tierLabel: string;
  templateImage: string;
  qrPlacement: TicketQrPlacement;
  qrBox?: TicketQrBox | null;
  style: TicketStyle;
  accent: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const qrWrapRef = useRef<HTMLDivElement | null>(null);
  const runRef = useRef(0);
  const [notice, setNotice] = useState<'' | 'fallback' | 'not-exportable'>('');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const run = ++runRef.current;
    const qrCanvas = qrWrapRef.current?.querySelector('canvas') ?? null;
    // Draw off-screen and only show the newest result: an older, slower draw can never overwrite it.
    const scratch = document.createElement('canvas');
    void drawTicketCard(scratch, {
      previewOnly: true,
      eventTitle: props.eventTitle,
      communityName: props.communityName,
      attendeeName: 'Attendee Name',
      dateLabel: props.dateLabel,
      venueLabel: props.venueLabel,
      priceLabel: props.priceLabel,
      tierLabel: props.tierLabel,
      reference: '',
      qrCanvas,
      templateImage: props.templateImage,
      qrPlacement: props.qrPlacement,
      qrBox: props.qrBox ?? undefined,
      style: props.style,
      accent: props.accent,
    })
      .then((result) => {
        if (run !== runRef.current) return;
        canvas.width = scratch.width;
        canvas.height = scratch.height;
        canvas.getContext('2d')?.drawImage(scratch, 0, 0);
        setNotice(
          !props.templateImage ? '' : !result.templateUsed ? 'fallback' : !result.exportable ? 'not-exportable' : '',
        );
      })
      .catch(() => undefined);
  }, [props.eventTitle, props.communityName, props.dateLabel, props.venueLabel, props.priceLabel, props.tierLabel, props.templateImage, props.qrPlacement, props.qrBox?.x, props.qrBox?.y, props.qrBox?.size, props.style, props.accent]);

  return (
    <div className="mt-3">
      <div ref={qrWrapRef} className="hidden" aria-hidden>
        <QRCodeCanvas value="guildos-ticket-preview" size={512} includeMargin />
      </div>
      <canvas ref={canvasRef} className="w-full rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm" />
      <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">Preview. Each buyer's ticket carries their own name and check-in QR.</p>
      {notice === 'fallback' ? (
        <p role="alert" className="mt-1 text-xs text-amber-700 dark:text-amber-400">
          Your design couldn&apos;t be loaded, so the standard design is shown. Check the image uploaded correctly, then upload it again.
        </p>
      ) : null}
      {notice === 'not-exportable' ? (
        <p role="alert" className="mt-1 text-xs text-amber-700 dark:text-amber-400">
          Your design shows here, but downloaded and printed tickets will use the standard design until your image storage allows cross-origin reads (CORS) for this site.
        </p>
      ) : null}
    </div>
  );
}
