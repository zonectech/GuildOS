'use client';

import { confirmDialog } from '../../../../components/guildos/ui/confirm-dialog';
import { LogoSpinner } from '../../../../components/guildos/ui/loading';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Award, BadgeCheck, Archive, Copy, ExternalLink, FileUp, GraduationCap, PenLine, Plus, RotateCcw, Trash2, UserCog,
} from 'lucide-react';

import { getCurrentUser } from '../../../../components/guildos/auth-api';
import {
  getCommunity, resolveAvatarUrl,
  getCommunityLeaders, getCommunityLeaderSessions, updateCommunityLeader, removeCommunityLeader,
  type CommunitySummary, type CommunityLeader, type CommunityLeaderSession,
} from '../../../../components/guildos/community-list-api';
import { StudentNav } from '../../../../components/guildos/student-nav';

import { ImageLightbox, LeaderCardAction, MemberAvatar } from '../_components/leader-ui';
import { LeaderDetailModal } from '../_components/leader-detail-modal';
import { LeaderEditorModal } from '../_components/leader-editor-modal';
import { LeaderCertificatePanel } from './_components/leader-certificate-panel';
import { ImportLeadersModal } from './_components/import-leaders-modal';
import { DissolveSessionModal } from './_components/dissolve-session-modal';
import { HandoverModal } from './_components/handover-modal';

const NO_SESSION_LABEL = 'No session';

/** The stored session string for a bucket label ('' for the "No session" bucket). */
function sessionValueOf(label: string | null) {
  return label === NO_SESSION_LABEL ? '' : label ?? '';
}

function parseSessionStartYear(label: string): number | null {
  const match = /^(\d{4})\/(\d{4})$/.exec(label.trim());
  return match ? Number(match[1]) : null;
}

/**
 * Picks which session counts as "Current": among sessions with at least one ACTIVE leader,
 * whichever has the highest starting year (parsed from "YYYY/YYYY") — NOT whichever was most
 * recently touched, since dissolving a session (a bulk status update) would otherwise make it
 * look freshly active again. Falls back to array order (already sorted by recent activity by
 * the backend) when nothing parses as a proper session year. Null when there are no leaders yet.
 */
function pickCurrentSessionLabel(buckets: Array<{ label: string; activeCount: number }>): string | null {
  if (buckets.length === 0) return null;
  const pool = buckets.some((b) => b.activeCount > 0) ? buckets.filter((b) => b.activeCount > 0) : buckets;
  let best = pool[0];
  let bestYear = parseSessionStartYear(best.label);
  for (const b of pool.slice(1)) {
    const y = parseSessionStartYear(b.label);
    if (y !== null && (bestYear === null || y > bestYear)) {
      best = b;
      bestYear = y;
    }
  }
  return best.label;
}

type OpenModal =
  | { kind: 'editor'; leader: CommunityLeader | null }
  | { kind: 'import' }
  | { kind: 'dissolve' }
  | { kind: 'handover' }
  | null;

const CHIP_BASE = 'rounded-full px-3.5 py-1.5 text-xs font-semibold transition';
const CHIP_IDLE = 'border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800';
const CARD_ACTION = 'rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1.5 text-slate-500 dark:text-slate-400 transition';

