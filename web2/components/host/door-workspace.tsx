'use client';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, DoorOpen, ShieldCheck } from 'lucide-react';
import type { loadHostEvent } from '@/lib/api/host';
import { readDoor, refreshRoster } from '@/lib/door';
import { fmtWhen } from '@/lib/format';
import { Scanner } from '@/components/host/scanner';
import { Btn, Chip } from '@/components/ui/bits';

type Loaded = Awaited<ReturnType<typeof loadHostEvent>>;

/**
 * What an Event Helper sees: the door and nothing else. Check people in and out (camera or typed
 * code), and the count at the door. No attendee list, no editing, no finalizing, no messages.
 * The attendee list is still saved on the device, so the door keeps working if the connection drops.
 */
export function DoorWorkspace({ ev }: { ev: Loaded }) {
  const [mode, setMode] = useState<'in' | 'out'>('in');
  const [counts, setCounts] = useState<{ total: number; inside: number; out: number; open: boolean; finalized: boolean } | null>(null);
  const read = useCallback(() => {
    const r = readDoor(ev.id).roster;
    if (r) setCounts({ total: r.entries.length, inside: r.entries.filter((e) => e.in).length, out: r.entries.filter((e) => e.out).length, open: r.event.doorsOpen, finalized: r.event.finalized });
  }, [ev.id]);
  useEffect(() => { read(); void refreshRoster(ev.id).then(read); }, [ev.id, read]);
  const open = counts ? counts.open : ['CHECK_IN', 'CHECK_OUT'].includes(ev.status);

  return (
    <div className="mx-auto flex max-w-[640px] flex-col gap-5 px-4 pt-6 pb-20 sm:px-6 lg:pt-10">
      <a href={`/events/${ev.slug}`} className="inline-flex w-fit items-center gap-1.5 text-[14px] font-semibold text-muted hover:text-ink"><ArrowLeft size={16} />Event page</a>
      <div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tint px-2.5 py-1 text-[12.5px] font-bold text-green-text"><ShieldCheck size={14} />Event Helper · door only</span>
        <h1 className="mt-2 text-[30px] font-extrabold">{ev.draft.title}</h1>
        <p className="text-[14.5px] text-muted">{fmtWhen(ev.draft.startDate, ev.draft.timezone)}</p>
      </div>

      {counts ? (
        <div className="grid grid-cols-3 gap-2 text-center">
          {([['Registered', counts.total], ['Checked in', counts.inside], ['Checked out', counts.out]] as const).map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-mist p-3"><b className="block font-display text-[24px] tabular-nums">{v}</b><small className="text-muted">{k}</small></div>
          ))}
        </div>
      ) : null}

      {counts?.finalized ? (
        <p className="rounded-2xl bg-mist px-4 py-3 text-[14.5px]">Attendance for this event is finalized. The door is closed.</p>
      ) : !open ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-line p-4">
          <p className="flex items-start gap-2 text-[14.5px]"><DoorOpen size={18} className="mt-0.5 shrink-0 text-muted" />Check-in isn&apos;t open yet. An organizer opens it from their workspace when the doors open.</p>
          <p className="text-[13.5px] text-muted">{counts ? `The attendee list is saved on this device (${counts.total} ${counts.total === 1 ? 'person' : 'people'}), so the door works even if the connection drops.` : 'Open this page once before the event while you have a connection, so the attendee list is saved on this device.'}</p>
          <Btn kind="secondary" className="self-start" onClick={() => void refreshRoster(ev.id).then(read)}>Check again</Btn>
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <Chip on={mode === 'in'} onClick={() => setMode('in')}>Check in</Chip>
            <Chip on={mode === 'out'} onClick={() => setMode('out')}>Check out</Chip>
          </div>
          <Scanner eventId={ev.id} mode={mode} onScanned={read} />
        </>
      )}
    </div>
  );
}
