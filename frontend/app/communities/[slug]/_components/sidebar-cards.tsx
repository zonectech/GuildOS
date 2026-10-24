'use client';

import { useState } from 'react';
import { Award, Bell, CalendarDays, CheckCircle2, ChevronRight, Copy, Link2, LogOut, Megaphone, Trash2, UserPlus, XCircle } from 'lucide-react';

import {
  sendCommunityAnnouncement,
  type CommunityMemberAnalytics, type CommunitySummary,
} from '../../../../components/guildos/community-list-api';
import { MemberAvatar } from './leader-ui';
import type { CommunityContext } from './types';

const SIDEBAR_CARD = 'rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm';
const SIDEBAR_HEADING = 'mb-3 text-sm font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500';

export type ChecklistItem = { label: string; done: boolean; href: string };

/** Founder setup checklist — fights the empty-community cold start. `#invite` opens the email-invite modal. */
export function SetupChecklistCard({ items, onInvite }: { items: ChecklistItem[]; onInvite: () => void }) {
  const doneCount = items.filter((i) => i.done).length;
  return (
    <div className="rounded-3xl border border-indigo-200 dark:border-indigo-500/30 bg-white dark:bg-slate-900 p-5 shadow-sm">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wide text-indigo-500">Setup checklist</h3>
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          {doneCount}/{items.length}
        </span>
      </div>
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-950">
        <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${Math.round((doneCount / items.length) * 100)}%` }} />
      </div>
      <div className="space-y-1.5">
        {items.map((item) => (
          item.done ? (
            <p key={item.label} className="flex items-center gap-2 text-sm text-slate-400 dark:text-slate-500">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
              <span className="line-through">{item.label}</span>
            </p>
          ) : item.href === '#invite' ? (
            <button key={item.label} onClick={onInvite} className="flex w-full items-center gap-2 text-left text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-indigo-600">
              <ChevronRight className="h-4 w-4 shrink-0 text-indigo-400" /> {item.label}
            </button>
          ) : (
            <a key={item.label} href={item.href} className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-indigo-600">
              <ChevronRight className="h-4 w-4 shrink-0 text-indigo-400" /> {item.label}
            </a>
          )
        ))}
      </div>
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      {children}
    </div>
  );
}

export function CommunityInfoCard({ community, showNotes }: { community: CommunitySummary; showNotes: boolean }) {
  return (
    <div className={SIDEBAR_CARD}>
      <h3 className={SIDEBAR_HEADING}>Community Info</h3>
      <div className="space-y-2.5 text-sm">
        <InfoRow label="Visibility">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${community.visibility === 'PUBLIC' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400'}`}>{community.visibility}</span>
        </InfoRow>
        <InfoRow label="Status">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${community.verificationStatus === 'VERIFIED' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : community.verificationStatus === 'REJECTED' ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'}`}>{community.verificationStatus}</span>
        </InfoRow>
        <InfoRow label="Category">
          <span className="font-medium text-slate-800 dark:text-slate-200">{community.category}</span>
        </InfoRow>
        <InfoRow label="Founded">
          <span className="font-medium text-slate-800 dark:text-slate-200">{new Date(community.createdAt).toLocaleDateString('en-NG', { month: 'short', year: 'numeric' })}</span>
        </InfoRow>
        {community.verificationMethod && (
          <InfoRow label="Verified via">
            <span className="font-medium text-slate-800 dark:text-slate-200">
              {community.verificationMethod === 'UNIVERSITY_EMAIL' ? 'Uni email' : community.verificationMethod === 'ENDORSEMENT' ? 'Endorsement' : 'Admin'}
            </span>
          </InfoRow>
        )}
      </div>
      {showNotes && community.verificationNotes && (
        <p className="mt-3 rounded-xl bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs text-slate-600 dark:text-slate-400">Note: {community.verificationNotes}</p>
      )}
    </div>
  );
}

