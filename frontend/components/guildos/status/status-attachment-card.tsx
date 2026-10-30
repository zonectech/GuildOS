'use client';

// Save as: components/guildos/status/status-attachment-card.tsx
import { memo, useEffect, useRef, useState, type RefObject } from 'react';
import { CalendarDays, GraduationCap, Ticket } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';

import {
  DEFAULT_CERTIFICATE_CONTENT,
  DEFAULT_CERTIFICATE_THEME,
  resolveEventImageUrl,
  type CertificateDetail,
} from '../api/event-api';
import { drawStandardCertificate } from '../certificates/certificate-canvas';
import { drawCustomCertificate, ensureNameFont } from '../certificates/certificate-custom';
import { drawTicketCard, type TicketQrPlacement, type TicketStyle } from '../ticket-canvas';
import type { StatusAttachment } from '../status-store';

type Props = {
  attachment: StatusAttachment;
  /** When set the whole card is a button (the viewer navigates to attachment.href). */
  onOpen?: () => void;
};

function eventMeta(attachment: StatusAttachment) {
  const when = attachment.startsAt
    ? new Date(attachment.startsAt).toLocaleDateString('en-NG', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    : '';

  return [when, attachment.mode === 'VIRTUAL' ? 'Online' : attachment.venue]
    .filter(Boolean)
    .join(' · ');
}

/** Same look as the event card in chat link previews. */
function EventCard({ attachment }: { attachment: StatusAttachment }) {
  const image = attachment.image ? resolveEventImageUrl(attachment.image) : '';
  const meta = eventMeta(attachment);
  const isTicket = attachment.type === 'TICKET';

  return (
    <>
      {image ? (
        <div className="relative aspect-[2/1] w-full bg-gradient-to-br from-indigo-500/30 to-sky-400/30">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image}
            alt=""
            className="h-full w-full object-cover"
            onError={(event) => {
              event.currentTarget.style.display = 'none';
            }}
          />
        </div>
      ) : null}

      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300">
          {isTicket ? <Ticket className="h-4 w-4" /> : <CalendarDays className="h-4 w-4" />}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
            {attachment.title}
          </p>
          {meta ? (
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{meta}</p>
          ) : null}
        </div>

        {isTicket ? (
          <span className="shrink-0 rounded-full bg-indigo-600 px-2.5 py-1 text-[11px] font-semibold text-white">
            Ticket
          </span>
        ) : null}
      </div>
    </>
  );
}

type TicketDesign = {
  templateImage: string;
  qrPlacement: string;
  qrBox?: { x: number; y: number; size: number } | null;
  style: string;
  accent: string;
  priceNgn: number;
  hasTiers: boolean;
  communityName: string;
  communityLogo: string;
  holderName: string;
  daysLabel: string;
  sectionLabel: string;
};

function readTicketDesign(snapshot: Record<string, unknown> | null): TicketDesign | null {
  const raw = snapshot?.ticket;
  return raw && typeof raw === 'object' ? (raw as TicketDesign) : null;
}

/**
 * Stands in for the check-in QR on a shared ticket. A status is visible to the
 * whole campus for 24 hours, so the real QR / gate code never leave the owner's pass.
 */
function makePrivatePassTile(): HTMLCanvasElement {
  const tile = document.createElement('canvas');
  tile.width = 512;
  tile.height = 512;
  const ctx = tile.getContext('2d');

  if (ctx) {
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 6;
    ctx.setLineDash([18, 14]);
    ctx.strokeRect(24, 24, 464, 464);
    ctx.setLineDash([]);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#0f172a';
    ctx.font = '800 64px Montserrat, Arial, sans-serif';
    ctx.fillText('GUILDOS', 256, 210);
    ctx.fillStyle = '#475569';
    ctx.font = '700 34px Montserrat, Arial, sans-serif';
    ctx.fillText('VERIFIED TICKET', 256, 272);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 26px Montserrat, Arial, sans-serif';
    ctx.fillText('Check-in code kept private', 256, 332);
  }

  return tile;
}

// Drawn tickets / certificates are kept for the session, so reopening a status (or the
// story after its composer preview) shows instantly instead of redrawing.
const renderCache = new Map<string, string>();
const RENDER_CACHE_LIMIT = 20;

function cacheKeyFor(attachment: StatusAttachment) {
  return `${attachment.type}:${attachment.refId}`;
}

function remember(key: string, canvas: HTMLCanvasElement) {
  try {
    const url = canvas.toDataURL('image/png');
    if (renderCache.size >= RENDER_CACHE_LIMIT) {
      const oldest = renderCache.keys().next().value;
      if (oldest) renderCache.delete(oldest);
    }
    renderCache.set(key, url);
  } catch {
    // A canvas tainted by a cross-origin image can't be exported: just skip caching.
  }
}

