// One-off: renders the GuildOS "G" app icon to PNGs for the PWA manifest.
// Run from backend/: npx tsx scripts/make-pwa-icons.ts
import { createCanvas } from '@napi-rs/canvas';
import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = path.resolve(__dirname, '..', '..', 'frontend', 'public');

function drawIcon(size: number, opts: { rounded: boolean }) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, '#4f46e5');
  grad.addColorStop(1, '#7c3aed');
  ctx.fillStyle = grad;
  if (opts.rounded) {
    const r = size * 0.25;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.arcTo(size, 0, size, size, r);
    ctx.arcTo(size, size, 0, size, r);
    ctx.arcTo(0, size, 0, 0, r);
    ctx.arcTo(0, 0, size, 0, r);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillRect(0, 0, size, size);
  }
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Maskable icons get cropped to ~80% safe zone — keep the glyph a bit smaller there.
  const fontSize = Math.round(size * (opts.rounded ? 0.6 : 0.5));
  ctx.font = `800 ${fontSize}px Arial, Helvetica, sans-serif`;
  ctx.fillText('G', size / 2, size / 2 + size * 0.02);
  return canvas.toBuffer('image/png');
}

const files: Array<[string, number, { rounded: boolean }]> = [
  ['icon-192.png', 192, { rounded: true }],
  ['icon-512.png', 512, { rounded: true }],
  ['icon-maskable-192.png', 192, { rounded: false }],
  ['icon-maskable-512.png', 512, { rounded: false }],
];

for (const [name, size, opts] of files) {
  const buf = drawIcon(size, opts);
  fs.writeFileSync(path.join(OUT_DIR, name), buf);
  console.log(`wrote ${name} (${buf.length} bytes)`);
}
