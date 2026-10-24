// Save as: components/guildos/events/qr-detect.ts
//
// Finds a QR code that is already printed in an organizer's ticket artwork, so the
// real check-in QR can be placed exactly there (same size: printed tickets still scan).
// Needs the `jsqr` package:  npm i jsqr
// Uses the browser's BarcodeDetector first when it exists (fast, Chromium), jsQR otherwise.
import type { TicketQrBox } from '../ticket-canvas';

/** Big artwork is scanned at this size: plenty for a QR, and fast. */
const MAX_SIDE = 1600;

type Point = { x: number; y: number };

type BarcodeDetectorLike = {
  detect: (
    source: CanvasImageSource,
  ) => Promise<Array<{ cornerPoints?: Point[]; boundingBox?: { x: number; y: number; width: number; height: number } }>>;
};

function loadCanvas(source: File | string): Promise<HTMLCanvasElement | null> {
  return new Promise((resolve) => {
    const objectUrl = typeof source === 'string' ? '' : URL.createObjectURL(source);
    const image = new Image();
    if (typeof source === 'string') image.crossOrigin = 'anonymous';

    image.onload = () => {
      const longest = Math.max(image.naturalWidth, image.naturalHeight);
      const scale = longest > MAX_SIDE ? MAX_SIDE / longest : 1;
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      canvas.getContext('2d', { willReadFrequently: true })?.drawImage(image, 0, 0, canvas.width, canvas.height);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      resolve(canvas);
    };
    image.onerror = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      resolve(null);
    };
    image.src = typeof source === 'string' ? source : objectUrl;
  });
}

async function withBarcodeDetector(canvas: HTMLCanvasElement): Promise<Point[] | null> {
  const Detector = (window as unknown as {
    BarcodeDetector?: new (options: { formats: string[] }) => BarcodeDetectorLike;
  }).BarcodeDetector;
  if (!Detector) return null;

  try {
    const results = await new Detector({ formats: ['qr_code'] }).detect(canvas);
    const first = results[0];
    if (!first) return null;
    if (first.cornerPoints?.length) return first.cornerPoints;
    if (first.boundingBox) {
      const { x, y, width, height } = first.boundingBox;
      return [
        { x, y },
        { x: x + width, y },
        { x: x + width, y: y + height },
        { x, y: y + height },
      ];
    }
  } catch {
    // Unsupported formats / blocked: fall through to jsQR.
  }
  return null;
}

/** jsQR struggles with a QR that is small inside big, busy artwork, so it also scans parts of the image. */
async function withJsQr(canvas: HTMLCanvasElement): Promise<Point[] | null> {
  try {
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    const { default: jsQR } = await import('jsqr');
    const { width, height } = canvas;

    // Whole image first, then halves and quarters (x, y, w, h).
    const regions: Array<[number, number, number, number]> = [
      [0, 0, width, height],
      [Math.floor(width / 2), 0, Math.ceil(width / 2), height],
      [0, 0, Math.ceil(width / 2), height],
      [0, Math.floor(height / 2), width, Math.ceil(height / 2)],
      [0, 0, width, Math.ceil(height / 2)],
      [Math.floor(width / 2), Math.floor(height / 2), Math.ceil(width / 2), Math.ceil(height / 2)],
      [Math.floor(width / 2), 0, Math.ceil(width / 2), Math.ceil(height / 2)],
      [0, Math.floor(height / 2), Math.ceil(width / 2), Math.ceil(height / 2)],
      [0, 0, Math.ceil(width / 2), Math.ceil(height / 2)],
    ];

    for (const [x, y, w, h] of regions) {
      // Throws for a canvas tainted by a cross-origin image: caught below.
      const image = context.getImageData(x, y, w, h);
      const code = jsQR(image.data, image.width, image.height, { inversionAttempts: 'attemptBoth' });
      if (code) {
        const { topLeftCorner, topRightCorner, bottomRightCorner, bottomLeftCorner } = code.location;
        return [topLeftCorner, topRightCorner, bottomRightCorner, bottomLeftCorner].map((point) => ({
          x: point.x + x,
          y: point.y + y,
        }));
      }
      // Let the page breathe between scans.
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    return null;
  } catch {
    return null;
  }
}

const round1 = (value: number) => Math.round(value * 10) / 10;

/**
 * Turns the found corners into a box, but only when it "fits well": roughly square,
 * not tiny and not huge, fully inside the artwork. Otherwise null, so the organizer
 * places it themselves rather than us guessing wrong and breaking check-in.
 */
function toPlausibleBox(corners: Point[], width: number, height: number): TicketQrBox | null {
  const xs = corners.map((point) => point.x);
  const ys = corners.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const boxWidth = maxX - minX;
  const boxHeight = maxY - minY;

  if (boxWidth <= 0 || boxHeight <= 0) return null;

  const ratio = boxWidth / boxHeight;
  if (ratio < 0.75 || ratio > 1.33) return null;

  const side = Math.max(boxWidth, boxHeight);
  const sizePercent = (side / Math.min(width, height)) * 100;
  if (sizePercent < 6 || sizePercent > 60) return null;

  // Allow a pixel or two of rounding at the edges.
  if (minX < -2 || minY < -2 || maxX > width + 2 || maxY > height + 2) return null;

  return {
    x: round1(Math.max(0, minX / width) * 100),
    y: round1(Math.max(0, minY / height) * 100),
    size: round1(sizePercent),
  };
}

/** Resolves to the QR's box in the artwork, or null when none was found or it doesn't fit well. */
export async function detectQrBox(source: File | string): Promise<TicketQrBox | null> {
  const canvas = await loadCanvas(source);
  if (!canvas) return null;

  const corners = (await withBarcodeDetector(canvas)) ?? (await withJsQr(canvas));
  return corners ? toPlausibleBox(corners, canvas.width, canvas.height) : null;
}

/** Natural size of an image (a File you just chose, or a URL). */
export function imageSize(source: File | string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const objectUrl = typeof source === 'string' ? '' : URL.createObjectURL(source);
    const image = new Image();
    image.onload = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      resolve(null);
    };
    image.src = typeof source === 'string' ? source : objectUrl;
  });
}

type Corner = 'TOP_LEFT' | 'TOP_RIGHT' | 'BOTTOM_LEFT' | 'BOTTOM_RIGHT' | 'CENTER';

/** A QR box in a corner (or the centre) of artwork of the given size; `sizePercent` is of the shorter side. */
export function presetQrBox(corner: Corner, size: { width: number; height: number }, sizePercent = 14): TicketQrBox {
  const shorter = Math.min(size.width, size.height);
  const widthPct = (sizePercent * shorter) / size.width;
  const heightPct = (sizePercent * shorter) / size.height;
  const margin = 4;
  const x = corner.endsWith('LEFT') ? margin : corner.endsWith('RIGHT') ? 100 - margin - widthPct : (100 - widthPct) / 2;
  const y = corner.startsWith('TOP') ? margin : corner.startsWith('BOTTOM') ? 100 - margin - heightPct : (100 - heightPct) / 2;
  return { x: round1(x), y: round1(y), size: sizePercent };
}