'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, LocateFixed, MapPin } from 'lucide-react';

type Suggestion = {
  id: string;
  label: string;
  short: string;
};

const NOMINATIM = 'https://nominatim.openstreetmap.org';

function toShortLabel(item: any): string {
  const a = item.address ?? {};
  const city = a.city ?? a.town ?? a.village ?? a.suburb ?? a.county ?? '';
  const state = a.state ?? '';
  const country = a.country ?? '';
  return [city, state, country].filter(Boolean).join(', ') || item.display_name;
}

/**
 * Location picker with search-as-you-type (OpenStreetMap Nominatim, no API key)
 * plus a "use my current location" button.
 */
export function LocationInput({
  value,
  onChange,
  placeholder = 'Search city or town…',
  className = '',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const skipSearch = useRef(false);
  const lastEmitted = useRef(value);
  const rootRef = useRef<HTMLDivElement>(null);
  const debounce = useRef<number | undefined>(undefined);

  // keep in sync when parent value changes externally (not from our own onChange)
  useEffect(() => {
    if (value === lastEmitted.current) return;
    lastEmitted.current = value;
    skipSearch.current = true;
    setQuery(value);
  }, [value]);

  // close on outside click
  useEffect(() => {
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, []);

  // debounced search
  useEffect(() => {
    if (skipSearch.current) {
      skipSearch.current = false;
      return;
    }
    window.clearTimeout(debounce.current);
    if (query.trim().length < 2) {
      setSuggestions([]);
      setSearching(false);
      setOpen(false);
      return;
    }
    setSearching(true);
    setOpen(true);
    debounce.current = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `${NOMINATIM}/search?format=jsonv2&addressdetails=1&limit=6&q=${encodeURIComponent(query.trim())}`,
          { headers: { Accept: 'application/json' } },
        );
        if (!res.ok) throw new Error();
        const data = await res.json();
        setSuggestions(
          (Array.isArray(data) ? data : []).map((item: any) => ({
            id: String(item.place_id),
            label: item.display_name,
            short: toShortLabel(item),
          })),
        );
        setOpen(true);
      } catch {
        setSuggestions([]);
        setOpen(false);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => window.clearTimeout(debounce.current);
  }, [query]);

  function pick(s: Suggestion) {
    skipSearch.current = true;
    setQuery(s.short);
    lastEmitted.current = s.short;
    onChange(s.short);
    setSuggestions([]);
    setOpen(false);
  }

  function useMyLocation() {
    if (!navigator.geolocation || locating) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const res = await fetch(
            `${NOMINATIM}/reverse?format=jsonv2&addressdetails=1&lat=${coords.latitude}&lon=${coords.longitude}`,
            { headers: { Accept: 'application/json' } },
          );
          if (!res.ok) throw new Error();
          const item = await res.json();
          const short = toShortLabel(item);
          skipSearch.current = true;
          setQuery(short);
          lastEmitted.current = short;
          onChange(short);
          setOpen(false);
        } catch {
          /* ignore — user can still type */
        } finally {
          setLocating(false);
        }
      },
      () => setLocating(false),
      { timeout: 10000 },
    );
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          className="ev-input w-full pl-9 pr-10"
          value={query}
          placeholder={placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            lastEmitted.current = e.target.value;
            onChange(e.target.value);
          }}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          autoComplete="off"
        />
        <button
          type="button"
          onClick={useMyLocation}
          title="Use my current location"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-indigo-600"
        >
          {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
        </button>
      </div>

      {open && (suggestions.length > 0 || searching) ? (
        <ul className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-auto rounded-2xl border border-slate-200 bg-white py-1 shadow-lg">
          {searching && suggestions.length === 0 ? (
            <li className="flex items-center gap-2 px-3 py-2.5 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Searching…
            </li>
          ) : null}
          {suggestions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => pick(s)}
                className="flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm text-slate-700 transition hover:bg-slate-50"
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <span>
                  <span className="font-medium text-slate-900">{s.short}</span>
                  {s.label !== s.short ? (
                    <span className="mt-0.5 block truncate text-xs text-slate-400">{s.label}</span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
