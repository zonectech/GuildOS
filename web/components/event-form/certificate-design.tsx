'use client';
import { useEffect, useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Upload } from 'lucide-react';
import { imageUrl } from '@/lib/api';
import { uploadEventFile } from '@/lib/account';
import { CERT_BACKGROUNDS, drawStandardCertificate } from '@/lib/certificate/canvas';
import { drawCustomCertificate, ensureNameFont, loadArtwork } from '@/lib/certificate/custom';
import {
  CERTIFICATE_TYPES, DEFAULT_CERTIFICATE_CONTENT, DEFAULT_CERTIFICATE_THEME, DEFAULT_NAME_PLACEMENT,
  type CertificateContent, type CertificateNamePlacement, type TicketQrBox,
} from '@/lib/certificate/types';

export type CertificateDesign = {
  certificateType: string; certificateMode: 'STANDARD' | 'CUSTOM'; certificateStyle: string; certificateTemplate: string;
  certificateContent: CertificateContent; certificateNamePlacement: CertificateNamePlacement; certificateQrBox: TicketQrBox | null;
};
const label = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

/**
 * The organizer's own artwork with the name and QR added on top, or our one standard
 * design with the community's logo and a signature. The preview uses the real renderer. The preview uses the real renderer.
 */
export function CertificateDesignFields({ value, onChange, eventTitle, communityName, onError }: {
  value: CertificateDesign; onChange: (patch: Partial<CertificateDesign>) => void; eventTitle: string; communityName: string; onError: (m: string) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const qr = useRef<HTMLDivElement>(null);
  const [uploading, setUploading] = useState('');
  const content = value.certificateContent ?? DEFAULT_CERTIFICATE_CONTENT;
  const sig = content.signatories?.[0] ?? { name: '', title: '', image: '' };
  const place = value.certificateNamePlacement ?? DEFAULT_NAME_PLACEMENT;

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const qrCanvas = qr.current?.querySelector('canvas') ?? null;
    if (value.certificateMode === 'CUSTOM') {
      if (!value.certificateTemplate) { el.width = 0; return; }
      loadArtwork(imageUrl(value.certificateTemplate))
        .then((img) => ensureNameFont(place.font).then(() => drawCustomCertificate(el, { image: img, attendeeName: 'Amina Bello', placement: place, qrBox: value.certificateQrBox, qrCanvas, serial: 'GLD-2026-PREVIEW' })))
        .catch((e: Error) => onError(e.message));
      return;
    }
    void drawStandardCertificate(el, {
      attendeeName: 'Amina Bello', eventTitle: eventTitle || 'Your event', communityName: communityName || 'Your community', type: value.certificateType,
      theme: DEFAULT_CERTIFICATE_THEME, style: value.certificateStyle, content, serial: 'GLD-2026-PREVIEW', verificationUrl: 'https://example.com', qrCanvas, issueDate: new Date().toISOString(),
    });
  }, [value, eventTitle, communityName, content, place]);

  async function upload(field: 'certificateTemplate' | 'signature' | 'certificateLogo', file?: File) {
    if (!file) return;
    setUploading(field);
    try {
      const path = (await uploadEventFile(field, file))[field];
      if (field === 'certificateTemplate') onChange({ certificateTemplate: path });
      if (field === 'certificateLogo') onChange({ certificateContent: { ...content, logo: path } });
      if (field === 'signature') onChange({ certificateContent: { ...content, signatories: [{ ...sig, image: path }] } });
    } catch (e) { onError(e instanceof Error ? e.message : 'Upload failed'); }
    finally { setUploading(''); }
  }

  return (
    <>
      <div ref={qr} hidden><QRCodeCanvas value="https://example.com/certificates/preview" size={220} marginSize={4} /></div>
      <label className="field"><span>Certificate type</span><select className="input" value={value.certificateType} onChange={(e) => onChange({ certificateType: e.target.value })}>{CERTIFICATE_TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}</select></label>
      <div className="two">
        {(['CUSTOM', 'STANDARD'] as const).map((m) => (
          <label key={m} className={`rad${value.certificateMode === m ? ' on' : ''}`}><input type="radio" name="certmode" checked={value.certificateMode === m} onChange={() => onChange({ certificateMode: m })} /><span className="stack" style={{ gap: 2 }}><b>{m === 'STANDARD' ? 'Standard design' : 'Your own design'}</b><span className="small">{m === 'STANDARD' ? 'Ours, with your logo and signature' : 'Upload it; we add each name and the QR code'}</span></span></label>
        ))}
      </div>
      {/* Nothing to preview until the artwork is uploaded. */}
      <canvas ref={canvas} className="certcanvas" aria-label="Certificate preview" hidden={value.certificateMode === 'CUSTOM' && !value.certificateTemplate} />
      {value.certificateMode === 'STANDARD' ? <>
        <label className="field"><span>Community logo</span><span className="drop"><Upload size={18} />{uploading === 'certificateLogo' ? 'Uploading…' : content.logo ? 'Change logo' : 'Upload logo'}<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => void upload('certificateLogo', e.target.files?.[0])} /></span></label>
        {content.logo ? <label className="field"><span>Logo position</span><select className="input" value={content.logoAlign ?? 'CENTER'} onChange={(e) => onChange({ certificateContent: { ...content, logoAlign: e.target.value as 'LEFT' | 'CENTER' | 'RIGHT' } })}><option value="LEFT">Left</option><option value="CENTER">Centre</option><option value="RIGHT">Right</option></select></label> : null}
        <span className="field"><span>Signature</span></span>
        <div className="two">
          <input className="input" aria-label="Signer name" placeholder="Name" value={sig.name} onChange={(e) => onChange({ certificateContent: { ...content, signatories: [{ ...sig, name: e.target.value }] } })} />
          <input className="input" aria-label="Signer title" placeholder="Title, for example President" value={sig.title} onChange={(e) => onChange({ certificateContent: { ...content, signatories: [{ ...sig, title: e.target.value }] } })} />
        </div>
        <span className="drop"><Upload size={18} />{uploading === 'signature' ? 'Uploading…' : sig.image ? 'Change signature image' : 'Upload signature image'}<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => void upload('signature', e.target.files?.[0])} /></span>
      </> : <>
        <span className="drop"><Upload size={18} />{uploading === 'certificateTemplate' ? 'Uploading…' : value.certificateTemplate ? 'Change artwork' : 'Upload certificate artwork (PNG or JPG)'}<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => void upload('certificateTemplate', e.target.files?.[0])} /></span>
        {value.certificateTemplate ? <>
          <span className="field"><span>Where the name goes</span></span>
          <div className="two">
            <label className="field"><span>Across ({place.x}%)</span><input type="range" min={5} max={95} value={place.x} onChange={(e) => onChange({ certificateNamePlacement: { ...place, x: Number(e.target.value) } })} /></label>
            <label className="field"><span>Down ({place.y}%)</span><input type="range" min={5} max={95} value={place.y} onChange={(e) => onChange({ certificateNamePlacement: { ...place, y: Number(e.target.value) } })} /></label>
          </div>
          <div className="two">
            <label className="field"><span>Size ({place.fontSize})</span><input type="range" min={2} max={14} step={0.5} value={place.fontSize} onChange={(e) => onChange({ certificateNamePlacement: { ...place, fontSize: Number(e.target.value) } })} /></label>
            <label className="field"><span>Colour</span><input className="input" type="color" value={place.color} onChange={(e) => onChange({ certificateNamePlacement: { ...place, color: e.target.value } })} /></label>
          </div>
          <label className="tog"><span>Add the verification QR code</span><input type="checkbox" checked={Boolean(value.certificateQrBox)} onChange={(e) => onChange({ certificateQrBox: e.target.checked ? { x: 82, y: 78, size: 14 } : null })} /></label>
        </> : null}
      </>}
    </>
  );
}

export { CERT_BACKGROUNDS };
