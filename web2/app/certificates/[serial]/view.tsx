'use client';
import { useEffect, useState } from 'react';
import * as m from 'motion/react-m';
import { BadgeCheck, CircleAlert, Download, Share2 } from 'lucide-react';
import { api, API_BASE_URL, enc } from '@/lib/api/client';
import { spring } from '@/lib/motion';
import { Stamp } from '@/components/brand/stamp';
import { Btn } from '@/components/ui/bits';
import { useToast } from '@/components/ui/toast';
import { fmtDate } from '@/lib/format';

type Cert = { verified: boolean; status: string; serial: string; attendeeName: string; eventTitle: string; communityName: string; university: string; type: string; issuedAt?: string };

/** Anyone can check a certificate here: who it was issued to, for which event, and whether it is still valid. */
export function CertificateView({ serial }: { serial: string }) {
  const toast = useToast();
  const [c, setC] = useState<Cert | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { api<{ certificate: Cert }>(`/api/certificates/verify/${enc(serial)}`).then((r) => setC(r.certificate)).catch((e: Error) => setError(e.message)); }, [serial]);
  const share = async () => { const url = window.location.href; try { if (navigator.share) await navigator.share({ url, title: c?.eventTitle }); else { await navigator.clipboard.writeText(url); toast('Link copied'); } } catch { /* dismissed */ } };

  if (error) return <div className="flex flex-col items-center gap-3 px-6 py-24 text-center"><CircleAlert size={36} className="text-coral-text" /><h1 className="text-[26px] font-extrabold">No certificate with this number</h1><p className="text-muted">Check the serial: {serial}</p></div>;
  if (!c) return <div className="mx-auto max-w-xl px-4 pt-12"><div className="shimmer h-[420px] rounded-[28px]" /></div>;
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-6 px-4 pt-10 pb-20 text-center">
      <m.span initial={{ scale: 1.8, rotate: -30, opacity: 0 }} animate={{ scale: 1, rotate: -8, opacity: 1 }} transition={spring.bouncy}>
        <Stamp label={c.communityName} ink={c.verified ? 'green' : 'ink'} state={c.verified ? 'stamped' : 'locked'} size={150} center={<text x="100" y="116" textAnchor="middle" fontSize="34" fontWeight="800">{c.verified ? 'VALID' : c.status}</text>} />
      </m.span>
      <div className="flex flex-col gap-2">
        <span className={`mx-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-bold ${c.verified ? 'bg-tint text-green-text' : 'bg-mist text-muted'}`}>{c.verified ? <><BadgeCheck size={15} />Verified certificate</> : <>Not valid: {c.status.toLowerCase()}</>}</span>
        <h1 className="text-[30px] font-extrabold">{c.attendeeName}</h1>
        <p className="text-[16px]">{c.type === 'ATTENDANCE' ? 'Participation' : c.type.charAt(0) + c.type.slice(1).toLowerCase()} in <b>{c.eventTitle}</b></p>
        <p className="text-[14.5px] text-muted">Issued by {c.communityName}{c.university ? ` · ${c.university}` : ''}{c.issuedAt ? ` · ${fmtDate(c.issuedAt, null, { year: true })}` : ''}</p>
        <p className="font-mono text-[13px] text-muted">{c.serial}</p>
      </div>
      <p className="max-w-md text-[13.5px] text-muted">Issued only to attendees who were scanned in and out and whose attendance the organizers finalized.</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Btn kind="secondary" href={`${API_BASE_URL}/api/certificates/${enc(c.serial)}/pdf`}><Download size={16} />Download PDF</Btn>
        <Btn kind="secondary" onClick={() => void share()}><Share2 size={16} />Share</Btn>
      </div>
    </div>
  );
}