/** Waits for web fonts so the first draw is the final one (no font swap). */
function useFontsLoaded(families: string[] = []) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const fonts = (document as unknown as {
      fonts?: { ready: Promise<unknown>; load: (font: string) => Promise<unknown> };
    }).fonts;

    if (!fonts) {
      setLoaded(true);
      return;
    }

    void Promise.all([fonts.ready, ...families.map((font) => fonts.load(font))])
      .catch(() => undefined)
      .then(() => setLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return loaded;
}

/** Reserves the final shape and fades the drawing in, so there is no empty flash. */
function DrawingFrame({
  ratio,
  ready,
  canvasRef,
}: {
  ratio: number;
  ready: boolean;
  canvasRef: RefObject<HTMLCanvasElement>;
}) {
  return (
    <div className="relative w-full bg-slate-100 dark:bg-slate-900" style={{ aspectRatio: String(ratio) }}>
      {!ready ? <div className="absolute inset-0 animate-pulse bg-slate-200 dark:bg-slate-800" /> : null}
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 h-full w-full transition-opacity duration-300 ${ready ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  );
}

function TicketFooter({ attachment }: { attachment: StatusAttachment }) {
  const meta = eventMeta(attachment);

  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300">
        <Ticket className="h-4 w-4" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
          {attachment.title}
        </p>
        {meta ? (
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{meta}</p>
        ) : null}
      </div>

      <span className="shrink-0 rounded-full bg-indigo-600 px-2.5 py-1 text-[11px] font-semibold text-white">
        Ticket
      </span>
    </div>
  );
}

/** The actual ticket image (organizer artwork or GuildOS design), drawn without the QR. */
function TicketCard({ attachment }: { attachment: StatusAttachment }) {
  const key = cacheKeyFor(attachment);
  const cached = renderCache.get(key);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fontsLoaded = useFontsLoaded(['700 30px Montserrat', '400 22px Montserrat']);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [ratio, setRatio] = useState(1500 / 560);
  const hasDesign = Boolean(readTicketDesign(attachment.snapshot));

  useEffect(() => {
    const canvas = canvasRef.current;
    const design = readTicketDesign(attachment.snapshot);
    if (!canvas || !design || !fontsLoaded) return;

    let cancelled = false;

    void (async () => {
      try {
        await drawTicketCard(canvas, {
          eventTitle: attachment.title,
          communityName: design.communityName,
          attendeeName: design.holderName || 'Attendee',
          dateLabel: attachment.startsAt
            ? new Date(attachment.startsAt).toLocaleDateString('en-NG', {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })
            : '',
          venueLabel: attachment.mode === 'VIRTUAL' ? 'Online event' : attachment.venue,
          priceLabel: design.priceNgn > 0 ? `₦${design.priceNgn.toLocaleString('en-NG')}` : 'FREE ENTRY',
          // Same rule as the download: untiered = General Admission, tiered = no type line.
          tierLabel: design.hasTiers ? '' : 'General Admission',
          sectionLabel: design.sectionLabel,
          // Never the real credentials.
          passCode: '',
          reference: '',
          qrCanvas: makePrivatePassTile(),
          // Organizer's own artwork: draw only the attendee's name on it (no QR block at all).
          nameOnly: Boolean(design.templateImage),
          templateImage: design.templateImage,
          qrPlacement: (design.qrPlacement || undefined) as TicketQrPlacement | undefined,
          qrBox: design.qrBox ?? undefined,
          style: (design.style || undefined) as TicketStyle | undefined,
          accent: design.accent || undefined,
          logoImage: design.communityLogo,
          daysLabel: design.daysLabel,
        });
        if (cancelled) return;
        setRatio(canvas.width / canvas.height);
        setReady(true);
        remember(key, canvas);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [attachment, fontsLoaded, key]);

  // Older ticket statuses (no design saved) or a drawing failure: the event card.
  if (!hasDesign || failed) {
    return <EventCard attachment={attachment} />;
  }

  return (
    <>
      {cached ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cached} alt="" className="block w-full" />
      ) : (
        <DrawingFrame ratio={ratio} ready={ready} canvasRef={canvasRef} />
      )}
      <TicketFooter attachment={attachment} />
    </>
  );
}

/** Draws the certificate exactly like the public certificate page does. */
function CertificateCard({ attachment }: { attachment: StatusAttachment }) {
  const detail = attachment.snapshot as unknown as CertificateDetail | null;
  const key = cacheKeyFor(attachment);
  const cached = renderCache.get(key);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const qrWrapRef = useRef<HTMLDivElement | null>(null);
  const fontsLoaded = useFontsLoaded();
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [ratio, setRatio] = useState(1876 / 1450);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!detail || !canvas || !fontsLoaded) return;

    let cancelled = false;

    // CUSTOM template: overlay the attendee name on the uploaded image.
    if (detail.mode === 'CUSTOM' && detail.templateImage) {
      const placement = detail.namePlacement;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        void ensureNameFont(placement.font).then(() => {
          if (cancelled) return;
          const qrCanvas = qrWrapRef.current?.querySelector('canvas') ?? null;
          drawCustomCertificate(canvas, {
            image: img,
            attendeeName: detail.attendeeName,
            placement,
            qrBox: detail.qrBox,
            qrCanvas,
            serial: detail.serial,
          });
          setRatio(canvas.width / canvas.height);
          setReady(true);
          remember(key, canvas);
        });
      };
      img.onerror = () => {
        if (!cancelled) setFailed(true);
      };
      img.src = resolveEventImageUrl(detail.templateImage);

      return () => {
        cancelled = true;
      };
    }

    // STANDARD template: shared certificate renderer.
    void (async () => {
      try {
        const qrCanvas = qrWrapRef.current?.querySelector('canvas') ?? null;
        await drawStandardCertificate(canvas, {
          attendeeName: detail.attendeeName,
          eventTitle: detail.eventTitle,
          communityName: detail.communityName,
          university: detail.university,
          type: detail.type,
          theme: detail.theme ?? DEFAULT_CERTIFICATE_THEME,
          style: detail.style ?? 'CLASSIC',
          content: detail.content ?? DEFAULT_CERTIFICATE_CONTENT,
          sponsors: detail.sponsors ?? [],
          coHosts: detail.coHosts ?? [],
          partners: detail.partners ?? [],
          serial: detail.serial,
          verificationUrl: detail.verificationUrl,
          issueDate: detail.issueDate,
          eventDate: detail.eventDate,
          attendanceMinutes: detail.attendanceMinutes,
          daysAttended: detail.daysAttended,
          totalDays: detail.totalDays,
          sectionName: detail.sectionName,
          qrCanvas,
        });
        if (cancelled) return;
        setRatio(canvas.width / canvas.height);
        setReady(true);
        remember(key, canvas);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [detail, fontsLoaded, key]);

  return (
    <>
      {detail && !failed ? (
        cached ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cached} alt="" className="block w-full" />
        ) : (
          <>
            <DrawingFrame ratio={ratio} ready={ready} canvasRef={canvasRef} />
            <div ref={qrWrapRef} className="hidden">
              <QRCodeCanvas value={detail.verificationUrl} size={detail.mode === 'CUSTOM' ? 512 : 220} level="M" marginSize={detail.mode === 'CUSTOM' ? 4 : 2} />
            </div>
          </>
        )
      ) : null}

      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300">
          <GraduationCap className="h-4 w-4" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
            {attachment.title}
          </p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
            {attachment.subtitle || 'Verified certificate'}
          </p>
        </div>

        <span className="shrink-0 rounded-full bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white">
          Verify
        </span>
      </div>
    </>
  );
}

