'use client';

import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';

import { SelectMenu } from '../../../../components/guildos/ui/select-menu';
import { getCommunityMembersPage, type MembershipStatus } from '../../../../components/guildos/community-list-api';
import { MemberAvatar } from './leader-ui';
import { RoleBadge } from './role-badge';
import type { MemberRow } from './types';

const ASSIGNABLE_ROLES = ['MEMBER', 'VOLUNTEER', 'COORDINATOR', 'ORGANIZER', 'SECRETARY', 'TREASURER', 'VICE_PRESIDENT', 'PRESIDENT'];

/**
 * Full member roster for managers. The community context only ships the FIRST page (50);
 * searching and "Load more" go through GET /:id/members so huge communities stay fast.
 */
export function MembersCard({
  communityId,
  firstPage,
  firstPageCursor,
  firstPageTotal,
  canManageRoles,
  canManageMembers,
  isFounder,
  busyMemberId,
  onOpenPeople,
  onChangeRole,
  onSetStatus,
  onTransferOwnership,
}: {
  communityId: string;
  firstPage: MemberRow[];
  firstPageCursor: string | null;
  firstPageTotal: number;
  canManageRoles: boolean;
  canManageMembers: boolean;
  isFounder: boolean;
  busyMemberId: string;
  onOpenPeople: (kind: 'members' | 'followers') => void;
  /** Each action refreshes the community context; the card re-runs an active search after. */
  onChangeRole: (memberId: string, role: string) => Promise<void>;
  onSetStatus: (memberId: string, status: MembershipStatus) => Promise<void>;
  onTransferOwnership: (memberId: string) => Promise<void>;
}) {
  const [rows, setRows] = useState<MemberRow[]>(firstPage);
  const [cursor, setCursor] = useState<string | null>(firstPageCursor);
  const [total, setTotal] = useState(firstPageTotal);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);

  function showFirstPage() {
    setRows(firstPage);
    setCursor(firstPageCursor);
    setTotal(firstPageTotal);
  }

  // Keep the rows in sync with the context's first page — unless the admin is mid-search,
  // in which case their filtered view wins until the search is cleared.
  useEffect(() => {
    if (search.trim()) return;
    showFirstPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstPage, firstPageCursor, firstPageTotal]);

  async function runSearch(q: string) {
    try {
      setBusy(true);
      const page = await getCommunityMembersPage(communityId, { q: q.trim() || undefined });
      setRows(page.members as MemberRow[]);
      setCursor(page.nextCursor);
      setTotal(page.total);
    } catch {
      /* keep the previous rows on transient failures */
    } finally {
      setBusy(false);
    }
  }

  async function loadMore() {
    if (!cursor) return;
    try {
      setBusy(true);
      const page = await getCommunityMembersPage(communityId, { cursor, q: search.trim() || undefined });
      setRows((prev) => [...prev, ...(page.members as MemberRow[])]);
      setCursor(page.nextCursor);
      setTotal(page.total);
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }

  async function act(action: Promise<void>) {
    await action;
    if (search.trim()) void runSearch(search);
  }

  if (!(rows.length > 0 || search.trim() || firstPage.length > 0)) return null;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
      <h2 className="flex items-center gap-2 text-base font-bold text-slate-950 dark:text-white">
        <Users className="h-4 w-4 text-indigo-500" /> All Members
        <span className="ml-auto rounded-full bg-slate-100 dark:bg-slate-950 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:text-slate-400">{total}</span>
      </h2>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
        <button type="button" onClick={() => onOpenPeople('members')} className="font-semibold text-indigo-600 hover:underline">
          View all members
        </button>
        <span className="text-slate-300 dark:text-slate-700">•</span>
        <button type="button" onClick={() => onOpenPeople('followers')} className="font-semibold text-indigo-600 hover:underline">
          View all followers
        </button>
      </div>
      {(total > 10 || search.trim()) && (
        <input
          type="text"
          value={search}
          onChange={(e) => {
            const q = e.target.value;
            setSearch(q);
            if (q.trim().length >= 2) void runSearch(q);
            else if (!q.trim()) showFirstPage();
          }}
          placeholder="Search members by name…"
          className="mt-3 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none transition focus:border-indigo-400"
        />
      )}
      <div className="mt-4 space-y-2">
        {rows.length === 0 && (
          <p className="py-4 text-center text-sm text-slate-500 dark:text-slate-400">{busy ? 'Searching…' : 'No members match your search.'}</p>
        )}
        {rows.map((entry) => {
          const memberId = entry.membership._id;
          const rowBusy = busyMemberId === memberId;
          return (
            <div key={entry.user.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60 px-4 py-3">
              <MemberAvatar fullName={entry.user.fullName} avatar={entry.user.profile?.avatar} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-slate-900 dark:text-slate-100">{entry.user.fullName}</p>
                {entry.membership.status && entry.membership.status !== 'ACTIVE' && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">{entry.membership.status}</span>
                )}
              </div>
              {canManageRoles && entry.membership.role !== 'FOUNDER' ? (
                <SelectMenu
                  aria-label="Member role"
                  className="w-44"
                  size="sm"
                  value={entry.membership.role}
                  onChange={(v) => void act(onChangeRole(memberId, v))}
                  disabled={rowBusy}
                  options={ASSIGNABLE_ROLES.map((r) => ({ value: r, label: r.replace('_', ' ') }))}
                />
              ) : <RoleBadge role={entry.membership.role} />}
              {canManageMembers && entry.membership.role !== 'FOUNDER' && (
                <div className="flex gap-1.5">
                  {entry.membership.status === 'SUSPENDED' ? (
                    <button onClick={() => void act(onSetStatus(memberId, 'ACTIVE'))} disabled={rowBusy} className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20">Reactivate</button>
                  ) : (
                    <button onClick={() => void act(onSetStatus(memberId, 'SUSPENDED'))} disabled={rowBusy} className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 transition hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/20">Suspend</button>
                  )}
                  <button onClick={() => void act(onSetStatus(memberId, 'REMOVED'))} disabled={rowBusy} className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20">Remove</button>
                  {isFounder && (
                    <button onClick={() => void act(onTransferOwnership(memberId))} disabled={rowBusy} className="rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700 transition hover:bg-violet-100 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300 dark:hover:bg-violet-500/20">Transfer</button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {cursor && (
        <button
          onClick={() => void loadMore()}
          disabled={busy}
          className="mt-4 w-full rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 transition hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
        >
          {busy ? 'Loading…' : `Load more (${rows.length} of ${total})`}
        </button>
      )}
    </div>
  );
}
