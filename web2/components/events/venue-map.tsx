'use client';
import { useId, useState } from 'react';
import { ChevronDown, MapPin, Navigation } from 'lucide-react';
import type { Event } from '@/lib/api/types';

export function VenueMap({ event, compact = false }: { event: Event; compact?: boolean }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  if (event.mode === 'VIRTUAL' || !event.venue.trim()) return null;
  const venue = event.venue.trim();
  const location = event.state.trim() && !venue.toLowerCase().includes(event.state.trim().toLowerCase()) ? `${venue}, ${event.state.trim()}` : venue;
  const query = encodeURIComponent(location);
  return <div className="overflow-hidden rounded-2xl border border-line bg-surface">
    <button type="button" onClick={() => { setOpen((value) => !value); setLoaded(false); }} aria-expanded={open} aria-controls={id} className="flex w-full items-center gap-2 px-4 py-3 text-left text-[14px] font-semibold text-green-text hover:bg-mist">
      <MapPin size={17} /><span className="flex-1">{open ? 'Hide map' : 'View map'}</span><ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
    {open ? <div id={id} className="border-t border-line">
      <div className={`relative bg-mist ${compact ? 'h-[230px]' : 'h-[280px] sm:h-[320px]'}`}>
        {!loaded ? <div role="status" className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-mist text-[13px] text-muted">Loading venue map…</div> : null}
        <iframe title={`Map of ${location}`} src={`https://maps.google.com/maps?q=${query}&output=embed`} className="h-full w-full border-0" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen onLoad={() => setLoaded(true)} />
      </div>
      <div className="flex flex-col gap-2 px-4 py-3"><p className="break-words text-[12px] text-muted">Map search based on the organizer’s venue: {location}</p><a href={`https://www.google.com/maps/dir/?api=1&destination=${query}`} target="_blank" rel="noopener noreferrer" className="inline-flex w-fit items-center gap-1.5 text-[13px] font-bold text-green-text hover:underline"><Navigation size={14} />Get directions</a></div>
    </div> : null}
  </div>;
}