/** Permission-backed leaders (Membership roles), as opposed to the curated roster. */
export function LeadersMiniList({ leadership }: { leadership: NonNullable<CommunityContext['leadership']> }) {
  return (
    <div className={SIDEBAR_CARD}>
      <h3 className={SIDEBAR_HEADING}>Leaders</h3>
      <div className="space-y-2.5">
        {leadership.slice(0, 5).map((entry) => (
          <div key={entry.user.id} className="flex items-center gap-3">
            <MemberAvatar fullName={entry.user.fullName} avatar={entry.user.profile?.avatar} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{entry.user.fullName}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">{entry.membership.role.replace('_', ' ')}</p>
            </div>
            {entry.membership.role === 'FOUNDER' && <Award className="h-4 w-4 shrink-0 text-violet-500" />}
          </div>
        ))}
        {leadership.length > 5 && (
          <p className="pt-1 text-xs text-slate-400 dark:text-slate-500">+{leadership.length - 5} more leaders</p>
        )}
      </div>
    </div>
  );
}

const ACTION_BASE = 'flex w-full items-center gap-2.5 rounded-2xl border px-4 py-2.5 text-sm font-medium transition';
const ACTION_NEUTRAL = `${ACTION_BASE} border-slate-100 text-slate-700 dark:text-slate-300 hover:border-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800`;

export function CommunityActionsCard({
  canLeave, canInvite, canInviteByEmail, canCreateEvent, canAnnounce, canDelete, canArchive,
  inviteLink, actionBusy, inviteBusy,
  onLeave, onCreateInviteLink, onCopyInviteLink, onRevokeInviteLink, onInviteByEmail, onToggleAnnounce, onDelete, onArchive,
}: {
  canLeave: boolean;
  canInvite: boolean;
  canInviteByEmail: boolean;
  canCreateEvent: boolean;
  canAnnounce: boolean;
  canDelete: boolean;
  canArchive: boolean;
  inviteLink: string;
  actionBusy: boolean;
  inviteBusy: boolean;
  onLeave: () => void;
  onCreateInviteLink: () => void;
  onCopyInviteLink: () => void;
  onRevokeInviteLink: () => void;
  onInviteByEmail: () => void;
  onToggleAnnounce: () => void;
  onDelete: () => void;
  onArchive: () => void;
}) {
  return (
    <div className={SIDEBAR_CARD}>
      <h3 className={SIDEBAR_HEADING}>Actions</h3>
      <div className="space-y-2">
        {canLeave && (
          <button onClick={onLeave} disabled={actionBusy} className={`${ACTION_BASE} border-slate-100 text-slate-700 dark:text-slate-300 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 dark:border-slate-800 dark:hover:border-rose-500/30 dark:hover:bg-rose-500/10 dark:hover:text-rose-300`}>
            <LogOut className="h-4 w-4" /> Leave community
          </button>
        )}
        {canInvite && (
          <button onClick={onCreateInviteLink} disabled={inviteBusy} className={ACTION_NEUTRAL}>
            <Link2 className="h-4 w-4" /> Generate invite link
          </button>
        )}
        {inviteLink && (
          <>
            <button onClick={onCopyInviteLink} className={`${ACTION_BASE} border-indigo-100 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20`}>
              <Copy className="h-4 w-4" /> Copy invite link
            </button>
            <button onClick={onRevokeInviteLink} disabled={inviteBusy} className={`${ACTION_BASE} border-rose-100 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20`}>
              <XCircle className="h-4 w-4" /> Revoke invite link
            </button>
          </>
        )}
        {canInviteByEmail && (
          <button onClick={onInviteByEmail} className={ACTION_NEUTRAL}>
            <UserPlus className="h-4 w-4" /> Invite by email
          </button>
        )}
        {canCreateEvent && (
          <a href="/dashboard/events/create" className={ACTION_NEUTRAL}>
            <CalendarDays className="h-4 w-4" /> Create event
          </a>
        )}
        {canAnnounce && (
          <button onClick={onToggleAnnounce} className={`${ACTION_BASE} border-indigo-100 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-500/30 dark:text-indigo-300 dark:hover:bg-indigo-500/10`}>
            <Bell className="h-4 w-4" /> Send announcement
          </button>
        )}
        {canDelete && (
          <button onClick={onDelete} disabled={actionBusy} className={`${ACTION_BASE} border-rose-100 text-rose-700 hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-400 dark:hover:bg-rose-500/10`}>
            <Trash2 className="h-4 w-4" /> Delete community
          </button>
        )}
        {canArchive && (
          <button onClick={onArchive} disabled={actionBusy} className={`${ACTION_BASE} border-amber-100 text-amber-700 hover:bg-amber-50 dark:border-amber-500/30 dark:text-amber-400 dark:hover:bg-amber-500/10`}>
            <XCircle className="h-4 w-4" /> Archive community
          </button>
        )}
      </div>
    </div>
  );
}

