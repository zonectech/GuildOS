'use client';

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { syncPushSubscription } from './push-client';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISS_KEY = 'guildos-install-dismissed';

/**
 * PWA plumbing mounted once in the root layout:
 * - registers the service worker
 * - re-syncs an existing push subscription with the backend
 * - shows a dismissable "Install GuildOS" banner when the browser offers install
 */
export function PwaProvider() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    void syncPushSubscription();
  }, []);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      try {
        if (window.localStorage.getItem(DISMISS_KEY)) return;
      } catch {
        /* storage unavailable */
      }
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstallEvent(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!installEvent) return null;

  const install = async () => {
    const ev = installEvent;
    setInstallEvent(null);
    try {
      await ev.prompt();
      await ev.userChoice;
    } catch {
      /* user dismissed the native prompt */
    }
  };

  const dismiss = () => {
    setInstallEvent(null);
    try {
      window.localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* storage unavailable */
    }
  };

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl sm:inset-x-auto sm:right-4 sm:bottom-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white">
        <Download className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900">Install GuildOS</p>
        <p className="text-xs text-slate-500">Add it to your home screen for quick access and notifications.</p>
      </div>
      <button
        type="button"
        onClick={install}
        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
      >
        Install
      </button>
      <button type="button" onClick={dismiss} aria-label="Dismiss" className="rounded-lg p-1 text-slate-400 hover:text-slate-600">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
