/**
 * Ticket card renderer — the visual, downloadable version of an attendee's QR pass.
 *
 * Two modes (mirrors the certificate approach):
 * - STANDARD: GuildOS-designed landscape ticket (1500x560) with a perforated QR stub.
 * - CUSTOM:   the organizer's uploaded artwork at its own aspect ratio with the QR
 *   block composited at `qrPlacement` — so any flyer/design tool output becomes a
 *   scannable ticket without rebuilding it in GuildOS.
 *
 * The QR encodes the registration's qrToken (same token the scanner check-in uses),
 * so a downloaded ticket and the on-page pass are interchangeable at the door.
 */

import { resolveEventImageUrl, type TicketQrPlacement } from './event-api';

export type { TicketQrPlacement };

export type TicketDrawData = {
  eventTitle: string;
  communityName: string;
  attendeeName: string;
  dateLabel: string;
  venueLabel: string;
  /** '' for free events; e.g. "₦1,500" for paid. */
  priceLabel: string;
  /** Payment reference for paid tickets; '' hides the line. */
  reference: string;
  /** Rendered <canvas> holding the QR (e.g. qrcode.react QRCodeCanvas). */
  qrCanvas: HTMLCanvasElement | null;
  /** Raw /uploads path of the organizer's artwork; '' = standard design. */
  templateImage?: string;
  qrPlacement?: TicketQrPlacement;
};

