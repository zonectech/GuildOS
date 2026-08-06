'use client';

import { useEffect, useRef, useState } from 'react';

export function QrScanner({ onResult, onClose }: { onResult: (value: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    const AnyWindow = window as unknown as {
      BarcodeDetector?: new (opts: { formats: string[] }) => { detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>> };
    };

    if (!AnyWindow.BarcodeDetector) {
      setErr('Camera scanning is not supported in this browser. Enter the code manually.');
      return;
    }
    const detector = new AnyWindow.BarcodeDetector({ formats: ['qr_code'] });

    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        const tick = async () => {
          if (stopped || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes && codes.length && codes[0].rawValue) {
              onResult(codes[0].rawValue);
              return;
            }
          } catch {
            /* ignore per-frame detection errors */
          }
          raf = requestAnimationFrame(() => void tick());
        };
        raf = requestAnimationFrame(() => void tick());
      } catch {
        setErr('Unable to access the camera. Enter the code manually.');
      }
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [onResult]);

  return (
    <div className="mt-4">
      {err ? (
        <p className="text-sm text-amber-700">{err}</p>
      ) : (
        <video ref={videoRef} className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800" muted playsInline />
      )}
      <button onClick={onClose} className="mt-2 block text-sm text-slate-500 dark:text-slate-400 underline">Close scanner</button>
    </div>
  );
}

export function playSuccessFeedback() {
  try {
    (navigator as Navigator & { vibrate?: (p: number) => boolean }).vibrate?.(120);
  } catch {
    /* vibration unsupported */
  }
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.start();
    osc.stop(ctx.currentTime + 0.26);
    osc.onended = () => void ctx.close();
  } catch {
    /* audio unsupported */
  }
}
