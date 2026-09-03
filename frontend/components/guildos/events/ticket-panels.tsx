'use client';

import { useState } from 'react';
import { Check, Ticket } from 'lucide-react';
import type { TicketQuote, TicketSales } from '../event-api';
import { SelectMenu } from '../ui/select-menu';

/**
 * Buyer-side purchase panel for paid/tiered events: tier pills, quantity,
 * promo code, live order total, discount hints, and the missed-redirect
 * "check payment status" escape hatch. All pricing state lives in the page
 * (the quote effect re-prices on every change) — this is the presentation.
 */
export function TicketPurchasePanel({
  quote,
  fallbackPriceNgn,
  busy,
  selTier,
  onSelectTier,
  qty,
  onQty,
  promoInput,
  onPromoInput,
  appliedPromo,
  onApplyPromo,
  onBuy,
  onCheckPayment,
}: {
  quote: TicketQuote | null;
  fallbackPriceNgn: number;
  busy: boolean;
  selTier: string;
  onSelectTier: (name: string) => void;
  qty: number;
  onQty: (n: number) => void;
  promoInput: string;
  onPromoInput: (v: string) => void;
  appliedPromo: string;
  onApplyPromo: (code: string) => void;
  onBuy: () => void;
  onCheckPayment: () => void;
}) {
  return (
    <div className="w-full space-y-2.5">
      {(quote?.tiers ?? []).length > 1 ? (
        <div className="flex flex-wrap gap-1.5">
          {(quote?.tiers ?? []).map((tier) => (
            <button
              key={tier.name}
              onClick={() => onSelectTier(tier.name)}
              disabled={tier.soldOut}
              className={`rounded-xl border px-3 py-1.5 text-xs font-semibold ${tier.soldOut ? 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-400 dark:text-slate-500 line-through' : selTier === tier.name ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'}`}
            >
              {tier.name} — {tier.unitPrice > 0 ? `₦${tier.unitPrice.toLocaleString('en-NG')}` : 'Free'}
              {tier.sectionName ? ` · ${tier.sectionName}` : ''}
              {(tier.days ?? []).length ? ` · Day ${(tier.days ?? []).join(' & ')}` : ''}
              {tier.dayCancelled ? ' (day cancelled)' : tier.sectionFull ? ' (track full)' : tier.remaining !== null && !tier.soldOut ? ` (${tier.remaining} left)` : tier.soldOut ? ' (sold out)' : ''}
            </button>
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={onBuy}
          disabled={busy || (quote ? !quote.paymentsEnabled && quote.total > 0 : false)}
          className="inline-flex items-center gap-1.5 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          <Ticket className="h-4 w-4" /> {quote && quote.total === 0 ? 'Get free ticket' : `Get ticket${qty > 1 ? `s (${qty})` : ''} — ₦${(quote?.total ?? fallbackPriceNgn).toLocaleString('en-NG')}`}
        </button>
        <SelectMenu
          aria-label="Ticket quantity"
          value={String(qty)}
          onChange={(v) => onQty(Number(v))}
          className="w-32"
          size="sm"
          options={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => ({ value: String(n), label: n === 1 ? '1 ticket' : `${n} tickets` }))}
        />
      </div>
      {quote && quote.fee > 0 ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">₦{quote.price.toLocaleString('en-NG')}{qty > 1 ? ` × ${qty}` : ''} + ₦{quote.fee.toLocaleString('en-NG')} processing fee{qty > 1 ? ' — extra tickets become links you share with your guests' : ''}</p>
      ) : null}
      {quote?.groupDiscount ? (
        quote.discountSource === 'GROUP' ? (
          <p className="text-xs font-semibold text-emerald-700">Group discount applied — each ticket is {quote.groupDiscount.percentOff}% off (₦{quote.listPrice.toLocaleString('en-NG')} → ₦{quote.price.toLocaleString('en-NG')})</p>
        ) : qty < quote.groupDiscount.minQuantity ? (
          <p className="text-xs text-indigo-700">Buy {quote.groupDiscount.minQuantity}+ tickets and save {quote.groupDiscount.percentOff}% on each</p>
        ) : null
      ) : null}
      <div className="flex items-center gap-2">
        <input
          value={promoInput}
          onChange={(e) => onPromoInput(e.target.value.toUpperCase())}
          onKeyDown={(e) => { if (e.key === 'Enter' && promoInput.trim()) onApplyPromo(promoInput.trim()); }}
          placeholder="Promo code"
          className="w-36 rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs uppercase"
        />
        <button onClick={() => onApplyPromo(promoInput.trim())} disabled={!promoInput.trim()} className="rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 disabled:opacity-50">Apply</button>
        {quote?.promo && quote.discountSource === 'PROMO' ? <span className="text-xs font-semibold text-emerald-700">{quote.promo.code}: −{quote.promo.percentOff}% applied</span> : null}
        {quote?.promo && quote.discountSource === 'GROUP' ? <span className="text-xs text-slate-500 dark:text-slate-400">{quote.promo.code} skipped — the group discount is bigger</span> : null}
        {quote?.promoError && appliedPromo ? <span className="text-xs text-rose-600">{quote.promoError}</span> : null}
      </div>
      {quote && !quote.paymentsEnabled && quote.total > 0 ? (
        <p className="text-xs text-amber-700">Online payment isn’t available right now — contact the organizers to get a ticket.</p>
      ) : null}
      <button onClick={onCheckPayment} disabled={busy} className="text-xs font-medium text-indigo-600 hover:underline disabled:opacity-50">
        Already paid? Check payment status
      </button>
    </div>
  );
}

/** Organizer-only sales summary: totals, per-tier chips, sold-per-day mini chart, promo conversions. */
export function TicketSalesCard({ sales }: { sales: TicketSales }) {
  return (
    <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-500/30 dark:bg-emerald-950/40">
      <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-900"><Ticket className="h-4 w-4 shrink-0" /> Ticket sales</p>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div><p className="text-xs text-emerald-700">Sold</p><p className="text-lg font-semibold text-emerald-900">{sales.sold}</p></div>
        <div><p className="text-xs text-emerald-700">Gross</p><p className="text-lg font-semibold text-emerald-900">₦{sales.grossNgn.toLocaleString('en-NG')}</p></div>
        <div><p className="text-xs text-emerald-700">GuildOS commission ({sales.commissionPercent}%)</p><p className="text-lg font-semibold text-emerald-900">₦{sales.commissionNgn.toLocaleString('en-NG')}</p></div>
        <div><p className="text-xs text-emerald-700">Your earnings</p><p className="text-lg font-semibold text-emerald-900">₦{sales.organizerNgn.toLocaleString('en-NG')}</p></div>
      </div>
      {typeof sales.views === 'number' && sales.views > 0 ? (
        <p className="mt-3 rounded-xl bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200">
          Funnel: <span className="font-bold">{sales.views.toLocaleString('en-NG')}</span> page view{sales.views === 1 ? '' : 's'} →{' '}
          <span className="font-bold">{(sales.checkoutsStarted ?? 0).toLocaleString('en-NG')}</span> checkout{(sales.checkoutsStarted ?? 0) === 1 ? '' : 's'} started →{' '}
          <span className="font-bold">{sales.sold.toLocaleString('en-NG')}</span> sold
          {/* Conversion % only when views plausibly cover the sales — view tracking is newer
              than some events' sales history, and "500% view-to-sale" reads as a bug. */}
          {sales.views >= Math.max(sales.sold, sales.checkoutsStarted ?? 0) && sales.views >= 5 ? (
            <span className="ml-1 text-emerald-600">({Math.round((sales.sold / sales.views) * 100)}% view-to-sale)</span>
          ) : null}
        </p>
      ) : null}
      {(sales.referrers ?? []).length > 0 ? (
        <div className="mt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Top referrers</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {(sales.referrers ?? []).slice(0, 6).map((r) => (
              <span key={r.username} className="inline-flex items-center gap-1 rounded-full bg-white dark:bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-200">
                @{r.username} · {r.sold} ticket{r.sold === 1 ? '' : 's'} · ₦{r.grossNgn.toLocaleString('en-NG')}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      {(sales.tiers ?? []).length > 1 || ((sales.tiers ?? [])[0]?.name && (sales.tiers ?? [])[0].name !== 'General') ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {(sales.tiers ?? []).map((tier) => (
            <span key={tier.name} className="rounded-full bg-white dark:bg-slate-900 px-3 py-1 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200">
              {tier.name}: {tier.sold} sold · ₦{tier.grossNgn.toLocaleString('en-NG')}
            </span>
          ))}
        </div>
      ) : null}
      {(sales.salesByDay ?? []).length > 1 ? (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Sales trend</p>
          <div className="mt-1.5 flex items-end gap-1" title="Tickets sold per day">
            {(() => {
              const days = (sales.salesByDay ?? []).slice(-14);
              const max = Math.max(...days.map((d) => d.sold), 1);
              return days.map((d) => (
                <div key={d.day} className="flex flex-col items-center gap-0.5" title={`${d.day}: ${d.sold} sold · ₦${d.grossNgn.toLocaleString('en-NG')}`}>
                  <div className="w-5 rounded-t bg-emerald-500" style={{ height: `${Math.max(6, Math.round((d.sold / max) * 48))}px` }} />
                  <span className="text-[9px] text-emerald-700">{d.day.slice(5)}</span>
                </div>
              ));
            })()}
          </div>
        </div>
      ) : null}
      {(sales.promos ?? []).length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {(sales.promos ?? []).map((promo) => (
            <span key={promo.code} className="rounded-full bg-white dark:bg-slate-900 px-3 py-1 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200">
              {promo.code}: {promo.uses} use{promo.uses === 1 ? '' : 's'} · ₦{promo.grossNgn.toLocaleString('en-NG')}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}

/** Group-buy guest links: the buyer shares each unclaimed link; claimed ones show who took them. */
export function GuestClaimsPanel({ claims, slug }: { claims: { token: string; claimed: boolean; claimedByName: string | null }[]; slug: string }) {
  const [copiedClaim, setCopiedClaim] = useState('');
  return (
    <section className="rounded-3xl border border-indigo-200 bg-indigo-50 p-5 dark:border-indigo-500/30 dark:bg-indigo-950/40">
      <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-900"><Ticket className="h-4 w-4 shrink-0" /> Your guest tickets ({claims.filter((c) => !c.claimed).length} unclaimed)</p>
      <p className="mt-1 text-xs text-indigo-800">Send each link to one guest — when they open it, the ticket becomes theirs with their own check-in QR.</p>
      <div className="mt-3 space-y-2">
        {claims.map((claim, i) => (
          <div key={claim.token} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-indigo-200 bg-white dark:bg-slate-900 px-3 py-2 text-sm">
            <span className="font-medium text-slate-800 dark:text-slate-200">Guest ticket {i + 1}</span>
            {claim.claimed ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><Check className="h-3.5 w-3.5" /> Claimed by {claim.claimedByName}</span>
            ) : (
              <button
                onClick={() => {
                  void navigator.clipboard.writeText(`${window.location.origin}/events/${encodeURIComponent(slug)}?ticket_claim=${claim.token}`);
                  setCopiedClaim(claim.token);
                  setTimeout(() => setCopiedClaim(''), 2000);
                }}
                className="rounded-lg border border-indigo-300 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
              >
                {copiedClaim === claim.token ? 'Copied ✓' : 'Copy invite link'}
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
