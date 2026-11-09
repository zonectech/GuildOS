'use client';
import { useEffect, useState } from 'react';
import { loadHostEvent } from '@/lib/api/host';
import { EventForm } from '@/components/host/event-form';
import { Btn } from '@/components/ui/bits';

type Loaded = Awaited<ReturnType<typeof loadHostEvent>>;

export function EditEvent({ slug }: { slug: string }) {
  const [ev, setEv] = useState<Loaded | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { loadHostEvent(slug).then(setEv).catch((e: Error) => setError(e.message)); }, [slug]);
  if (error) return <div className="px-6 py-24 text-center font-semibold">{error}</div>;
  if (!ev) return <div className="mx-auto max-w-[1200px] px-4 pt-10"><div className="shimmer h-[420px] rounded-[28px]" /></div>;
  if (!ev.canManage) return <div className="mx-auto max-w-lg px-6 py-24 text-center"><h1 className="text-[28px] font-extrabold">Only the hosts can edit this event</h1><Btn className="mt-6" href={`/events/${slug}`}>Back to the event</Btn></div>;
  return <EventForm existing={ev} />;
}
