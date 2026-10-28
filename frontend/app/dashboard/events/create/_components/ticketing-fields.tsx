'use client';

import { useRef, useState } from 'react';

import { Field } from '../../../../../components/guildos/events/event-form-ui';
import { detectQrBox } from '../../../../../components/guildos/events/qr-detect';
import { TicketQrPlacementPanel, type QrDetectState } from '../../../../../components/guildos/events/ticket-qr-box-editor';
import {
  TICKET_QR_PLACEMENTS, TICKET_STYLES, resolveEventImageUrl, uploadEventMedia,
  type EventInput, type TicketTier,
} from '../../../../../components/guildos/event-api';
import { TicketPreview } from './ticket-preview';
import { REMOVE_SQUARE, namedSections, type SectionProps } from './form-model';

const ACCENT_SWATCHES = ['#6366f1', '#0f766e', '#059669', '#b91c1c', '#e11d48', '#d97706', '#0369a1', '#7c3aed', '#1e293b'];
const CHOICE_ACTIVE = 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-500/40 dark:bg-indigo-500/15 dark:text-indigo-300';
const CHOICE_IDLE = 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400';
const ENTRY_ACTIVE = 'border-indigo-400 bg-indigo-50 dark:bg-indigo-500/15 font-semibold text-indigo-800 dark:text-indigo-200';
const ENTRY_IDLE = 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-indigo-200';
const SMALL_ADD = 'rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:border-indigo-300 hover:text-indigo-600';
const COLUMN_HEADINGS = 'mb-1 grid gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500';

type TicketingProps = SectionProps & {
  updateForm: (patch: Partial<EventInput>) => void;
  /** Platform commission on paid tickets (percent), once loaded. */
  ticketCommission: number | null;
  onError: (message: string) => void;
};

const toCount = (value: string) => Math.max(0, Math.round(Number(value) || 0));

