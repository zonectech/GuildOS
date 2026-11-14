import type { Metadata } from 'next';
import { DoorOpen } from 'lucide-react';
import { Btn } from '@/components/ui/bits';

export const metadata: Metadata = { title: 'Door scanner' };

/**
 * The previous site's door links (/scan/<token>) worked without an account. Door scanning now needs
 * one: organizers add the people working the door as Event Helpers, who then scan from the event's page.
 */
export default function OldScanLink() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-20 text-center">
      <span className="grid size-16 place-items-center rounded-2xl bg-tint text-green-text"><DoorOpen size={30} /></span>
      <h1 className="text-[28px] font-extrabold">Ask the organizer to add you as an Event Helper</h1>
      <p className="text-[15.5px] text-muted">
        Door links like this one no longer work. To scan passes at the door, sign in, then ask the event&apos;s
        organizer to add you as an Event Helper in the event&apos;s workspace. You&apos;ll find the scanner on the event&apos;s page.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Btn href="/login?next=/events">Sign in</Btn>
        <Btn kind="secondary" href="/events">Browse events</Btn>
      </div>
    </div>
  );
}
