'use client';

// Save as: components/guildos/status/status-attachment-picker.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, GraduationCap, Ticket, Upload, X } from 'lucide-react';

import { resolveEventImageUrl } from '../event-api';
import {
  listAttachmentOptions,
  type StatusAttachmentOption,
  type StatusPickerType,
} from '../status-store';

type Props = {
  type: StatusPickerType;
  /** A selection or upload is in progress. */
  busy: boolean;
  onSelect: (id: string) => void;
  /** Only used for tickets and certificates. */
  onUpload: (file: File) => void;
  onClose: () => void;
};

const COPY: Record<StatusPickerType, { title: string; search: string; empty: string }> = {
  EVENT: {
    title: 'Share an event',
    search: 'Search events',
    empty: 'No events to share right now.',
  },
  TICKET: {
    title: 'Share your ticket',
    search: 'Search your tickets',
    empty: "You don't have any upcoming tickets yet.",
  },
  CERTIFICATE: {
    title: 'Share your certificate',
    search: 'Search your certificates',
    empty: "You don't have any certificates yet.",
  },
};

// Shown instantly on the next open while a fresh list loads in the background.
const optionsCache: Partial<Record<StatusPickerType, StatusAttachmentOption[]>> = {};

/** Pulls the slug out of a pasted event link, e.g. http://localhost:3000/events/tech-week-summit-demo */
function eventSlugFromLink(value: string): string {
  const match = value.match(/\/events\/([^/?#\s]+)/i);
  if (!match) return '';
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function formatDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-NG', { month: 'short', day: 'numeric' });
}

export function StatusAttachmentPicker({ type, busy, onSelect, onUpload, onClose }: Props) {
  const copy = COPY[type];
  const [options, setOptions] = useState<StatusAttachmentOption[] | null>(optionsCache[type] ?? null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [link, setLink] = useState('');
  const [shown, setShown] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const canLink = type === 'EVENT' || type === 'TICKET';
  const canUpload = type === 'TICKET' || type === 'CERTIFICATE';

  useEffect(() => {
    let active = true;
    setError('');

    void listAttachmentOptions(type)
      .then((items) => {
        optionsCache[type] = items;
        if (active) setOptions(items);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load your items');
        setOptions((current) => current ?? []);
      });

    return () => {
      active = false;
    };
  }, [type]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true));
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = options ?? [];
    return (query ? list.filter((option) => option.title.toLowerCase().includes(query)) : list).slice(0, 50);
  }, [options, search]);

  function applyLink(value: string) {
    const slug = eventSlugFromLink(value);
    if (slug) onSelect(slug);
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center md:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={copy.title}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className={`absolute inset-0 bg-black/60 transition-opacity duration-200 ${shown ? 'opacity-100' : 'opacity-0'}`}
      />

      <div
        className={`relative flex max-h-[85vh] w-full flex-col rounded-t-3xl bg-white shadow-2xl transition-transform duration-200 dark:bg-slate-900 md:max-w-lg md:rounded-xl ${shown ? 'translate-y-0' : 'translate-y-full'}`}
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">{copy.title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-full text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-2 px-5 pb-3">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={copy.search}
            aria-label={copy.search}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-indigo-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />

          {canLink ? (
            <div className="flex gap-2">
              <input
                value={link}
                onChange={(event) => setLink(event.target.value)}
                onPaste={(event) => {
                  const pasted = event.clipboardData.getData('text');
                  if (eventSlugFromLink(pasted)) {
                    event.preventDefault();
                    setLink(pasted);
                    applyLink(pasted);
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    applyLink(link);
                  }
                }}
                placeholder="Or paste an event link…"
                aria-label="Event link"
                className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-indigo-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={() => applyLink(link)}
                disabled={!eventSlugFromLink(link) || busy}
                className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                Use
              </button>
            </div>
          ) : null}
        </div>

        <div className="min-h-[8rem] flex-1 overflow-y-auto px-3 pb-3">
          {options === null ? (
            <div className="space-y-2 px-2 py-1" aria-label="Loading">
              {[0, 1, 2].map((row) => (
                <div key={row} className="h-14 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
              ))}
            </div>
          ) : visible.length ? (
            <ul className="space-y-1">
              {visible.map((option) => {
                const thumb = option.image ? resolveEventImageUrl(option.image) : '';
                const detail = [formatDate(option.startsAt), option.subtitle].filter(Boolean).join(' · ');

                return (
                  <li key={`${option.type}-${option.id}`}>
                    <button
                      type="button"
                      onClick={() => onSelect(option.id)}
                      disabled={busy}
                      className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition hover:bg-slate-50 disabled:opacity-60 dark:hover:bg-slate-800"
                    >
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumb} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover" />
                      ) : (
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300">
                          {option.type === 'CERTIFICATE' ? <GraduationCap className="h-5 w-5" /> : option.type === 'TICKET' ? <Ticket className="h-5 w-5" /> : <CalendarDays className="h-5 w-5" />}
                        </span>
                      )}
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-slate-900 dark:text-slate-100">{option.title}</span>
                        {detail ? <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{detail}</span> : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              {search.trim() ? 'Nothing matches your search.' : copy.empty}
            </p>
          )}

          {error ? (
            <p role="alert" className="px-4 py-2 text-center text-sm text-red-600 dark:text-red-400">{error}</p>
          ) : null}
        </div>

        {canUpload ? (
          <div className="border-t border-slate-100 px-5 py-3 dark:border-slate-800">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (fileInputRef.current) fileInputRef.current.value = '';
                if (file) onUpload(file);
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Upload className="h-4 w-4" />
              {busy ? 'Working…' : `Upload your own ${type === 'TICKET' ? 'ticket' : 'certificate'} image`}
            </button>
            <p className="mt-1.5 text-center text-xs text-slate-500 dark:text-slate-400">
              {type === 'TICKET' ? 'Cover the QR code and any gate code first: anyone who sees your status could copy them. ' : ''}
              Uploaded images are shown as not verified by GuildOS.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}