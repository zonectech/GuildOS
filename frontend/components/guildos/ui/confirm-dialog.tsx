'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Logo } from './logo';

type Tone = 'default' | 'danger';

type DialogRequest = {
  id: number;
  mode: 'confirm' | 'prompt';
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  tone: Tone;
  placeholder?: string;
  defaultValue?: string;
  optional?: boolean;
  resolve: (value: boolean | string | null) => void;
};

type Listener = (req: DialogRequest) => void;
let listener: Listener | null = null;
let counter = 0;

/** Promise-based confirmation dialog (replaces window.confirm). */
export function confirmDialog(options: {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: Tone;
}): Promise<boolean> {
  return new Promise((resolve) => {
    if (!listener) return resolve(false);
    listener({
      id: ++counter,
      mode: 'confirm',
      title: options.title,
      message: options.message,
      confirmLabel: options.confirmLabel ?? 'Confirm',
      cancelLabel: options.cancelLabel ?? 'Cancel',
      tone: options.tone ?? 'default',
      resolve: (v) => resolve(Boolean(v)),
    });
  });
}

/** Promise-based prompt dialog (replaces window.prompt). Resolves null on cancel. */
export function promptDialog(options: {
  title: string;
  message?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  optional?: boolean;
  tone?: Tone;
}): Promise<string | null> {
  return new Promise((resolve) => {
    if (!listener) return resolve(null);
    listener({
      id: ++counter,
      mode: 'prompt',
      title: options.title,
      message: options.message,
      confirmLabel: options.confirmLabel ?? 'Submit',
      cancelLabel: options.cancelLabel ?? 'Cancel',
      tone: options.tone ?? 'default',
      placeholder: options.placeholder,
      defaultValue: options.defaultValue,
      optional: options.optional ?? true,
      resolve: (v) => resolve(typeof v === 'string' ? v : null),
    });
  });
}

/** Global dialog host. Mount once near the app root. */
export function DialogHost() {
  const [req, setReq] = useState<DialogRequest | null>(null);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    listener = (r) => {
      setValue(r.defaultValue ?? '');
      setReq(r);
    };
    return () => {
      listener = null;
    };
  }, []);

  useEffect(() => {
    if (req?.mode === 'prompt') {
      const t = window.setTimeout(() => inputRef.current?.focus(), 50);
      return () => window.clearTimeout(t);
    }
  }, [req]);

  if (!req) return null;

  function close(result: boolean | string | null) {
    req?.resolve(result);
    setReq(null);
  }

  function onConfirm() {
    if (req?.mode === 'prompt') {
      if (!req.optional && !value.trim()) return;
      close(value);
    } else {
      close(true);
    }
  }

  const danger = req.tone === 'danger';

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start gap-3">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${danger ? 'bg-rose-50 text-rose-600' : 'bg-indigo-50'}`}>
            {danger ? <AlertTriangle className="h-5 w-5" /> : <Logo size="sm" />}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-slate-950">{req.title}</h2>
            {req.message ? <p className="mt-1 text-sm text-slate-500">{req.message}</p> : null}
          </div>
        </div>

        {req.mode === 'prompt' ? (
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onConfirm();
              if (e.key === 'Escape') close(null);
            }}
            placeholder={req.placeholder}
            className="mt-4 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        ) : null}

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => close(req.mode === 'prompt' ? null : false)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
            {req.cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-xl px-4 py-2 text-sm font-medium text-white transition ${danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
          >
            {req.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
