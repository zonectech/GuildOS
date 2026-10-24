/**
 * Flat illustrated people (inline SVG): warm and human without pretending to be real users.
 * Deliberately simple shapes so they stay crisp at 24px and at 96px.
 */

type Hair = 'short' | 'afro' | 'braids' | 'wrap' | 'bun' | 'fade';

export type PersonLook = {
  skin: string;
  hair: Hair;
  hairColor: string;
  top: string;
  bg: string;
};

/** A varied cast: skin tones, hairstyles (including headwrap/hijab) and colours. */
export const CAST: PersonLook[] = [
  { skin: '#8d5524', hair: 'afro', hairColor: '#1f1410', top: '#6366f1', bg: '#e0e7ff' },
  { skin: '#c68642', hair: 'wrap', hairColor: '#0f766e', top: '#f59e0b', bg: '#fef3c7' },
  { skin: '#5c3a21', hair: 'fade', hairColor: '#120c08', top: '#10b981', bg: '#d1fae5' },
  { skin: '#e0ac69', hair: 'bun', hairColor: '#2b1b12', top: '#ec4899', bg: '#fce7f3' },
  { skin: '#a0662f', hair: 'braids', hairColor: '#1a110b', top: '#0ea5e9', bg: '#e0f2fe' },
  { skin: '#f1c27d', hair: 'short', hairColor: '#3b2416', top: '#8b5cf6', bg: '#ede9fe' },
  { skin: '#6b4226', hair: 'short', hairColor: '#0d0906', top: '#ef4444', bg: '#fee2e2' },
  { skin: '#b07142', hair: 'wrap', hairColor: '#7c3aed', top: '#14b8a6', bg: '#ccfbf1' },
];

function HairBack({ look }: { look: PersonLook }) {
  switch (look.hair) {
    case 'afro':
      return <circle cx="32" cy="25" r="17" fill={look.hairColor} />;
    case 'braids':
      return (
        <g fill={look.hairColor}>
          <path d="M17 26c0-9 7-15 15-15s15 6 15 15v14h-5V27H22v13h-5z" />
          <rect x="17" y="36" width="4" height="14" rx="2" />
          <rect x="43" y="36" width="4" height="14" rx="2" />
        </g>
      );
    case 'wrap':
      return <path d="M14 30c0-11 8-19 18-19s18 8 18 19v12c-3-4-6-6-9-7H23c-3 1-6 3-9 7z" fill={look.hairColor} />;
    case 'bun':
      return <circle cx="32" cy="9" r="6" fill={look.hairColor} />;
    default:
      return null;
  }
}

function HairFront({ look }: { look: PersonLook }) {
  switch (look.hair) {
    case 'short':
      return <path d="M20 24c0-7 5-12 12-12s12 5 12 12c-3-3-7-4-12-4s-9 1-12 4z" fill={look.hairColor} />;
    case 'fade':
      return <path d="M21 22c1-6 5-9 11-9s10 3 11 9c-3-2-7-3-11-3s-8 1-11 3z" fill={look.hairColor} />;
    case 'bun':
      return <path d="M20 24c0-7 5-12 12-12s12 5 12 12c-4-2-8-3-12-3s-8 1-12 3z" fill={look.hairColor} />;
    case 'wrap':
      return <path d="M19 22c2-6 7-9 13-9s11 3 13 9c-4-1-8-2-13-2s-9 1-13 2z" fill={look.hairColor} opacity="0.9" />;
    default:
      return null;
  }
}

export function Person({ look, size = 48, className = '' }: { look: PersonLook; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true">
      <circle cx="32" cy="32" r="32" fill={look.bg} />
      <HairBack look={look} />
      {/* shoulders */}
      <path d="M10 64c2-12 11-18 22-18s20 6 22 18z" fill={look.top} />
      <rect x="28" y="38" width="8" height="9" rx="3" fill={look.skin} />
      {/* head */}
      <circle cx="32" cy="27" r="12" fill={look.skin} />
      <HairFront look={look} />
      {/* face */}
      <circle cx="27.5" cy="28" r="1.3" fill="#1f1410" />
      <circle cx="36.5" cy="28" r="1.3" fill="#1f1410" />
      <path d="M28 32.5c2.2 2 5.8 2 8 0" stroke="#1f1410" strokeWidth="1.4" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/** Overlapping row of people — "a crowd you can join". */
export function PeopleCluster({ count = 5, size = 40, offset = 0, className = '' }: { count?: number; size?: number; offset?: number; className?: string }) {
  return (
    <div className={`flex -space-x-3 ${className}`}>
      {Array.from({ length: count }, (_, i) => CAST[(i + offset) % CAST.length]).map((look, i) => (
        <span key={i} className="rounded-full ring-2 ring-white dark:ring-slate-900" style={{ zIndex: count - i }}>
          <Person look={look} size={size} />
        </span>
      ))}
    </div>
  );
}
