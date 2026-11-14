// The 1200×630 preview image shown when a link is shared. Drawn on the server with next/og.
import { ImageResponse } from 'next/og';
import { BRAND_NAME } from './brand';

const INK = '#141A17';
const MUTED = '#5B6560';
const GREEN = '#0A7A50';
const PAPER = '#F6F3EC';
// The site's own font (Figtree, SIL Open Font License), bundled so previews never depend on a font server.
const regular = fetch(new URL('../assets/fonts/figtree-400.woff', import.meta.url)).then((r) => r.arrayBuffer());
const bold = fetch(new URL('../assets/fonts/figtree-800.woff', import.meta.url)).then((r) => r.arrayBuffer());

// The built-in font has no tick character, so it is drawn.
const Tick = ({ size, color }: { size: number; color: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);

const cut = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

export type CardInput = {
  kicker: string;          // small green line above the title, e.g. "WORKSHOP · 12 MAR"
  title: string;
  lines?: string[];        // up to two supporting lines
  tag?: string;            // optional pill at the bottom, e.g. "Instant certificate"
  stamp?: boolean;         // draws the round "verified" mark, for certificates
};

export async function shareCard({ kicker, title, lines = [], tag, stamp }: CardInput) {
  const [r, b] = await Promise.all([regular, bold]);
  const big = title.length > 48 ? 58 : title.length > 28 ? 68 : 80;
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: PAPER, padding: '64px 72px', position: 'relative', fontFamily: 'Figtree' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 18, background: GREEN }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 52, height: 52, borderRadius: 12, background: GREEN, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, fontWeight: 800 }}><Tick size={34} color="#fff" /></div>
          <div style={{ fontSize: 34, fontWeight: 800, color: INK }}>{BRAND_NAME}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: stamp ? 760 : 1040 }}>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: 3, color: GREEN, textTransform: 'uppercase' }}>{cut(kicker, 60)}</div>
          <div style={{ fontSize: big, fontWeight: 800, lineHeight: 1.05, color: INK }}>{cut(title, 90)}</div>
          {lines.slice(0, 2).map((line) => <div key={line} style={{ fontSize: 30, color: MUTED }}>{cut(line, 70)}</div>)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', minHeight: 48 }}>
          {tag ? <div style={{ display: 'flex', fontSize: 26, fontWeight: 800, color: GREEN, border: `3px solid ${GREEN}`, borderRadius: 999, padding: '8px 22px' }}>{tag}</div> : null}
        </div>
        {stamp ? (
          <div style={{ position: 'absolute', right: 80, top: 170, width: 280, height: 280, borderRadius: 999, border: `8px solid ${GREEN}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'rotate(-10deg)' }}>
            <div style={{ width: 236, height: 236, borderRadius: 999, border: `3px solid ${GREEN}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: GREEN }}>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 6 }}>VERIFIED</div>
              <Tick size={84} color={GREEN} />
              <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: 3 }}>{BRAND_NAME.toUpperCase()}</div>
            </div>
          </div>
        ) : null}
      </div>
    ),
    { width: 1200, height: 630, fonts: [{ name: 'Figtree', data: r, weight: 400, style: 'normal' }, { name: 'Figtree', data: b, weight: 800, style: 'normal' }], headers: { 'Cache-Control': 'public, max-age=300, s-maxage=3600' } },
  );
}
