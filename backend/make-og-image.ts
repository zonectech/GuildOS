// One-off: generates the 1200x630 Open Graph banner for the landing page.
// Run from backend/: npx tsx make-og-image.ts
// Output: ../frontend/public/og.png
import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync } from 'fs';
import { join } from 'path';

const W = 1200;
const H = 630;
const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');

// Background: deep indigo -> purple gradient
const bg = ctx.createLinearGradient(0, 0, W, H);
bg.addColorStop(0, '#312e81');
bg.addColorStop(0.55, '#4f46e5');
bg.addColorStop(1, '#7c3aed');
ctx.fillStyle = bg;
ctx.fillRect(0, 0, W, H);

// Subtle grid
ctx.strokeStyle = 'rgba(255,255,255,0.06)';
ctx.lineWidth = 1;
for (let x = 0; x <= W; x += 40) {
  ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
}
for (let y = 0; y <= H; y += 40) {
  ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
}

// Soft glow orbs
function orb(x: number, y: number, r: number, alpha: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(255,255,255,${alpha})`);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}
orb(1080, 90, 260, 0.14);
orb(120, 560, 300, 0.10);

function roundRect(x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const LEFT = 84;

// Logo tile + wordmark
roundRect(LEFT, 72, 64, 64, 16);
ctx.fillStyle = '#ffffff';
ctx.fill();
ctx.fillStyle = '#4f46e5';
ctx.font = '800 40px Arial';
ctx.textBaseline = 'middle';
ctx.fillText('G', LEFT + 19, 72 + 35);

ctx.fillStyle = '#ffffff';
ctx.font = '800 42px Arial';
ctx.fillText('GuildOS', LEFT + 82, 72 + 34);

// Headline
ctx.font = '800 76px Arial';
ctx.fillStyle = '#ffffff';
ctx.fillText('The Operating System for', LEFT, 268);
ctx.fillText('Student Communities', LEFT, 356);

// Subline
ctx.font = '400 30px Arial';
ctx.fillStyle = 'rgba(255,255,255,0.85)';
ctx.fillText('Run events, sell tickets, issue verified certificates,', LEFT, 436);
ctx.fillText('and build a living CV from campus life.', LEFT, 478);

// Feature chips
const chips = ['Events', 'Ticketing', 'Certificates', 'Sponsorships', 'Living CV'];
let cx = LEFT;
const cy = 532;
ctx.font = '700 22px Arial';
for (const chip of chips) {
  const tw = ctx.measureText(chip).width;
  const cw = tw + 40;
  roundRect(cx, cy, cw, 44, 22);
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.fillText(chip, cx + 20, cy + 23);
  cx += cw + 14;
}

const out = join(__dirname, '..', 'frontend', 'public', 'og.png');
writeFileSync(out, canvas.toBuffer('image/png'));
console.log('Wrote', out);