/** A ticket or certificate image the user uploaded. Always labelled as not verified. */
function UploadCard({ attachment }: { attachment: StatusAttachment }) {
  const isTicket = attachment.type === 'TICKET_UPLOAD';

  return (
    <>
      <div className="bg-slate-100 dark:bg-slate-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={resolveEventImageUrl(attachment.image)}
          alt={attachment.title}
          className="mx-auto block max-h-[360px] w-full object-contain"
        />
      </div>

      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {isTicket ? <Ticket className="h-4 w-4" /> : <GraduationCap className="h-4 w-4" />}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
            {attachment.title}
          </p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
            Shared image · not verified by GuildOS
          </p>
        </div>

        <span className="shrink-0 rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
          Uploaded
        </span>
      </div>
    </>
  );
}

// memo: the viewer re-renders every animation frame; the canvas must not redraw.
export const StatusAttachmentCard = memo(function StatusAttachmentCard({
  attachment,
  onOpen,
}: Props) {
  const body =
    attachment.type === 'CERTIFICATE' ? (
      <CertificateCard attachment={attachment} />
    ) : attachment.type === 'TICKET' ? (
      <TicketCard attachment={attachment} />
    ) : attachment.type === 'TICKET_UPLOAD' || attachment.type === 'CERTIFICATE_UPLOAD' ? (
      <UploadCard attachment={attachment} />
    ) : (
      <EventCard attachment={attachment} />
    );

  const shell =
    'block w-full overflow-hidden rounded-xl border border-black/10 bg-white text-left shadow-lg dark:border-white/10 dark:bg-slate-950';

  if (onOpen) {
    return (
      <button type="button" onClick={onOpen} className={`${shell} transition hover:shadow-xl`}>
        {body}
      </button>
    );
  }

  return <div className={shell}>{body}</div>;
});