/** Growth, engagement and role mix (COORDINATOR+). */
export function MemberAnalyticsCard({ analytics }: { analytics: CommunityMemberAnalytics }) {
  const max = Math.max(1, ...analytics.joinsByMonth.map((m) => m.count));
  return (
    <div className={SIDEBAR_CARD}>
      <h3 className={SIDEBAR_HEADING}>Member analytics</h3>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-slate-50 dark:bg-slate-900 px-3 py-2.5">
          <p className="text-lg font-extrabold text-slate-900 dark:text-slate-100">{analytics.totalMembers}</p>
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Active members</p>
        </div>
        <div className="rounded-2xl bg-emerald-50 px-3 py-2.5 dark:bg-emerald-950/50">
          <p className="text-lg font-extrabold text-emerald-700 dark:text-emerald-300">+{analytics.newLast30Days}</p>
          <p className="text-[11px] font-medium text-emerald-600">New (30 days)</p>
        </div>
        <div className="rounded-2xl bg-indigo-50 px-3 py-2.5 dark:bg-indigo-950/50">
          <p className="text-lg font-extrabold text-indigo-700 dark:text-indigo-300">{analytics.engagedLast60Days}</p>
          <p className="text-[11px] font-medium text-indigo-600">Engaged (60 days)</p>
        </div>
        <div className="rounded-2xl bg-amber-50 px-3 py-2.5 dark:bg-amber-950/50">
          <p className="text-lg font-extrabold text-amber-700 dark:text-amber-300">{analytics.dormantMembers}</p>
          <p className="text-[11px] font-medium text-amber-600">Dormant</p>
        </div>
      </div>
      <div className="mt-4">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Joins in the last 12 months</p>
        <div className="flex h-16 items-end gap-1">
          {analytics.joinsByMonth.map((m) => (
            <div key={m.month} className="group relative flex-1">
              <div
                className="w-full rounded-t bg-indigo-400 transition group-hover:bg-indigo-600"
                style={{ height: `${Math.max(3, Math.round((m.count / max) * 60))}px` }}
                title={`${m.month}: ${m.count} join${m.count === 1 ? '' : 's'}`}
              />
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-slate-400 dark:text-slate-500">
          <span>{analytics.joinsByMonth[0]?.month}</span>
          <span>{analytics.joinsByMonth[analytics.joinsByMonth.length - 1]?.month}</span>
        </div>
      </div>
      {analytics.departedMembers > 0 && (
        <p className="mt-3 text-[11px] text-slate-400 dark:text-slate-500">{analytics.departedMembers} member{analytics.departedMembers === 1 ? '' : 's'} left or removed overall · {analytics.followerCount} follower{analytics.followerCount === 1 ? '' : 's'}</p>
      )}
    </div>
  );
}

/** In-app announcement to every active member + optional branded email (SECRETARY+). */
export function AnnouncementComposer({ communityId, onError }: { communityId: string; onError: (message: string) => void }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [emailToo, setEmailToo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');

  async function handleSend() {
    try {
      setBusy(true);
      onError('');
      const result = await sendCommunityAnnouncement(communityId, { title, body, emailToo });
      setDone(`Sent to ${result.recipients} member${result.recipients === 1 ? '' : 's'}${result.emailed ? ` (${result.emailed} emailed)` : ''}.`);
      setTitle('');
      setBody('');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unable to send announcement');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-3xl border border-indigo-200 dark:border-indigo-500/30 bg-white dark:bg-slate-900 p-5 shadow-sm">
      <h3 className="mb-3 inline-flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-indigo-500"><Megaphone className="h-4 w-4" /> Announcement</h3>
      {done ? <p className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">{done}</p> : null}
      <div className="space-y-2.5">
        <input className="w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm" placeholder="Title" value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, 120))} />
        <textarea className="min-h-24 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100" placeholder="Message to all members…" value={body}
          onChange={(e) => setBody(e.target.value.slice(0, 2000))} />
        <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400">
          <input type="checkbox" checked={emailToo} onChange={(e) => setEmailToo(e.target.checked)} />
          Also send as branded email
        </label>
        <button
          disabled={busy || !title.trim() || !body.trim()}
          onClick={() => void handleSend()}
          className="w-full rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? 'Sending…' : 'Send to all members'}
        </button>
      </div>
    </div>
  );
}
