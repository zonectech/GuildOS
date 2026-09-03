'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { QRCodeCanvas } from 'qrcode.react';

import {
  resolveEventImageUrl,
  verifyCertificate,
  downloadSignedCertificatePdf,
  DEFAULT_CERTIFICATE_THEME,
  DEFAULT_CERTIFICATE_CONTENT,
  type CertificateDetail,
} from '../../../components/guildos/event-api';
import { drawStandardCertificate } from '../../../components/guildos/certificate-canvas';

function formatDuration(minutes: number) {
  if (!minutes || minutes <= 0) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h} Hour${h > 1 ? 's' : ''} ${m} Minute${m > 1 ? 's' : ''}`;
  if (h) return `${h} Hour${h > 1 ? 's' : ''}`;
  return `${m} Minute${m > 1 ? 's' : ''}`;
}

function formatDate(value?: string | null) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function CertificateView() {
  const params = useParams<{ serial: string }>();
  const serial = typeof params?.serial === 'string' ? params.serial : '';
  const [certificate, setCertificate] = useState<CertificateDetail | null>(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fontsReady, setFontsReady] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const qrWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    (document as unknown as { fonts?: { ready: Promise<unknown> } }).fonts?.ready.then(() => setFontsReady((n) => n + 1));
  }, []);

  useEffect(() => {
    if (!serial) return;
    let cancelled = false;
    void (async () => {
      try {
        const result = await verifyCertificate(serial);
        if (!cancelled) setCertificate(result.certificate);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Certificate not found');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [serial]);

  // CUSTOM template rendering: overlay the attendee name on the uploaded image.
  useEffect(() => {
    if (!certificate || certificate.mode !== 'CUSTOM' || !certificate.templateImage || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const placement = certificate.namePlacement;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      canvas.width = img.naturalWidth || 1200;
      canvas.height = img.naturalHeight || 850;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const fontPx = Math.round((placement.fontSize / 100) * canvas.height);
      ctx.font = `600 ${fontPx}px Georgia, "Times New Roman", serif`;
      ctx.fillStyle = placement.color || '#111111';
      ctx.textAlign = placement.align;
      ctx.textBaseline = 'middle';
      ctx.fillText(certificate.attendeeName, (placement.x / 100) * canvas.width, (placement.y / 100) * canvas.height);
      setReady(true);
    };
    img.onerror = () => setError('Unable to load certificate template');
    img.src = resolveEventImageUrl(certificate.templateImage);
  }, [certificate]);

  // STANDARD template rendering — delegated to the shared certificate renderer.
  useEffect(() => {
    if (!certificate || certificate.mode !== 'STANDARD' || !canvasRef.current) return;
    const canvas = canvasRef.current;
    void (async () => {
      const qrCanvas = qrWrapRef.current?.querySelector('canvas') ?? null;
      await drawStandardCertificate(canvas, {
        attendeeName: certificate.attendeeName,
        eventTitle: certificate.eventTitle,
        communityName: certificate.communityName,
        university: certificate.university,
        type: certificate.type,
        theme: certificate.theme ?? DEFAULT_CERTIFICATE_THEME,
        style: certificate.style ?? 'CLASSIC',
        content: certificate.content ?? DEFAULT_CERTIFICATE_CONTENT,
        sponsors: certificate.sponsors ?? [],
        coHosts: certificate.coHosts ?? [],
        partners: certificate.partners ?? [],
        serial: certificate.serial,
        verificationUrl: certificate.verificationUrl,
        issueDate: certificate.issueDate,
        eventDate: certificate.eventDate,
        attendanceMinutes: certificate.attendanceMinutes,
        daysAttended: certificate.daysAttended,
        totalDays: certificate.totalDays,
        sectionName: certificate.sectionName,
        qrCanvas,
      });
      setReady(true);
    })();
  }, [certificate, fontsReady]);

  function handleDownload() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = url;
      link.download = `certificate-${serial}.png`;
      link.click();
    } catch {
      setError('Download blocked by the browser. Right-click the certificate to save it.');
    }
  }

  function handleDownloadPdf() {
    try {
      void downloadSignedCertificatePdf(serial);
    } catch {
      setError('PDF export failed in this browser — use Download PNG instead.');
    }
  }

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/50 dark:text-red-300">{error}</div>
      </main>
    );
  }

  if (!certificate) {
    return <main className="mx-auto max-w-3xl px-4 py-10"><p className="text-slate-500 dark:text-slate-400">Loading certificate…</p></main>;
  }

  const isVerified = certificate.status === 'VERIFIED';
  const revoked = certificate.status === 'REVOKED';
  const expired = certificate.status === 'EXPIRED';
  const invalid = certificate.status === 'INVALID';
  const inactive = !isVerified;
  const statusTone = revoked || invalid
    ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-950/50 dark:text-red-300'
    : expired
      ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-950/50 dark:text-amber-300'
      : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-950/50 dark:text-emerald-300';
  const statusSummary = revoked
    ? `Revoked — this certificate is no longer valid.${certificate.revokeReason ? ` Reason: ${certificate.revokeReason}` : ''}`
    : invalid
      ? `Invalid — this certificate was invalidated.${certificate.invalidationReason ? ` Reason: ${certificate.invalidationReason}` : ''}`
      : expired
        ? 'Expired — this certificate has passed its validity period.'
        : `Verified · Authentic — this is a genuine GuildOS certificate. Verified ${certificate.verificationCount} time(s).`;
  const showCanvas = certificate.mode === 'STANDARD' || Boolean(certificate.templateImage);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 space-y-6">
      {/* Hidden QR used to composite into the standard certificate canvas */}
      <div ref={qrWrapRef} className="hidden">
        <QRCodeCanvas value={certificate.verificationUrl} size={220} level="M" marginSize={2} />
      </div>

      <div className={`rounded-2xl border px-4 py-3 text-sm ${statusTone}`}>
        <p><span className="font-semibold">{certificate.status}</span> — {statusSummary}</p>
      </div>

      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-950 dark:text-white">{certificate.eventTitle}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Issued to {certificate.attendeeName} by {certificate.communityName}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusTone}`}>{certificate.status} · {certificate.serial}</span>
        </div>

        {showCanvas ? (
          <>
            <div className={`mt-6 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 ${inactive ? 'opacity-60 grayscale' : ''}`}>
              <canvas ref={canvasRef} className="block w-full" />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                onClick={handleDownload}
                disabled={!ready}
                className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Download PNG
              </button>
              <button
                onClick={handleDownloadPdf}
                className="rounded-2xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
              >
                Download PDF
              </button>
              {isVerified ? (
                <>
                  <a
                    href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(certificate.verificationUrl)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="rounded-2xl bg-[#0a66c2] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                  >
                    Share on LinkedIn
                  </a>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`I earned a verified certificate for "${certificate.eventTitle}" 🎓 Verify it here: ${certificate.verificationUrl}`)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="rounded-2xl bg-[#25d366] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                  >
                    WhatsApp
                  </a>
                  <a
                    href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`I earned a verified certificate for "${certificate.eventTitle}" 🎓`)}&url=${encodeURIComponent(certificate.verificationUrl)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="rounded-2xl bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                  >
                    Post on X
                  </a>
                  <button
                    onClick={() => {
                      void navigator.clipboard.writeText(certificate.verificationUrl).then(() => {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      });
                    }}
                    className="rounded-2xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    {copied ? 'Copied ✓' : 'Copy link'}
                  </button>
                </>
              ) : null}
            </div>
          </>
        ) : (
          <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">No template image is attached to this certificate.</p>
        )}

        <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
          <div><dt className="text-slate-500 dark:text-slate-400">Certificate ID</dt><dd className="font-medium text-slate-900 dark:text-slate-100">{certificate.serial}</dd></div>
          <div><dt className="text-slate-500 dark:text-slate-400">Type</dt><dd className="font-medium text-slate-900 dark:text-slate-100">{certificate.type}</dd></div>
          {certificate.university ? <div><dt className="text-slate-500 dark:text-slate-400">University</dt><dd className="font-medium text-slate-900 dark:text-slate-100">{certificate.university}</dd></div> : null}
          {(certificate.totalDays ?? 0) > 1 ? <div><dt className="text-slate-500 dark:text-slate-400">Days Attended</dt><dd className="font-medium text-slate-900 dark:text-slate-100">{certificate.daysAttended ?? 0} of {certificate.totalDays} days</dd></div> : null}
          {certificate.attendanceMinutes ? <div><dt className="text-slate-500 dark:text-slate-400">Attendance Duration</dt><dd className="font-medium text-slate-900 dark:text-slate-100">{formatDuration(certificate.attendanceMinutes)}</dd></div> : null}
          {certificate.eventDate ? <div><dt className="text-slate-500 dark:text-slate-400">Event Date</dt><dd className="font-medium text-slate-900 dark:text-slate-100">{formatDate(certificate.eventDate)}</dd></div> : null}
          <div><dt className="text-slate-500 dark:text-slate-400">Issue Date</dt><dd className="font-medium text-slate-900 dark:text-slate-100">{formatDate(certificate.issueDate)}</dd></div>
        </dl>
      </div>
    </main>
  );
}
