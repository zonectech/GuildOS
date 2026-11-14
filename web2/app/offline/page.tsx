import type { Metadata } from 'next';
import { CloudOff } from 'lucide-react';
import { Btn } from '@/components/ui/bits';

export const metadata: Metadata = { title: 'Offline' };

/** Shown, from the device, for a page that was never opened here while there was a connection. */
export default function OfflinePage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-20 text-center">
      <span className="grid size-16 place-items-center rounded-2xl bg-mist text-muted"><CloudOff size={30} /></span>
      <h1 className="text-[28px] font-extrabold">You&apos;re offline</h1>
      <p className="text-[15.5px] text-muted">This page wasn&apos;t saved on this device. Your passes and any door you opened before still work without a connection.</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Btn href="/events/going">Your passes</Btn>
        <Btn kind="secondary" href="/events">Events</Btn>
      </div>
    </div>
  );
}
