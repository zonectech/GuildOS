'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Award, BadgeCheck, CalendarDays, Check, Copy, ExternalLink, HandHeart, Search, Sparkles, Crown } from 'lucide-react';

import { getCurrentUser } from '../../../components/guildos/auth-api';
import {
  issueCertificatesBulk,
  listCommunityCertificates,
  type CommunityCertificateType,
  type IssuedCommunityCertificate,
} from '../../../components/guildos/certificate-api';
import { getCommunity, getManagedCommunities, type CommunitySummary } from '../../../components/guildos/community-list-api';
import { DashboardShell } from '../../../components/guildos/dashboard-shell';
import { DashboardSidebar } from '../../../components/guildos/dashboard-sidebar';
import { DashboardTopbar } from '../../../components/guildos/dashboard-topbar';
import { CommunityPicker } from '../../../components/guildos/dashboard/community-picker';
import { Button } from '../../../components/guildos/ui/button';
import { LogoSpinner } from '../../../components/guildos/ui/loading';
import { SectionHeader } from '../../../components/guildos/ui/section-header';

type CommunityMember = {
  membership: { _id?: string; role: string; status?: string };
  user: { id: string; fullName: string; profile?: { username?: string } };
};

const TYPES: { value: CommunityCertificateType; label: string; heading: string; hint: string; icon: typeof Award; suggestions: string[] }[] = [
  { value: 'COMPLETION', label: 'Achievement', heading: 'Certificate of Achievement', hint: 'Wins, milestones, standout work', icon: Award, suggestions: ['Member of the Month', 'Outstanding Contribution', 'Project Showcase Winner'] },
  { value: 'LEADERSHIP', label: 'Leadership', heading: 'Certificate of Leadership', hint: 'Executives, team leads, coordinators', icon: Crown, suggestions: ['Team Lead', 'Program Coordinator', 'Executive Committee'] },
  { value: 'VOLUNTEER', label: 'Volunteer', heading: 'Certificate of Appreciation', hint: 'People who gave their time', icon: HandHeart, suggestions: ['Volunteer of the Month', 'Event Volunteer', 'Outreach Volunteer'] },
  { value: 'ATTENDANCE', label: 'Participation', heading: 'Certificate of Participation', hint: 'Programs outside a single event', icon: CalendarDays, suggestions: ['Bootcamp Participant', 'Mentorship Program', 'Study Group'] },
];

const INPUT = 'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-indigo-500/20';
const PANEL = 'rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900';

function prettyRole(role: string) {
  return role.replace(/_/g, ' ').toLowerCase();
}

