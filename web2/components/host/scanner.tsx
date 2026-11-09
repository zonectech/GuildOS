'use client';
import { useEffect, useRef, useState } from 'react';
import * as m from 'motion/react-m';
import { AnimatePresence } from 'motion/react';
import { CameraOff, CircleAlert, CircleCheck, Keyboard, RotateCcw } from 'lucide-react';
import { scan, type ScanResult } from '@/lib/api/host';
import { spring } from '@/lib/motion';
import { Btn } from '@/components/ui/bits';

type Detector = { detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
type Shown = ScanResult | { kind: 'camera'; message: string } | null;

/**
 * The door scanner: camera QR scanning where the browser supports it, manual code entry always.
 * States: success (green), already checked in (gold), invalid (coral), camera unavailable.
 */
export function Scanner({ eventId, mode, onScanned }: { eventId: string; mode: 'in' | 'out'; onScanned: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [shown, setShown] = useState<Shown>(null);
  const [code, setCode] = useState('');
  const [camera, setCamera] = useState<'starting' | 'on' | 'off'>('starting');
  const busy = useRef(false);
  const last = useRef({ value: '', at: 0 });

  async function submit(value: string) {
    const v = value.trim();
    if (!v || busy.current) return;
    if (last.current.value === v && Date.now() - last.current.at < 4000) return; // the same pass held in front of the camera
    last.current = { value: v, at: Date.now() };
    busy.current = true;
    const r = await scan(eventId, mode, v);
    busy.current = false;
    setShown(r);
    if (navigator.vibrate) navigator.vibrate(r.kind === 'ok' ? 18 : [30, 60, 30]);
    if (r.kind === 'ok') { setCode(''); onScanned(); }
  }

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
    (async () => {
      if (!BD || !navigator.mediaDevices?.getUserMedia) { setCamera('off'); setShown({ kind: 'camera', message: 'This browser can’t scan QR codes. Type the code from the student’s pass instead.' }); return; }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (stopped || !video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        setCamera('on');
        const detector = new BD({ formats: ['qr_code'] });
        const loop = async () => {
          if (stopped || !video.current) return;
          if (document.visibilityState === 'visible') {
            const found = await detector.detect(video.current).catch(() => []);
            if (found[0]?.rawValue) await submit(found[0].rawValue);
          }
          raf = window.setTimeout(loop, 350);
        };
        void loop();
      } catch {
        setCamera('off');
        setShown({ kind: 'camera', message: 'Camera unavailable. Allow camera access in your browser settings, or type the code.' });
      }
    })();
    return () => { stopped = true; clearTimeout(raf); stream?.getTracks().forEach((t) => t.stop()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, mode]);

  const tone = !shown ? '' : shown.kind === 'ok' ? 'bg-green text-white' : shown.kind === 'already' ? 'bg-gold text-[#111714]' : 'bg-coral text-[#111714]';
  return (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-[4/3] overflow-hidden rounded-[24px] bg-[#0d1210]">
        <video ref={video} muted playsInline className={`size-full object-cover ${camera === 'on' ? '' : 'hidden'}`} />
        {camera !== 'on' ? <span className="absolute inset-0 grid place-items-center text-white/70">{camera === 'starting' ? 'Starting camera…' : <CameraOff size={40} />}</span> : null}
        {camera === 'on' ? <span aria-hidden className="absolute inset-[18%] rounded-[22px] border-[3px] border-white/80 shadow-[0_0_0_999px_rgb(0_0_0/.35)]" /> : null}
        <AnimatePresence>
          {shown && shown.kind !== 'camera' ? (
            <m.div key={`${shown.kind}-${last.current.at}`} role="status" initial={{ y: 40, opacity: 0, scale: 0.96 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={spring.bouncy}
              className={`absolute inset-x-3 bottom-3 flex items-center gap-3 rounded-2xl px-4 py-3 font-bold ${tone}`}>
              {shown.kind === 'ok' ? <CircleCheck size={24} /> : <CircleAlert size={24} />}
              <span className="min-w-0">{shown.kind === 'ok' ? <>{shown.name} · {mode === 'in' ? 'checked in' : 'checked out'}</> : shown.message}</span>
            </m.div>
          ) : null}
        </AnimatePresence>
      </div>
      {shown?.kind === 'camera' ? <p className="flex items-start gap-2 rounded-2xl bg-mist p-3 text-[14px]"><CameraOff size={17} className="mt-0.5 shrink-0" />{shown.message}</p> : null}
      <form onSubmit={(e) => { e.preventDefault(); last.current = { value: '', at: 0 }; void submit(code); }} className="flex gap-2">
        <label className="flex h-12 flex-1 items-center gap-2 rounded-2xl border border-line bg-surface px-3.5 focus-within:border-green-text">
          <Keyboard size={17} className="text-muted" /><input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Type a pass code" aria-label="Pass code" autoCapitalize="characters" className="w-full bg-transparent text-[16px] font-semibold tracking-wider outline-none" />
        </label>
        <Btn type="submit" disabled={!code.trim()}>{mode === 'in' ? 'Check in' : 'Check out'}</Btn>
      </form>
      {shown && shown.kind !== 'ok' && shown.kind !== 'camera' ? <button type="button" onClick={() => setShown(null)} className="inline-flex w-fit items-center gap-1.5 text-[13.5px] font-semibold text-muted"><RotateCcw size={14} />Clear</button> : null}
    </div>
  );
}