function loadImg(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
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
  if (lines.length === maxLines && ctx.measureText(lines[maxLines - 1]).width > maxWidth) {
    let last = lines[maxLines - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    lines[maxLines - 1] = `${last}…`;
  }
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function drawTicketCard(canvas: HTMLCanvasElement, data: TicketDrawData) {
  if (typeof document !== 'undefined' && 'fonts' in document) {
    try {
      await (document as Document & { fonts: FontFaceSet }).fonts.ready;
    } catch {
      /* fonts are progressive enhancement */
    }
  }
  if (data.templateImage) {
    await drawCustomTicket(canvas, data);
  } else {
    drawStandardTicket(canvas, data);
  }
}

// ── STANDARD: GuildOS landscape ticket with QR stub ───────────────────────────

function drawStandardTicket(canvas: HTMLCanvasElement, data: TicketDrawData) {
  const W = 1500;
  const H = 560;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const STUB_X = 1080; // perforation line

  // Body background
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#101828');
  bg.addColorStop(1, '#1e2a4a');
  ctx.fillStyle = bg;
  roundRect(ctx, 0, 0, W, H, 28);
  ctx.fill();

  // Decorative circles on the body
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

  // Accent bar
  ctx.fillStyle = '#6366f1';
  roundRect(ctx, 0, 0, 14, H, 7);
  ctx.fill();

  // Stub (right side, light)
  ctx.save();
  roundRect(ctx, 0, 0, W, H, 28);
  ctx.clip();
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(STUB_X, 0, W - STUB_X, H);
  ctx.restore();

  // Perforation
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 3;
  ctx.setLineDash([4, 14]);
  ctx.beginPath();
  ctx.moveTo(STUB_X, 26);
  ctx.lineTo(STUB_X, H - 26);
  ctx.stroke();
  ctx.setLineDash([]);

  // Body text
  const left = 64;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#a5b4fc';
  ctx.font = '600 26px Montserrat, Arial, sans-serif';
  ctx.fillText(data.communityName.toUpperCase(), left, 88);

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 62px "Playfair Display", Georgia, serif';
  const titleLines = wrap(ctx, data.eventTitle, STUB_X - left - 60, 2);
  let y = 178;
  for (const line of titleLines) {
    ctx.fillText(line, left, y);
    y += 72;
  }

  ctx.font = '400 30px Montserrat, Arial, sans-serif';
  ctx.fillStyle = '#cbd5e1';
  y += 14;
  if (data.dateLabel) {
    ctx.fillText(data.dateLabel, left, y);
    y += 46;
  }
  if (data.venueLabel) {
    const venueLines = wrap(ctx, data.venueLabel, STUB_X - left - 60, 1);
    ctx.fillText(venueLines[0] ?? '', left, y);
    y += 46;
  }

  // Price chip + wordmark on the body footer
  const footerY = H - 64;
  if (data.priceLabel) {
    ctx.font = '700 28px Montserrat, Arial, sans-serif';
    const chipW = ctx.measureText(data.priceLabel).width + 48;
    ctx.fillStyle = '#6366f1';
    roundRect(ctx, left, footerY - 34, chipW, 52, 26);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(data.priceLabel, left + 24, footerY + 2);
  }
  ctx.textAlign = 'right';
  ctx.fillStyle = '#64748b';
  ctx.font = '700 26px Montserrat, Arial, sans-serif';
  ctx.fillText('GUILDOS · VERIFIED TICKET', STUB_X - 40, footerY + 2);

  // Stub content: QR + name + reference
  const stubCenter = STUB_X + (W - STUB_X) / 2;
  const qrSize = 250;
  if (data.qrCanvas) {
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, stubCenter - qrSize / 2 - 14, 62 - 14, qrSize + 28, qrSize + 28, 18);
    ctx.fill();
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    roundRect(ctx, stubCenter - qrSize / 2 - 14, 62 - 14, qrSize + 28, qrSize + 28, 18);
    ctx.stroke();
    ctx.drawImage(data.qrCanvas, stubCenter - qrSize / 2, 62, qrSize, qrSize);
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = '#0f172a';
  ctx.font = '700 30px Montserrat, Arial, sans-serif';
  const nameLines = wrap(ctx, data.attendeeName, W - STUB_X - 60, 1);
  ctx.fillText(nameLines[0] ?? '', stubCenter, 380);
  ctx.fillStyle = '#64748b';
  ctx.font = '400 22px Montserrat, Arial, sans-serif';
  ctx.fillText('Scan at the door to check in', stubCenter, 418);
  if (data.reference) {
    ctx.font = '400 20px "Courier New", monospace';
    ctx.fillStyle = '#94a3b8';
    const refLines = wrap(ctx, data.reference, W - STUB_X - 50, 1);
    ctx.fillText(refLines[0] ?? '', stubCenter, 486);
  }
}

// ── CUSTOM: organizer artwork + composited QR block ───────────────────────────

async function drawCustomTicket(canvas: HTMLCanvasElement, data: TicketDrawData) {
  const template = await loadImg(resolveEventImageUrl(data.templateImage ?? ''));
  const ctx0 = canvas.getContext('2d');
  if (!ctx0) return;

  if (!template) {
    // Template failed to load (e.g. missing CORS) — fall back to the standard design.
    drawStandardTicket(canvas, data);
    return;
  }

  // Render at the artwork's own aspect ratio, capped for crisp-but-sane files.
  const MAX_W = 1800;
  const scale = template.naturalWidth > MAX_W ? MAX_W / template.naturalWidth : 1;
  const W = Math.round(template.naturalWidth * scale);
  const H = Math.round(template.naturalHeight * scale);
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.drawImage(template, 0, 0, W, H);

  // QR block sized relative to the artwork.
  const qr = Math.round(Math.min(W, H) * 0.24);
  const pad = Math.round(Math.min(W, H) * 0.045);
  const cardPad = Math.round(qr * 0.08);
  const labelH = Math.round(qr * 0.22);
  const cardW = qr + cardPad * 2;
  const cardH = qr + cardPad * 2 + labelH;

  const placement = data.qrPlacement ?? 'BOTTOM_RIGHT';
  let x: number;
  let y: number;
  switch (placement) {
    case 'TOP_LEFT': x = pad; y = pad; break;
    case 'TOP_RIGHT': x = W - pad - cardW; y = pad; break;
    case 'BOTTOM_LEFT': x = pad; y = H - pad - cardH; break;
    case 'CENTER': x = (W - cardW) / 2; y = (H - cardH) / 2; break;
    case 'BOTTOM_RIGHT':
    default: x = W - pad - cardW; y = H - pad - cardH; break;
  }

  // White card so the QR scans on any artwork.
  ctx.save();
  ctx.shadowColor = 'rgba(15, 23, 42, 0.35)';
  ctx.shadowBlur = 18;
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, x, y, cardW, cardH, Math.round(cardPad * 1.2));
  ctx.fill();
  ctx.restore();

  if (data.qrCanvas) {
    ctx.drawImage(data.qrCanvas, x + cardPad, y + cardPad, qr, qr);
  }

  // Attendee name (and reference if it fits) under the QR inside the card.
  ctx.textAlign = 'center';
  ctx.fillStyle = '#0f172a';
  const nameSize = Math.max(14, Math.round(labelH * 0.42));
  ctx.font = `700 ${nameSize}px Montserrat, Arial, sans-serif`;
  const nameLines = wrap(ctx, data.attendeeName, cardW - cardPad * 2, 1);
  ctx.fillText(nameLines[0] ?? '', x + cardW / 2, y + cardPad + qr + Math.round(labelH * 0.5));
  if (data.reference) {
    const refSize = Math.max(10, Math.round(labelH * 0.26));
    ctx.font = `400 ${refSize}px "Courier New", monospace`;
    ctx.fillStyle = '#94a3b8';
    const refLines = wrap(ctx, data.reference, cardW - cardPad * 2, 1);
    ctx.fillText(refLines[0] ?? '', x + cardW / 2, y + cardPad + qr + Math.round(labelH * 0.85));
  }
}
