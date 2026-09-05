'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Wallet, Banknote, Landmark, Clock, Ticket, Lock, CheckCircle2, XCircle, TrendingUp, ArrowDownToLine, Hourglass, type LucideIcon } from 'lucide-react';

import { getCurrentUser } from '../../../components/guildos/auth-api';
import {
  getCommunityWallet,
  getManagedCommunities,
  requestWalletPayout,
  resolveWalletAccount,
  type CommunitySummary,
  type CommunityWallet,
} from '../../../components/guildos/community-list-api';
import { DashboardShell } from '../../../components/guildos/dashboard-shell';
import { DashboardSidebar } from '../../../components/guildos/dashboard-sidebar';
import { DashboardTopbar } from '../../../components/guildos/dashboard-topbar';
import { LogoSpinner } from '../../../components/guildos/ui/loading';
import { SelectMenu } from '../../../components/guildos/ui/select-menu';
import { toast } from '../../../components/guildos/ui/toast';

const ngn = (v: number) => `₦${v.toLocaleString('en-NG')}`;

const PAYOUT_META: Record<string, { chip: string; Icon: LucideIcon; iconTone: string }> = {
  PENDING: { chip: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300', Icon: Clock, iconTone: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400' },
  PAID: { chip: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300', Icon: CheckCircle2, iconTone: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400' },
  REJECTED: { chip: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300', Icon: XCircle, iconTone: 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400' },
};

