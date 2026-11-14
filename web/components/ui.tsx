import Link from 'next/link';
import { Check, Clock } from 'lucide-react';
import type { CertificateOffer } from '@/lib/api';
import { dateBadge } from '@/lib/events';

type ButtonKind = 'p' | 's' | 'd';
export function Button({ kind = 'p', wide, small, href, children, ...rest }: { kind?: ButtonKind; wide?: boolean; small?: boolean; href?: string; children: React.ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const className = ['btn', kind, wide ? 'w' : '', small ? 'sm' : ''].filter(Boolean).join(' ');
  if (href) return <Link href={href} className={className}>{children}</Link>;
  return <button type="button" className={className} {...rest}>{children}</button>;
}

export function Pill({ on, children, onClick }: { on?: boolean; children: React.ReactNode; onClick?: () => void }) {
  return <button type="button" className="pill" aria-pressed={Boolean(on)} onClick={onClick}>{children}</button>;
}

export function DateBadge({ value, tz }: { value: string | null; tz?: string | null }) {
  const badge = dateBadge(value, tz);
  if (!badge) return null;
  return <span className="date" aria-label={`${badge.day} ${badge.month}`}><i>{badge.month}</i><b>{badge.day}</b></span>;
}

const CERT_TEXT: Record<CertificateOffer, string> = { INSTANT: 'Instant certificate', AFTER_EVENT: 'Certificate after the event', NONE: 'No certificate' };
/** One answer to "will I get a certificate?", from the backend so every page agrees. */
export function CertLabel({ offer = 'NONE', past = false }: { offer?: CertificateOffer; past?: boolean }) {
  // Once the event is over, any certificate has already been given, so it reads in the past.
  const shown = past && offer !== 'NONE' ? 'INSTANT' : offer;
  return (
    <span className={`cert ${shown}`}>
      {shown === 'INSTANT' ? <Check size={14} strokeWidth={3} /> : shown === 'AFTER_EVENT' ? <Clock size={14} /> : null}
      {past ? (offer === 'NONE' ? 'No certificate' : 'Certificate given') : CERT_TEXT[offer]}
    </span>
  );
}

export function Avatar({ name, src, size = 36 }: { name: string; src?: string; size?: number }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?';
  return <span className="av" style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}>{src ? <img src={src} alt="" /> : initials}</span>;
}
