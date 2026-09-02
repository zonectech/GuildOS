import { createCanvas, loadImage } from '@napi-rs/canvas';
import crypto from 'node:crypto';
import path from 'node:path';
import { config } from '../config';
import { localUploadsDir, putUpload } from './storage.service';

/**
 * Sponsor thank-you graphic for the SOCIAL_ANNOUNCEMENT perk — a wide 1600x800
 * social card (logo composed into it) instead of posting a raw square logo,
 * which looks oversized in the feed. Best-effort: callers fall back to a
 * text-only post if generation fails. Plain ASCII text only (custom glyphs
 * render as tofu in the server sans font).
 */
export async function createSponsorThanksImage(input: {
  sponsorName: string;
  eventTitle: string;
  packageWon?: string;
  /** Sponsor logo as a raw /uploads path; '' = monogram fallback. */
  logo?: string;
}): Promise<string> {
  const W = 1600;
  const H = 800;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Backdrop.
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#111c33');
  bg.addColorStop(1, '#1c1240');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Soft radial glows.
  const glow = (cx: number, cy: number, r: number, color: string) => {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  };
  glow(200, 120, 380, 'rgba(99,102,241,0.30)');
  glow(1450, 700, 380, 'rgba(16,185,129,0.18)');

  // Accent top bar.
  const bar = ctx.createLinearGradient(0, 0, W, 0);
  bar.addColorStop(0, '#6366f1');
  bar.addColorStop(1, '#10b981');
  ctx.fillStyle = bar;
  ctx.fillRect(0, 0, W, 8);

  ctx.textAlign = 'center';

  // "THANK YOU" headline.
  ctx.fillStyle = 'rgba(165,180,252,0.9)';
  ctx.font = '700 30px sans-serif';
  ctx.fillText('A  B I G', W / 2, 110);
  ctx.fillStyle = '#f8fafc';
  ctx.font = '800 96px sans-serif';
  ctx.fillText('THANK YOU', W / 2, 205);

  // Logo card (white rounded) with the sponsor logo or a monogram fallback.
  const cardW = 240;
  const cardH = 240;
  const cx = W / 2 - cardW / 2;
  const cy = 260;
  const r = 40;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx + r, cy);
  ctx.arcTo(cx + cardW, cy, cx + cardW, cy + cardH, r);
  ctx.arcTo(cx + cardW, cy + cardH, cx, cy + cardH, r);
  ctx.arcTo(cx, cy + cardH, cx, cy, r);
  ctx.arcTo(cx, cy, cx + cardW, cy, r);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 30;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.clip();

  let drewLogo = false;
  if (input.logo) {
    try {
      const key = input.logo.replace(/^\/uploads\//, '');
      const src = config.r2?.publicBaseUrl ? `${config.r2.publicBaseUrl}/${key}` : path.join(localUploadsDir, key);
      const img = await loadImage(src);
      // Contain-fit inside the card with padding.
      const pad = 28;
      const scale = Math.min((cardW - pad * 2) / img.width, (cardH - pad * 2) / img.height);
      const dw = img.width * scale;
      const dh = img.height * scale;
      ctx.drawImage(img, cx + (cardW - dw) / 2, cy + (cardH - dh) / 2, dw, dh);
      drewLogo = true;
    } catch {
      /* monogram fallback below */
    }
  }
  if (!drewLogo) {
    ctx.fillStyle = '#4338ca';
    ctx.font = '800 110px sans-serif';
    ctx.fillText(input.sponsorName.trim().slice(0, 1).toUpperCase(), W / 2, cy + cardH / 2 + 38);
  }
  ctx.restore();

  // Sponsor name.
  ctx.fillStyle = '#f8fafc';
  ctx.font = '700 54px sans-serif';
  ctx.fillText(input.sponsorName.slice(0, 40), W / 2, 590);

  // "for sponsoring {event}" line (wraps to 2 lines max).
  ctx.fillStyle = '#94a3b8';
  ctx.font = '400 34px sans-serif';
  const line = `for sponsoring ${input.eventTitle}${input.packageWon ? ` as our ${input.packageWon}` : ''}`;
  if (ctx.measureText(line).width <= W - 200) {
    ctx.fillText(line, W / 2, 650);
  } else {
    const words = line.split(' ');
    let first = '';
    while (words.length && ctx.measureText(`${first} ${words[0]}`).width < W - 240) first = `${first} ${words.shift()}`.trim();
    ctx.fillText(first, W / 2, 645);
    ctx.fillText(words.join(' ').slice(0, 70), W / 2, 692);
  }

  // Footer mark.
  ctx.fillStyle = 'rgba(148,163,184,0.6)';
  ctx.font = '600 22px sans-serif';
  ctx.fillText('GUILDOS  -  VERIFIED SPONSORSHIP', W / 2, 762);

  const key = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-sponsor-thanks.png`;
  await putUpload(key, canvas.toBuffer('image/png'), 'image/png');
  return `/uploads/${key}`;
}
