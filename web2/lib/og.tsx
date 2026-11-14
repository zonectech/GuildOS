// The link-preview card (WhatsApp, X, LinkedIn…) for events, communities, profiles and certificates.
// Server-only: used by the opengraph-image routes. 1200 × 630, brand colours, no outside images (fast,
// and nothing fails if an upload is missing).
import { ImageResponse } from 'next/og';
import { BRAND } from '@/lib/brand';

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_TYPE = 'image/png';

const INK = '#111714', PAPER = '#FAFAF7', GREEN = '#0A7A50', GOLD = '#FFC233', MUTED = '#5B6660';

/** A card: small label on top, a big title, a line or two under it, and a round stamp with a word in it. */
export function shareCard({ kicker, title, lines = [], stamp = 'ATTEND', accent = GREEN }: { kicker: string; title: string; lines?: string[]; stamp?: string; accent?: string }) {
  const t = title.length > 90 ? `${title.slice(0, 87)}…` : title;
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: PAPER, padding: 64, position: 'relative' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 18, background: accent, display: 'flex' }} />
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1, paddingLeft: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 820 }}>
            <div style={{ display: 'flex', fontSize: 30, fontWeight: 700, color: accent, letterSpacing: 2, textTransform: 'uppercase' }}>{kicker}</div>
            <div style={{ display: 'flex', fontSize: t.length > 50 ? 64 : 80, fontWeight: 800, color: INK, lineHeight: 1.05, letterSpacing: -2 }}>{t}</div>
            {lines.filter(Boolean).slice(0, 2).map((l) => (
              <div key={l} style={{ display: 'flex', fontSize: 34, color: MUTED }}>{l.length > 70 ? `${l.slice(0, 67)}…` : l}</div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 34, fontWeight: 800, color: INK }}>
            <div style={{ display: 'flex', width: 20, height: 20, borderRadius: 10, background: GOLD }} />
            {BRAND}
            <div style={{ display: 'flex', fontSize: 26, fontWeight: 400, color: MUTED }}>· every event you attend counts</div>
          </div>
        </div>
        <div style={{ position: 'absolute', right: 72, top: 150, width: 230, height: 230, borderRadius: 115, border: `10px solid ${accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'rotate(-10deg)' }}>
          <div style={{ display: 'flex', fontSize: stamp.length > 7 ? 30 : 38, fontWeight: 800, color: accent, letterSpacing: 2 }}>{stamp}</div>
        </div>
      </div>
    ),
    { ...OG_SIZE },
  );
}

/** The plain brand card, for the home page and when a page's data can't be loaded. */
export const brandCard = () => shareCard({ kicker: 'Campus events', title: 'Find events, get scanned in, collect a stamp for every one you attend.', stamp: 'ATTEND' });
