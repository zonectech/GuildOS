'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { MessageSquare, X } from 'lucide-react';

import { getCurrentUser } from './auth-api';
import { resolveMessageAvatar } from './message-api';
import { onRealtime } from './realtime';

type Toast = {
  id: number;
  name: string;
  avatar: string;
  preview: string;
};

const AUTH_RECHECK_MS = 60_000;

/**
 * Watches for newly received messages while the app is open. When the unread
 * message count grows and the user is NOT inside the inbox, a toast is shown
 * that links to the inbox. Inside the inbox nothing pops up (messages update
 * live there), and offline users simply see the persisted bell notification.
 */
export function MessageToaster() {
  const router = useRouter();
  const pathname = usePathname();
  const [authed, setAuthed] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const myIdRef = useRef('');
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    (name: string, avatar: string, preview: string) => {
      const id = Date.now() + Math.random();
      setToasts((list) => [...list, { id, name: name || 'Someone', avatar, preview: preview || 'You have a new message' }]);
      setTimeout(() => dismiss(id), 7000);
    },
    [dismiss],
  );

  // Only poll when there is an authenticated session.
  useEffect(() => {
    let cancelled = false;
    const check = () => {
      void getCurrentUser()
        .then((u) => {
          if (cancelled) return;
          setAuthed(Boolean(u));
          myIdRef.current = u?.id ?? '';
        })
        .catch(() => {
          if (!cancelled) setAuthed(false);
        });
    };
    check();
    const timer = setInterval(check, AUTH_RECHECK_MS);
    window.addEventListener('focus', check);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener('focus', check);
    };
  }, []);

  useEffect(() => {
    if (!authed) return;
    const off = onRealtime((evt) => {
      if (evt.type !== 'message') return;
      if (evt.message.senderId === myIdRef.current) return; // ignore my own sends
      if (pathRef.current.startsWith('/messages')) return; // already in the inbox
      pushToast(evt.actor.fullName, evt.actor.avatar, evt.message.content);
    });
    return off;
  }, [authed, pushToast]);

  if (!toasts.length) return null;

  return (
    <div className="pointer-events-none fixed bottom-24 right-4 z-[100] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2">
      {toasts.map((t) => {
        const src = resolveMessageAvatar(t.avatar);
        return (
          <div
            key={t.id}
            className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-lg"
          >
            <button
              onClick={() => {
                dismiss(t.id);
                router.push('/messages');
              }}
              className="flex min-w-0 flex-1 items-start gap-3 text-left"
            >
              {src ? (
                <img src={src} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
              ) : (
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-indigo-100 text-indigo-600">
                  <MessageSquare className="h-5 w-5" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{t.name}</p>
                <p className="truncate text-xs text-slate-500">{t.preview}</p>
                <span className="mt-0.5 inline-block text-xs font-medium text-indigo-600">Open inbox →</span>
              </div>
            </button>
            <button
              onClick={() => dismiss(t.id)}
              className="shrink-0 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
