'use client';
import { useEffect, useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Btn } from '@/components/ui/bits';
import { Sheet } from '@/components/ui/sheet';

const VIEW = 240;
const OUT = 512;

/**
 * Crop a logo to a circle before saving: drag to position, zoom with the slider. Saves a square
 * 512×512 image, so logos always fit the round frame (no stretched or off-centre logos).
 */
export function LogoCropper({ file, onDone, onCancel }: { file: File | null; onDone: (cropped: File) => void; onCancel: () => void }) {
  const [url, setUrl] = useState('');
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  useEffect(() => {
    if (!file) return;
    const u = URL.createObjectURL(file);
    setUrl(u); setZoom(1); setPos({ x: 0, y: 0 }); setImg(null);
    const i = new Image(); i.onload = () => setImg(i); i.src = u;
    return () => URL.revokeObjectURL(u);
  }, [file]);

  // The image covers the circle at zoom 1; zooming scales from there.
  const base = img ? VIEW / Math.min(img.naturalWidth, img.naturalHeight) : 1;
  const w = img ? img.naturalWidth * base * zoom : VIEW;
  const h = img ? img.naturalHeight * base * zoom : VIEW;
  const clamp = (p: { x: number; y: number }) => ({ x: Math.min(0, Math.max(VIEW - w, p.x)), y: Math.min(0, Math.max(VIEW - h, p.y)) });
  const at = clamp(pos.x === 0 && pos.y === 0 && img ? { x: (VIEW - w) / 2, y: (VIEW - h) / 2 } : pos);
  useEffect(() => { if (img) setPos(clamp({ x: (VIEW - w) / 2, y: (VIEW - h) / 2 })); }, [img]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setPos((p) => clamp(p)); }, [zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (!img || !file) return;
    const canvas = document.createElement('canvas');
    canvas.width = OUT; canvas.height = OUT;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const k = OUT / VIEW;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, OUT, OUT);
    ctx.drawImage(img, at.x * k, at.y * k, w * k, h * k);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.92));
    if (blob) onDone(new File([blob], file.name.replace(/\.\w+$/, '') + '-logo.jpg', { type: 'image/jpeg' }));
  }

  return (
    <Sheet open={Boolean(file)} onClose={onCancel} title="Position your logo">
      <div className="flex flex-col items-center gap-5 px-5 pb-6">
        <div
          className="relative cursor-grab touch-none overflow-hidden rounded-full bg-mist shadow-[0_0_0_4px_var(--surface),0_0_0_6px_var(--line)] active:cursor-grabbing"
          style={{ width: VIEW, height: VIEW }}
          onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, px: at.x, py: at.y }; }}
          onPointerMove={(e) => { const d = drag.current; if (d) setPos(clamp({ x: d.px + e.clientX - d.x, y: d.py + e.clientY - d.y })); }}
          onPointerUp={() => { drag.current = null; }}
          role="img" aria-label="Logo preview">
          {url ? <img src={url} alt="" draggable={false} className="pointer-events-none absolute max-w-none select-none" style={{ left: at.x, top: at.y, width: w, height: h }} /> : null}
        </div>
        <label className="flex w-full max-w-[280px] items-center gap-3">
          <Minus size={16} className="text-muted" aria-hidden />
          <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} aria-label="Zoom" className="flex-1 accent-[var(--green-text)]" />
          <Plus size={16} className="text-muted" aria-hidden />
        </label>
        <p className="text-[13px] text-muted">Drag to position. The round frame is how it shows everywhere.</p>
        <div className="flex w-full gap-2">
          <Btn kind="secondary" wide onClick={onCancel}>Cancel</Btn>
          <Btn wide onClick={() => void save()} disabled={!img}>Use this logo</Btn>
        </div>
      </div>
    </Sheet>
  );
}
