'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';

export type ToastKind = 'success' | 'error' | 'info' | 'warning';

export type ToastItem = {
  id: number;
  kind: ToastKind;
  title: string;
  description?: string;
  duration: number;
};

type Listener = (toast: ToastItem) => void;
const listeners = new Set<Listener>();

function emit(kind: ToastKind, title: string, description?: string, duration = 4500) {
  const item: ToastItem = { id: Date.now() + Math.random(), kind, title, description, duration };
  listeners.forEach((l) => l(item));
  return item.id;
}

/** Imperative toast API — callable from any client component. */
export const toast = {
  success: (title: string, description?: string) => emit('success', title, description),
  error: (title: string, description?: string) => emit('error', title, description, 6000),
  info: (title: string, description?: string) => emit('info', title, description),
  warning: (title: string, description?: string) => emit('warning', title, description),
};

const STYLES: Record<ToastKind, { ring: string; icon: JSX.Element }> = {
  success: { ring: 'border-emerald-200', icon: <CheckCircle2 className="h-5 w-5 text-emerald-600" /> },
  error: { ring: 'border-rose-200', icon: <XCircle className="h-5 w-5 text-rose-600" /> },
  info: { ring: 'border-indigo-200', icon: <Info className="h-5 w-5 text-indigo-600" /> },
  warning: { ring: 'border-amber-200', icon: <AlertTriangle className="h-5 w-5 text-amber-600" /> },
};

/** Global toast host. Mount once near the app root. */
export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const listener: Listener = (item) => {
      setItems((list) => [...list, item]);
      window.setTimeout(() => {
        setItems((list) => list.filter((t) => t.id !== item.id));
      }, item.duration);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  function dismiss(id: number) {
    setItems((list) => list.filter((t) => t.id !== id));
  }

  if (!items.length) return null;

  return (
    <div className="pointer-events-none fixed left-1/2 top-4 z-[120] flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 flex-col gap-2">
      {items.map((t) => {
        const style = STYLES[t.kind];
        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 rounded-2xl border ${style.ring} bg-white p-3.5 shadow-lg`}
            role="alert"
          >
            <span className="mt-0.5 shrink-0">{style.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">{t.title}</p>
              {t.description ? <p className="mt-0.5 text-xs text-slate-500">{t.description}</p> : null}
            </div>
            <button onClick={() => dismiss(t.id)} className="shrink-0 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