export default function WalletPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [communities, setCommunities] = useState<CommunitySummary[]>([]);
  const [communityId, setCommunityId] = useState('');
  const [wallet, setWallet] = useState<CommunityWallet | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState('');
  // Payout request form
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Live bank-account verification (like banking apps: name appears once the number resolves)
  const [verifyState, setVerifyState] = useState<'idle' | 'checking' | 'verified' | 'failed'>('idle');
  const [verifyMessage, setVerifyMessage] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const user = await getCurrentUser();
        if (!user) {
          window.location.href = '/login';
          return;
        }
        const response = await getManagedCommunities();
        setCommunities(response.communities);
        if (response.communities.length) setCommunityId(response.communities[0]._id);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load communities');
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, []);

  useEffect(() => {
    if (!communityId) {
      setWallet(null);
      return;
    }
    let cancelled = false;
    setWalletLoading(true);
    setWalletError('');
    void (async () => {
      try {
        const { wallet } = await getCommunityWallet(communityId);
        if (!cancelled) {
          setWallet(wallet);
          // Enter bank details once — prefill from the most recent payout request.
          const last = wallet.payouts[0];
          if (last) {
            setBankName(last.bankName);
            setAccountNumber(last.accountNumber);
            setAccountName(last.accountName);
          } else {
            setBankName('');
            setAccountNumber('');
            setAccountName('');
          }
        }
      } catch (err) {
        if (!cancelled) {
          setWallet(null);
          setWalletError(err instanceof Error ? err.message : 'Unable to load wallet');
        }
      } finally {
        if (!cancelled) setWalletLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [communityId]);

  // Debounced account-name lookup: fires once bank + 10-digit number are in.
  useEffect(() => {
    const digits = accountNumber.replace(/\D/g, '');
    if (!showForm || !communityId || bankName.trim().length < 3 || digits.length !== 10) {
      setVerifyState('idle');
      setVerifyMessage('');
      return;
    }
    let cancelled = false;
    setVerifyState('checking');
    setVerifyMessage('');
    const timer = setTimeout(async () => {
      try {
        const result = await resolveWalletAccount(communityId, bankName.trim(), digits);
        if (cancelled) return;
        if (result.verified && result.accountName) {
          setAccountName(result.accountName);
          setVerifyState('verified');
          setVerifyMessage(result.accountName);
        } else {
          setVerifyState('idle');
          setVerifyMessage('');
        }
      } catch (err) {
        if (cancelled) return;
        setVerifyState('failed');
        setVerifyMessage(err instanceof Error ? err.message : 'Could not verify the account');
      }
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [showForm, communityId, bankName, accountNumber]);

  async function handleRequestPayout() {
    if (!communityId || !wallet) return;
    try {
      setSubmitting(true);
      const { payout } = await requestWalletPayout(communityId, {
        amountNgn: Math.round(Number(amount) || 0),
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        accountName: accountName.trim(),
      });
      toast.success('Payout requested', `${ngn(payout.amountNgn)} will be transferred to ${payout.accountName} once approved.`);
      setShowForm(false);
      setAmount('');
      const { wallet: refreshed } = await getCommunityWallet(communityId);
      setWallet(refreshed);
    } catch (err) {
      toast.error('Unable to request payout', err instanceof Error ? err.message : undefined);
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <DashboardShell sidebar={<DashboardSidebar />} topbar={<DashboardTopbar />}>
        <div className="grid min-h-[40vh] place-items-center"><LogoSpinner /></div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell sidebar={<DashboardSidebar />} topbar={<DashboardTopbar />}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-950 dark:text-white"><Wallet className="h-6 w-6 text-indigo-500" /> Wallet</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Ticket earnings for your community — request payouts to your bank account.</p>
          </div>
          {communities.length > 1 ? (
            <SelectMenu
              aria-label="Community"
              className="w-56"
              value={communityId}
              onChange={setCommunityId}
              options={communities.map((c) => ({ value: c._id, label: c.name }))}
            />
          ) : null}
        </div>

        {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/50 dark:text-rose-300">{error}</div> : null}

        {!communities.length ? (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-sm text-slate-500 dark:text-slate-400">You don't manage any communities yet.</div>
        ) : walletLoading ? (
          <div className="space-y-4">
            <div className="h-48 animate-pulse rounded-3xl bg-slate-200 dark:bg-slate-900" />
            <div className="grid gap-3 sm:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-white dark:bg-slate-900" />)}</div>
          </div>
        ) : walletError ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/50 dark:text-amber-300">{walletError}</div>
        ) : wallet ? (
          <>
            {/* Balance card — the fintech-style hero. Available = money that can move right now. */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-slate-900 p-6 text-white shadow-lg sm:p-7">
              <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-white/10" aria-hidden />
              <div className="pointer-events-none absolute -bottom-28 right-28 h-72 w-72 rounded-full bg-white/5" aria-hidden />
              <div className="pointer-events-none absolute -left-16 -bottom-20 h-52 w-52 rounded-full bg-indigo-400/10" aria-hidden />
              <div className="relative flex flex-wrap items-start justify-between gap-6">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-indigo-200">
                    <Wallet className="h-3.5 w-3.5" /> Available balance
                  </p>
                  <p className="mt-2 text-4xl font-extrabold tabular-nums sm:text-5xl">{ngn(wallet.availableNgn)}</p>
                  <p className="mt-2 truncate text-xs text-indigo-200">
                    {communities.find((c) => c._id === communityId)?.name ?? 'Community'} · {wallet.payoutMode === 'AUTO' ? 'Instant payouts' : 'Payouts reviewed by GuildOS'}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {wallet.canWithdraw ? (
                    <button
                      onClick={() => { setShowForm(true); setAmount(String(wallet.availableNgn || '')); }}
                      disabled={wallet.availableNgn < 1000 || wallet.pendingPayoutNgn > 0 || showForm}
                      className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-indigo-700 shadow-sm transition hover:bg-indigo-50 disabled:opacity-50"
                    >
                      <ArrowDownToLine className="h-4 w-4" /> Withdraw
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium text-indigo-100 backdrop-blur">
                      <Lock className="h-3.5 w-3.5" /> View only
                    </span>
                  )}
                  {wallet.pendingPayoutNgn > 0 ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 px-3 py-1 text-[11px] font-semibold text-amber-200">
                      <Clock className="h-3 w-3" /> {ngn(wallet.pendingPayoutNgn)} processing
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-2xl bg-white/10 px-3.5 py-2.5 backdrop-blur">
                  <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-indigo-200"><Hourglass className="h-3 w-3" /> On hold</p>
                  <p className="mt-0.5 text-lg font-bold tabular-nums">{ngn(wallet.heldNgn)}</p>
                </div>
                <div className="rounded-2xl bg-white/10 px-3.5 py-2.5 backdrop-blur">
                  <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-indigo-200"><TrendingUp className="h-3 w-3" /> Total earned</p>
                  <p className="mt-0.5 text-lg font-bold tabular-nums">{ngn(wallet.earnedNgn)}</p>
                </div>
                <div className="rounded-2xl bg-white/10 px-3.5 py-2.5 backdrop-blur">
                  <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-indigo-200"><Banknote className="h-3 w-3" /> Paid out</p>
                  <p className="mt-0.5 text-lg font-bold tabular-nums">{ngn(wallet.paidOutNgn)}</p>
                </div>
                <div className="rounded-2xl bg-white/10 px-3.5 py-2.5 backdrop-blur">
                  <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-indigo-200"><Ticket className="h-3 w-3" /> Tickets sold</p>
                  <p className="mt-0.5 text-lg font-bold tabular-nums">{wallet.ticketsSold}</p>
                </div>
              </div>
              <p className="relative mt-4 text-[11px] leading-relaxed text-indigo-200/90">
                Earnings are released after each event takes place — if an event is cancelled, held funds go back to the buyers.
              </p>
            </div>

            {wallet.canWithdraw ? (
              showForm ? (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400"><Landmark className="h-4.5 w-4.5" /></span>
                    <div>
                      <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Withdraw to bank</h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {wallet.payoutMode === 'AUTO'
                          ? 'The transfer is sent the moment you submit. Minimum ₦1,000.'
                          : 'GuildOS reviews and transfers your balance. Minimum ₦1,000.'}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <label className="text-sm">
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Amount (₦)</span>
                      <input type="number" min={1000} max={wallet.availableNgn} value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500/40" />
                      <span className="mt-1 block text-[11px] text-slate-400 dark:text-slate-500">Up to {ngn(wallet.availableNgn)}</span>
                    </label>
                    <label className="text-sm">
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Bank name</span>
                      <input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. Guaranty Trust Bank" className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40" />
                    </label>
                    <label className="text-sm">
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Account number</span>
                      <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} inputMode="numeric" className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500/40" />
                      {verifyState === 'checking' ? (
                        <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">Checking account…</span>
                      ) : verifyState === 'verified' ? (
                        <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" /> {verifyMessage}</span>
                      ) : verifyState === 'failed' ? (
                        <span className="mt-1 block text-xs text-rose-600 dark:text-rose-400">{verifyMessage}</span>
                      ) : null}
                    </label>
                    <label className="text-sm">
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Account name</span>
                      <input value={accountName} onChange={(e) => setAccountName(e.target.value)} readOnly={verifyState === 'verified'} className={`mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 ${verifyState === 'verified' ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-white dark:bg-slate-950'}`} />
                    </label>
                    <div className="flex items-center gap-2 sm:col-span-2">
                      <button onClick={() => void handleRequestPayout()} disabled={submitting} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50">
                        <ArrowDownToLine className="h-4 w-4" /> {submitting ? 'Requesting…' : wallet.payoutMode === 'AUTO' ? 'Withdraw now' : 'Submit request'}
                      </button>
                      <button onClick={() => setShowForm(false)} disabled={submitting} className="rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 transition hover:bg-slate-50 dark:hover:bg-slate-800">Cancel</button>
                    </div>
                  </div>
                </div>
              ) : null
            ) : (
              <p className="flex items-center gap-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-4 text-xs text-slate-500 dark:text-slate-400">
                <Lock className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
                You can see the community's finances as an Organizer — withdrawals and bank details are handled by the Treasurer and senior leaders.
              </p>
            )}

            {/* Per-event rollup — computed from the recent-sales ledger already loaded (no extra API call). */}
            {wallet.sales.some((s) => !s.refunded) ? (
              <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
                <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100"><TrendingUp className="h-4 w-4 text-indigo-500" /> Sales by event</h2>
                <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">From your most recent sales — refunded sales excluded.</p>
                <div className="mt-3 space-y-2.5">
                  {(() => {
                    const byEvent = new Map<string, { title: string; slug: string; sold: number; earnedNgn: number }>();
                    for (const s of wallet.sales) {
                      if (s.refunded) continue;
                      const key = s.eventSlug || s.eventTitle;
                      const row = byEvent.get(key) ?? { title: s.eventTitle, slug: s.eventSlug, sold: 0, earnedNgn: 0 };
                      row.sold += 1;
                      row.earnedNgn += s.earnedNgn;
                      byEvent.set(key, row);
                    }
                    const rows = [...byEvent.values()].sort((a, b) => b.earnedNgn - a.earnedNgn);
                    const max = rows[0]?.earnedNgn || 1;
                    return rows.map((r) => (
                      <div key={r.slug || r.title}>
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-sm">
                          <span className="min-w-0 truncate">
                            {r.slug ? <Link href={`/events/${r.slug}`} className="font-medium text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline">{r.title}</Link> : <span className="font-medium text-slate-900 dark:text-slate-100">{r.title}</span>}
                          </span>
                          <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                            {r.sold} sold · <span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">{ngn(r.earnedNgn)}</span>
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                          <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.max(4, Math.round((r.earnedNgn / max) * 100))}%` }} />
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </section>
            ) : null}

            {wallet.payouts.length ? (
              <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
                <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100"><Banknote className="h-4 w-4 text-indigo-500" /> Payout history</h2>
                <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
                  {wallet.payouts.map((p) => {
                    const meta = PAYOUT_META[p.status] ?? { chip: 'bg-slate-100 text-slate-600 dark:bg-slate-950 dark:text-slate-400', Icon: Clock, iconTone: 'bg-slate-100 text-slate-500 dark:bg-slate-950 dark:text-slate-400' };
                    return (
                      <div key={p._id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${meta.iconTone}`}><meta.Icon className="h-4 w-4" /></span>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{ngn(p.amountNgn)} <span className="font-normal text-slate-400 dark:text-slate-500">→</span> {p.accountName}</p>
                          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{p.bankName} · {p.accountNumber} · requested {new Date(p.requestedAt).toLocaleDateString('en-NG')}</p>
                          {p.note ? <p className="truncate text-xs text-slate-400 dark:text-slate-500">{p.note}</p> : null}
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${meta.chip}`}>{p.status}</span>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}

            <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
              <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100"><Ticket className="h-4 w-4 text-indigo-500" /> Recent ticket sales</h2>
              {wallet.sales.length ? (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        <th className="rounded-l-lg bg-slate-50 py-2 pl-3 pr-3 font-semibold dark:bg-slate-950/60">Event</th>
                        <th className="bg-slate-50 py-2 pr-3 font-semibold dark:bg-slate-950/60">Buyer</th>
                        <th className="bg-slate-50 py-2 pr-3 font-semibold dark:bg-slate-950/60">Ticket</th>
                        <th className="bg-slate-50 py-2 pr-3 font-semibold dark:bg-slate-950/60">Commission</th>
                        <th className="bg-slate-50 py-2 pr-3 font-semibold dark:bg-slate-950/60">You earned</th>
                        <th className="rounded-r-lg bg-slate-50 py-2 pr-3 font-semibold dark:bg-slate-950/60">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {wallet.sales.map((s) => (
                        <tr key={s._id} className={s.refunded ? 'opacity-70' : undefined}>
                          <td className="py-2.5 pl-3 pr-3">
                            {s.eventSlug ? <Link href={`/events/${s.eventSlug}`} className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline">{s.eventTitle}</Link> : s.eventTitle}
                            {s.refunded && (
                              <span className="ml-2 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-600 dark:bg-rose-500/15 dark:text-rose-300" title="Event cancelled — the buyer was refunded; this sale no longer counts toward your earnings">Refunded</span>
                            )}
                          </td>
                          <td className="py-2.5 pr-3 text-slate-700 dark:text-slate-300">{s.buyerName}</td>
                          <td className="py-2.5 pr-3 tabular-nums text-slate-700 dark:text-slate-300">{ngn(s.ticketNgn)}</td>
                          <td className="py-2.5 pr-3 tabular-nums text-slate-500 dark:text-slate-400">−{ngn(s.commissionNgn)}</td>
                          <td className={`py-2.5 pr-3 font-semibold tabular-nums ${s.refunded ? 'text-slate-400 line-through dark:text-slate-500' : 'text-emerald-700 dark:text-emerald-400'}`}>{ngn(s.earnedNgn)}</td>
                          <td className="py-2.5 pr-3 text-slate-500 dark:text-slate-400">{s.paidAt ? new Date(s.paidAt).toLocaleDateString('en-NG') : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="mt-3 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 px-4 py-8 text-center">
                  <Ticket className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-700" />
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">No ticket sales yet. Set a ticket price on an event to start earning.</p>
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>
    </DashboardShell>
  );
}
