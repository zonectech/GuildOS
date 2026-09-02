'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Wallet, Banknote, Landmark, Clock, Ticket } from 'lucide-react';

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

const PAYOUT_BADGE: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  PAID: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-rose-100 text-rose-700',
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

        {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

        {!communities.length ? (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-sm text-slate-500 dark:text-slate-400">You don't manage any communities yet.</div>
        ) : walletLoading ? (
          <div className="grid gap-3 sm:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-white dark:bg-slate-900" />)}</div>
        ) : walletError ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{walletError}</div>
        ) : wallet ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Available</p>
                <p className="mt-1 text-2xl font-bold text-emerald-900">{ngn(wallet.availableNgn)}</p>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">On hold</p>
                <p className="mt-1 text-2xl font-bold text-amber-900">{ngn(wallet.heldNgn)}</p>
                <p className="text-xs text-amber-700">Released when each event takes place</p>
              </div>
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Total earned</p>
                <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{ngn(wallet.earnedNgn)}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{wallet.ticketsSold} ticket{wallet.ticketsSold === 1 ? '' : 's'} sold</p>
              </div>
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Paid out</p>
                <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{ngn(wallet.paidOutNgn)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Pending payout</p>
                <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{ngn(wallet.pendingPayoutNgn)}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100"><Landmark className="h-4 w-4 text-indigo-500" /> Withdraw to bank</h2>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {wallet.payoutMode === 'AUTO'
                      ? 'Payouts are automatic — the transfer is sent to your bank the moment you request it. Minimum ₦1,000.'
                      : "GuildOS transfers your balance to your community's bank account. Minimum ₦1,000."}
                    {' '}Earnings are released after each event takes place — if an event is cancelled, held funds go back to the buyers.
                  </p>
                </div>
                {!showForm ? (
                  <button
                    onClick={() => { setShowForm(true); setAmount(String(wallet.availableNgn || '')); }}
                    disabled={wallet.availableNgn < 1000 || wallet.pendingPayoutNgn > 0}
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Request payout
                  </button>
                ) : null}
              </div>
              {wallet.pendingPayoutNgn > 0 ? (
                <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-amber-700"><Clock className="h-3.5 w-3.5" /> A payout of {ngn(wallet.pendingPayoutNgn)} is awaiting processing.</p>
              ) : null}
              {showForm ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="text-sm">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Amount (₦)</span>
                    <input type="number" min={1000} max={wallet.availableNgn} value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm" />
                  </label>
                  <label className="text-sm">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Bank name</span>
                    <input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. GTBank" className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm" />
                  </label>
                  <label className="text-sm">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Account number</span>
                    <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} inputMode="numeric" className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm" />
                    {verifyState === 'checking' ? (
                      <span className="mt-1 block text-xs text-slate-500">Checking account…</span>
                    ) : verifyState === 'verified' ? (
                      <span className="mt-1 block text-xs font-semibold text-emerald-600">✓ {verifyMessage}</span>
                    ) : verifyState === 'failed' ? (
                      <span className="mt-1 block text-xs text-rose-600">{verifyMessage}</span>
                    ) : null}
                  </label>
                  <label className="text-sm">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Account name</span>
                    <input value={accountName} onChange={(e) => setAccountName(e.target.value)} readOnly={verifyState === 'verified'} className={`mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm ${verifyState === 'verified' ? 'bg-emerald-50 dark:bg-emerald-500/10' : ''}`} />
                  </label>
                  <div className="flex items-center gap-2 sm:col-span-2">
                    <button onClick={() => void handleRequestPayout()} disabled={submitting} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{submitting ? 'Requesting…' : 'Submit request'}</button>
                    <button onClick={() => setShowForm(false)} disabled={submitting} className="rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400">Cancel</button>
                  </div>
                </div>
              ) : null}
            </div>

            {wallet.payouts.length ? (
              <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
                <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100"><Banknote className="h-4 w-4 text-indigo-500" /> Payout history</h2>
                <div className="mt-3 divide-y divide-slate-100">
                  {wallet.payouts.map((p) => (
                    <div key={p._id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-slate-100">{ngn(p.amountNgn)} → {p.accountName}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{p.bankName} · {p.accountNumber} · requested {new Date(p.requestedAt).toLocaleDateString('en-NG')}</p>
                        {p.note ? <p className="text-xs text-slate-500 dark:text-slate-400">Note: {p.note}</p> : null}
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${PAYOUT_BADGE[p.status] ?? 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400'}`}>{p.status}</span>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
              <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100"><Ticket className="h-4 w-4 text-indigo-500" /> Recent ticket sales</h2>
              {wallet.sales.length ? (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        <th className="py-2 pr-3">Event</th>
                        <th className="py-2 pr-3">Buyer</th>
                        <th className="py-2 pr-3">Ticket</th>
                        <th className="py-2 pr-3">Commission</th>
                        <th className="py-2 pr-3">You earned</th>
                        <th className="py-2">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {wallet.sales.map((s) => (
                        <tr key={s._id}>
                          <td className="py-2.5 pr-3">
                            {s.eventSlug ? <Link href={`/events/${s.eventSlug}`} className="font-medium text-indigo-600 hover:underline">{s.eventTitle}</Link> : s.eventTitle}
                          </td>
                          <td className="py-2.5 pr-3 text-slate-700 dark:text-slate-300">{s.buyerName}</td>
                          <td className="py-2.5 pr-3 text-slate-700 dark:text-slate-300">{ngn(s.ticketNgn)}</td>
                          <td className="py-2.5 pr-3 text-slate-500 dark:text-slate-400">−{ngn(s.commissionNgn)}</td>
                          <td className="py-2.5 pr-3 font-semibold text-emerald-700">{ngn(s.earnedNgn)}</td>
                          <td className="py-2.5 text-slate-500 dark:text-slate-400">{s.paidAt ? new Date(s.paidAt).toLocaleDateString('en-NG') : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No ticket sales yet. Set a ticket price on an event to start earning.</p>
              )}
            </section>
          </>
        ) : null}
      </div>
    </DashboardShell>
  );
}
