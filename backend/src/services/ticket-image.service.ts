import { createCanvas, loadImage, type SKRSContext2D } from '@napi-rs/canvas';
import path from 'node:path';
import QRCode from 'qrcode';
import { config } from '../config';
import { localUploadsDir } from './storage.service';

/**
 * Server-side ticket PNG — attached to the purchase-receipt email so the buyer
 * has their ticket in their inbox (Selar-style delivery). Mirrors the frontend
 * ticket-canvas design: GuildOS standard landscape ticket, or the organizer's
 * uploaded artwork with the personal QR composited onto it.
 *
 * The QR encodes the registration's qrToken — identical to the on-page pass,
 * so the emailed ticket scans at the door exactly the same way.
 */

export type TicketRenderInput = {
  eventTitle: string;
  communityName: string;
  attendeeName: string;
  dateLabel: string;
  venueLabel: string;
  priceLabel: string;
  qrToken: string;
  /** Raw /uploads path of custom artwork; '' = standard design. */
  templateImage?: string;
  qrPlacement?: 'BOTTOM_RIGHT' | 'BOTTOM_LEFT' | 'TOP_RIGHT' | 'TOP_LEFT' | 'CENTER';
};

function roundRect(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrap(ctx: SKRSContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    } else {
      line = candidate;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  return lines;
}

async function qrImage(token: string) {
  const buffer = await QRCode.toBuffer(token, { width: 512, margin: 2 });
  return loadImage(buffer);
}

/** Resolve a stored /uploads/<key> path to something loadImage can open (local file or public URL). */
function resolveTemplateSource(templateImage: string): string {
  const key = templateImage.replace(/^\/uploads\//, '');
  const publicBase = config.r2?.publicBaseUrl;
  if (publicBase) return `${publicBase}/${key}`;
  return path.join(localUploadsDir, key);
}

export async function renderTicketPng(input: TicketRenderInput): Promise<Buffer> {
  if (input.templateImage) {
    try {
      return await renderCustomTicket(input);
    } catch {
      /* template unreadable — fall back to the standard design */
    }
  }
  return renderStandardTicket(input);
}

async function renderStandardTicket(input: TicketRenderInput): Promise<Buffer> {
  const W = 1500;
  const H = 560;
  const STUB_X = 1080;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#101828');
  bg.addColorStop(1, '#1e2a4a');
  ctx.fillStyle = bg;
  roundRect(ctx, 0, 0, W, H, 28);
  ctx.fill();

  ctx.save();
  roundRect(ctx, 0, 0, STUB_X, H, 28);
  ctx.clip();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = '#8ea4ff';
  for (const [cx, cy, r] of [[180, -40, 190], [920, 560, 240], [640, 90, 70]] as const) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.fillStyle = '#6366f1';
  roundRect(ctx, 0, 0, 14, H, 7);
  ctx.fill();

  ctx.save();
  roundRect(ctx, 0, 0, W, H, 28);
  ctx.clip();
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(STUB_X, 0, W - STUB_X, H);
  ctx.restore();

  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 3;
  ctx.setLineDash([4, 14]);
  ctx.beginPath();
  ctx.moveTo(STUB_X, 26);
  ctx.lineTo(STUB_X, H - 26);
  ctx.stroke();
  ctx.setLineDash([]);

  const left = 64;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#a5b4fc';
  ctx.font = '600 26px sans-serif';
  ctx.fillText(input.communityName.toUpperCase(), left, 88);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 62px serif';
  let y = 178;
  for (const line of wrap(ctx, input.eventTitle, STUB_X - left - 60, 2)) {
    ctx.fillText(line, left, y);
    y += 72;
  }

  ctx.font = '30px sans-serif';
  ctx.fillStyle = '#cbd5e1';
  y += 14;
  if (input.dateLabel) {
    ctx.fillText(input.dateLabel, left, y);
    y += 46;
  }
  if (input.venueLabel) {
    ctx.fillText(wrap(ctx, input.venueLabel, STUB_X - left - 60, 1)[0] ?? '', left, y);
  }

  const footerY = H - 64;
  if (input.priceLabel) {
    ctx.font = 'bold 28px sans-serif';
    const chipW = ctx.measureText(input.priceLabel).width + 48;
    ctx.fillStyle = '#6366f1';
    roundRect(ctx, left, footerY - 34, chipW, 52, 26);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(input.priceLabel, left + 24, footerY + 2);
  }
  ctx.textAlign = 'right';
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('GUILDOS · VERIFIED TICKET', STUB_X - 40, footerY + 2);

  const stubCenter = STUB_X + (W - STUB_X) / 2;
  const qrSize = 250;
  const qr = await qrImage(input.qrToken);
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, stubCenter - qrSize / 2 - 14, 48, qrSize + 28, qrSize + 28, 18);
  ctx.fill();
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  roundRect(ctx, stubCenter - qrSize / 2 - 14, 48, qrSize + 28, qrSize + 28, 18);
  ctx.stroke();
  ctx.drawImage(qr, stubCenter - qrSize / 2, 62, qrSize, qrSize);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText(wrap(ctx, input.attendeeName, W - STUB_X - 60, 1)[0] ?? '', stubCenter, 380);
  ctx.fillStyle = '#64748b';
  ctx.font = '22px sans-serif';
  ctx.fillText('Scan at the door to check in', stubCenter, 418);

  return canvas.toBuffer('image/png');
}

async function renderCustomTicket(input: TicketRenderInput): Promise<Buffer> {
  const template = await loadImage(resolveTemplateSource(input.templateImage ?? ''));
  const MAX_W = 1800;
  const scale = template.width > MAX_W ? MAX_W / template.width : 1;
  const W = Math.round(template.width * scale);
  const H = Math.round(template.height * scale);
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(template, 0, 0, W, H);

  const qrSize = Math.round(Math.min(W, H) * 0.24);
  const pad = Math.round(Math.min(W, H) * 0.045);
  const cardPad = Math.round(qrSize * 0.08);
  const labelH = Math.round(qrSize * 0.22);
  const cardW = qrSize + cardPad * 2;
  const cardH = qrSize + cardPad * 2 + labelH;

  let x: number;
  let y: number;
  switch (input.qrPlacement ?? 'BOTTOM_RIGHT') {
    case 'TOP_LEFT': x = pad; y = pad; break;
    case 'TOP_RIGHT': x = W - pad - cardW; y = pad; break;
    case 'BOTTOM_LEFT': x = pad; y = H - pad - cardH; break;
    case 'CENTER': x = (W - cardW) / 2; y = (H - cardH) / 2; break;
    default: x = W - pad - cardW; y = H - pad - cardH; break;
  }

  ctx.fillStyle = '#ffffff';
  roundRect(ctx, x, y, cardW, cardH, Math.round(cardPad * 1.2));
  ctx.fill();

  const qr = await qrImage(input.qrToken);
  ctx.drawImage(qr, x + cardPad, y + cardPad, qrSize, qrSize);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#0f172a';
  ctx.font = `bold ${Math.max(14, Math.round(labelH * 0.42))}px sans-serif`;
  ctx.fillText(wrap(ctx, input.attendeeName, cardW - cardPad * 2, 1)[0] ?? '', x + cardW / 2, y + cardPad + qrSize + Math.round(labelH * 0.6));

  return canvas.toBuffer('image/png');
}
