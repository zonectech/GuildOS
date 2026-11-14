import { useId } from 'react';
import { Stamp, type StampInk } from './stamp';

/**
 * A community's crest: the OnTheRoll stamp with the community's logo in the middle, in its accent ink.
 * Without a logo, its initials sit in the centre instead.
 */
export function Crest({ name, logo, ink = 'green', size = 120, tilt = -8, className = '' }: { name: string; logo?: string; ink?: StampInk; size?: number; tilt?: number; className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const initials = name.replace(/^\[[^\]]*\]\s*/, '').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  const center = logo ? (
    <>
      <defs><clipPath id={`crest${uid}`}><circle cx="100" cy="100" r="44" /></clipPath></defs>
      <image href={logo} x="56" y="56" width="88" height="88" preserveAspectRatio="xMidYMid slice" clipPath={`url(#crest${uid})`} />
    </>
  ) : <text x="100" y="114" textAnchor="middle" fontSize="40" letterSpacing="-.02em">{initials || '★'}</text>;
  return <Stamp label={name.replace(/^\[[^\]]*\]\s*/, '')} ink={ink} size={size} tilt={tilt} center={center} title={`${name} crest`} className={className} />;
}
