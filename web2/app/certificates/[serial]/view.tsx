'use client';
import { useEffect, useState } from 'react';
import * as m from 'motion/react-m';
import { BadgeCheck, CircleAlert, Download, Share2 } from 'lucide-react';
import { api, ApiError, API_BASE_URL, enc } from '@/lib/api/client';
import { spring } from '@/lib/motion';
import { SealText, Stamp } from '@/components/brand/stamp';
import { Btn } from '@/components/ui/bits';
import { useToast } from '@/components/ui/toast';
import { fmtDate } from '@/lib/format';
import type { Cert } from '@/lib/api/public';

/** Anyone can check a certificate here: who it was issued to, for which event, and whether it is still valid. */
export function CertificateView({ serial, initial = null }: { serial: string; initial?: Cert | null }) {
  const toast = useToast();
  const [c, setC] = useState<Cert | null>(initial);
  const [error, setError] = useState<{ missing: boolean } | null>(null);
  const [attempt, setAttempt] = useState(0);
  // The seal only drops in when the certificate was checked here; a server-rendered one is just there.
  const [arrived] = useState(() => !initial);
  useEffect(() => { if (initial && attempt === 0) return; setError(null); api<{ certificate: Cert }>(`/api/certificates/verify/${enc(serial)}`).then((r) => setC(r.certificate)).catch((e: unknown) => setError({ missing: e instanceof ApiError && e.status === 404 })); }, [serial, attempt]); // eslint-disable-line react-hooks/exhaustive-deps -- `initial` only matters on the first load
  const share = async () => { const url = window.location.href; try { if (navigator.share) await navigator.share({ url, title: c?.eventTitle }); else { await navigator.clipboard.writeText(url); toast('Link copied'); } } catch { /* dismissed */ } };

  if (error?.missing) return <div className="flex flex-col items-center gap-3 px-6 py-24 text-center"><CircleAlert size={36} className="text-coral-text" /><h1 className="text-[26px] font-extrabold">No certificate with this number</h1><p className="text-muted">Check the serial: {serial}</p></div>;
  // Anything else (offline, server trouble) says nothing about the certificate itself.
  if (error) return <div role="alert" className="flex flex-col items-center gap-3 px-6 py-24 text-center"><CircleAlert size={36} className="text-muted" /><h1 className="text-[26px] font-extrabold">We couldn&apos;t check this certificate right now</h1><p className="max-w-sm text-muted">This is a connection problem, not a problem with the certificate. Serial: {serial}</p><Btn onClick={() => setAttempt((n) => n + 1)}>Try again</Btn></div>;
  if (!c) return <div className="mx-auto max-w-xl px-4 pt-12"><div className="shimmer h-[420px] rounded-[28px]" /></div>;
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-6 px-4 pt-10 pb-20 text-center">
      <m.span initial={arrived ? { scale: 1.8, rotate: -30, opacity: 0 } : false} animate={{ scale: 1, rotate: -8, opacity: 1 }} transition={spring.bouncy}>
        <Stamp label={c.communityName} ink={c.verified ? 'green' : 'ink'} state={c.verified ? 'stamped' : 'locked'} size={150} center={<SealText>{String(c.verified ? 'VALID' : c.status)}</SealText>} />
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
