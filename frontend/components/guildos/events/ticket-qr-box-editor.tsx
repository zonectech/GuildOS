'use client';

// Save as: components/guildos/events/ticket-qr-box-editor.tsx
import { useRef, useState } from 'react';
import { QrCode } from 'lucide-react';

import type { TicketQrBox, TicketQrPlacement } from '../ticket-canvas';

const MIN_SIZE = 8;
const MAX_SIZE = 50;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round1 = (value: number) => Math.round(value * 10) / 10;

/** A starting box for "place it myself", near the preset spot the organizer had picked. */
function boxForPlacement(placement: TicketQrPlacement): TicketQrBox {
  const size = 22;
  switch (placement) {
    case 'TOP_LEFT':
      return { x: 4, y: 4, size };
    case 'TOP_RIGHT':
      return { x: 74, y: 4, size };
    case 'BOTTOM_LEFT':
      return { x: 4, y: 70, size };
    case 'CENTER':
      return { x: 39, y: 39, size };
    case 'BOTTOM_RIGHT':
    default:
      return { x: 74, y: 70, size };
  }
}

/**
 * The artwork with a draggable box over it: where the real QR goes. Drag to move,
 * slider (or arrow keys) to fine-tune. Percentages, so it works at any print size.
 */
export function TicketQrBoxEditor({
  image,
  box,
  onChange,
}: {
  image: string;
  box: TicketQrBox;
  onChange: (box: TicketQrBox) => void;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ pointerX: number; pointerY: number; boxX: number; boxY: number } | null>(null);
  const resizeRef = useRef(false);
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);

  // `size` is a % of the shorter side, so the box has different % width / height on a wide image.
  const shorter = natural ? Math.min(natural.width, natural.height) : 1;
  const extent = (size: number) =>
    natural ? { w: (size * shorter) / natural.width, h: (size * shorter) / natural.height } : { w: size, h: size };

  const place = (next: TicketQrBox): TicketQrBox => {
    const { w, h } = extent(next.size);
    return {
      size: next.size,
      x: round1(clamp(next.x, 0, Math.max(0, 100 - w))),
      y: round1(clamp(next.y, 0, Math.max(0, 100 - h))),
    };
  };

  const { w, h } = extent(box.size);

  return (
    <div>
      <div
        ref={wrapRef}
        className="relative w-full select-none overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900"
        style={{ touchAction: 'none' }}
        // Never let a click on the artwork fall through to a surrounding <label>'s first button.
        onClick={(event) => event.preventDefault()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt="Your ticket design"
          draggable={false}
          className="block w-full"
          onLoad={(event) =>
            setNatural({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })
          }
        />

        <div
          role="slider"
          tabIndex={0}
          aria-label="QR code position. Drag, or use the arrow keys."
          aria-valuetext={`${Math.round(box.x)}% from the left, ${Math.round(box.y)}% from the top`}
          className="absolute grid cursor-move place-items-center border-2 border-dashed border-indigo-600 bg-white/70 text-indigo-700 shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          style={{ left: `${box.x}%`, top: `${box.y}%`, width: `${w}%`, height: `${h}%` }}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            dragRef.current = { pointerX: event.clientX, pointerY: event.clientY, boxX: box.x, boxY: box.y };
          }}
          onPointerMove={(event) => {
            const drag = dragRef.current;
            const rect = wrapRef.current?.getBoundingClientRect();
            if (!drag || !rect) return;
            // Button already released (e.g. outside the window): stop following the pointer.
            if (event.buttons === 0) {
              dragRef.current = null;
              return;
            }
            onChange(
              place({
                size: box.size,
                x: drag.boxX + ((event.clientX - drag.pointerX) / rect.width) * 100,
                y: drag.boxY + ((event.clientY - drag.pointerY) / rect.height) * 100,
              }),
            );
          }}
          onPointerUp={() => {
            dragRef.current = null;
          }}
          onPointerCancel={() => {
            dragRef.current = null;
          }}
          onLostPointerCapture={() => {
            dragRef.current = null;
          }}
          onKeyDown={(event) => {
            if (['+', '=', '-', '_'].includes(event.key)) {
              event.preventDefault();
              const delta = (event.key === '+' || event.key === '=' ? 1 : -1) * (event.shiftKey ? 3 : 1);
              onChange(place({ ...box, size: clamp(box.size + delta, MIN_SIZE, MAX_SIZE) }));
              return;
            }
            const step = event.shiftKey ? 2 : 0.5;
            const moves: Record<string, [number, number]> = {
              ArrowLeft: [-step, 0],
              ArrowRight: [step, 0],
              ArrowUp: [0, -step],
              ArrowDown: [0, step],
            };
            const move = moves[event.key];
            if (!move) return;
            event.preventDefault();
            onChange(place({ size: box.size, x: box.x + move[0], y: box.y + move[1] }));
          }}
        >
          <QrCode className="h-1/2 w-1/2" aria-hidden />

          {/* Resize: drag the corner. The box stays square and inside the artwork. */}
          <span
            role="presentation"
            aria-hidden
            title="Drag to resize"
            className="absolute bottom-0 right-0 h-6 w-6 cursor-nwse-resize rounded-tl-lg bg-indigo-600"
            style={{ touchAction: 'none' }}
            onPointerDown={(event) => {
              event.stopPropagation();
              event.currentTarget.setPointerCapture(event.pointerId);
              resizeRef.current = true;
            }}
            onPointerMove={(event) => {
              if (!resizeRef.current) return;
              event.stopPropagation();
              if (event.buttons === 0) {
                resizeRef.current = false;
                return;
              }
              const rect = wrapRef.current?.getBoundingClientRect();
              if (!rect || !natural) return;
              // Pointer position from the box's top-left corner, in % of the artwork, back to a "size".
              const widthPct = ((event.clientX - rect.left) / rect.width) * 100 - box.x;
              const heightPct = ((event.clientY - rect.top) / rect.height) * 100 - box.y;
              const wanted = Math.max((widthPct * natural.width) / shorter, (heightPct * natural.height) / shorter);
              const fits = Math.min(
                MAX_SIZE,
                ((100 - box.x) * natural.width) / shorter,
                ((100 - box.y) * natural.height) / shorter,
              );
              onChange({ ...box, size: round1(clamp(wanted, MIN_SIZE, Math.max(MIN_SIZE, fits))) });
            }}
            onPointerUp={() => {
              resizeRef.current = false;
            }}
            onPointerCancel={() => {
              resizeRef.current = false;
            }}
            onLostPointerCapture={() => {
              resizeRef.current = false;
            }}
          />
        </div>
      </div>

      <label className="mt-2 flex items-center gap-3 text-xs font-medium text-slate-600 dark:text-slate-400">
        Size {Math.round(box.size)}%
        <input
          type="range"
          min={MIN_SIZE}
          max={MAX_SIZE}
          step={0.5}
          value={box.size}
          onChange={(event) => onChange(place({ ...box, size: Number(event.target.value) }))}
          className="flex-1"
          aria-label="QR code size"
        />
      </label>
    </div>
  );
}

