'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as m from 'motion/react-m';
import { AnimatePresence } from 'motion/react';
import { CameraOff, CircleAlert, CircleCheck, CloudOff, Keyboard, RefreshCw, RotateCcw, Wifi } from 'lucide-react';
import { scan } from '@/lib/api/host';
import { markScanned, pendingCount, readDoor, refreshRoster, scanOffline, syncDoor } from '@/lib/door';
import { fmtTime } from '@/lib/format';
import { spring } from '@/lib/motion';
import { Btn } from '@/components/ui/bits';
import { useToast } from '@/components/ui/toast';

type Detector = { detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
/** What the last scan showed. `saved` marks a scan checked against the saved list while offline. */
type Shown =
  | { kind: 'ok'; name: string; saved?: boolean }
  | { kind: 'already'; message: string }
  | { kind: 'invalid'; message: string }
  | { kind: 'unverified'; message: string }
  | { kind: 'camera'; message: string }
  | null;

/**
 * The door scanner. Camera scanning uses the browser's own QR detector where there is one, and a
 * small JavaScript reader (loaded only then) everywhere else, such as iPhones and Firefox. A typed
 * pass code always works.
 *
 * With no connection it keeps working: passes are checked against the attendee list saved on this
 * device, queued, and sent as soon as the connection is back ("3 waiting to sync").
 */
export function Scanner({ eventId, mode, onScanned }: { eventId: string; mode: 'in' | 'out'; onScanned: () => void }) {
  const toast = useToast();
  const video = useRef<HTMLVideoElement>(null);
  const [shown, setShown] = useState<Shown>(null);
  const [code, setCode] = useState('');
  const [camera, setCamera] = useState<'starting' | 'on' | 'off'>('starting');
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [list, setList] = useState<{ count: number; savedAt: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [problems, setProblems] = useState<{ name: string; message: string }[]>([]);
  const busy = useRef(false);
  const last = useRef({ value: '', at: 0 });
  const tick = useRef(0);

  const readSaved = useCallback(() => {
    const saved = readDoor(eventId);
    setPending(saved.queue.length);
    setList(saved.roster ? { count: saved.roster.entries.length, savedAt: saved.roster.generatedAt } : null);
  }, [eventId]);

  const sync = useCallback(async () => {
    if (!pendingCount(eventId) || busy.current) return;
    setSyncing(true);
    const r = await syncDoor(eventId);
    setSyncing(false);
    if (!r) { setOnline(false); readSaved(); return; }
    setOnline(true);
    const ok = r.results.filter((x) => x.kind === 'ok').length;
    const already = r.results.filter((x) => x.kind === 'already').length;
    const bad = r.results.filter((x) => x.kind === 'invalid');
    if (r.results.length) toast(`${ok} scan${ok === 1 ? '' : 's'} synced${already ? ` · ${already} already recorded` : ''}${bad.length ? ` · ${bad.length} not recorded` : ''}`, <RefreshCw size={16} className="text-green-text" />);
    if (bad.length) setProblems((p) => [...bad.map((b) => ({ name: b.name || 'Unknown pass', message: b.message })), ...p].slice(0, 20));
    await refreshRoster(eventId);
    readSaved();
    onScanned();
  }, [eventId, readSaved, toast, onScanned]);

  // The saved list: on open, then every 5 minutes; the queue: on open, on reconnect, and every 20 seconds.
  useEffect(() => {
    readSaved();
    setOnline(navigator.onLine);
    void refreshRoster(eventId).then((r) => { if (r) setOnline(true); readSaved(); }).then(sync);
    const goOnline = () => { setOnline(true); void sync(); };
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline); window.addEventListener('offline', goOffline);
    const id = window.setInterval(() => {
      tick.current += 1;
      if (pendingCount(eventId)) void sync();
      if (tick.current % 15 === 0 && navigator.onLine) void refreshRoster(eventId).then(readSaved);
    }, 20_000);
    return () => { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline); clearInterval(id); };
  }, [eventId, readSaved, sync]);

  async function submit(value: string) {
    const v = value.trim();
    if (!v || busy.current) return;
    if (last.current.value === v && Date.now() - last.current.at < 4000) return; // the same pass held in front of the camera
    last.current = { value: v, at: Date.now() };
    busy.current = true;
    let next: Shown;
    const r = navigator.onLine ? await scan(eventId, mode, v) : ({ kind: 'offline' } as const);
    if (r.kind === 'offline') {
      setOnline(false);
      const o = await scanOffline(eventId, mode, v);
      next = o.kind === 'ok' ? { kind: 'ok', name: o.name, saved: true }
        : o.kind === 'already' ? { kind: 'already', message: o.message }
        : { kind: 'unverified', message: o.message };
    } else {
      setOnline(true);
      next = r.kind === 'ok' ? { kind: 'ok', name: r.name } : r;
      if (r.kind === 'ok') void markScanned(eventId, mode, v);
    }
    busy.current = false;
    readSaved();
    setShown(next);
    if (navigator.vibrate) navigator.vibrate(next?.kind === 'ok' ? 18 : [30, 60, 30]);
    if (next?.kind === 'ok') { setCode(''); onScanned(); }
    else if (next?.kind === 'unverified') setCode('');
  }

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer = 0;
    let stopped = false;
    const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) { setCamera('off'); setShown({ kind: 'camera', message: 'This browser can’t use the camera. Type the code from the student’s pass instead.' }); return; }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (stopped || !video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        setCamera('on');
        // The browser's own QR detector where there is one; otherwise a JavaScript reader, loaded only now.
        let read: (v: HTMLVideoElement) => Promise<string>;
        if (BD) {
          const detector = new BD({ formats: ['qr_code'] });
          read = async (v) => (await detector.detect(v).catch(() => []))[0]?.rawValue ?? '';
        } else {
          const jsQR = (await import('jsqr')).default;
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          read = async (v) => {
            if (!ctx || !v.videoWidth) return '';
            const scale = Math.min(1, 640 / v.videoWidth);
            canvas.width = Math.round(v.videoWidth * scale); canvas.height = Math.round(v.videoHeight * scale);
            ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            return jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })?.data ?? '';
          };
        }
        const loop = async () => {
          if (stopped || !video.current) return;
          if (document.visibilityState === 'visible') {
            const found = await read(video.current);
            if (found) await submit(found);
          }
          timer = window.setTimeout(loop, 300);
        };
        void loop();
      } catch {
        setCamera('off');
        setShown({ kind: 'camera', message: 'Camera unavailable. Allow camera access in your browser settings, or type the code.' });
      }
    })();
    return () => { stopped = true; clearTimeout(timer); stream?.getTracks().forEach((t) => t.stop()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, mode]);

  const tone = !shown ? '' : shown.kind === 'ok' ? 'bg-green text-white' : shown.kind === 'already' || shown.kind === 'unverified' ? 'bg-gold text-[#111714]' : 'bg-coral text-[#111714]';
  const verb = mode === 'in' ? 'checked in' : 'checked out';
  return (
    <div className="flex flex-col gap-4">
      {/* Connection and queue: always visible, so the door crew knows whether scans are reaching the server. */}
      <div role="status" className={`flex flex-wrap items-center justify-between gap-2 rounded-2xl px-4 py-2.5 text-[13.5px] font-semibold ${online ? 'bg-mist' : 'bg-[color-mix(in_srgb,var(--gold)_30%,var(--surface))]'}`}>
        <span className="flex items-center gap-2">
          {online ? <Wifi size={16} className="text-green-text" /> : <CloudOff size={16} />}
          {online ? 'Online' : 'Offline · scans are saved on this device'}
          {list ? <span className="font-medium text-muted">· list saved {fmtTime(list.savedAt)} · {list.count} {list.count === 1 ? 'person' : 'people'}</span> : <span className="font-medium text-muted">· no saved list yet</span>}
        </span>
        {pending ? (
          <span className="flex items-center gap-2">
            <b className="tabular-nums">{pending} waiting to sync</b>
            {online ? <button type="button" onClick={() => void sync()} disabled={syncing} className="rounded-lg border border-line bg-surface px-2.5 py-1 text-[12.5px] disabled:opacity-60">{syncing ? 'Syncing…' : 'Sync now'}</button> : null}
          </span>
        ) : null}
      </div>

      <div className="relative aspect-[4/3] overflow-hidden rounded-[24px] bg-[#0d1210]">
        <video ref={video} muted playsInline className={`size-full object-cover ${camera === 'on' ? '' : 'hidden'}`} />
        {camera !== 'on' ? <span className="absolute inset-0 grid place-items-center text-white/70">{camera === 'starting' ? 'Starting camera…' : <CameraOff size={40} />}</span> : null}
        {camera === 'on' ? <span aria-hidden className="absolute inset-[18%] rounded-[22px] border-[3px] border-white/80 shadow-[0_0_0_999px_rgb(0_0_0/.35)]" /> : null}
        <AnimatePresence>
          {shown && shown.kind !== 'camera' ? (
            <m.div key={`${shown.kind}-${last.current.at}`} role="status" initial={{ y: 40, opacity: 0, scale: 0.96 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={spring.bouncy}
              className={`absolute inset-x-3 bottom-3 flex items-center gap-3 rounded-2xl px-4 py-3 font-bold ${tone}`}>
              {shown.kind === 'ok' ? <CircleCheck size={24} /> : <CircleAlert size={24} />}
              <span className="min-w-0">
                {shown.kind === 'ok' ? <>{shown.name} · {verb}{shown.saved ? <span className="block text-[12.5px] font-semibold opacity-90">Saved offline · will sync</span> : null}</> : shown.message}
              </span>
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
      {problems.length ? (
        <div className="rounded-2xl border border-line p-3 text-[13.5px]">
          <b className="block">Scans that could not be recorded</b>
          <ul className="mt-1.5 flex flex-col gap-1">{problems.map((p, i) => <li key={i}><b>{p.name}</b>: {p.message}</li>)}</ul>
          <button type="button" onClick={() => setProblems([])} className="mt-2 text-[12.5px] font-semibold text-muted">Dismiss</button>
        </div>
      ) : null}
    </div>
  );
}
