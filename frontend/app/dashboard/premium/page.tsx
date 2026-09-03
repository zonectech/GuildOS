'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Crown, Loader2, CheckCircle2, Wallet, XCircle } from 'lucide-react';

import { getCurrentUser } from '../../../components/guildos/auth-api';
import {
  getPremiumStatus,
  startPremiumCheckout,
  payPremiumFromWallet,
  verifyPremiumPayment,
  getPremiumHistory,
  reconcileCommunityPayment,
  type PremiumStatus,
  type PremiumPayment,
} from '../../../components/guildos/event-api';
import { DashboardShell } from '../../../components/guildos/dashboard-shell';
import { DashboardSidebar } from '../../../components/guildos/dashboard-sidebar';
import { DashboardTopbar } from '../../../components/guildos/dashboard-topbar';
import { LogoSpinner } from '../../../components/guildos/ui/loading';

function formatNaira(n: number) {
  return `₦${n.toLocaleString('en-NG')}`;
}

function formatDate(value?: string | null) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' });
}

function PremiumPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const communityId = params.get('communityId') ?? '';
  const reference = params.get('reference') ?? params.get('trxref') ?? params.get('tx_ref') ?? '';

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [status, setStatus] = useState<PremiumStatus | null>(null);
  const [payments, setPayments] = useState<PremiumPayment[]>([]);

  async function refresh() {
    const s = await getPremiumStatus(communityId);
    setStatus(s);
    try {
      const { payments: list } = await getPremiumHistory(communityId);
      setPayments(list);
    } catch {
      /* leaders only; ignore */
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        const user = await getCurrentUser();
        if (!user) {
          router.replace('/login');
          return;
        }
        if (!communityId) {
          setError('No community selected.');
          return;
        }
        // Returning from Paystack — verify the payment first.
        if (reference) {
          try {
            const result = await verifyPremiumPayment(communityId, reference);
            setNotice(
              result.status === 'PAID'
                ? { tone: 'ok', text: 'Payment successful — premium is now active.' }
                : { tone: 'err', text: 'Payment was not completed. You have not been charged.' },
            );
          } catch (err) {
            setNotice({ tone: 'err', text: err instanceof Error ? err.message : 'Unable to verify payment' });
          }
        }
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load premium');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [communityId, reference]);

  async function handleUpgrade() {
    try {
      setBusy(true);
      setError('');
      const { authorizationUrl } = await startPremiumCheckout(communityId);
      window.location.href = authorizationUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start payment');
      setBusy(false);
    }
  }

  /** One month of premium paid straight from ticket earnings — no card, no gateway fee. */
  async function handlePayFromWallet() {
    try {
      setBusy(true);
      setError('');
      const result = await payPremiumFromWallet(communityId);
      const fresh = await getPremiumStatus(communityId);
      setStatus(fresh);
      setNotice({ tone: 'ok', text: `Paid from wallet — premium is active${result.premiumExpiresAt ? ` until ${formatDate(result.premiumExpiresAt)}` : ''}.` });
      try {
        const { payments: list } = await getPremiumHistory(communityId);
        setPayments(list);
      } catch { /* ignore */ }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to pay from wallet');
    } finally {
      setBusy(false);
    }
  }

  async function handleCheckStatus() {
    try {
      setBusy(true);
      setError('');
      const result = await reconcileCommunityPayment(communityId);
      setStatus(result.status);
      try {
        const { payments: list } = await getPremiumHistory(communityId);
        setPayments(list);
      } catch { /* ignore */ }
      setNotice(
        result.recovered > 0
          ? { tone: 'ok', text: 'Found your payment — premium is now active.' }
          : { tone: 'err', text: result.pending > 0 ? 'Payment still pending. If you were charged, try again in a minute.' : 'No pending payment found.' },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to check payment');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="grid min-h-[60vh] place-items-center"><LogoSpinner /></div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
      <button onClick={() => router.back()} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <header className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-600"><Crown className="h-6 w-6" /></div>
        <div>
          <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Premium</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Unlock certificate customization — colours, fonts, wording and multiple signatures.</p>
        </div>
      </header>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      {notice ? (
        <div className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm ${notice.tone === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-950/50 dark:text-emerald-300' : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/50 dark:text-rose-300'}`}>
          {notice.tone === 'ok' ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />} {notice.text}
        </div>
      ) : null}

      {/* Status card */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
        {status?.isPremium ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-700"><Crown className="h-4 w-4" /> Premium active</span>
              {status.premiumExpiresAt ? <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Renews / expires on <span className="font-semibold">{formatDate(status.premiumExpiresAt)}</span></p> : null}
            </div>
            {status.paymentsEnabled || (status.walletAvailableNgn ?? 0) >= status.monthlyPrice ? (
              <div className="flex flex-wrap items-center gap-2">
                {(status.walletAvailableNgn ?? 0) >= status.monthlyPrice ? (
                  <button onClick={() => void handlePayFromWallet()} disabled={busy} className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50" title={`Wallet balance: ${formatNaira(status.walletAvailableNgn ?? 0)}`}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />} Extend from wallet · {formatNaira(status.monthlyPrice)}
                  </button>
                ) : null}
                {status.paymentsEnabled ? (
                  <button onClick={() => void handleUpgrade()} disabled={busy} className="inline-flex items-center gap-2 rounded-2xl border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Extend by 1 month · {formatNaira(status.monthlyTotal ?? status.monthlyPrice)}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">Upgrade to Premium</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{formatNaira(status?.monthlyPrice ?? 0)} / month — cancel anytime, no auto-charge.{status?.monthlyFee ? ` Incl. ${formatNaira(status.monthlyFee)} gateway fee → ${formatNaira(status.monthlyTotal ?? 0)} total.` : ''}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(status?.walletAvailableNgn ?? 0) >= (status?.monthlyPrice ?? Number.POSITIVE_INFINITY) ? (
                <button onClick={() => void handlePayFromWallet()} disabled={busy} className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50" title={`Wallet balance: ${formatNaira(status?.walletAvailableNgn ?? 0)}`}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />} Pay from wallet · {formatNaira(status?.monthlyPrice ?? 0)}
                </button>
              ) : null}
              {status?.paymentsEnabled ? (
                <button onClick={() => void handleUpgrade()} disabled={busy} className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600 disabled:opacity-50">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />} Upgrade · {formatNaira(status?.monthlyTotal ?? status?.monthlyPrice ?? 0)}
                </button>
              ) : (status?.walletAvailableNgn ?? 0) < (status?.monthlyPrice ?? 0) ? (
                <span className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-4 py-2 text-xs text-slate-500 dark:text-slate-400">Card payment isn&apos;t set up yet — sell tickets to build a wallet balance ({formatNaira(status?.walletAvailableNgn ?? 0)} of {formatNaira(status?.monthlyPrice ?? 0)}), or ask an admin.</span>
              ) : null}
            </div>
          </div>
        )}
        {status && !status.isPremium && status.paymentsEnabled ? (
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Already paid but not activated?{' '}
            <button onClick={() => void handleCheckStatus()} disabled={busy} className="font-semibold text-amber-700 underline underline-offset-2 disabled:opacity-50">Check payment status</button>
          </p>
        ) : null}
        <ul className="mt-5 grid gap-2 text-sm text-slate-600 dark:text-slate-400 sm:grid-cols-2">
          {['Custom accent colours', 'Backgrounds (Ivory / White / Navy)', 'Font styles', 'Custom title & wording', 'Custom message paragraph', 'Up to 3 signatures'].map((f) => (
            <li key={f} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> {f}</li>
          ))}
        </ul>
      </div>

      {/* Payment history */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <h2 className="text-base font-bold text-slate-950 dark:text-white">Payment history</h2>
        {payments.length ? (
          <div className="mt-3 overflow-hidden rounded-2xl border border-slate-100">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900 text-left text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Amount</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Covers until</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p) => (
                  <tr key={p.reference}>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-400">{formatDate(p.createdAt)}</td>
                    <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-200">{formatNaira(p.amount)}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${p.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : p.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 dark:bg-slate-950 text-slate-500 dark:text-slate-400'}`}>{p.status}</span>
                    </td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-400">{formatDate(p.periodEnd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No payments yet.</p>
        )}
      </div>
    </div>
  );
}

export default function PremiumPage() {
  return (
    <DashboardShell sidebar={<DashboardSidebar />} topbar={<DashboardTopbar />}>
      <Suspense fallback={<div className="grid min-h-[60vh] place-items-center"><LogoSpinner /></div>}>
        <PremiumPageInner />
      </Suspense>
    </DashboardShell>
  );
}
