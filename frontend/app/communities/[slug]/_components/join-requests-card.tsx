'use client';

import { CheckCircle2, UserCheck, XCircle } from 'lucide-react';
import type { CommunityJoinRequest, CommunitySummary } from '../../../../components/guildos/api/community-list-api';

const MODE_INACTIVE = 'border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800';

export function JoinRequestsCard({
  community,
  isFounder,
  joinRequests,
  requestBusy,
  joinModeBusy,
  onSetJoinMode,
  onApprove,
  onReject,
}: {
  community: CommunitySummary;
  isFounder: boolean;
  joinRequests: CommunityJoinRequest[];
  /** Id of the request currently being approved/rejected. */
  requestBusy: string;
  joinModeBusy: boolean;
  onSetJoinMode: (autoApprove: boolean) => void;
  onApprove: (requestId: string) => void;
  onReject: (requestId: string) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
      <h2 className="flex items-center gap-2 text-base font-bold text-slate-950 dark:text-white">
        <UserCheck className="h-4 w-4 text-indigo-500" /> Join Requests
        {joinRequests.length > 0 && (
          <span className="ml-auto rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30">{joinRequests.length} pending</span>
        )}
      </h2>

      {/* How people join — quick toggle for the existing autoApprove flag so admins
          don't have to dig into the edit wizard. Founder-only (community updates
          are founder-gated server-side). */}
      {isFounder && community.visibility !== 'PRIVATE' && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 dark:bg-slate-900 px-3.5 py-2.5">
          <p className="mr-1 text-xs font-semibold text-slate-600 dark:text-slate-400">How people join:</p>
          <button
            onClick={() => onSetJoinMode(true)}
            disabled={joinModeBusy}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition disabled:opacity-50 ${community.autoApprove ? 'bg-emerald-600 text-white' : MODE_INACTIVE}`}
          >
            Free join (instant)
          </button>
          <button
            onClick={() => onSetJoinMode(false)}
            disabled={joinModeBusy}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition disabled:opacity-50 ${!community.autoApprove ? 'bg-amber-600 text-white' : MODE_INACTIVE}`}
          >
            Request to join (approval)
          </button>
          <p className="w-full text-[11px] text-slate-400 dark:text-slate-500">
            {community.autoApprove
              ? 'Anyone can join instantly. No approval needed.'
              : 'New members wait below until a leader approves them.'}
          </p>
        </div>
      )}

      {joinRequests.length > 0 ? (
        <div className="mt-4 space-y-2">
          {joinRequests.map((req) => (
            <div key={req._id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60 px-4 py-3">
              <div>
                <p className="font-semibold text-slate-900 dark:text-slate-100">{req.user?.fullName ?? `User ${req.userId}`}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">{new Date(req.requestedAt).toLocaleDateString('en-NG')}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => onApprove(req._id)} disabled={requestBusy === req._id} className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                </button>
                <button onClick={() => onReject(req._id)} disabled={requestBusy === req._id} className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20">
                  <XCircle className="h-3.5 w-3.5" /> Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No pending requests.</p>
      )}
    </div>
  );
}
