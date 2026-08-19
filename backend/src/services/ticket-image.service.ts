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
  /** Standard-design look; ignored when templateImage is set. */
  style?: 'MIDNIGHT' | 'DAYLIGHT' | 'BOLD' | 'MINIMAL';
  /** Accent hex for bar/chips/decor on the standard design. */
  accent?: string;
  /** Community logo (/uploads path) drawn beside the community name. */
  logoImage?: string;
  /** Ticket type, e.g. "VIP" / "General Admission" — stated on the stub under the attendee name. */
  tierLabel?: string;
  /** e.g. "Day 2 only" — chip next to the price. */
  daysLabel?: string;
  /** Section/track the ticket registers into, e.g. "Data Science" — printed on the stub. */
  sectionLabel?: string;
};

type TicketStyleKey = NonNullable<TicketRenderInput['style']>;

/** Per-style palette — keep in sync with frontend/components/guildos/ticket-canvas.ts. */
const TICKET_PALETTES: Record<TicketStyleKey, {
  body0: string; body1: string; title: string; muted: string; stub: string;
  decor: 'accent' | string; footerMark: string; lightBody: boolean;
}> = {
  MIDNIGHT: { body0: '#101828', body1: '#1e2a4a', title: '#ffffff', muted: '#cbd5e1', stub: '#f8fafc', decor: '#8ea4ff', footerMark: '#64748b', lightBody: false },
  DAYLIGHT: { body0: '#ffffff', body1: '#e8edf5', title: '#0f172a', muted: '#475569', stub: '#f8fafc', decor: 'accent', footerMark: '#94a3b8', lightBody: true },
  BOLD: { body0: 'accent', body1: 'accent-dark', title: '#ffffff', muted: 'rgba(255,255,255,0.82)', stub: '#f8fafc', decor: '#ffffff', footerMark: 'rgba(255,255,255,0.6)', lightBody: false },
  MINIMAL: { body0: '#ffffff', body1: '#ffffff', title: '#111827', muted: '#6b7280', stub: '#fafafa', decor: 'none', footerMark: '#9ca3af', lightBody: true },
};

