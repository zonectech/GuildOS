'use client';
import { CalendarPlus, MapPin } from 'lucide-react';
import type { Event } from '@/lib/api/types';
import { downloadEventCalendar } from '@/lib/event-calendar';
import { fmtWhen } from '@/lib/format';
import { Btn } from '@/components/ui/bits';
import { useToast } from '@/components/ui/toast';

export function RegistrationConfirmation({ event }: { event: Event }) {
  const toast = useToast();
  return <div className="flex flex-col gap-3 rounded-2xl border border-line bg-tint p-4 text-[14px]">
    <div><b className="text-[16px] text-green-text">Your place is confirmed</b><p className="mt-1 text-muted">Your QR pass is below. Here’s what you need for the event.</p></div>
    <dl className="flex flex-col gap-3"><div><dt className="text-[12px] text-muted">When</dt><dd className="font-semibold">{event.startDate ? fmtWhen(event.startDate, event.timezone) : 'To be announced'}{event.endDate ? <> — {fmtWhen(event.endDate, event.timezone)}</> : null}</dd></div>
      <div><dt className="text-[12px] text-muted">Where</dt><dd className="break-words font-semibold">{event.mode === 'VIRTUAL' ? 'Online — use the event page to join when check-in opens' : event.venue || 'The organizer will share the venue'}{event.mode === 'HYBRID' ? ' · Online option available through the event page' : ''}</dd></div>
      {event.whatToBring ? <div><dt className="text-[12px] text-muted">What to bring</dt><dd className="whitespace-pre-wrap break-words font-semibold">{event.whatToBring}</dd></div> : <p className="text-[12px] text-muted">Check the event description for any preparation instructions.</p>}
    </dl>
    <div className="flex flex-wrap gap-2"><Btn size="sm" kind="secondary" disabled={!event.startDate || !event.endDate} onClick={() => { try { downloadEventCalendar(event); } catch (e) { toast(e instanceof Error ? e.message : 'Unable to create calendar entry'); } }}><CalendarPlus size={15} />Add to calendar</Btn>
      {event.mode !== 'VIRTUAL' && event.venue ? <Btn size="sm" kind="secondary" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.venue)}`}><MapPin size={15} />Open map</Btn> : null}</div>
  </div>;
}
