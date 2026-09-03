'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Ticket, Banknote, Percent, Check, X } from 'lucide-react';

import {
  getAdminPayouts,
  getAdminRefundsDue,
  getTicketCommission,
  getTicketOverview,
  markRefundSettled,
  setAdminPayoutStatus,
  setTicketCommission,
  setTicketSettings,
  type AdminPayoutRow,
  type AdminRefundRow,
  type TicketEventRow,
  type TicketOverviewTotals,
} from '../../../../components/guildos/admin-api';
import { LogoSpinner } from '../../../../components/guildos/ui/loading';
import { toast } from '../../../../components/guildos/ui/toast';
import { confirmDialog } from '../../../../components/guildos/ui/confirm-dialog';

const ngn = (v: number) => `₦${v.toLocaleString('en-NG')}`;

const PAYOUT_BADGE: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  PAID: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-rose-100 text-rose-700',
};

export default function AdminTicketsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [totals, setTotals] = useState<TicketOverviewTotals | null>(null);
  const [events, setEvents] = useState<TicketEventRow[]>([]);
  const [payouts, setPayouts] = useState<AdminPayoutRow[]>([]);
  const [refunds, setRefunds] = useState<AdminRefundRow[]>([]);
  const [commission, setCommission] = useState('');
  const [savingCommission, setSavingCommission] = useState(false);
  const [payoutMode, setPayoutMode] = useState<'MANUAL' | 'AUTO'>('MANUAL');
  const [gatewayConfigured, setGatewayConfigured] = useState(false);
  const [gatewayName, setGatewayName] = useState('');
  const [savingMode, setSavingMode] = useState(false);
  const [busyId, setBusyId] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        const [overview, payoutsRes, commissionRes, refundsRes] = await Promise.all([
          getTicketOverview(),
          getAdminPayouts(),
          getTicketCommission(),
          getAdminRefundsDue(),
        ]);
        setTotals(overview.totals);
        setEvents(overview.events);
        setPayouts(payoutsRes.payouts);
        setRefunds(refundsRes.refunds);
        setCommission(String(commissionRes.commissionPercent));
        setPayoutMode(commissionRes.payoutMode);
        setGatewayConfigured(commissionRes.gatewayConfigured);
        setGatewayName(commissionRes.gateway);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load ticket data');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleSaveCommission() {
    try {
      setSavingCommission(true);
      const { commissionPercent } = await setTicketCommission(Number(commission));
      setCommission(String(commissionPercent));
      toast.success(`Commission set to ${commissionPercent}%`, 'Applies to new ticket sales.');
    } catch (err) {
      toast.error('Unable to update commission', err instanceof Error ? err.message : undefined);
    } finally {
      setSavingCommission(false);
    }
  }

  async function handlePayoutMode(mode: 'MANUAL' | 'AUTO') {
    if (mode === payoutMode) return;
    try {
      setSavingMode(true);
      const result = await setTicketSettings({ payoutMode: mode });
      setPayoutMode(result.payoutMode);
      toast.success(
        result.payoutMode === 'AUTO' ? 'Automatic payouts on' : 'Manual payouts on',
        result.payoutMode === 'AUTO'
          ? 'New payout requests trigger a gateway bank transfer immediately; failures fall back to manual.'
          : 'You settle payout requests by bank transfer and mark them paid here.',
      );
    } catch (err) {
      toast.error('Unable to change payout mode', err instanceof Error ? err.message : undefined);
    } finally {
      setSavingMode(false);
    }
  }

  async function handlePayout(payout: AdminPayoutRow, status: 'PAID' | 'REJECTED') {
    const ok = await confirmDialog({
      title: status === 'PAID' ? 'Mark payout as paid?' : 'Reject this payout?',
      message:
        status === 'PAID'
          ? `Confirm you have transferred ${ngn(payout.amountNgn)} to ${payout.accountName} (${payout.bankName} ${payout.accountNumber}).`
          : `The ${ngn(payout.amountNgn)} will return to ${payout.communityName}'s available balance.`,
      confirmLabel: status === 'PAID' ? 'Mark paid' : 'Reject',
      tone: status === 'PAID' ? 'default' : 'danger',
    });
    if (!ok) return;
    try {
      setBusyId(payout._id);
      const { payout: updated } = await setAdminPayoutStatus(payout._id, status);
      setPayouts((list) => list.map((p) => (p._id === payout._id ? { ...p, status: updated.status, processedAt: updated.processedAt } : p)));
      toast.success(status === 'PAID' ? 'Payout marked as paid' : 'Payout rejected');
      // Money moved — refresh the platform totals.
      void getTicketOverview().then((overview) => setTotals(overview.totals)).catch(() => undefined);
    } catch (err) {
      toast.error('Unable to update payout', err instanceof Error ? err.message : undefined);
    } finally {
      setBusyId('');
    }
  }

  async function handleMarkRefunded(refund: AdminRefundRow) {
    const ok = await confirmDialog({
      title: 'Mark refund as settled?',
      message: `Confirm you have sent ₦${refund.amountNgn.toLocaleString('en-NG')} back to ${refund.buyerName} (${refund.buyerEmail || refund.reference}).`,
      confirmLabel: 'Mark refunded',
    });
    if (!ok) return;
    try {
      setBusyId(refund._id);
      await markRefundSettled(refund._id);
      setRefunds((list) => list.filter((r) => r._id !== refund._id));
      toast.success('Refund marked as settled');
      void getTicketOverview().then((overview) => setTotals(overview.totals)).catch(() => undefined);
    } catch (err) {
      toast.error('Unable to mark refund', err instanceof Error ? err.message : undefined);
    } finally {
      setBusyId('');
    }
  }

  const pendingPayouts = payouts.filter((p) => p.status === 'PENDING');
  const processedPayouts = payouts.filter((p) => p.status !== 'PENDING');

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold text-slate-950 dark:text-white">Ticket sales</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Platform-wide paid-event economics: sales, commission, and organizer payouts.</p>
      </header>
      {loading ? (
        <div className="grid min-h-[40vh] place-items-center"><LogoSpinner /></div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : (
        <div className="space-y-6">
          {totals ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Tickets sold</p>
                <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{totals.ticketsSold}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Gross {ngn(totals.grossNgn)} (incl. {ngn(totals.gatewayFeesNgn)} gateway fees)</p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-950/40">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">GuildOS commission</p>
                <p className="mt-1 text-2xl font-bold text-emerald-900 dark:text-emerald-200">{ngn(totals.commissionNgn)}</p>
                <p className="text-xs text-emerald-700 dark:text-emerald-400">Platform revenue</p>
              </div>
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Owed to organizers</p>
                <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{ngn(totals.owedToOrganizersNgn)}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{ngn(totals.paidOutNgn)} already paid out</p>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-950/40">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">Pending payouts</p>
                <p className="mt-1 text-2xl font-bold text-amber-900 dark:text-amber-200">{ngn(totals.pendingPayoutsNgn)}</p>
                <p className="text-xs text-amber-700 dark:text-amber-400">{pendingPayouts.length} request{pendingPayouts.length === 1 ? '' : 's'} awaiting action</p>
              </div>
            </div>
          ) : null}

          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100"><Percent className="h-4 w-4 text-indigo-500" /> Commission rate</h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Percentage of each ticket price GuildOS keeps (0–50). Applies to new sales only.</p>
            <div className="mt-3 flex items-center gap-2">
              <input type="number" min={0} max={50} value={commission} onChange={(e) => setCommission(e.target.value)} className="w-24 rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm" />
              <span className="text-sm text-slate-500 dark:text-slate-400">%</span>
              <button onClick={() => void handleSaveCommission()} disabled={savingCommission} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{savingCommission ? 'Saving…' : 'Save'}</button>
            </div>
            <div className="mt-5 border-t border-slate-100 pt-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Payout mode</h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">How organizer withdrawals are settled.</p>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => void handlePayoutMode('MANUAL')}
                  disabled={savingMode}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-semibold ${payoutMode === 'MANUAL' ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400'}`}
                >
                  Manual — you transfer &amp; mark paid
                </button>
                <button
                  onClick={() => void handlePayoutMode('AUTO')}
                  disabled={savingMode}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-semibold ${payoutMode === 'AUTO' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400'}`}
                >
                  Auto — instant gateway transfer
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Auto sends the money through {gatewayName || 'the active gateway'}'s Transfers API the moment an organizer requests a payout
                (needs a funded gateway balance{gatewayName === 'PAYSTACK' ? ' and OTP-for-transfers disabled in the Paystack dashboard' : ''}).
                Any failed transfer safely falls back to a pending request you settle manually.
              </p>
              {payoutMode === 'AUTO' && !gatewayConfigured ? (
                <p className="mt-1 text-xs font-medium text-amber-700">No {gatewayName || 'gateway'} secret key is configured — auto payouts will fall back to manual until a key is added.</p>
              ) : null}
            </div>
          </section>

          {refunds.length ? (
            <section className="rounded-2xl border border-rose-200 bg-rose-50/40 p-5 shadow-sm">
              <h2 className="flex items-center gap-2 text-sm font-bold text-rose-900"><Banknote className="h-4 w-4" /> Refunds to settle ({refunds.length})</h2>
              <p className="mt-0.5 text-xs text-rose-700">The gateway refund failed for these buyers — send the money back by bank transfer, then mark it settled.</p>
              <div className="mt-3 space-y-2">
                {refunds.map((r) => (
                  <div key={r._id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-white dark:bg-slate-900 px-4 py-3 text-sm">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        ₦{r.amountNgn.toLocaleString('en-NG')} — {r.buyerName}
                        {r.partial ? <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">Partial · ticket stays valid</span> : null}
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">{r.eventTitle} · {r.buyerEmail || r.reference} · since {new Date(r.since).toLocaleDateString('en-NG')}</p>
                    </div>
                    <button onClick={() => void handleMarkRefunded(r)} disabled={busyId === r._id} className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"><Check className="h-3.5 w-3.5" /> Mark refunded</button>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100"><Banknote className="h-4 w-4 text-indigo-500" /> Payout requests</h2>
            {!payouts.length ? (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No payout requests yet.</p>
            ) : (
              <div className="mt-3 space-y-4">
                {pendingPayouts.length ? (
                  <div className="space-y-2">
                    {pendingPayouts.map((p) => (
                      <div key={p._id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm">
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-slate-100">{ngn(p.amountNgn)} — {p.communityName}</p>
                          <p className="text-xs text-slate-600 dark:text-slate-400">{p.bankName} · {p.accountNumber} · {p.accountName} · requested by {p.requestedByName} on {new Date(p.requestedAt).toLocaleDateString('en-NG')}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => void handlePayout(p, 'PAID')} disabled={busyId === p._id} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"><Check className="h-3.5 w-3.5" /> Mark paid</button>
                          <button onClick={() => void handlePayout(p, 'REJECTED')} disabled={busyId === p._id} className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-rose-600 disabled:opacity-50"><X className="h-3.5 w-3.5" /> Reject</button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
                {processedPayouts.length ? (
                  <div className="divide-y divide-slate-100">
                    {processedPayouts.map((p) => (
                      <div key={p._id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                        <div>
                          <p className="font-medium text-slate-800 dark:text-slate-200">{ngn(p.amountNgn)} — {p.communityName}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{p.bankName} · {p.accountName} · {p.processedAt ? new Date(p.processedAt).toLocaleDateString('en-NG') : ''}</p>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${PAYOUT_BADGE[p.status] ?? 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400'}`}>{p.status}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100"><Ticket className="h-4 w-4 text-indigo-500" /> Sales by event</h2>
            {!events.length ? (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No paid tickets sold yet.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      <th className="py-2 pr-3">Event</th>
                      <th className="py-2 pr-3">Community</th>
                      <th className="py-2 pr-3">Price</th>
                      <th className="py-2 pr-3">Sold</th>
                      <th className="py-2 pr-3">Gross</th>
                      <th className="py-2 pr-3">Commission</th>
                      <th className="py-2 pr-3">Organizer</th>
                      <th className="py-2">Last sale</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {events.map((e) => (
                      <tr key={e.eventId}>
                        <td className="py-2.5 pr-3">
                          {e.slug ? <Link href={`/events/${e.slug}`} className="font-medium text-indigo-600 hover:underline">{e.title}</Link> : e.title}
                        </td>
                        <td className="py-2.5 pr-3 text-slate-700 dark:text-slate-300">{e.communityName}</td>
                        <td className="py-2.5 pr-3 text-slate-700 dark:text-slate-300">{ngn(e.ticketPriceNgn)}</td>
                        <td className="py-2.5 pr-3 font-semibold text-slate-900 dark:text-slate-100">{e.sold}</td>
                        <td className="py-2.5 pr-3 text-slate-700 dark:text-slate-300">{ngn(e.grossNgn)}</td>
                        <td className="py-2.5 pr-3 text-emerald-700">{ngn(e.commissionNgn)}</td>
                        <td className="py-2.5 pr-3 text-slate-700 dark:text-slate-300">{ngn(e.organizerNgn)}</td>
                        <td className="py-2.5 text-slate-500 dark:text-slate-400">{e.lastSaleAt ? new Date(e.lastSaleAt).toLocaleDateString('en-NG') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
