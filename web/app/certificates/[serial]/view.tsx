'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { QRCodeCanvas } from 'qrcode.react';
import { BadgeCheck, Download, Share2, TriangleAlert } from 'lucide-react';
import { imageUrl } from '@/lib/api';
import { certificatePdfUrl, verifyCertificate, type VerifiedCertificate } from '@/lib/account';
import { drawStandardCertificate } from '@/lib/certificate/canvas';
import { drawCustomCertificate, ensureNameFont, loadArtwork } from '@/lib/certificate/custom';

const STATUS_TEXT = { REVOKED: 'This certificate was revoked', EXPIRED: 'This certificate has expired', INVALID: 'This certificate is not valid' };

/** Public verification: anyone with the link sees the real certificate and whether it still stands. */
export default function VerifyCertificatePage() {
  const { serial } = useParams<{ serial: string }>();
  const [cert, setCert] = useState<VerifiedCertificate | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const qr = useRef<HTMLDivElement>(null);

  useEffect(() => { verifyCertificate(serial).then((r) => setCert(r.certificate)).catch((e: Error) => setError(e.message)); }, [serial]);

  // The same renderer as the current site, so the picture matches the printed certificate.
  useEffect(() => {
    if (!cert || !canvas.current) return;
    const el = canvas.current;
    const qrCanvas = qr.current?.querySelector('canvas') ?? null;
    if (cert.mode === 'CUSTOM' && cert.templateImage) {
      loadArtwork(imageUrl(cert.templateImage))
        .then((img) => ensureNameFont(cert.namePlacement?.font).then(() => drawCustomCertificate(el, { image: img, attendeeName: cert.attendeeName, placement: cert.namePlacement, qrBox: cert.qrBox, qrCanvas, serial: cert.serial })))
        .catch((e: Error) => setError(e.message));
      return;
    }
    void drawStandardCertificate(el, {
      attendeeName: cert.attendeeName, eventTitle: cert.eventTitle, communityName: cert.communityName, university: cert.university, type: cert.type,
      theme: cert.theme, style: cert.style, content: cert.content, sponsors: cert.sponsors, coHosts: cert.coHosts, partners: cert.partners,
      serial: cert.serial, verificationUrl: cert.verificationUrl, issueDate: cert.issueDate, eventDate: cert.eventDate,
      attendanceMinutes: cert.attendanceMinutes, daysAttended: cert.daysAttended, totalDays: cert.totalDays, sectionName: cert.sectionName, qrCanvas,
    });
  }, [cert]);

  if (error && !cert) return <div className="wrap page" style={{ maxWidth: 760 }}><p className="error">{error}</p></div>;
  if (!cert) return <div className="wrap page"><p className="empty">Checking certificate…</p></div>;

  const ok = cert.status === 'VERIFIED';
  const issued = new Date(cert.issueDate);
  function downloadPng() {
    try {
      const a = document.createElement('a');
      a.href = canvas.current?.toDataURL('image/png') ?? '';
      a.download = `certificate-${cert?.serial}.png`;
      a.click();
    } catch { setError('Your browser blocked the download. Right-click the certificate to save it.'); }
  }

  return (
    <div className="wrap page" style={{ maxWidth: 900 }}>
      <div className={`vbanner ${ok ? '' : 'bad'}`} role="status">
        {ok ? <BadgeCheck size={24} /> : <TriangleAlert size={24} />}
        <div className="stack" style={{ gap: 0 }}>
          <b>{ok ? 'This certificate is real' : STATUS_TEXT[cert.status as keyof typeof STATUS_TEXT]}</b>
          <span>{ok ? (cert.attendanceEvidence === 'ORGANIZER_IMPORT' ? 'Attendance reported by the organizer' : 'Attendance recorded at the event') : cert.revokeReason || cert.invalidationReason || 'Contact the issuing community for details.'}</span>
        </div>
      </div>
      <div ref={qr} hidden><QRCodeCanvas value={cert.verificationUrl} size={220} marginSize={4} /></div>
      <canvas ref={canvas} className="certcanvas" aria-label={`Certificate for ${cert.attendeeName}, ${cert.eventTitle}`} />
      <div className="stack" style={{ gap: 0 }}>
        {[['Awarded to', cert.attendeeName], ['Event', cert.eventTitle], ['Issued by', cert.communityName], ['Serial', cert.serial], ['Issued', issued.toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })], ...(cert.sectionName ? [['Track', cert.sectionName]] : []), ...(cert.totalDays ? [['Days attended', `${cert.daysAttended} of ${cert.totalDays}`]] : [])].map(([k, v]) => (
          <div key={k} className="kv"><span>{k}</span><b>{v}</b></div>
        ))}
      </div>
      {error ? <p className="error">{error}</p> : null}
      <div className="row">
        <a className="btn p" href={certificatePdfUrl(cert.serial)}><Download size={16} />Download PDF</a>
        <button type="button" className="btn s" onClick={downloadPng}>Download image</button>
        <button type="button" className="btn s" onClick={() => navigator.clipboard.writeText(window.location.href).then(() => setCopied(true)).catch(() => undefined)}><Share2 size={16} />{copied ? 'Link copied' : 'Copy link'}</button>
      </div>
    </div>
  );
}
