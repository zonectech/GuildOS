/**
 * A small confetti burst in brand colours, drawn on a throwaway canvas. Loaded with import() only when a
 * celebration plays, and skipped entirely when the viewer prefers reduced motion.
 */
const COLORS = ['#0A7A50', '#2FBF7F', '#FFC233', '#F2603A', '#FAFAF7'];

export function burst({ x = 0.5, y = 0.35, count = 120 }: { x?: number; y?: number; count?: number } = {}) {
  if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const canvas = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
  Object.assign(canvas.style, { position: 'fixed', inset: '0', width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: '120' });
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) { canvas.remove(); return; }
  ctx.scale(dpr, dpr);
  const ox = innerWidth * x; const oy = innerHeight * y;
  const bits = Array.from({ length: count }, () => {
    const a = Math.random() * Math.PI * 2; const v = 4 + Math.random() * 9;
    return { x: ox, y: oy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 6, w: 6 + Math.random() * 6, h: 3 + Math.random() * 5, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3, c: COLORS[Math.floor(Math.random() * COLORS.length)], life: 0 };
  });
  const start = performance.now();
  const frame = (t: number) => {
    const elapsed = t - start;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const b of bits) {
      b.vy += 0.28; b.vx *= 0.99; b.x += b.vx; b.y += b.vy; b.r += b.vr;
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - elapsed / 2200); ctx.translate(b.x, b.y); ctx.rotate(b.r); ctx.fillStyle = b.c; ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h); ctx.restore();
    }
    if (elapsed < 2200) requestAnimationFrame(frame); else canvas.remove();
  };
  requestAnimationFrame(frame);
}
