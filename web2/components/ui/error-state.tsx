'use client';
import { CloudOff, RefreshCw } from 'lucide-react';
import { ApiError, friendlyError } from '@/lib/api/client';
import { Btn } from '@/components/ui/bits';

/**
 * The one way a page says "that didn't load": a plain sentence and Try again. Used wherever data
 * loads, instead of an empty list (which would wrongly say there is nothing) or the raw error text.
 * `compact` is for a section inside a page (a tab, a list); the default fills the page.
 */
export function ErrorState({ error, onRetry, title, compact }: { error: unknown; onRetry?: () => void; title?: string; compact?: boolean }) {
  const offline = error instanceof ApiError && error.status === 0;
  const message = friendlyError(error);
  if (compact) {
    return (
      <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[color-mix(in_srgb,var(--coral)_14%,transparent)] px-4 py-3 text-[14px] font-semibold text-coral-text">
        <span>{title ? `${title} ` : ''}{message}</span>
        {onRetry ? <Btn size="sm" kind="secondary" onClick={onRetry}>Try again</Btn> : null}
      </div>
    );
  }
  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-3 px-6 py-20 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-mist text-muted">{offline ? <CloudOff size={26} /> : <RefreshCw size={24} />}</span>
      <h1 className="text-[24px] font-extrabold">{title ?? (offline ? 'You seem to be offline' : 'This didn’t load')}</h1>
      <p className="text-[15px] text-muted">{message}</p>
      {onRetry ? <Btn onClick={onRetry} className="mt-2">Try again</Btn> : null}
    </div>
  );
}
