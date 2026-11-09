/**
 * A crest image for a community that has no logo yet (the backend requires one): its initials inside a
 * stamp-style double ring, in brand green, as a 512px PNG file ready to upload.
 */
export async function crestPng(name: string): Promise<File> {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Unable to draw a logo');
  const mid = size / 2;
  ctx.fillStyle = '#E2F3E9'; ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = '#0A7A50';
  ctx.lineWidth = 22; ctx.beginPath(); ctx.arc(mid, mid, 214, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 5; ctx.setLineDash([14, 12]); ctx.beginPath(); ctx.arc(mid, mid, 178, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
  const initials = name.replace(/^\[[^\]]*\]\s*/, '').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '★';
  try { await document.fonts.ready; } catch { /* fonts unavailable */ }
  ctx.fillStyle = '#0A7A50';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `800 ${initials.length > 1 ? 168 : 200}px ${getComputedStyle(document.body).getPropertyValue('--font-bricolage') || 'sans-serif'}, sans-serif`;
  ctx.fillText(initials, mid, mid + 8);
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/png'));
  if (!blob) throw new Error('Unable to draw a logo');
  return new File([blob], 'crest.png', { type: 'image/png' });
}
