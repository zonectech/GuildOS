'use client';
import { useEffect, useRef, useState } from 'react';

type Detector = { detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>> };

/**
 * Reads QR passes from the back camera. Uses the browser's own detector where it exists
 * (Chrome and Edge on Android) and jsQR everywhere else, so iPhones work too.
 * Pauses briefly after each read so one pass is not scanned twice.
 */
export function QrCamera({ onRead, paused }: { onRead: (value: string) => void; paused?: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const readRef = useRef(onRead);
  readRef.current = onRead;

  useEffect(() => {
    let stream: MediaStream | null = null;
    let frame = 0;
    let stopped = false;
    let last = '';
    let lastAt = 0;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const Native = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
    const native = Native ? new Native({ formats: ['qr_code'] }) : null;

    async function read(el: HTMLVideoElement): Promise<string> {
      if (native) {
        const codes = await native.detect(el).catch(() => []);
        return codes[0]?.rawValue ?? '';
      }
      if (!ctx || !el.videoWidth) return '';
      canvas.width = el.videoWidth;
      canvas.height = el.videoHeight;
      ctx.drawImage(el, 0, 0);
      const { default: jsQR } = await import('jsqr');
      return jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height)?.data ?? '';
    }

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        const el = video.current;
        if (!el || stopped) return;
        el.srcObject = stream;
        await el.play();
        const tick = async () => {
          if (stopped) return;
          if (!pausedRef.current) {
            const value = await read(el);
            const now = Date.now();
            if (value && (value !== last || now - lastAt > 4000)) { last = value; lastAt = now; readRef.current(value); }
          }
          frame = window.setTimeout(() => void tick(), 250);
        };
        void tick();
      } catch {
        setError('The camera could not start. Allow camera access, or type the pass code below.');
      }
    })();

    return () => { stopped = true; clearTimeout(frame); stream?.getTracks().forEach((t) => t.stop()); };
  }, []);

  return (
    <div className="cam">
      {error ? <p className="small" style={{ color: '#F2B654', padding: 16, textAlign: 'center' }}>{error}</p> : <video ref={video} muted playsInline />}
      <i className="c1" /><i className="c2" /><i className="c3" /><i className="c4" />
    </div>
  );
}

/** A short buzz and beep so the person at the door knows the scan worked without looking. */
export function scanFeedback(ok: boolean) {
  try { navigator.vibrate?.(ok ? 120 : [80, 60, 80]); } catch { /* not supported */ }
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = ok ? 880 : 220;
    osc.connect(gain); gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.start(); osc.stop(ctx.currentTime + 0.26);
    osc.onended = () => void ctx.close();
  } catch { /* audio blocked */ }
}
