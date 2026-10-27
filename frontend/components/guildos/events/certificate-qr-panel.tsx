'use client';

// Save as: components/guildos/events/certificate-qr-panel.tsx
import { useEffect, useState } from 'react';

import { TICKET_QR_PLACEMENTS } from '../event-api';
import type { TicketQrBox } from '../ticket-canvas';
import { imageSize, presetQrBox } from './qr-detect';
import { TicketQrBoxEditor, type QrDetectState } from './ticket-qr-box-editor';

const pill =
  'rounded-lg border px-2.5 py-1 text-[11px] font-medium border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400';
const pillActive =
  'rounded-lg border px-2.5 py-1 text-[11px] font-medium border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-500/40 dark:bg-indigo-500/15 dark:text-indigo-300';

/**
 * "Verification QR on your certificate": found automatically when the design already has a QR
 * (the real one is placed exactly there), added at the bottom right when it has none, and always
 * movable, resizable or removable. Scanning it opens the certificate's verification page.
 */
export function CertificateQrPanel({
  image,
  box,
  onBox,
  detect,
  onRedetect,
}: {
  /** Resolved URL of the uploaded design. */
  image: string;
  box: TicketQrBox | null;
  onBox: (box: TicketQrBox | null) => void;
  detect: QrDetectState;
  onRedetect: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    let alive = true;
    void imageSize(image).then((value) => {
      if (alive) setSize(value);
    });
    return () => {
      alive = false;
    };
  }, [image]);

  const fallbackBox: TicketQrBox = size ? presetQrBox('BOTTOM_RIGHT', size) : { x: 80, y: 76, size: 14 };

  return (
    <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Verification QR</p>

      {detect === 'detecting' ? (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Looking for a QR code in your design…</p>
      ) : null}

      {box ? (
        <>
          <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
            {detect === 'found'
              ? 'We found a QR code in your design. The verification QR will be placed exactly there, at the same size, replacing it, so printed certificates can still be scanned and verified.'
              : detect === 'none'
                ? "We couldn't find a QR code in your design, so we added a verification QR at the bottom right. Drag it anywhere, resize it, or remove it."
                : "Verification QR set. Scanning it opens this certificate's verification page, with the certificate ID shown beside it."}
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
              Remove QR
            </button>
            <button type="button" onClick={onRedetect} disabled={detect === 'detecting'} className={pill}>
              Detect again
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
            {detect === 'none'
              ? "We couldn't find a QR code in your design. "
              : ''}
            Without a QR, a printed certificate can&apos;t be verified by scanning it.
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {TICKET_QR_PLACEMENTS.map((item) => (
              <button
                key={item.value}
                type="button"
                disabled={!size}
                onClick={() => size && onBox(presetQrBox(item.value, size))}
                className={pill}
              >
                {item.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                onBox(fallbackBox);
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
        </>
      )}

      {box && editing ? (
        <div className="mt-2">
          <TicketQrBoxEditor image={image} box={box} onChange={onBox} />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Drag the box to move it. Drag the corner, use the slider, or press + and − to resize. Keep it large enough to scan when printed.
          </p>
        </div>
      ) : null}
    </div>
  );
}