export default function CommunityLeadersPage() {
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [community, setCommunity] = useState<CommunitySummary | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [leaders, setLeaders] = useState<CommunityLeader[]>([]);
  const [leadersLoading, setLeadersLoading] = useState(false);
  const [leaderSessions, setLeaderSessions] = useState<CommunityLeaderSession[]>([]);
  const [actionError, setActionError] = useState('');
  // Archive / restore / delete on a roster card in flight.
  const [rowBusy, setRowBusy] = useState(false);
  // Every tab — including "Current" — is a specific session's full roster (current + past
  // members of that session; archived ones are flagged, not hidden). "Current" is simply an
  // alias for whichever session is most recently active — it is NOT a cross-session
  // "active status" filter, so a session's own archived members still show up under it.
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [viewLeader, setViewLeader] = useState<CommunityLeader | null>(null);
  // Full-size click-to-preview for any photo shown in the add/edit form.
  const [photoLightbox, setPhotoLightbox] = useState('');
  const [modal, setModal] = useState<OpenModal>(null);
  const [copiedSessionLink, setCopiedSessionLink] = useState(false);

  /** Fetches one session's full roster (current + past members of that session). */
  async function fetchLeadersForView(communityId: string, session: string | null) {
    if (session === null) {
      setLeaders([]);
      return;
    }
    setLeadersLoading(true);
    try {
      const { leaders: fetched } = await getCommunityLeaders(communityId, { session: sessionValueOf(session) });
      setLeaders(fetched ?? []);
    } finally {
      setLeadersLoading(false);
    }
  }

  async function refreshSessions(communityId: string) {
    const { sessions: fetched } = await getCommunityLeaderSessions(communityId);
    setLeaderSessions(fetched ?? []);
    return fetched ?? [];
  }

  useEffect(() => {
    const load = async () => {
      try {
        const user = await getCurrentUser();
        if (!user) {
          router.replace('/login');
          return;
        }

        const response = await getCommunity(slug);
        setCommunity(response.community);
        const role = response.viewerMembership?.role;
        setCanManage(Boolean(role && ['VICE_PRESIDENT', 'PRESIDENT', 'FOUNDER'].includes(role)));

        if (response.community?._id) {
          const fetchedSessions = await refreshSessions(response.community._id);
          const defaultSession = pickCurrentSessionLabel(
            fetchedSessions.map((s) => ({ label: s.session.trim() || NO_SESSION_LABEL, activeCount: s.activeCount })),
          );
          setSelectedSession(defaultSession);
          await fetchLeadersForView(response.community._id, defaultSession);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load leadership team');
      } finally {
        setIsLoading(false);
      }
    };

    if (slug) {
      void load();
    }
  }, [router, slug]);

  // Session buckets (label + counts), most-recently-active first. Sourced from the lightweight
  // /leaders/sessions endpoint so browsing history doesn't require fetching every leader up front.
  const sessions = useMemo(
    () =>
      leaderSessions.map((s) => ({
        label: s.session.trim() || NO_SESSION_LABEL,
        total: s.total,
        activeCount: s.activeCount,
        archivedCount: s.archivedCount,
        pastCount: s.pastCount,
      })),
    [leaderSessions],
  );

  // "Current" is an alias for whichever session has the highest starting year among those with
  // at least one ACTIVE leader — NOT the most-recently-touched bucket (dissolving a session is a
  // bulk status update, so it must never make the just-dissolved session look "current" again).
  const currentSessionLabel = useMemo(() => pickCurrentSessionLabel(sessions), [sessions]);
  const currentSessionActiveCount = sessions.find((s) => s.label === currentSessionLabel)?.activeCount ?? 0;
  const otherSessions = useMemo(() => sessions.filter((s) => s.label !== currentSessionLabel), [sessions, currentSessionLabel]);

  // Existing session labels (most recently active first) — offered as autocomplete
  // suggestions so leaders re-use "2026/2027" instead of typos like "2026/27".
  const sessionSuggestions = useMemo(() => sessions.map((s) => s.label).filter((l) => l !== NO_SESSION_LABEL), [sessions]);

  function selectSession(session: string) {
    setSelectedSession(session);
    if (community) void fetchLeadersForView(community._id, session);
  }

  async function refreshLeaders() {
    if (!community) return;
    const fetchedSessions = await refreshSessions(community._id);
    const mapped = fetchedSessions.map((s) => ({ label: s.session.trim() || NO_SESSION_LABEL, activeCount: s.activeCount }));
    // The currently-selected session might no longer exist (e.g. its last leader was just
    // deleted) — fall back to whichever session is now "Current", or null if there are none left.
    const stillExists = selectedSession !== null && mapped.some((s) => s.label === selectedSession);
    const nextSession = stillExists ? selectedSession : pickCurrentSessionLabel(mapped);
    if (nextSession !== selectedSession) setSelectedSession(nextSession);
    await fetchLeadersForView(community._id, nextSession);
  }

  // Group "collect your certificate" link for whichever session is being browsed —
  // available any time after a dissolve, not just in the dissolve results view.
  function sessionCertificatesPath() {
    return `/communities/${community?.slug}/leaders/certificates?session=${encodeURIComponent(sessionValueOf(selectedSession))}`;
  }

  async function copySessionCertificatesLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${sessionCertificatesPath()}`);
      setCopiedSessionLink(true);
      setTimeout(() => setCopiedSessionLink(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  async function runRowAction(action: () => Promise<unknown>, fallbackError: string) {
    try {
      setRowBusy(true);
      await action();
      await refreshLeaders();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : fallbackError);
    } finally {
      setRowBusy(false);
    }
  }

  async function handleArchiveLeader(leaderId: string) {
    if (!community) return;
    const confirmed = await confirmDialog({
      title: 'Archive this leader?',
      message: "They'll be marked as having left the post before their session ended. They stay on record, flagged as an individual exception. This is different from dissolving the whole session.",
      confirmLabel: 'Archive',
    });
    if (!confirmed) return;
    await runRowAction(() => updateCommunityLeader(community._id, leaderId, { status: 'ARCHIVED' }), 'Unable to archive leader');
  }

  async function handleRemoveLeader(leaderId: string) {
    if (!community) return;
    const confirmed = await confirmDialog({ title: 'Permanently delete this entry?', message: 'This cannot be undone.', confirmLabel: 'Delete', tone: 'danger' });
    if (!confirmed) return;
    await runRowAction(() => removeCommunityLeader(community._id, leaderId), 'Unable to remove leader');
  }

  if (isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-100 dark:bg-slate-950">
        <LogoSpinner />
      </div>
    );
  }

  if (error || !community) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
        <StudentNav active="/communities" />
        <main className="mx-auto max-w-2xl px-4 py-10">
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/50 dark:text-red-300">{error || 'Community not found'}</div>
        </main>
      </div>
    );
  }

  const closeModal = () => setModal(null);

  return (
    <div className="min-h-screen bg-[#F4F6FA] dark:bg-slate-950">
      <StudentNav active="/communities" />
      <main className="mx-auto max-w-4xl px-4 py-6">
        <a href={`/communities/${community.slug}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 dark:text-slate-400 transition hover:text-slate-700">
          <ArrowLeft className="h-4 w-4" /> Back to {community.name}
        </a>

        <div className="mt-4 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            {community.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={resolveAvatarUrl(community.logo)} alt={community.name} className="h-12 w-12 shrink-0 rounded-2xl border border-slate-200 dark:border-slate-800 object-cover" />
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-lg font-bold text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
                {community.name.slice(0, 1)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="flex items-center gap-2 text-lg font-extrabold text-slate-950 dark:text-white">
                <Award className="h-5 w-5 text-indigo-500" /> Leadership Team
              </h1>
              <p className="truncate text-sm text-slate-500 dark:text-slate-400">{community.name}</p>
            </div>
            {canManage && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setModal({ kind: 'handover' })}
                  title="Give the listed leaders real management roles"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 px-3.5 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <UserCog className="h-4 w-4" /> Hand over roles
                </button>
                <button
                  onClick={() => setModal({ kind: 'import' })}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 px-3.5 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <FileUp className="h-4 w-4" /> Import from document
                </button>
                <button
                  onClick={() => setModal({ kind: 'editor', leader: null })}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20"
                >
                  <Plus className="h-4 w-4" /> Add leader
                </button>
              </div>
            )}
          </div>

          {actionError && (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/50 dark:text-rose-300">{actionError}</div>
          )}

          {/* Session chips — every chip (including "Current") is a specific session's full
              roster. "Current" is the session with the highest starting year that still has
              at least one active leader; its own archived/past members still show up there
              (flagged, not hidden) — browsing by session is how you see who led in earlier years. */}
          {currentSessionLabel !== null && (
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                onClick={() => selectSession(currentSessionLabel)}
                className={`${CHIP_BASE} ${selectedSession === currentSessionLabel ? 'bg-slate-900 text-white' : CHIP_IDLE}`}
                title={`Current session${currentSessionLabel !== NO_SESSION_LABEL ? `: ${currentSessionLabel}` : ''}`}
              >
                Current{currentSessionLabel !== NO_SESSION_LABEL ? ` · ${currentSessionLabel}` : ''}
              </button>
              {otherSessions.map((s) => (
                <button
                  key={s.label}
                  onClick={() => selectSession(s.label)}
                  className={`${CHIP_BASE} ${selectedSession === s.label ? 'bg-slate-900 text-white' : CHIP_IDLE}`}
                  title={`${s.activeCount} active${s.archivedCount > 0 ? `, ${s.archivedCount} archived` : ''}${s.pastCount > 0 ? `, ${s.pastCount} past` : ''}`}
                >
                  {s.label} ({s.total})
                </button>
              ))}
            </div>
          )}

          {/* Dissolve session — bulk end-of-term action, shown only for the Current session
              while it still has active leaders. Distinct from archiving one person who left early. */}
          {canManage && selectedSession === currentSessionLabel && currentSessionActiveCount > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-500/30 dark:bg-amber-950/50">
              <div>
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">Ending this session?</p>
                <p className="text-xs text-amber-700 dark:text-amber-300">Dissolving moves everyone currently serving to Past Leadership together, then you can add a new set of leaders under a new session.</p>
              </div>
              <button
                onClick={() => setModal({ kind: 'dissolve' })}
                disabled={rowBusy}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50"
              >
                <GraduationCap className="h-3.5 w-3.5" /> Dissolve session
              </button>
            </div>
          )}

          {/* Certificates directory for the session being viewed — appears whenever this
              session has issued certificates (i.e. it was dissolved with certificates), so
              admins can grab the group "collect your certificate" link anytime later. */}
          {canManage && leaders.some((l) => l.certificate) && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/70 px-4 py-3 dark:border-indigo-500/30 dark:bg-indigo-500/10">
              <div>
                <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">
                  Certificates issued for this session ({leaders.filter((l) => l.certificate).length})
                </p>
                <p className="text-xs text-indigo-700 dark:text-indigo-300">One public link for the whole set. Each person finds their name and downloads their own certificate. No account needed.</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => void copySessionCertificatesLink()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700"
                >
                  <Copy className="h-3.5 w-3.5" /> {copiedSessionLink ? 'Copied!' : 'Copy certificates link'}
                </button>
                <a
                  href={sessionCertificatesPath()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-300 px-3.5 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 dark:border-indigo-500/40 dark:text-indigo-300 dark:hover:bg-indigo-500/15"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Open
                </a>
              </div>
            </div>
          )}

          {/* Roster — scoped server-side to whichever session tab is selected (archived members of that session still appear, flagged below) */}
          {leadersLoading ? (
            <div className="mt-6 flex justify-center">
              <LogoSpinner />
            </div>
          ) : leaders.length > 0 ? (
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {leaders.map((leader) => (
                <button
                  key={leader.id}
                  onClick={() => setViewLeader(leader)}
                  className="group relative flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3.5 dark:border-slate-800 dark:bg-slate-950/60 text-left transition hover:border-indigo-200 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm"
                >
                  <MemberAvatar fullName={leader.name} avatar={leader.photo} size="lg" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate font-semibold text-slate-900 dark:text-slate-100">{leader.name}</p>
                      {leader.linkedUser && (
                        <span title="Has a GuildOS account" className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 ring-1 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/30">
                          <BadgeCheck className="h-3 w-3" /> On GuildOS
                        </span>
                      )}
                      {leader.status === 'ARCHIVED' && (
                        <span title="Archived: left the post before their session ended" className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30">
                          Archived
                        </span>
                      )}
                      {/* "Past" = completed their term: either explicitly dissolved (status PAST), or
                          simply belonging to an earlier session than the current one — belt and braces
                          so stale ACTIVE rows in old sessions still read correctly. */}
                      {(leader.status === 'PAST' || (leader.status === 'ACTIVE' && currentSessionLabel !== null && leader.session !== currentSessionLabel)) && (
                        <span title="Past: served in an earlier session" className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-slate-100 dark:bg-slate-950 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400 ring-1 ring-slate-200 dark:ring-slate-800">
                          Past
                        </span>
                      )}
                    </div>
                    {(leader.title || leader.session) && (
                      <p className="truncate text-xs font-medium text-indigo-600">
                        {leader.title}
                        {leader.title && leader.session ? ' · ' : ''}
                        {leader.session}
                      </p>
                    )}
                    {leader.bio && (
                      <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{leader.bio}</p>
                    )}
                  </div>
                  {canManage && (
                    <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                      <LeaderCardAction
                        onClick={(e) => { e.stopPropagation(); setModal({ kind: 'editor', leader }); }}
                        title="Edit leader"
                        className={`${CARD_ACTION} hover:border-indigo-200 hover:text-indigo-600`}
                      >
                        <PenLine className="h-3.5 w-3.5" />
                      </LeaderCardAction>
                      {leader.status !== 'ACTIVE' ? (
                        <LeaderCardAction
                          onClick={(e) => {
                            e.stopPropagation();
                            void runRowAction(() => updateCommunityLeader(community._id, leader.id, { status: 'ACTIVE' }), 'Unable to restore leader');
                          }}
                          title="Restore to active"
                          className={`${CARD_ACTION} hover:border-emerald-200 hover:text-emerald-600`}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </LeaderCardAction>
                      ) : (
                        <LeaderCardAction
                          onClick={(e) => { e.stopPropagation(); void handleArchiveLeader(leader.id); }}
                          title="Archive (left the post early)"
                          className={`${CARD_ACTION} hover:border-amber-200 hover:text-amber-600`}
                        >
                          <Archive className="h-3.5 w-3.5" />
                        </LeaderCardAction>
                      )}
                      <LeaderCardAction
                        onClick={(e) => { e.stopPropagation(); void handleRemoveLeader(leader.id); }}
                        title="Delete permanently"
                        className={`${CARD_ACTION} hover:border-rose-200 hover:text-rose-600`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </LeaderCardAction>
                    </div>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-5">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {selectedSession === null
                  ? 'No leaders listed yet.'
                  : selectedSession === currentSessionLabel
                    ? 'No leaders listed for the current session yet.'
                    : `No leaders found for ${selectedSession}.`}
              </p>
              {canManage && (
                <button
                  onClick={() => setModal({ kind: 'editor', leader: null })}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700"
                >
                  <Plus className="h-3.5 w-3.5" /> Add your first leader
                </button>
              )}
            </div>
          )}
        </div>
      </main>

      {viewLeader && (
        <LeaderDetailModal leader={viewLeader} avatarSize="lg" onClose={() => setViewLeader(null)}>
          {canManage && (
            <LeaderCertificatePanel
              communityId={community._id}
              communityName={community.name}
              leader={viewLeader}
              onIssued={async (updated) => {
                setViewLeader(updated);
                await refreshLeaders();
              }}
              onError={setActionError}
            />
          )}
        </LeaderDetailModal>
      )}

      {modal?.kind === 'editor' && (
        <LeaderEditorModal
          communityId={community._id}
          leader={modal.leader}
          // Pre-fill the session field with whatever's currently selected, for convenience.
          defaultSession={sessionValueOf(selectedSession)}
          sessionSuggestions={sessionSuggestions}
          onClose={closeModal}
          onSaved={refreshLeaders}
          onPreviewPhoto={(src) => setPhotoLightbox(src)}
        />
      )}

      {modal?.kind === 'import' && (
        <ImportLeadersModal
          communityId={community._id}
          initialSession={sessionValueOf(selectedSession)}
          onClose={closeModal}
          onImported={async (session) => {
            await refreshSessions(community._id);
            if (selectedSession === session) await fetchLeadersForView(community._id, session);
          }}
        />
      )}

      {modal?.kind === 'dissolve' && currentSessionLabel !== null && (
        <DissolveSessionModal
          community={community}
          sessionLabel={currentSessionLabel}
          sessionValue={sessionValueOf(currentSessionLabel)}
          leaders={leaders}
          onClose={closeModal}
          onDissolved={refreshLeaders}
        />
      )}

      {modal?.kind === 'handover' && (
        <HandoverModal communityId={community._id} leaders={leaders} onClose={closeModal} onHandedOver={refreshLeaders} />
      )}

      {photoLightbox && <ImageLightbox src={photoLightbox} onClose={() => setPhotoLightbox('')} />}
    </div>
  );
}
