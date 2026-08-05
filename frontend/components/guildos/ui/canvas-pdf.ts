/**
 * Dependency-free single-page PDF builder: wraps a rendered <canvas> as a JPEG
 * image inside a minimal PDF 1.4 document. Good for certificates and CVs where
 * the pixel-perfect rendering already exists on canvas and we just need a real
 * .pdf file (email-able, print-ready, opens everywhere).
 *
 * PDF structure: Catalog → Pages → Page (sized to the image) → XObject (DCTDecode
 * = raw JPEG bytes) drawn full-bleed via the content stream.
 */

function stringToBytes(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length);
  for (let i = 0; i < value.length; i += 1) bytes[i] = value.charCodeAt(i) & 0xff;
  return bytes;
}

/** Build a one-page PDF (Uint8Array) from JPEG bytes with the given pixel size. */
export function jpegToPdf(jpeg: Uint8Array, width: number, height: number): Uint8Array {
  // Points: scale so the page is at most A4-landscape-ish wide but keeps the aspect.
  // 72dpi direct mapping keeps numbers simple; viewers scale to fit anyway.
  const pageW = width * 0.5;
  const pageH = height * 0.5;

  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let position = 0;

  function push(data: string | Uint8Array) {
    const bytes = typeof data === 'string' ? stringToBytes(data) : data;
    chunks.push(bytes);
    position += bytes.length;
  }
  function beginObject(id: number) {
    offsets[id] = position;
    push(`${id} 0 obj\n`);
  }

  push('%PDF-1.4\n%\xff\xff\xff\xff\n');

  beginObject(1);
  push('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  beginObject(2);
  push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');

  beginObject(3);
  push(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW.toFixed(2)} ${pageH.toFixed(2)}] ` +
      '/Resources << /XObject << /Im0 4 0 R >> /ProcSet [/PDF /ImageC] >> /Contents 5 0 R >>\nendobj\n',
  );

  beginObject(4);
  push(
    `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} ` +
      `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
  );
  push(jpeg);
  push('\nendstream\nendobj\n');

  const content = `q\n${pageW.toFixed(2)} 0 0 ${pageH.toFixed(2)} 0 0 cm\n/Im0 Do\nQ\n`;
  beginObject(5);
  push(`<< /Length ${content.length} >>\nstream\n${content}endstream\nendobj\n`);

  const xrefStart = position;
  push('xref\n0 6\n0000000000 65535 f \n');
  for (let id = 1; id <= 5; id += 1) {
    push(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
  }
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`);

  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Uint8Array(total);
  let cursor = 0;
  for (const chunk of chunks) {
    out.set(chunk, cursor);
    cursor += chunk.length;
  }
  return out;
}

/** Render a canvas into a downloadable one-page PDF file. */
export function downloadCanvasAsPdf(canvas: HTMLCanvasElement, filename: string) {
  // JPEG at 0.95 keeps certificates crisp while staying ~10x smaller than PNG-in-PDF.
  const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const binary = atob(base64);
  const jpeg = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) jpeg[i] = binary.charCodeAt(i);

  const pdf = jpegToPdf(jpeg, canvas.width, canvas.height);
  const blob = new Blob([pdf.buffer as ArrayBuffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
