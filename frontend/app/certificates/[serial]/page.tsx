'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { QRCodeCanvas } from 'qrcode.react';

import { resolveEventImageUrl, verifyCertificate, type CertificateDetail } from '../../../components/guildos/event-api';

const TYPE_LABEL: Record<string, string> = {
  ATTENDANCE: 'Certificate of Attendance',
  COMPLETION: 'Certificate of Completion',
  LEADERSHIP: 'Certificate of Leadership',
  VOLUNTEER: 'Certificate of Volunteering',
};

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
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function CertificatePage() {
  const params = useParams<{ serial: string }>();
  const serial = typeof params?.serial === 'string' ? params.serial : '';
  const [certificate, setCertificate] = useState<CertificateDetail | null>(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const qrWrapRef = useRef<HTMLDivElement | null>(null);

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

  // STANDARD template rendering: draw a branded GuildOS certificate.
  useEffect(() => {
    if (!certificate || certificate.mode !== 'STANDARD' || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = 1200;
    const H = 850;
    canvas.width = W;
    canvas.height = H;

    const accent = '#4f46e5';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 10;
    ctx.strokeRect(24, 24, W - 48, H - 48);
    ctx.strokeStyle = '#c7d2fe';
    ctx.lineWidth = 2;
    ctx.strokeRect(44, 44, W - 88, H - 88);

    ctx.textAlign = 'center';
    ctx.fillStyle = accent;
    ctx.font = '700 26px Arial, sans-serif';
    ctx.fillText('GuildOS', W / 2, 110);

    ctx.fillStyle = '#0f172a';
    ctx.font = '700 46px Georgia, serif';
    ctx.fillText((TYPE_LABEL[certificate.type] ?? 'Certificate').toUpperCase(), W / 2, 190);

    ctx.fillStyle = '#64748b';
    ctx.font = '400 20px Arial, sans-serif';
    ctx.fillText('This is proudly presented to', W / 2, 260);

    ctx.fillStyle = '#111827';
    ctx.font = '700 56px Georgia, serif';
    ctx.fillText(certificate.attendeeName, W / 2, 335);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W / 2 - 260, 360);
    ctx.lineTo(W / 2 + 260, 360);
    ctx.stroke();

    ctx.fillStyle = '#64748b';
    ctx.font = '400 20px Arial, sans-serif';
    ctx.fillText('for participating in', W / 2, 410);

    ctx.fillStyle = '#0f172a';
    ctx.font = '600 32px Georgia, serif';
    ctx.fillText(certificate.eventTitle, W / 2, 455);

    ctx.fillStyle = '#475569';
    ctx.font = '400 20px Arial, sans-serif';
    const org = [certificate.communityName, certificate.university].filter(Boolean).join('  ·  ');
    if (org) ctx.fillText(`Organized by ${org}`, W / 2, 495);

    const duration = formatDuration(certificate.attendanceMinutes);
    const eventDate = formatDate(certificate.eventDate);
    const metaLine = [duration ? `Attendance: ${duration}` : '', eventDate ? `Event Date: ${eventDate}` : '']
      .filter(Boolean)
      .join('      ');
    if (metaLine) {
      ctx.fillStyle = '#334155';
      ctx.font = '500 18px Arial, sans-serif';
      ctx.fillText(metaLine, W / 2, 540);
    }

    // Footer: certificate ID + verification
    ctx.textAlign = 'left';
    ctx.fillStyle = '#64748b';
    ctx.font = '400 16px Arial, sans-serif';
    ctx.fillText('Certificate ID', 90, 700);
    ctx.fillStyle = '#0f172a';
    ctx.font = '600 20px Arial, sans-serif';
    ctx.fillText(certificate.serial, 90, 728);
    ctx.fillStyle = '#64748b';
    ctx.font = '400 15px Arial, sans-serif';
    ctx.fillText(`Verify at ${certificate.verificationUrl}`, 90, 756);
    ctx.fillStyle = '#475569';
    ctx.font = '400 15px Arial, sans-serif';
    ctx.fillText(`Issued ${formatDate(certificate.issueDate)}`, 90, 782);

    // QR composite (bottom right)
    const qrCanvas = qrWrapRef.current?.querySelector('canvas');
    if (qrCanvas) {
      ctx.drawImage(qrCanvas, W - 90 - 150, 640, 150, 150);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#64748b';
      ctx.font = '400 13px Arial, sans-serif';
      ctx.fillText('Scan to verify', W - 90 - 75, 810);
    }

    setReady(true);
  }, [certificate]);

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

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      </main>
    );
  }

  if (!certificate) {
    return <main className="mx-auto max-w-3xl px-4 py-10"><p className="text-slate-500">Loading certificate…</p></main>;
  }

  const revoked = certificate.status === 'REVOKED';
  const showCanvas = certificate.mode === 'STANDARD' || Boolean(certificate.templateImage);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 space-y-6">
      {/* Hidden QR used to composite into the standard certificate canvas */}
      <div ref={qrWrapRef} className="hidden">
        <QRCodeCanvas value={certificate.verificationUrl} size={220} level="M" marginSize={2} />
      </div>

      <div className={`rounded-2xl border px-4 py-3 text-sm ${revoked ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
        {revoked ? (
          <p><span className="font-semibold">Revoked</span> — this certificate is no longer valid.{certificate.revokeReason ? ` Reason: ${certificate.revokeReason}` : ''}</p>
        ) : (
          <p><span className="font-semibold">Verified · Authentic</span> — this is a genuine GuildOS certificate. Verified {certificate.verificationCount} time(s).</p>
        )}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-950">{certificate.eventTitle}</h1>
            <p className="text-sm text-slate-500">Issued to {certificate.attendeeName} by {certificate.communityName}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${revoked ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{certificate.status} · {certificate.serial}</span>
        </div>

        {showCanvas ? (
          <>
            <div className={`mt-6 overflow-hidden rounded-2xl border border-slate-200 ${revoked ? 'opacity-60 grayscale' : ''}`}>
              <canvas ref={canvasRef} className="block w-full" />
            </div>
            <button
              onClick={handleDownload}
              disabled={!ready}
              className="mt-4 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Download PNG
            </button>
          </>
        ) : (
          <p className="mt-6 text-sm text-slate-500">No template image is attached to this certificate.</p>
        )}

        <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
          <div><dt className="text-slate-500">Certificate ID</dt><dd className="font-medium text-slate-900">{certificate.serial}</dd></div>
          <div><dt className="text-slate-500">Type</dt><dd className="font-medium text-slate-900">{certificate.type}</dd></div>
          {certificate.university ? <div><dt className="text-slate-500">University</dt><dd className="font-medium text-slate-900">{certificate.university}</dd></div> : null}
          {certificate.attendanceMinutes ? <div><dt className="text-slate-500">Attendance Duration</dt><dd className="font-medium text-slate-900">{formatDuration(certificate.attendanceMinutes)}</dd></div> : null}
          {certificate.eventDate ? <div><dt className="text-slate-500">Event Date</dt><dd className="font-medium text-slate-900">{formatDate(certificate.eventDate)}</dd></div> : null}
          <div><dt className="text-slate-500">Issue Date</dt><dd className="font-medium text-slate-900">{formatDate(certificate.issueDate)}</dd></div>
        </dl>
      </div>
    </main>
  );
}