function shadeHex(hex: string, factor: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * factor)));
  const r = ch((n >> 16) & 0xff);
  const g = ch((n >> 8) & 0xff);
  const b = ch(n & 0xff);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function roundRect(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** GuildOS brand mark (purple rounded square + white G, matching the app icon) —
 * drawn with canvas primitives so the render never depends on an image asset. */
function drawGuildosMark(ctx: SKRSContext2D, x: number, y: number, size: number) {
  const g = ctx.createLinearGradient(x, y, x + size, y + size);
  g.addColorStop(0, '#8b5cf6');
  g.addColorStop(1, '#6d3ef2');
  roundRect(ctx, x, y, size, size, size * 0.28);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 ${Math.round(size * 0.6)}px sans-serif`;
  ctx.fillText('G', x + size / 2, y + size / 2 + size * 0.04);
  ctx.restore();
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

  const style: TicketStyleKey = input.style ?? 'MIDNIGHT';
  const accent = /^#[0-9a-f]{6}$/i.test(input.accent ?? '') ? (input.accent as string) : '#6366f1';
  const p = TICKET_PALETTES[style] ?? TICKET_PALETTES.MIDNIGHT;
  const body0 = p.body0 === 'accent' ? accent : p.body0;
  const body1 = p.body1 === 'accent-dark' ? shadeHex(accent, 0.55) : p.body1;

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, body0);
  bg.addColorStop(1, body1);
  ctx.fillStyle = bg;
  roundRect(ctx, 0, 0, W, H, 28);
  ctx.fill();

  if (style === 'MINIMAL') {
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 3;
    roundRect(ctx, 1.5, 1.5, W - 3, H - 3, 27);
    ctx.stroke();
  }

  if (p.decor !== 'none') {
    ctx.save();
    roundRect(ctx, 0, 0, STUB_X, H, 28);
    ctx.clip();
    ctx.globalAlpha = p.lightBody ? 0.07 : 0.08;
    ctx.fillStyle = p.decor === 'accent' ? accent : p.decor;
    for (const [cx, cy, r] of [[180, -40, 190], [920, 560, 240], [640, 90, 70]] as const) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  ctx.fillStyle = style === 'BOLD' ? '#ffffff' : accent;
  roundRect(ctx, 0, 0, 14, H, 7);
  ctx.fill();

  ctx.save();
  roundRect(ctx, 0, 0, W, H, 28);
  ctx.clip();
  ctx.fillStyle = p.stub;
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

  // Community branding: circle-cropped logo (best effort) + overline name.
  let left = 64;
  let logo: Awaited<ReturnType<typeof loadImage>> | null = null;
  if (input.logoImage) {
    try {
      logo = await loadImage(resolveTemplateSource(input.logoImage));
    } catch {
      /* logo is decoration — never block the ticket */
    }
  }
  if (logo) {
    const R = 30;
    ctx.save();
    ctx.beginPath();
    ctx.arc(left + R, 78 - R + 8, R, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(left, 78 - 2 * R + 8, R * 2, R * 2);
    ctx.drawImage(logo, left, 78 - 2 * R + 8, R * 2, R * 2);
    ctx.restore();
    ctx.strokeStyle = p.lightBody ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(left + R, 78 - R + 8, R, 0, Math.PI * 2);
    ctx.stroke();
    left += R * 2 + 20;
  }

  ctx.textAlign = 'left';
  ctx.fillStyle = style === 'BOLD' ? 'rgba(255,255,255,0.85)' : p.lightBody ? accent : shadeHex(accent, 1.55);
  ctx.font = '600 26px sans-serif';
  ctx.fillText(input.communityName.toUpperCase(), left, 88);
  left = 64;

  ctx.fillStyle = p.title;
  ctx.font = 'bold 62px serif';
  let y = 178;
  for (const line of wrap(ctx, input.eventTitle, STUB_X - left - 60, 2)) {
    ctx.fillText(line, left, y);
    y += 72;
  }

  ctx.font = '30px sans-serif';
  ctx.fillStyle = p.muted;
  y += 14;
  if (input.dateLabel) {
    ctx.fillText(input.dateLabel, left, y);
    y += 46;
  }
  if (input.venueLabel) {
    ctx.fillText(wrap(ctx, input.venueLabel, STUB_X - left - 60, 1)[0] ?? '', left, y);
    y += 46;
  }
  // The attendee's track gets its own body line — it's their room assignment, not a ticket type.
  if (input.sectionLabel) {
    ctx.font = 'bold 30px sans-serif';
    ctx.fillStyle = p.title;
    ctx.fillText(wrap(ctx, `Track: ${input.sectionLabel}`, STUB_X - left - 60, 1)[0] ?? '', left, y);
  }

  // Footer chips: price (solid accent) + day-scope (outline). The ticket type is
  // stated on the stub, so it doesn't repeat here.
  const footerY = H - 64;
  let chipX = left;
  if (input.priceLabel) {
    ctx.font = 'bold 28px sans-serif';
    const chipW = ctx.measureText(input.priceLabel).width + 48;
    ctx.fillStyle = style === 'BOLD' ? '#ffffff' : accent;
    roundRect(ctx, chipX, footerY - 34, chipW, 52, 26);
    ctx.fill();
    ctx.fillStyle = style === 'BOLD' ? accent : '#ffffff';
    ctx.fillText(input.priceLabel, chipX + 24, footerY + 2);
    chipX += chipW + 14;
  }
  if (input.daysLabel) {
    const label = input.daysLabel;
    ctx.font = '600 26px sans-serif';
    const chipW = ctx.measureText(label.toUpperCase()).width + 44;
    if (chipX + chipW <= STUB_X - 400) { // never collide with the brand lockup
      ctx.strokeStyle = style === 'BOLD' ? 'rgba(255,255,255,0.7)' : p.lightBody ? shadeHex(accent, 0.9) : 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 2.5;
      roundRect(ctx, chipX, footerY - 34, chipW, 52, 26);
      ctx.stroke();
      ctx.fillStyle = style === 'BOLD' ? '#ffffff' : p.lightBody ? shadeHex(accent, 0.8) : '#e2e8f0';
      ctx.fillText(label.toUpperCase(), chipX + 22, footerY + 2);
      chipX += chipW + 14;
    }
  }
  // GuildOS brand lockup: drawn logo mark + wordmark, right-aligned at the perforation.
  ctx.textAlign = 'right';
  ctx.fillStyle = p.footerMark;
  ctx.font = 'bold 26px sans-serif';
  const wordmark = 'GUILDOS · VERIFIED TICKET';
  ctx.fillText(wordmark, STUB_X - 40, footerY + 2);
  const markSize = 40;
  drawGuildosMark(ctx, STUB_X - 40 - ctx.measureText(wordmark).width - 16 - markSize, footerY - 27, markSize);

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
  // Ticket type — stated on the stub so the door team can tier-check at a glance.
  // Callers pass 'General Admission' for untiered events; unknown tier = no line.
  const hasType = Boolean(input.tierLabel);
  if (hasType) {
    ctx.font = 'bold 23px sans-serif';
    ctx.fillStyle = shadeHex(accent, 0.8);
    ctx.fillText((input.tierLabel as string).toUpperCase(), stubCenter, 422);
  }
  ctx.fillStyle = '#64748b';
  ctx.font = '22px sans-serif';
  ctx.fillText('Scan at the door to check in', stubCenter, hasType ? 458 : 418);

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
