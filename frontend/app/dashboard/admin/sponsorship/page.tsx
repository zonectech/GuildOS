'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Handshake, Landmark, Package, Plus, Trash2 } from 'lucide-react';

import { getCurrentUser } from '../../../../components/guildos/auth-api';
import {
  getAdminSponsorshipInquiries,
  getAdminSponsorshipSettings,
  setAdminInquiryFeeStatus,
  updateAdminSponsorshipSettings,
  type AdminSponsorshipInquiry,
  type SponsorshipFeeSettings,
} from '../../../../components/guildos/admin-api';
import { SPONSOR_PERKS } from '../../../../components/guildos/event-api';
import { Loading } from '../../../../components/guildos/ui/loading';

const STATUS_TONE: Record<AdminSponsorshipInquiry['status'], string> = {
  NEW: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
  CONTACTED: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  WON: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  CLOSED: 'bg-slate-100 dark:bg-slate-950 text-slate-500 dark:text-slate-400',
};

const FILTERS = ['ALL', 'NEW', 'CONTACTED', 'WON', 'CLOSED'] as const;

function formatNaira(amount: number) {
  return `₦${amount.toLocaleString('en-NG')}`;
}

export default function AdminSponsorshipPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [inquiries, setInquiries] = useState<AdminSponsorshipInquiry[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('ALL');
  const [settings, setSettings] = useState<SponsorshipFeeSettings>({ sponsorshipFeePercent: 10, feeBankName: '', feeAccountNumber: '', feeAccountName: '', packageTemplates: [] });
  const [savingSettings, setSavingSettings] = useState(false);

  function updateTemplate(index: number, patch: Partial<SponsorshipFeeSettings['packageTemplates'][number]>) {
    setSettings((s) => ({
      ...s,
      packageTemplates: s.packageTemplates.map((t, i) => (i === index ? { ...t, ...patch } : t)),
    }));
  }

  function toggleTemplatePerk(index: number, key: string) {
    setSettings((s) => ({
      ...s,
      packageTemplates: s.packageTemplates.map((t, i) =>
        i === index ? { ...t, perks: t.perks.includes(key) ? t.perks.filter((k) => k !== key) : [...t.perks, key] } : t,
      ),
    }));
  }

  useEffect(() => {
    void (async () => {
      try {
        const user = await getCurrentUser();
        if (!user) {
          router.replace('/login');
          return;
        }
        if (user.role !== 'ADMIN') {
          setError('Admins only.');
          return;
        }
        const [inquiriesRes, settingsRes] = await Promise.all([
          getAdminSponsorshipInquiries(),
          getAdminSponsorshipSettings(),
        ]);
        setInquiries(inquiriesRes.inquiries);
        setSettings(settingsRes.settings);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load sponsorship pipeline');
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: inquiries.length };
    for (const q of inquiries) c[q.status] = (c[q.status] ?? 0) + 1;
    return c;
  }, [inquiries]);

  const feeTotals = useMemo(() => {
    const won = inquiries.filter((q) => q.status === 'WON' && q.dealAmount > 0);
    const pct = settings.sponsorshipFeePercent;
    const owed = won.filter((q) => q.feeStatus !== 'PAID').reduce((sum, q) => sum + Math.round((q.dealAmount * pct) / 100), 0);
    const collected = won.filter((q) => q.feeStatus === 'PAID').reduce((sum, q) => sum + Math.round((q.dealAmount * pct) / 100), 0);
    return { owed, collected };
  }, [inquiries, settings.sponsorshipFeePercent]);

  const filtered = filter === 'ALL' ? inquiries : inquiries.filter((q) => q.status === filter);

  async function handleSaveSettings() {
    try {
      setSavingSettings(true);
      setError('');
      const response = await updateAdminSponsorshipSettings(settings);
      setSettings(response.settings);
      setNotice('Fee settings saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save settings');
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleFeeToggle(inquiry: AdminSponsorshipInquiry) {
    try {
      const next = inquiry.feeStatus === 'PAID' ? 'PENDING' : 'PAID';
      const response = await setAdminInquiryFeeStatus(inquiry._id, next);
      setInquiries((current) => current.map((q) => (q._id === inquiry._id ? { ...q, feeStatus: response.inquiry.feeStatus } : q)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update fee status');
    }
  }

  if (loading) {
    return <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 shadow-sm"><Loading /></div>;
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold text-slate-950 dark:text-white">Sponsorship pipeline</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Every sponsorship inquiry across the platform. Track deals and collect the platform fee.</p>
      </header>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/50 dark:text-red-300">{error}</div> : null}
      {notice ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-950/50 dark:text-emerald-300">{notice}</div> : null}

      {/* Fee settings */}
      <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
          <Landmark className="h-4 w-4" />
          <h2 className="text-sm font-semibold">Platform fee & payment account</h2>
        </div>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Organizers see these details when they mark a deal as won, so they know how much to remit and where.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Fee percent (%)</span>
            <input
              type="number" min="0" max="50"
              value={settings.sponsorshipFeePercent}
              onChange={(e) => setSettings((s) => ({ ...s, sponsorshipFeePercent: Number(e.target.value) }))}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Bank name</span>
            <input
              value={settings.feeBankName}
              onChange={(e) => setSettings((s) => ({ ...s, feeBankName: e.target.value }))}
              placeholder="e.g. GTBank"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Account number</span>
            <input
              value={settings.feeAccountNumber}
              onChange={(e) => setSettings((s) => ({ ...s, feeAccountNumber: e.target.value }))}
              placeholder="0123456789"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Account name</span>
            <input
              value={settings.feeAccountName}
              onChange={(e) => setSettings((s) => ({ ...s, feeAccountName: e.target.value }))}
              placeholder="GuildOS Ltd"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-4 text-xs">
            <span className="text-slate-500 dark:text-slate-400">Fees pending: <span className="font-semibold text-amber-700">{formatNaira(feeTotals.owed)}</span></span>
            <span className="text-slate-500 dark:text-slate-400">Fees collected: <span className="font-semibold text-emerald-700">{formatNaira(feeTotals.collected)}</span></span>
          </div>
          <button
            onClick={() => void handleSaveSettings()}
            disabled={savingSettings}
            className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            {savingSettings ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </section>

      {/* Package templates */}
      <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
            <Package className="h-4 w-4" />
            <h2 className="text-sm font-semibold">Package templates ({settings.packageTemplates.length}/6)</h2>
          </div>
          <button
            type="button"
            onClick={() => setSettings((s) => (s.packageTemplates.length >= 6 ? s : { ...s, packageTemplates: [...s.packageTemplates, { name: '', price: '', perks: [], benefits: '' }] }))}
            disabled={settings.packageTemplates.length >= 6}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" /> Add template
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          These tiers pre-fill every organizer’s package editor when they enable sponsorship — you decide the standard deliverables, they can adjust prices.
          Tip: keep “Logo on attendee certificates” on the top tier only.
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {settings.packageTemplates.map((tpl, index) => (
            <div key={index} className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
              <input
                value={tpl.name}
                onChange={(e) => updateTemplate(index, { name: e.target.value })}
                placeholder="Tier name (e.g. Gold Sponsor)"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
              <input
                value={tpl.price}
                onChange={(e) => updateTemplate(index, { price: e.target.value })}
                placeholder="Suggested price (e.g. ₦150,000)"
                className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
              <div className="mt-3 space-y-1.5">
                {SPONSOR_PERKS.map((perk) => (
                  <label key={perk.key} className="flex cursor-pointer items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                    <input type="checkbox" checked={tpl.perks.includes(perk.key)} onChange={() => toggleTemplatePerk(index, perk.key)} />
                    <span>
                      {perk.label}
                      {perk.platformDelivered ? <span className="ml-1 rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">GuildOS</span> : null}
                    </span>
                  </label>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setSettings((s) => ({ ...s, packageTemplates: s.packageTemplates.filter((_, i) => i !== index) }))}
                className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:underline"
              >
                <Trash2 className="h-3.5 w-3.5" /> Remove tier
              </button>
            </div>
          ))}
        </div>
        <div className="mt-4 text-right">
          <button
            onClick={() => void handleSaveSettings()}
            disabled={savingSettings}
            className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            {savingSettings ? 'Saving…' : 'Save templates'}
          </button>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${filter === f ? 'bg-slate-900 text-white' : 'border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            {f === 'ALL' ? 'All' : f} ({counts[f] ?? 0})
          </button>
        ))}
      </div>

      {filtered.length ? (
        <div className="space-y-3">
          {filtered.map((q) => {
            const fee = q.dealAmount > 0 ? Math.round((q.dealAmount * settings.sponsorshipFeePercent) / 100) : 0;
            return (
              <div key={q._id} className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-950 dark:text-white">{q.companyName}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {q.contactName} · <a href={`mailto:${q.email}`} className="text-indigo-600 hover:underline">{q.email}</a>
                      {q.phone ? ` · ${q.phone}` : ''}
                    </p>
                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                      <Link href={`/events/${encodeURIComponent(q.eventSlug)}`} className="text-indigo-600 hover:underline">{q.eventTitle}</Link>
                      {q.communityName ? ` · ${q.communityName}` : ''} · {new Date(q.createdAt).toLocaleString('en-NG')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {q.packageName ? <span className="rounded-full bg-slate-100 dark:bg-slate-950 px-2.5 py-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-400">{q.packageName}</span> : null}
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_TONE[q.status]}`}>{q.status}</span>
                  </div>
                </div>
                {q.message ? <p className="mt-3 whitespace-pre-line text-sm text-slate-600 dark:text-slate-400">{q.message}</p> : null}
                {q.status === 'WON' ? (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-sm">
                    <p className="text-slate-700 dark:text-slate-300">
                      <span className="font-semibold text-emerald-800">Deal won</span>
                      {q.packageWon ? ` · ${q.packageWon}` : ''}
                      {q.dealAmount > 0 ? <> · {formatNaira(q.dealAmount)} · fee <span className="font-semibold">{formatNaira(fee)}</span></> : ' · amount not reported'}
                      {q.dealNote ? ` · ${q.dealNote}` : ''}
                    </p>
                    {q.dealAmount > 0 ? (
                      <button
                        onClick={() => void handleFeeToggle(q)}
                        className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${q.feeStatus === 'PAID' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/20'}`}
                      >
                        {q.feeStatus === 'PAID' ? 'Fee paid ✓ (click to undo)' : 'Mark fee as paid'}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-10 text-center">
          <Handshake className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No inquiries{filter !== 'ALL' ? ' with this status' : ' yet'}.</p>
        </div>
      )}
    </div>
  );
}