/** Every registrant gets a ticket, so the design is available for free and paid events alike. */
function TicketDesignField({ form, update, onError }: SectionProps & { onError: (message: string) => void }) {
  const [qrDetect, setQrDetect] = useState<QrDetectState>('idle');
  // Bumped on every organizer action on the QR; a detection that finishes later is dropped.
  const qrRunRef = useRef(0);

  async function handleTemplateUpload(file: File | null) {
    if (!file) return;
    try {
      onError('');
      const fd = new FormData();
      fd.append('ticketTemplate', file);
      const uploaded = await uploadEventMedia(fd);
      update('ticketTemplate', uploaded.ticketTemplate);
      // If the design already has a QR, put the real one exactly there; otherwise the organizer chooses.
      const run = ++qrRunRef.current;
      setQrDetect('detecting');
      const found = await detectQrBox(file).catch(() => null);
      // The organizer may have placed the QR themselves while this ran: never overwrite that.
      if (run !== qrRunRef.current) return;
      update('ticketQrBox', found);
      setQrDetect(found ? 'found' : 'none');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unable to upload ticket design');
    }
  }

  async function redetectQr() {
    if (!form.ticketTemplate) return;
    const run = ++qrRunRef.current;
    setQrDetect('detecting');
    const found = await detectQrBox(resolveEventImageUrl(form.ticketTemplate)).catch(() => null);
    if (run !== qrRunRef.current) return;
    update('ticketQrBox', found);
    setQrDetect(found ? 'found' : 'none');
  }

  return (
    <Field label="Ticket design" as="div">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => { update('ticketTemplate', ''); update('ticketQrBox', null); setQrDetect('idle'); }}
          className={`rounded-xl border px-3 py-1.5 text-xs font-semibold ${!form.ticketTemplate ? CHOICE_ACTIVE : CHOICE_IDLE}`}
        >
          GuildOS design
        </button>
        <label className={`cursor-pointer rounded-xl border px-3 py-1.5 text-xs font-semibold ${form.ticketTemplate ? CHOICE_ACTIVE : CHOICE_IDLE}`}>
          {form.ticketTemplate ? 'Your design ✓ (replace)' : 'Upload your own design'}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => { void handleTemplateUpload(e.target.files?.[0] ?? null); e.target.value = ''; }} />
        </label>
      </div>
      {form.ticketTemplate ? (
        <TicketQrPlacementPanel
          image={resolveEventImageUrl(form.ticketTemplate)}
          placements={TICKET_QR_PLACEMENTS}
          placement={form.ticketQrPlacement ?? 'BOTTOM_RIGHT'}
          onPlacement={(value) => { qrRunRef.current += 1; update('ticketQrPlacement', value); }}
          box={form.ticketQrBox ?? null}
          onBox={(value) => { qrRunRef.current += 1; update('ticketQrBox', value); setQrDetect(value ? 'idle' : 'none'); }}
          detect={qrDetect}
          onRedetect={() => void redetectQr()}
        />
      ) : (
        <>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Buyers can download a branded ticket with their personal check-in QR. Upload your own flyer-style design to replace the GuildOS look.</p>
          <div className="mt-2">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Ticket look</span>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {TICKET_STYLES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  title={s.desc}
                  onClick={() => update('ticketStyle', s.value)}
                  className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium ${(form.ticketStyle ?? 'MIDNIGHT') === s.value ? CHOICE_ACTIVE : CHOICE_IDLE}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-medium text-slate-600 dark:text-slate-400">Accent</span>
              {ACCENT_SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Accent ${c}`}
                  onClick={() => update('ticketAccent', c)}
                  className={`h-6 w-6 rounded-full ring-offset-1 transition ${(form.ticketAccent ?? '#6366f1').toLowerCase() === c ? 'ring-2 ring-slate-900' : 'ring-1 ring-slate-200 dark:ring-slate-800'}`}
                  style={{ background: c }}
                />
              ))}
              <input
                type="color"
                value={form.ticketAccent ?? '#6366f1'}
                onChange={(e) => update('ticketAccent', e.target.value)}
                className="h-6 w-6 cursor-pointer rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-0.5"
                aria-label="Custom accent colour"
              />
            </div>
          </div>
        </>
      )}
      <TicketPreview
        eventTitle={form.title || 'Your event'}
        communityName="Your community"
        dateLabel={form.startDate ? new Date(form.startDate).toLocaleDateString('en-NG', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) : 'Event date'}
        venueLabel={form.mode === 'VIRTUAL' ? 'Online event' : form.venue || 'Venue'}
        priceLabel={(form.ticketPrice ?? 0) > 0 ? `₦${(form.ticketPrice ?? 0).toLocaleString('en-NG')}` : 'FREE ENTRY'}
        tierLabel={(form.ticketTiers ?? [])[0]?.name || 'General Admission'}
        templateImage={form.ticketTemplate || ''}
        qrPlacement={form.ticketQrPlacement ?? 'BOTTOM_RIGHT'}
        qrBox={form.ticketQrBox ?? null}
        style={form.ticketStyle ?? 'MIDNIGHT'}
        accent={form.ticketAccent ?? '#6366f1'}
      />
    </Field>
  );
}

function TicketTiersField({ form, update }: SectionProps) {
  const tiers = form.ticketTiers ?? [];
  const dayCount = (form.days ?? []).length;
  const hasTierDays = dayCount > 1;
  const tracks = namedSections(form);
  const hasTierSections = tracks.length > 0;
  const grid = hasTierDays
    ? hasTierSections ? 'grid-cols-[1fr_90px_80px_95px_120px_32px]' : 'grid-cols-[1fr_100px_90px_110px_32px]'
    : hasTierSections ? 'grid-cols-[1fr_100px_90px_120px_32px]' : 'grid-cols-[1fr_110px_100px_32px]';
  const patchTier = (index: number, patch: Partial<TicketTier>) =>
    update('ticketTiers', tiers.map((t, i) => (i === index ? { ...t, ...patch } : t)));

  return (
    <Field label="Ticket types (optional, e.g. Early Bird / Regular / VIP)" as="div">
      {tiers.length ? (
        <div className={`${COLUMN_HEADINGS} ${grid}`}>
          <span>Name</span><span>Price (₦)</span><span>Available</span>{hasTierDays ? <span>Days</span> : null}{hasTierSections ? <span>Track</span> : null}<span />
        </div>
      ) : null}
      {tiers.map((tier, i) => (
        <div key={i} className={`mb-2 grid ${grid} items-center gap-2`}>
          <input className="ev-input" placeholder="Name (e.g. VIP)" value={tier.name} onChange={(e) => patchTier(i, { name: e.target.value })} />
          <input className="ev-input" type="number" min={0} placeholder="Price ₦" title="Price (₦)" value={tier.price} onChange={(e) => patchTier(i, { price: toCount(e.target.value) })} />
          <input className="ev-input" type="number" min={0} placeholder="Qty (0=∞)" title="Capacity (0 = unlimited)" value={tier.capacity} onChange={(e) => patchTier(i, { capacity: toCount(e.target.value) })} />
          {hasTierDays ? (
            <input
              className="ev-input"
              placeholder="All days"
              title="Which days this ticket covers, e.g. 1,3 (blank = whole event)"
              value={(tier.days ?? []).join(',')}
              onChange={(e) => {
                const days = [...new Set(e.target.value.split(',').map((v) => Math.round(Number(v.trim()))))]
                  .filter((d) => Number.isFinite(d) && d >= 1 && d <= dayCount)
                  .sort((a, b) => a - b);
                patchTier(i, { days });
              }}
            />
          ) : null}
          {hasTierSections ? (
            <select
              className="ev-input"
              aria-label="Tier track"
              title="Buying this ticket registers the attendee into this track (Any = buyer picks)"
              value={tier.sectionKey ?? ''}
              onChange={(e) => patchTier(i, { sectionKey: e.target.value })}
            >
              <option value="">Any track</option>
              {tracks.map((s) => (
                <option key={s.key} value={s.key}>{s.name}</option>
              ))}
            </select>
          ) : null}
          <button type="button" title="Remove tier" onClick={() => update('ticketTiers', tiers.filter((_, idx) => idx !== i))} className={REMOVE_SQUARE}>×</button>
        </div>
      ))}
      {tiers.length < 5 ? (
        <button type="button" onClick={() => update('ticketTiers', [...tiers, { name: '', price: 0, capacity: 0 }])} className={SMALL_ADD}>
          + Add ticket type
        </button>
      ) : null}
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Name + price + how many are available (0 = unlimited). A ₦0 tier is a free ticket, great for members-only free entry alongside paid VIP.
        {hasTierDays ? ' Days: e.g. "2" sells a Day-2-only pass (comma-separate for several days; blank covers the whole event). The scanner enforces it.' : ''}
      </p>
    </Field>
  );
}

function PromoCodesField({ form, update }: SectionProps) {
  const codes = form.ticketPromoCodes ?? [];
  const patchCode = (index: number, patch: Partial<(typeof codes)[number]>) =>
    update('ticketPromoCodes', codes.map((c, i) => (i === index ? { ...c, ...patch } : c)));

  return (
    <Field label="Promo codes (optional)" as="div">
      {codes.length ? (
        <div className={`${COLUMN_HEADINGS} grid-cols-[1fr_110px_110px_32px]`}>
          <span>Code</span><span>% off</span><span>Max uses</span><span />
        </div>
      ) : null}
      {codes.map((promo, i) => (
        <div key={i} className="mb-2 grid grid-cols-[1fr_110px_110px_32px] items-center gap-2">
          <input className="ev-input uppercase" placeholder="CODE (e.g. EARLY10)" value={promo.code} onChange={(e) => patchCode(i, { code: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 20) })} />
          <input className="ev-input" type="number" min={1} max={100} placeholder="% off" title="Percent off (1–100)" value={promo.percentOff} onChange={(e) => patchCode(i, { percentOff: Math.min(100, Math.max(1, Math.round(Number(e.target.value) || 1))) })} />
          <input className="ev-input" type="number" min={0} placeholder="Uses (0=∞)" title="Max uses (0 = unlimited)" value={promo.maxUses} onChange={(e) => patchCode(i, { maxUses: toCount(e.target.value) })} />
          <button type="button" title="Remove code" onClick={() => update('ticketPromoCodes', codes.filter((_, idx) => idx !== i))} className={REMOVE_SQUARE}>×</button>
        </div>
      ))}
      {codes.length < 10 ? (
        <button type="button" onClick={() => update('ticketPromoCodes', [...codes, { code: '', percentOff: 10, maxUses: 0 }])} className={SMALL_ADD}>
          + Add promo code
        </button>
      ) : null}
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Share codes with partner communities or early birds. A 100% code makes the ticket free for that buyer. Max uses 0 = unlimited.</p>
    </Field>
  );
}

function GroupDiscountField({ form, update }: SectionProps) {
  const minQuantity = form.ticketGroupDiscount?.minQuantity ?? 0;
  const percentOff = form.ticketGroupDiscount?.percentOff ?? 0;
  return (
    <Field label="Group discount (optional, e.g. buy 3+, save 10%)" as="div">
      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
        <span>Buy</span>
        <input type="number" min={0} max={10} className="ev-input w-20" value={minQuantity} onChange={(e) => update('ticketGroupDiscount', { minQuantity: toCount(e.target.value), percentOff })} />
        <span>or more tickets, each is</span>
        <input type="number" min={0} max={100} className="ev-input w-20" value={percentOff} onChange={(e) => update('ticketGroupDiscount', { minQuantity, percentOff: Math.min(100, toCount(e.target.value)) })} />
        <span>% off</span>
      </div>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Set both to activate (minimum 2 tickets). If a buyer also has a promo code, they get whichever discount is bigger, never both.</p>
    </Field>
  );
}

/** Free vs paid entry, pricing, ticket types, discounts and the ticket design. */
export function TicketingFields({ form, update, updateForm, ticketCommission, onError }: TicketingProps) {
  // Explicit Free/Paid entry choice — null until the organizer picks (or an existing event resolves it).
  const [ticketChoice, setTicketChoice] = useState<'FREE' | 'PAID' | null>(null);
  const price = form.ticketPrice ?? 0;
  const tiers = form.ticketTiers ?? [];
  const isPriced = price > 0 || tiers.length > 0;
  // The organizer's explicit pick wins; otherwise infer from saved data.
  const ticketing: 'FREE' | 'PAID' = ticketChoice ?? (isPriced ? 'PAID' : 'FREE');

  function pickFree() {
    setTicketChoice('FREE');
    updateForm({
      ticketPrice: 0,
      ticketTiers: [],
      ticketPromoCodes: [],
      ticketGroupDiscount: { minQuantity: 0, percentOff: 0 },
    });
  }

  return (
    <>
      <Field label="Entry" as="div">
        <div className="flex gap-2">
          <button type="button" onClick={pickFree} className={`flex-1 rounded-lg border px-4 py-3 text-left text-sm transition ${ticketing === 'FREE' ? ENTRY_ACTIVE : ENTRY_IDLE}`}>
            Free event
            <span className="mt-0.5 block text-xs font-normal text-slate-500 dark:text-slate-400">{form.attendanceSource === 'EXTERNAL' ? 'Register on GuildOS, then continue to the external registration site.' : 'No payment. Attendees register on GuildOS and get a QR pass.'}</span>
          </button>
          <button type="button" onClick={() => setTicketChoice('PAID')} className={`flex-1 rounded-lg border px-4 py-3 text-left text-sm transition ${ticketing === 'PAID' ? ENTRY_ACTIVE : ENTRY_IDLE}`}>
            Paid tickets
            <span className="mt-0.5 block text-xs font-normal text-slate-500 dark:text-slate-400">Sell tickets through GuildOS by card, bank transfer or USSD.</span>
          </button>
        </div>
      </Field>
      {ticketing === 'PAID' ? (
        <>
          <Field label="Ticket price (₦)">
            <input
              type="number"
              min={0}
              className="ev-input"
              value={price}
              disabled={tiers.length > 0}
              onChange={(e) => update('ticketPrice', toCount(e.target.value))}
            />
            {price === 0 && !tiers.some((t) => t.price > 0) ? (
              <p className="mt-1 rounded-lg bg-amber-50 dark:bg-amber-950/50 px-2.5 py-1.5 text-xs font-medium text-amber-800 dark:text-amber-300">
                Set a ticket price (or add priced ticket types below). Otherwise every ticket is issued free. If the event has no tickets at all, pick “Free event” above.
              </p>
            ) : null}
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {tiers.length > 0 ? 'Ticket types below set the prices for this event. ' : ''}
              Paid events register through a secure checkout. Buyers pay the ticket price plus the processing fee (card, bank transfer, or USSD via the payment provider).
              GuildOS keeps {ticketCommission !== null ? `a ${ticketCommission}% commission on` : 'a small commission of'} each ticket, and you receive the rest in your <a href="/dashboard/wallet" className="text-indigo-600 hover:underline">Wallet</a>.
              {price > 0 && ticketCommission !== null ? ` Example: on a ₦${price.toLocaleString('en-NG')} ticket you earn ₦${(price - Math.round((price * ticketCommission) / 100)).toLocaleString('en-NG')}.` : ''}
              {price > 0 && form.registrationPolicy === 'APPROVAL' ? ' Note: paid tickets confirm instantly (approval doesn’t apply to paid registrations).' : ''}
            </p>
          </Field>
          <TicketTiersField form={form} update={update} />
          {isPriced ? <PromoCodesField form={form} update={update} /> : null}
          {isPriced ? <GroupDiscountField form={form} update={update} /> : null}
        </>
      ) : null}
      {form.attendanceSource !== 'EXTERNAL' ? <TicketDesignField form={form} update={update} onError={onError} /> : null}
    </>
  );
}
