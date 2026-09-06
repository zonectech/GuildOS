/**
 * One-off: renders a professional 1600x800 event banner for the live payment test.
 * Plain ASCII text only (em-dash/middot render as tofu in the server sans font).
 * Run: npx tsx make-career-night-banner.ts  → banner-career-night.png
 */
import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';

const W = 1600;
const H = 800;
const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');

// Deep navy gradient backdrop.
const bg = ctx.createLinearGradient(0, 0, W, H);
bg.addColorStop(0, '#0b1220');
bg.addColorStop(0.55, '#111c33');
bg.addColorStop(1, '#1b1035');
ctx.fillStyle = bg;
ctx.fillRect(0, 0, W, H);

// Subtle grid.
ctx.strokeStyle = 'rgba(99,102,241,0.08)';
ctx.lineWidth = 1;
for (let x = 0; x <= W; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
for (let y = 0; y <= H; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

// Glowing accent circles.
function glow(cx: number, cy: number, r: number, color: string) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
}
glow(1350, 150, 420, 'rgba(99,102,241,0.35)');
glow(180, 700, 380, 'rgba(16,185,129,0.22)');
glow(1500, 720, 300, 'rgba(236,72,153,0.18)');

// Robot-arm style abstract nodes (right side).
ctx.strokeStyle = 'rgba(129,140,248,0.7)';
ctx.lineWidth = 4;
const nodes: Array<[number, number]> = [[1180, 620], [1270, 480], [1390, 400], [1460, 260], [1360, 170]];
ctx.beginPath();
nodes.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
ctx.stroke();
for (const [x, y] of nodes) {
  ctx.fillStyle = '#818cf8';
  ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#0b1220';
  ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
}

// Accent top bar.
const bar = ctx.createLinearGradient(0, 0, W, 0);
bar.addColorStop(0, '#6366f1');
bar.addColorStop(1, '#10b981');
ctx.fillStyle = bar;
ctx.fillRect(0, 0, W, 10);

// Host chip.
ctx.fillStyle = 'rgba(99,102,241,0.18)';
const chipY = 96;
ctx.beginPath();
// simple rounded rect
const rx = 90, ry = chipY, rw = 560, rh = 54, rr = 27;
ctx.moveTo(rx + rr, ry);
ctx.arcTo(rx + rw, ry, rx + rw, ry + rh, rr);
ctx.arcTo(rx + rw, ry + rh, rx, ry + rh, rr);
ctx.arcTo(rx, ry + rh, rx, ry, rr);
ctx.arcTo(rx, ry, rx + rw, ry, rr);
ctx.fill();
ctx.fillStyle = '#a5b4fc';
ctx.font = '600 28px sans-serif';
ctx.fillText('ROBOTICS GUILD  x  INDUSTRY PARTNERS', 122, chipY + 37);

// Title.
ctx.fillStyle = '#f8fafc';
ctx.font = '800 104px sans-serif';
ctx.fillText('AI & Robotics', 90, 300);
ctx.fillText('Career Night 2026', 90, 415);

// Subtitle.
ctx.fillStyle = '#94a3b8';
ctx.font = '400 36px sans-serif';
ctx.fillText('Meet engineers and recruiters building the future of automation.', 90, 490);
ctx.fillText('CV clinics, live demos, hiring conversations.', 90, 540);

// Info row.
ctx.fillStyle = '#e2e8f0';
ctx.font = '600 32px sans-serif';
ctx.fillText('Sat, Sep 19, 2026', 90, 640);
ctx.fillText('4:00 PM', 470, 640);
ctx.fillText('Engineering Complex Hall B, ABU Zaria', 680, 640);

// Divider dots.
ctx.fillStyle = '#6366f1';
ctx.beginPath(); ctx.arc(430, 630, 6, 0, Math.PI * 2); ctx.fill();
ctx.beginPath(); ctx.arc(640, 630, 6, 0, Math.PI * 2); ctx.fill();

// Footer strip.
ctx.fillStyle = 'rgba(148,163,184,0.9)';
ctx.font = '500 26px sans-serif';
ctx.fillText('Tickets N100  |  Certificates for attendees  |  Sponsorship slots open', 90, 720);

writeFileSync('banner-career-night.png', canvas.toBuffer('image/png'));
console.log('banner-career-night.png written (1600x800)');
