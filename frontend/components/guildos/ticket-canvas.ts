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

import { resolveEventImageUrl, type TicketQrPlacement, type TicketStyle } from './event-api';

export type { TicketQrPlacement, TicketStyle };

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
  /** Standard-design look; ignored when templateImage is set. */
  style?: TicketStyle;
  /** Accent hex for bar/chips/decor on the standard design. */
  accent?: string;
  /** Community logo (/uploads path or URL) — drawn beside the community name. */
  logoImage?: string;
  /** Ticket type, e.g. "VIP" / "General Admission" — stated on the stub under the attendee name. */
  tierLabel?: string;
  /** e.g. "Day 2 only" — rendered as a chip next to the price. */
  daysLabel?: string;
  /** Attendee's section/track, e.g. "Coding · Innovation Hub" — own line in the ticket body. */
  sectionLabel?: string;
};

/** Per-style palette for the standard ticket. The accent colour is layered on top. */
const TICKET_PALETTES: Record<TicketStyle, {
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

/** GuildOS brand mark (purple rounded square + white G, matching the app icon) —
 * drawn with canvas primitives so the ticket never waits on an image asset. */
function drawGuildosMark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
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
  ctx.font = `800 ${Math.round(size * 0.6)}px Montserrat, Arial, sans-serif`;
  ctx.fillText('G', x + size / 2, y + size / 2 + size * 0.04);
  ctx.restore();
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
    await drawStandardTicket(canvas, data);
  }
}

// ── STANDARD: GuildOS landscape ticket with QR stub ───────────────────────

async function drawStandardTicket(canvas: HTMLCanvasElement, data: TicketDrawData) {
  const W = 1500;
  const H = 560;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const style: TicketStyle = data.style ?? 'MIDNIGHT';
  const accent = /^#[0-9a-f]{6}$/i.test(data.accent ?? '') ? (data.accent as string) : '#6366f1';
  const p = TICKET_PALETTES[style] ?? TICKET_PALETTES.MIDNIGHT;
  const body0 = p.body0 === 'accent' ? accent : p.body0;
  const body1 = p.body1 === 'accent-dark' ? shadeHex(accent, 0.55) : p.body1;

  const STUB_X = 1080; // perforation line

  // Body background
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, body0);
  bg.addColorStop(1, body1);
  ctx.fillStyle = bg;
  roundRect(ctx, 0, 0, W, H, 28);
  ctx.fill();

  // MINIMAL gets a hairline frame instead of decor circles.
  if (style === 'MINIMAL') {
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 3;
    roundRect(ctx, 1.5, 1.5, W - 3, H - 3, 27);
    ctx.stroke();
  }

  // Decorative circles on the body
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

  // Accent bar
  ctx.fillStyle = style === 'BOLD' ? '#ffffff' : accent;
  roundRect(ctx, 0, 0, 14, H, 7);
  ctx.fill();

  // Stub (right side, light)
  ctx.save();
  roundRect(ctx, 0, 0, W, H, 28);
  ctx.clip();
  ctx.fillStyle = p.stub;
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

  // Community branding: circle-cropped logo (when it loads) + overline name.
  let left = 64;
  const logo = data.logoImage ? await loadImg(resolveEventImageUrl(data.logoImage)) : null;
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
  ctx.font = '600 26px Montserrat, Arial, sans-serif';
  ctx.fillText(data.communityName.toUpperCase(), left, 88);
  left = 64;

  ctx.fillStyle = p.title;
  ctx.font = '700 62px "Playfair Display", Georgia, serif';
  const titleLines = wrap(ctx, data.eventTitle, STUB_X - left - 60, 2);
  let y = 178;
  for (const line of titleLines) {
    ctx.fillText(line, left, y);
    y += 72;
  }

  ctx.font = '400 30px Montserrat, Arial, sans-serif';
  ctx.fillStyle = p.muted;
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
  // The attendee's track gets its own body line — it's their room assignment, not a ticket type.
  if (data.sectionLabel) {
    ctx.font = '700 30px Montserrat, Arial, sans-serif';
    ctx.fillStyle = p.title;
    ctx.fillText(wrap(ctx, `Track: ${data.sectionLabel}`, STUB_X - left - 60, 1)[0] ?? '', left, y);
    y += 46;
  }

  // Footer chips: price (solid accent) + day-scope (outline). The ticket type is
  // stated on the stub, so it doesn't repeat here.
  const footerY = H - 64;
  let chipX = left;
  if (data.priceLabel) {
    ctx.font = '700 28px Montserrat, Arial, sans-serif';
    const chipW = ctx.measureText(data.priceLabel).width + 48;
    ctx.fillStyle = style === 'BOLD' ? '#ffffff' : accent;
    roundRect(ctx, chipX, footerY - 34, chipW, 52, 26);
    ctx.fill();
    ctx.fillStyle = style === 'BOLD' ? accent : '#ffffff';
    ctx.fillText(data.priceLabel, chipX + 24, footerY + 2);
    chipX += chipW + 14;
  }
  if (data.daysLabel) {
    const label = data.daysLabel;
    ctx.font = '600 26px Montserrat, Arial, sans-serif';
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
  ctx.font = '700 26px Montserrat, Arial, sans-serif';
  const wordmark = 'GUILDOS · VERIFIED TICKET';
  ctx.fillText(wordmark, STUB_X - 40, footerY + 2);
  const markSize = 40;
  drawGuildosMark(ctx, STUB_X - 40 - ctx.measureText(wordmark).width - 16 - markSize, footerY - 27, markSize);

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
  // Ticket type — stated on the stub so the door team can tier-check at a glance.
  // Callers pass 'General Admission' for untiered events; unknown tier = no line
  // (never print a type we can't vouch for).
  const hasType = Boolean(data.tierLabel);
  if (hasType) {
    if ('letterSpacing' in ctx) (ctx as unknown as { letterSpacing: string }).letterSpacing = '3px';
    ctx.font = '700 23px Montserrat, Arial, sans-serif';
    ctx.fillStyle = shadeHex(accent, 0.8);
    ctx.fillText((data.tierLabel as string).toUpperCase(), stubCenter, 422);
    if ('letterSpacing' in ctx) (ctx as unknown as { letterSpacing: string }).letterSpacing = '0px';
  }
  ctx.fillStyle = '#64748b';
  ctx.font = '400 22px Montserrat, Arial, sans-serif';
  ctx.fillText('Scan at the door to check in', stubCenter, hasType ? 458 : 418);
  if (data.reference) {
    ctx.font = '400 20px "Courier New", monospace';
    ctx.fillStyle = '#94a3b8';
    const refLines = wrap(ctx, data.reference, W - STUB_X - 50, 1);
    ctx.fillText(refLines[0] ?? '', stubCenter, hasType ? 506 : 486);
  }
}

// ── CUSTOM: organizer artwork + composited QR block ───────────────────────────

async function drawCustomTicket(canvas: HTMLCanvasElement, data: TicketDrawData) {
  const template = await loadImg(resolveEventImageUrl(data.templateImage ?? ''));
  const ctx0 = canvas.getContext('2d');
  if (!ctx0) return;

  if (!template) {
    // Template failed to load (e.g. missing CORS) — fall back to the standard design.
    await drawStandardTicket(canvas, data);
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
