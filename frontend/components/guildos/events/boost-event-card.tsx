'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, Copy, Megaphone, ChevronRight } from 'lucide-react';

import type { EventSummary } from '../event-api';

/**
 * Organizer-only "Boost your event" checklist — promo codes, waitlist, chat link
 * and the share link all exist but were invisible until now (zero lifetime usage
 * in the data). Shown while sign-ups are open; disappears once every item is done.
 */
export function BoostEventCard({ event }: { event: EventSummary }) {
  const [copied, setCopied] = useState(false);

  const editHref = `/dashboard/events/create?communityId=${event.communityId}&slug=${event.slug}`;
  const isPaid = (event.ticketPrice ?? 0) > 0 || (event.ticketTiers ?? []).some((t) => t.price > 0);

  const items = useMemo(() => {
    const list: { key: string; label: string; hint: string; done: boolean }[] = [
      {
        key: 'chat',
        label: 'Add an attendee group chat',
        hint: 'WhatsApp/Telegram link shown only to confirmed attendees — keeps them engaged before the day.',
        done: Boolean(event.attendeeChatLink) || (event.sections ?? []).some((s) => Boolean(s.chatLink)),
      },
    ];
    if ((event.capacity ?? 0) > 0) {
      list.push({
        key: 'waitlist',
        label: 'Enable the waitlist',
        hint: 'Cancelled seats refill themselves — nobody has to watch the page.',
        done: Boolean(event.waitlistEnabled),
      });
    }
    if (isPaid) {
      list.push({
        key: 'promo',
        label: 'Create a promo code',
        hint: 'A time-limited discount code gives people a reason to buy now, not later.',
        done: (event.ticketPromoCodes ?? []).length > 0,
      });
    }
    return list;
  }, [event, isPaid]);

  // Everything configured → nothing left to nag about.
  if (items.every((i) => i.done)) return null;

  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/events/${event.slug}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* clipboard unavailable — ignore */
    }
  }

  return (
    <section className="rounded-3xl border border-indigo-200 bg-indigo-50/60 p-5 dark:border-indigo-500/30 dark:bg-indigo-950/30">
      <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-900 dark:text-indigo-200">
        <Megaphone className="h-4 w-4 shrink-0" /> Boost your event
      </p>
      <p className="mt-1 text-xs text-indigo-800/80 dark:text-indigo-300/80">
        Only you and your team can see this. A few switches meaningfully lift sign-ups:
      </p>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item.key} className="flex items-start gap-2.5">
            <span
              className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full ${
                item.done
                  ? 'bg-emerald-500 text-white'
                  : 'border border-indigo-300 bg-white dark:border-indigo-600 dark:bg-transparent'
              }`}
            >
              {item.done ? <Check className="h-3 w-3" /> : null}
            </span>
            <div className="min-w-0">
              {item.done ? (
                <p className="text-sm font-medium text-indigo-900/60 line-through dark:text-indigo-300/50">{item.label}</p>
              ) : (
                <Link href={editHref} className="group inline-flex items-center gap-0.5 text-sm font-medium text-indigo-900 hover:underline dark:text-indigo-200">
                  {item.label} <ChevronRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                </Link>
              )}
              {!item.done ? <p className="text-xs text-indigo-800/70 dark:text-indigo-300/60">{item.hint}</p> : null}
            </div>
          </li>
        ))}
      </ul>
      <button
        onClick={() => void copyShareLink()}
        className="mt-4 inline-flex items-center gap-1.5 rounded-2xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? 'Link copied — paste it anywhere' : 'Copy event link to share'}
      </button>
    </section>
  );
}