export default function CertificatesPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [allManaged, setAllManaged] = useState<CommunitySummary[]>([]);
  const [communityId, setCommunityId] = useState('');
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [type, setType] = useState<CommunityCertificateType>('COMPLETION');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [issued, setIssued] = useState<IssuedCommunityCertificate[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [copied, setCopied] = useState('');

  const verified = useMemo(() => allManaged.filter((c) => c.verificationStatus === 'VERIFIED'), [allManaged]);
  const unverified = allManaged.filter((c) => c.verificationStatus !== 'VERIFIED');
  const community = verified.find((c) => c._id === communityId) ?? null;
  const typeMeta = TYPES.find((t) => t.value === type) ?? TYPES[0];

  useEffect(() => {
    void (async () => {
      try {
        const user = await getCurrentUser();
        if (!user) {
          window.location.href = '/login';
          return;
        }
        const { communities } = await getManagedCommunities();
        setAllManaged(communities);
        const first = communities.find((c) => c.verificationStatus === 'VERIFIED');
        if (first) setCommunityId(first._id);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load certificates');
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const loadHistory = useCallback(async (id: string) => {
    setHistoryLoading(true);
    try {
      const { certificates } = await listCommunityCertificates(id);
      setIssued(certificates);
    } catch {
      setIssued([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!community) {
      setMembers([]);
      setIssued([]);
      return;
    }
    setSelectedIds([]);
    setMemberSearch('');
    setRoleFilter('');
    setSuccess('');
    void getCommunity(community.slug)
      .then((response) => setMembers((response.members as CommunityMember[]) ?? []))
      .catch(() => setMembers([]));
    void loadHistory(community._id);
  }, [community, loadHistory]);

  const activeMembers = members.filter((m) => !['REMOVED', 'LEFT', 'SUSPENDED'].includes(m.membership.status ?? ''));
  const roles = Array.from(new Set(activeMembers.map((m) => m.membership.role)));
  const filteredMembers = activeMembers.filter((m) => {
    if (roleFilter && m.membership.role !== roleFilter) return false;
    const q = memberSearch.trim().toLowerCase();
    if (!q) return true;
    return m.user.fullName.toLowerCase().includes(q) || (m.user.profile?.username ?? '').toLowerCase().includes(q);
  });
  const filteredIds = filteredMembers.map((m) => m.user.id);
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedIds.includes(id));
  const previewName = activeMembers.find((m) => m.user.id === selectedIds[0])?.user.fullName ?? 'Recipient name';
  const canIssue = Boolean(community && selectedIds.length && title.trim()) && !submitting;

  const filteredHistory = issued.filter((c) => {
    const q = historySearch.trim().toLowerCase();
    return !q || c.recipientName.toLowerCase().includes(q) || c.title.toLowerCase().includes(q);
  });

  function toggleMember(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  }

  function toggleSelectAll() {
    setSelectedIds((current) => (allFilteredSelected ? current.filter((id) => !filteredIds.includes(id)) : Array.from(new Set([...current, ...filteredIds]))));
  }

  async function handleIssue() {
    if (!community || !canIssue) return;
    try {
      setSubmitting(true);
      setError('');
      setSuccess('');
      const response = await issueCertificatesBulk({ communityId: community._id, userIds: selectedIds, title: title.trim(), description: description.trim(), type });
      setIssued((current) => [...response.certificates, ...current]);
      setSuccess(
        response.issued
          ? `Issued ${response.issued} certificate${response.issued === 1 ? '' : 's'}. Recipients get a notification and an email with their verification link.${response.skipped.length ? ` Skipped: ${response.skipped.join(', ')}.` : ''}`
          : `Nothing new to issue. ${response.skipped.join(', ')}.`,
      );
      setSelectedIds([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to issue certificates');
    } finally {
      setSubmitting(false);
    }
  }

  async function copyLink(serial: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/certificates/${serial}`);
      setCopied(serial);
      window.setTimeout(() => setCopied(''), 1800);
    } catch {
      /* clipboard blocked: the View link still works */
    }
  }

  if (isLoading) {
    return (
      <DashboardShell sidebar={<DashboardSidebar />} topbar={<DashboardTopbar />}>
        <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white p-10 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <LogoSpinner />
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell sidebar={<DashboardSidebar />} topbar={<DashboardTopbar />}>
      <SectionHeader
        eyebrow="Events"
        title="Certificates"
        subtitle="Award verified certificates to members for leadership, volunteering and achievements. Each one gets a QR code anyone can verify."
        toolbar={verified.length ? <CommunityPicker communities={verified} value={communityId} onChange={setCommunityId} /> : undefined}
      />

      <div className="flex items-start gap-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-500/30 dark:bg-sky-950/40 dark:text-sky-200">
        <CalendarDays className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Certificates for <span className="font-semibold">event attendance</span> are sent from each event after check-in, so attendance is proven.{' '}
          <Link href="/dashboard/events" className="font-semibold underline">Go to events</Link>
        </p>
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/50 dark:text-red-300">{error}</div> : null}
      {success ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-950/50 dark:text-emerald-300">{success}</div> : null}

      {!verified.length ? (
        <section className={`${PANEL} text-center`}>
          <BadgeCheck className="mx-auto h-8 w-8 text-indigo-500" />
          <h2 className="mt-3 text-lg font-semibold text-slate-950 dark:text-white">Verify your community to issue certificates</h2>
          <p className="mx-auto mt-1 max-w-lg text-sm text-slate-500 dark:text-slate-400">
            {unverified.length
              ? `${unverified.map((c) => c.name).join(', ')} ${unverified.length === 1 ? 'isn’t' : 'aren’t'} verified yet. Verification keeps certificates trustworthy for recruiters.`
              : 'Create a community and get it verified with a school email or an endorsement letter.'}
          </p>
          <Button variant="primary" asChild href={unverified.length ? '/dashboard/communities' : '/dashboard/communities/create'} className="mt-4">
            {unverified.length ? 'Go to verification' : 'Create a community'}
          </Button>
        </section>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          {/* Issue */}
          <section className={`${PANEL} min-w-0 space-y-6`}>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Step 1</p>
              <h2 className="text-base font-semibold text-slate-950 dark:text-white">What kind of certificate?</h2>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {TYPES.map((t) => {
                  const Icon = t.icon;
                  const active = t.value === type;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setType(t.value)}
                      aria-pressed={active}
                      className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${active ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500 dark:bg-indigo-500/10' : 'border-slate-200 hover:border-indigo-300 dark:border-slate-800'}`}
                    >
                      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${active ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-400'}`} />
                      <span>
                        <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">{t.label}</span>
                        <span className="block text-xs text-slate-500 dark:text-slate-400">{t.hint}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Step 2</p>
                <h2 className="text-base font-semibold text-slate-950 dark:text-white">What is it for?</h2>
              </div>
              <input className={INPUT} placeholder="e.g. Volunteer of the Month" value={title} maxLength={140} onChange={(e) => setTitle(e.target.value)} />
              <div className="flex flex-wrap gap-1.5">
                {typeMeta.suggestions.map((s) => (
                  <button key={s} type="button" onClick={() => setTitle(s)} className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-indigo-300 hover:text-indigo-700 dark:border-slate-700 dark:text-slate-400">
                    {s}
                  </button>
                ))}
              </div>
              <textarea className={`${INPUT} min-h-20`} placeholder="Optional note shown on the certificate, e.g. For running registration at Build Day 2026." value={description} maxLength={400} onChange={(e) => setDescription(e.target.value)} />
            </div>

            <div className="space-y-3">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Step 3</p>
                  <h2 className="text-base font-semibold text-slate-950 dark:text-white">Who receives it? {selectedIds.length ? <span className="text-indigo-600 dark:text-indigo-400">({selectedIds.length} selected)</span> : null}</h2>
                </div>
                {filteredMembers.length ? (
                  <button type="button" onClick={toggleSelectAll} className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
                    {allFilteredSelected ? 'Clear selection' : `Select all${roleFilter ? ` ${prettyRole(roleFilter)}s` : ''} (${filteredMembers.length})`}
                  </button>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {['', ...roles].map((role) => (
                  <button
                    key={role || 'all'}
                    type="button"
                    onClick={() => setRoleFilter(role)}
                    className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition ${roleFilter === role ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'}`}
                  >
                    {role ? `${prettyRole(role)} (${activeMembers.filter((m) => m.membership.role === role).length})` : `Everyone (${activeMembers.length})`}
                  </button>
                ))}
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input className={`${INPUT} pl-9`} placeholder="Search by name or @username" value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} />
              </div>
              <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-1.5 dark:border-slate-800">
                {filteredMembers.length ? (
                  filteredMembers.map((m) => {
                    const checked = selectedIds.includes(m.user.id);
                    return (
                      <label key={m.user.id} className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${checked ? 'bg-indigo-50 dark:bg-indigo-500/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                        <input type="checkbox" checked={checked} onChange={() => toggleMember(m.user.id)} className="h-4 w-4 rounded border-slate-300 text-indigo-600 dark:border-slate-700" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-slate-900 dark:text-slate-100">{m.user.fullName}</span>
                          <span className="block truncate text-xs capitalize text-slate-500 dark:text-slate-400">{m.user.profile?.username ? `@${m.user.profile.username} · ` : ''}{prettyRole(m.membership.role)}</span>
                        </span>
                      </label>
                    );
                  })
                ) : (
                  <p className="px-3 py-4 text-center text-sm text-slate-500 dark:text-slate-400">{activeMembers.length ? 'No matching members.' : 'No members yet. Invite people from the Members page.'}</p>
                )}
              </div>
            </div>

            <Button variant="primary" className="w-full" onClick={() => void handleIssue()} disabled={!canIssue}>
              <Sparkles className="h-4 w-4" />
              {submitting ? 'Issuing…' : !title.trim() ? 'Add a title to continue' : !selectedIds.length ? 'Pick at least one recipient' : `Issue ${selectedIds.length} certificate${selectedIds.length === 1 ? '' : 's'}`}
            </Button>
          </section>

          {/* Preview + history */}
          <div className="min-w-0 space-y-6">
            <section className={PANEL} aria-label="Preview">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Preview</p>
              <div className="mt-3 rounded-lg border-4 border-double border-amber-300/70 bg-gradient-to-br from-amber-50/60 via-white to-indigo-50/40 px-6 py-8 text-center dark:border-amber-500/30 dark:from-slate-900 dark:via-slate-950 dark:to-indigo-950/40">
                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">{community?.name}</p>
                <p className="mt-3 font-sans text-xl font-bold text-slate-950 dark:text-white">{typeMeta.heading}</p>
                <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">is presented to</p>
                <p className="mt-1 font-sans text-2xl font-bold text-indigo-700 dark:text-indigo-300">{previewName}</p>
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">for</p>
                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{title.trim() || 'Your certificate title'}</p>
                {description.trim() ? <p className="mx-auto mt-2 max-w-sm text-xs text-slate-600 dark:text-slate-400">{description.trim()}</p> : null}
                <p className="mt-5 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                  <BadgeCheck className="h-3 w-3" /> Verifiable with a QR code
                </p>
              </div>
              {selectedIds.length > 1 ? <p className="mt-2 text-center text-xs text-slate-500 dark:text-slate-400">Each of the {selectedIds.length} recipients gets their own copy with their name.</p> : null}
            </section>

            <section className={PANEL} aria-label="Issued certificates">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-slate-950 dark:text-white">Issued by {community?.name}</h2>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{issued.length}</span>
              </div>
              {issued.length > 5 ? (
                <div className="relative mt-3">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input className={`${INPUT} pl-9`} placeholder="Search issued certificates" value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} />
                </div>
              ) : null}
              {historyLoading ? (
                <div className="mt-4 space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />)}</div>
              ) : filteredHistory.length ? (
                <ul className="mt-3 max-h-[28rem] divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
                  {filteredHistory.map((c) => (
                    <li key={c.serial} className="flex items-center gap-3 py-2.5">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300"><Award className="h-4 w-4" /></span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{c.recipientName}</p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                          {c.title} · {new Date(c.issuedAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {c.status !== 'VERIFIED' ? <span className="font-semibold text-rose-600"> · {c.status.toLowerCase()}</span> : null}
                        </p>
                      </div>
                      <button type="button" onClick={() => void copyLink(c.serial)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200" aria-label={`Copy link to ${c.recipientName}'s certificate`}>
                        {copied === c.serial ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                      </button>
                      <Link href={`/certificates/${c.serial}`} target="_blank" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200" aria-label={`Open ${c.recipientName}'s certificate`}>
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  {issued.length ? 'No matches.' : 'Nothing issued yet. Certificates you issue here are saved and listed with their verification links.'}
                </p>
              )}
            </section>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