export type QrDetectState = 'idle' | 'detecting' | 'found' | 'none';

const pill =
  'rounded-lg border px-2.5 py-1 text-[11px] font-medium border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400';
const pillActive =
  'rounded-lg border px-2.5 py-1 text-[11px] font-medium border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-500/40 dark:bg-indigo-500/15 dark:text-indigo-300';

/**
 * "QR code position on your design": found automatically when the artwork already has a QR,
 * otherwise the organizer picks a spot or places the box themselves.
 */
export function TicketQrPlacementPanel({
  image,
  placements,
  placement,
  onPlacement,
  box,
  onBox,
  detect,
  onRedetect,
}: {
  /** Resolved URL of the uploaded artwork. */
  image: string;
  placements: ReadonlyArray<{ value: TicketQrPlacement; label: string }>;
  placement: TicketQrPlacement;
  onPlacement: (placement: TicketQrPlacement) => void;
  box: TicketQrBox | null;
  onBox: (box: TicketQrBox | null) => void;
  detect: QrDetectState;
  onRedetect: () => void;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="mt-2">
      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">QR code position on your design</span>

      {detect === 'detecting' ? (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Looking for a QR code in your design…</p>
      ) : null}

      {box ? (
        <>
          <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
            {detect === 'found'
              ? 'We found a QR code in your design. The real check-in QR will be placed exactly there, at the same size, replacing it, so printed tickets still scan.'
              : 'QR position set by you. The real check-in QR is placed exactly there.'}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setEditing((value) => !value)} className={editing ? pillActive : pill}>
              {editing ? 'Done' : 'Adjust'}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                onBox(null);
              }}
              className={pill}
            >
              Use a preset spot instead
            </button>
            <button type="button" onClick={onRedetect} disabled={detect === 'detecting'} className={pill}>
              Detect again
            </button>
          </div>
        </>
      ) : (
        <>
          {detect === 'none' ? (
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
              We couldn&apos;t find a QR code in your design that we can match. Choose a spot, or place it yourself.
            </p>
          ) : null}
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {placements.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => onPlacement(item.value)}
                className={placement === item.value ? pillActive : pill}
              >
                {item.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                onBox(boxForPlacement(placement));
                setEditing(true);
              }}
              className={pill}
            >
              Place it myself
            </button>
            <button type="button" onClick={onRedetect} disabled={detect === 'detecting'} className={pill}>
              Detect automatically
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Leave a clear area for the QR. It&apos;s drawn on a white card so it scans on any artwork.
          </p>
        </>
      )}

      {box && editing ? (
        <div className="mt-2">
          <TicketQrBoxEditor image={image} box={box} onChange={onBox} />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Drag the box over the spot reserved for the QR (or over the QR printed in your design). Drag the corner, use the slider, or press + and − to resize it. Keep it large enough to scan when printed.
          </p>
        </div>
      ) : null}
    </div>
  );
}