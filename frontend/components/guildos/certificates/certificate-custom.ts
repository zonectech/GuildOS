// Save as: components/guildos/certificates/certificate-custom.ts
//
// One place that draws an organizer-uploaded ("CUSTOM") certificate: the attendee's name in the
// organizer's chosen font, and, when the event has a QR box, a verification QR placed exactly
// there with the certificate serial beside it. Used by the certificate page, the status card
// and anything else that renders a custom certificate, so they can never drift apart.
import { CERT_FONTS } from './certificate-canvas';
import type { CertificateNamePlacement, TicketQrBox } from '../api/event-api';

/** The look every custom certificate had before fonts were selectable. */
const LEGACY_NAME_FONT = 'Georgia, "Times New Roman", serif';

/** CSS font stack for the attendee's name. '' / unknown = the original Georgia look (older certificates). */
export function nameFontStack(font?: string | null): string {
  return CERT_FONTS.find((item) => item.value === font)?.css ?? LEGACY_NAME_FONT;
}

/** Script fonts have no bold; the others keep the semi-bold the name always had. */
export function nameFontWeight(font?: string | null): number {
  return font === 'SCRIPT' ? 400 : 600;
}

/** Makes sure the chosen web font is ready before drawing, so the first draw is the final one. */
export async function ensureNameFont(font?: string | null): Promise<void> {
  const fonts = (document as unknown as { fonts?: { load: (font: string) => Promise<unknown> } }).fonts;
  if (!fonts) return;
  try {
    await fonts.load(`${nameFontWeight(font)} 32px ${nameFontStack(font)}`);
  } catch {
    // Fall back to whatever the browser has.
  }
}

/** Our QR canvas carries a quiet zone (~4 modules) around its modules, about 12% of their width. */
const QR_QUIET_ZONE = 0.12;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export type CustomCertificateInput = {
  image: HTMLImageElement;
  attendeeName: string;
  placement: CertificateNamePlacement;
  /** Where the verification QR goes (percent of the artwork); null/undefined = no QR. */
  qrBox?: TicketQrBox | null;
  /** The verification QR, drawn with a 4-module quiet zone: <QRCodeCanvas marginSize={4} />. */
  qrCanvas?: HTMLCanvasElement | null;
  serial?: string;
};

export function drawCustomCertificate(canvas: HTMLCanvasElement, input: CustomCertificateInput) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { image, placement } = input;
  canvas.width = image.naturalWidth || 1200;
  canvas.height = image.naturalHeight || 850;
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  const fontPx = Math.round((placement.fontSize / 100) * canvas.height);
  ctx.font = `${nameFontWeight(placement.font)} ${fontPx}px ${nameFontStack(placement.font)}`;
  ctx.fillStyle = placement.color || '#111111';
  ctx.textAlign = placement.align;
  ctx.textBaseline = 'middle';
  ctx.fillText(
    input.attendeeName,
    (placement.x / 100) * canvas.width,
    (placement.y / 100) * canvas.height,
  );
  ctx.textBaseline = 'alphabetic';

  if (input.qrBox && input.qrCanvas) {
    drawVerificationQr(ctx, canvas.width, canvas.height, input.qrBox, input.qrCanvas, input.serial);
  }
}

/**
 * The QR's modules fill the box exactly, on a white backing with its quiet zone (which also hides
 * any placeholder QR printed in the artwork), and a small "Scan to verify · serial" pill beside it.
 */
function drawVerificationQr(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  rawBox: TicketQrBox,
  qrCanvas: HTMLCanvasElement,
  serial?: string,
) {
  const box = { x: clamp(rawBox.x, 0, 100), y: clamp(rawBox.y, 0, 100), size: clamp(rawBox.size, 5, 70) };
  const modules = (box.size / 100) * Math.min(W, H);
  const margin = modules * QR_QUIET_ZONE;
  const side = modules + margin * 2;
  const cover = modules * 0.03;
  const left = clamp((box.x / 100) * W - margin, 0, Math.max(0, W - side));
  const top = clamp((box.y / 100) * H - margin, 0, Math.max(0, H - side));

  ctx.save();
  ctx.shadowColor = 'rgba(15, 23, 42, 0.2)';
  ctx.shadowBlur = 10;
  ctx.fillStyle = '#ffffff';
  roundedRect(ctx, left - cover, top - cover, side + cover * 2, side + cover * 2, Math.round(side * 0.04));
  ctx.fill();
  ctx.restore();
  ctx.drawImage(qrCanvas, left, top, side, side);

  // "Scan to verify" + serial, under the QR or above it when there is no room.
  const labelSize = Math.max(11, Math.round(side * 0.075));
  const serialSize = Math.max(9, Math.round(side * 0.058));
  const pillH = Math.round(labelSize * 1.7 + (serial ? serialSize * 1.6 : 0));
  const gap = Math.round(side * 0.03);
  const roomBelow = H - (top + side + cover);
  const pillY = roomBelow >= pillH + gap ? top + side + cover + gap : Math.max(0, top - cover - gap - pillH);

  ctx.save();
  ctx.shadowColor = 'rgba(15, 23, 42, 0.2)';
  ctx.shadowBlur = 10;
  ctx.fillStyle = '#ffffff';
  roundedRect(ctx, left, pillY, side, pillH, Math.round(pillH * 0.25));
  ctx.fill();
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#0f172a';
  ctx.font = `700 ${labelSize}px Arial, Helvetica, sans-serif`;
  ctx.fillText('SCAN TO VERIFY', left + side / 2, pillY + labelSize * 0.95);
  if (serial) {
    ctx.fillStyle = '#475569';
    ctx.font = `600 ${serialSize}px "Courier New", monospace`;
    ctx.fillText(serial, left + side / 2, pillY + labelSize * 1.7 + serialSize * 0.7);
  }
  ctx.textBaseline = 'alphabetic';
}