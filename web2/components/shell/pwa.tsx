'use client';
import { useEffect, useRef, useState } from 'react';
import { Download, RefreshCw, Share, X } from 'lucide-react';
import { useSession } from '@/lib/session';
import { savedGoing } from '@/lib/offline';
import { Btn } from '@/components/ui/bits';

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

const INSTALL_KEY = 'otr-install';
const DAY = 86_400_000;
type InstallMemory = { dismissed: number; at: number; installed?: boolean };
const memory = (): InstallMemory => { try { return JSON.parse(localStorage.getItem(INSTALL_KEY) ?? '') as InstallMemory; } catch { return { dismissed: 0, at: 0 }; } };
const remember = (m: InstallMemory) => { try { localStorage.setItem(INSTALL_KEY, JSON.stringify(m)); } catch { /* storage blocked: it may ask again next visit */ } };
const standalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/**
 * The installable-app parts: registers the service worker (production builds only), says when a new
 * version is ready, and offers installing, without nagging:
 * - only to a signed-in student who holds at least one pass (the moment it is useful: the pass opens
 *   with no signal);
 * - at most once per visit; "Not now" waits 30 days; after two "Not now"s, never again;
 * - never once installed, or when already running as the app.
 * iPhones have no install prompt, so they get the two taps to do it (Share, Add to Home Screen).
 */
export function Pwa() {
  const { user } = useSession();
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [offer, setOffer] = useState<'prompt' | 'ios' | null>(null);
  const refreshing = useRef(false);

  // Service worker and updates.
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    let reg: ServiceWorkerRegistration | undefined;
    const watch = (r: ServiceWorkerRegistration) => {
      if (r.waiting && navigator.serviceWorker.controller) setWaiting(r.waiting);
      r.addEventListener('updatefound', () => {
        const next = r.installing;
        next?.addEventListener('statechange', () => { if (next.state === 'installed' && navigator.serviceWorker.controller) setWaiting(next); });
      });
    };
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).then((r) => { reg = r; watch(r); }).catch(() => undefined);
    // Reload once the new version has taken over, but only when you asked for it (not on first install).
    const onChange = () => { if (refreshing.current) window.location.reload(); };
    navigator.serviceWorker.addEventListener('controllerchange', onChange);
    // Look for a new version when you come back to the tab, and every 30 minutes.
    const check = () => { if (document.visibilityState === 'visible') void reg?.update().catch(() => undefined); };
    document.addEventListener('visibilitychange', check);
    const t = setInterval(check, 30 * 60_000);
    return () => { navigator.serviceWorker.removeEventListener('controllerchange', onChange); document.removeEventListener('visibilitychange', check); clearInterval(t); };
  }, []);

  // The browser's install prompt (Android, desktop Chrome and Edge): kept for when it is useful.
  useEffect(() => {
    const keep = (e: Event) => { e.preventDefault(); setPrompt(e as InstallPrompt); };
    const done = () => { remember({ ...memory(), installed: true }); setOffer(null); };
    window.addEventListener('beforeinstallprompt', keep);
    window.addEventListener('appinstalled', done);
    return () => { window.removeEventListener('beforeinstallprompt', keep); window.removeEventListener('appinstalled', done); };
  }, []);

  // Whether to offer, a few seconds after the page settles.
  useEffect(() => {
    if (!user || standalone()) { setOffer(null); return; }
    const m = memory();
    if (m.installed || m.dismissed >= 2 || (m.at && Date.now() - m.at < 30 * DAY)) return;
    if (!savedGoing(user.id).going?.some((r) => r.pass)) return;
    const t = setTimeout(() => setOffer(prompt ? 'prompt' : isIos() ? 'ios' : null), 4000);
    return () => clearTimeout(t);
  }, [user, prompt]);

  const notNow = () => { const m = memory(); remember({ dismissed: m.dismissed + 1, at: Date.now() }); setOffer(null); };
  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') remember({ ...memory(), installed: true }); else notNow();
    setPrompt(null); setOffer(null);
  };
  const refresh = () => { refreshing.current = true; waiting?.postMessage({ type: 'SKIP_WAITING' }); };

  const place = 'fixed inset-x-3 z-[90] mx-auto max-w-md bottom-[calc(100px+env(safe-area-inset-bottom))] lg:bottom-6 lg:right-6 lg:left-auto';
  if (waiting) {
    return (
      <div role="status" className={`${place} flex items-center justify-between gap-3 rounded-2xl bg-ink px-4 py-3 text-paper shadow-lift`}>
        <span className="flex items-center gap-2 text-[14.5px] font-semibold"><RefreshCw size={16} />New version available</span>
        <button type="button" onClick={refresh} className="rounded-xl bg-paper px-3.5 py-1.5 text-[14px] font-bold text-ink">Refresh</button>
      </div>
    );
  }
  if (!offer) return null;
  return (
    <div role="dialog" aria-label="Install OnTheRoll" className={`${place} flex flex-col gap-3 rounded-2xl border border-line bg-raised p-4 shadow-lift`}>
      <div className="flex items-start gap-3">
        <img src="/icons/icon-192.png" alt="" width={44} height={44} className="size-11 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <b className="block text-[15.5px]">Add OnTheRoll to your home screen</b>
          <span className="text-[14px] text-muted">
            {offer === 'ios'
              ? <>Your pass then opens even with no signal. Tap <Share size={14} className="inline align-[-2px]" aria-label="Share" /> Share, then <b>Add to Home Screen</b>.</>
              : 'Your pass then opens in one tap, even with no signal.'}
          </span>
        </div>
        <button type="button" onClick={notNow} aria-label="Not now" className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-mist"><X size={16} /></button>
      </div>
      {offer === 'prompt' ? (
        <div className="flex gap-2">
          <Btn size="sm" onClick={() => void install()}><Download size={15} />Install</Btn>
          <Btn size="sm" kind="secondary" onClick={notNow}>Not now</Btn>
        </div>
      ) : null}
    </div>
  );
}
