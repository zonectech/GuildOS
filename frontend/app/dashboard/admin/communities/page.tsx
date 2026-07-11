'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Building2, Search } from 'lucide-react';

import {
  getAdminCommunities,
  suspendCommunity,
  restoreCommunity,
  setCommunityPremium,
  getPremiumPricing,
  setPremiumPricing,
  type AdminCommunity,
  type PremiumPricing,
} from '../../../../components/guildos/admin-api';
import { promptDialog } from '../../../../components/guildos/ui/confirm-dialog';
import { Loading } from '../../../../components/guildos/ui/loading';

export default function AdminCommunitiesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [communities, setCommunities] = useState<AdminCommunity[]>([]);
  const [query, setQuery] = useState('');
  const [pricing, setPricing] = useState<PremiumPricing | null>(null);
  const [pricingBusy, setPricingBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const { communities: list } = await getAdminCommunities();
        setCommunities(list);
        try { setPricing(await getPremiumPricing()); } catch { /* pricing optional */ }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load communities');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function savePricing() {
    if (!pricing) return;
    try {
      setPricingBusy(true);
      const saved = await setPremiumPricing({ price: pricing.price, eventPrice: pricing.eventPrice, gatewayFee: pricing.gatewayFee, gateway: pricing.gateway });
      setPricing(saved);
      setNotice('Premium pricing updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update pricing');
    } finally {
      setPricingBusy(false);
    }
  }

  async function toggle(c: AdminCommunity) {
    try {
      if (c.suspended) {
        await restoreCommunity(c.id);
        setNotice(`${c.name} restored.`);
      } else {
        const reason = await promptDialog({ title: `Suspend ${c.name}?`, message: 'This hides its posts and events until restored.', placeholder: 'Reason (optional)', confirmLabel: 'Suspend', tone: 'danger' });
        if (reason === null) return;
        await suspendCommunity(c.id, reason);
        setNotice(`${c.name} suspended.`);
      }
      setCommunities((list) => list.map((x) => (x.id === c.id ? { ...x, suspended: !c.suspended } : x)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    }
  }

  async function togglePremium(c: AdminCommunity) {
    try {
      const next = !c.isPremium;
      await setCommunityPremium(c.id, next);
      setNotice(`${c.name} premium ${next ? 'enabled' : 'disabled'}.`);
      setCommunities((list) => list.map((x) => (x.id === c.id ? { ...x, isPremium: next } : x)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    }
  }

  const filtered = communities.filter((c) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || c.university.toLowerCase().includes(q) || c.category.toLowerCase().includes(q);
  });

  if (loading) {
    return <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm"><Loading /></div>;
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-950"><Building2 className="h-6 w-6" /> Communities</h1>
        <p className="text-sm text-slate-500">Grant or revoke premium (unlocks certificate customization tools), suspend a community that breaks the rules, or restore a suspended one. Premium changes are logged in the Audit trail.</p>
      </header>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {notice ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}

      {pricing ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-800">Premium pricing & gateway fee</p>
          <p className="mt-0.5 text-xs text-slate-500">Buyers pay the base price plus the gateway processing fee (grossed up so you receive the base price net). Set the fee to match Paystack or Flutterwave.</p>

          <div className="mt-3">
            <p className="mb-1.5 text-xs font-medium text-slate-600">Active payment gateway (only one is used)</p>
            <div className="flex flex-wrap gap-2">
              {(['PAYSTACK', 'FLUTTERWAVE'] as const).map((g) => {
                const configured = pricing.gatewayConfigured?.[g];
                const active = pricing.gateway === g;
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setPricing({ ...pricing, gateway: g })}
                    className={`rounded-xl border px-3 py-2 text-left text-xs transition ${active ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200 hover:bg-slate-50'}`}
                  >
                    <span className="block font-semibold text-slate-800">{g === 'PAYSTACK' ? 'Paystack' : 'Flutterwave'}{active ? ' · ON' : ''}</span>
                    <span className={`mt-0.5 block text-[11px] ${configured ? 'text-emerald-600' : 'text-amber-600'}`}>{configured ? 'API key set' : 'API key missing'}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500">The selected gateway is enabled; the other is off. Add its secret key to the backend .env to go live.</p>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="text-xs font-medium text-slate-600">Monthly price (₦)
              <input type="number" min={0} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={pricing.price} onChange={(e) => setPricing({ ...pricing, price: Number(e.target.value) })} />
            </label>
            <label className="text-xs font-medium text-slate-600">Per-event price (₦)
              <input type="number" min={0} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={pricing.eventPrice} onChange={(e) => setPricing({ ...pricing, eventPrice: Number(e.target.value) })} />
            </label>
            <label className="text-xs font-medium text-slate-600">Fee percent (%)
              <input type="number" min={0} step={0.1} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={pricing.gatewayFee.percent} onChange={(e) => setPricing({ ...pricing, gatewayFee: { ...pricing.gatewayFee, percent: Number(e.target.value) } })} />
            </label>
            <label className="text-xs font-medium text-slate-600">Flat fee (₦)
              <input type="number" min={0} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={pricing.gatewayFee.flat} onChange={(e) => setPricing({ ...pricing, gatewayFee: { ...pricing.gatewayFee, flat: Number(e.target.value) } })} />
            </label>
            <label className="text-xs font-medium text-slate-600">Fee cap (₦)
              <input type="number" min={0} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={pricing.gatewayFee.cap} onChange={(e) => setPricing({ ...pricing, gatewayFee: { ...pricing.gatewayFee, cap: Number(e.target.value) } })} />
            </label>
            <label className="text-xs font-medium text-slate-600">Flat waived under (₦)
              <input type="number" min={0} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={pricing.gatewayFee.waiver} onChange={(e) => setPricing({ ...pricing, gatewayFee: { ...pricing.gatewayFee, waiver: Number(e.target.value) } })} />
            </label>
          </div>
          <div className="mt-3">
            <button type="button" onClick={() => void savePricing()} disabled={pricingBusy} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50">
              {pricingBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save pricing
            </button>
            <span className="ml-3 text-xs text-slate-500">Flutterwave (local cards): ~1.4%, flat 0, cap ₦2,000. Paystack: 1.5% + ₦100, cap ₦2,000, flat waived under ₦2,500.</span>
          </div>
        </div>
      ) : null}

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search communities" className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {filtered.length ? (
          <ul className="divide-y divide-slate-100">
            {filtered.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Link href={`/communities/${encodeURIComponent(c.slug)}`} className="truncate text-sm font-medium text-slate-900 hover:underline">{c.name}</Link>
                    {c.isPremium ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">⭐ Premium</span> : null}
                    {c.suspended ? <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">Suspended</span> : null}
                  </div>
                  <p className="truncate text-xs text-slate-500">{[c.university, c.category].filter(Boolean).join(' · ')} · {c.memberCount} members · {c.eventCount} events{c.suspended && c.archiveReason ? ` · ${c.archiveReason}` : ''}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => void togglePremium(c)}
                    className={`rounded-2xl px-4 py-2 text-sm font-medium ${c.isPremium ? 'border border-slate-300 text-slate-600 hover:bg-slate-50' : 'border border-amber-300 text-amber-700 hover:bg-amber-50'}`}
                  >
                    {c.isPremium ? 'Revoke premium' : 'Grant premium'}
                  </button>
                  <button
                    onClick={() => void toggle(c)}
                    className={`rounded-2xl px-4 py-2 text-sm font-medium ${c.suspended ? 'border border-emerald-300 text-emerald-700 hover:bg-emerald-50' : 'border border-rose-300 text-rose-700 hover:bg-rose-50'}`}
                  >
                    {c.suspended ? 'Restore' : 'Suspend'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-8 text-center text-sm text-slate-500">No communities found.</p>
        )}
      </div>
    </div>
  );
}
