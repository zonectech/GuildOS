'use client';

import { LogoSpinner } from '../../../components/guildos/ui/loading';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';

import { getCurrentUser } from '../../../components/guildos/auth-api';
import { issueCertificatesBulk } from '../../../components/guildos/certificate-api';
import { getCommunity, getManagedCommunities, type CommunityEndorsement, type CommunitySummary } from '../../../components/guildos/community-list-api';
import { DashboardShell } from '../../../components/guildos/dashboard-shell';
import { DashboardSidebar } from '../../../components/guildos/dashboard-sidebar';
import { DashboardTopbar } from '../../../components/guildos/dashboard-topbar';
import { Badge } from '../../../components/guildos/ui/badge';
import { Button } from '../../../components/guildos/ui/button';
import { Card } from '../../../components/guildos/ui/card';
import { SectionHeader } from '../../../components/guildos/ui/section-header';
import { CertificatePreview } from '../../../components/guildos/certificate-preview';

type IssuedCertificate = {
  id: string;
  title: string;
  description: string;
  userId: string;
  recipientName?: string;
  occurredAt: string;
};

type CommunityMember = {
  membership: { _id?: string; role: string; status?: string };
  user: { id: string; fullName: string; profile?: { username?: string } };
};

type SelectedCommunityContext = {
  community: CommunitySummary;
  members: CommunityMember[];
  endorsements: CommunityEndorsement[];
};

export default function CertificatesPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [communities, setCommunities] = useState<CommunitySummary[]>([]);
  const [currentUserId, setCurrentUserId] = useState('');
  const [title, setTitle] = useState('Community Achievement Certificate');
  const [description, setDescription] = useState('Recognizes verified participation and leadership contribution.');
  const [communityId, setCommunityId] = useState('');
  const [communityMembers, setCommunityMembers] = useState<CommunityMember[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [selectedCommunityContext, setSelectedCommunityContext] = useState<SelectedCommunityContext | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [issued, setIssued] = useState<IssuedCertificate[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const user = await getCurrentUser();
        if (!user) {
          window.location.href = '/login';
          return;
        }

        setCurrentUserId(user.id);
        const response = await getManagedCommunities();
        setCommunities(response.communities.filter((community) => community.verificationStatus === 'VERIFIED'));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load certificates');
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, []);

  useEffect(() => {
    const loadCommunityMembers = async () => {
      if (!communityId) {
        setCommunityMembers([]);
        setSelectedCommunityContext(null);
        return;
      }

      const selectedCommunity = communities.find((community) => community._id === communityId);
      if (!selectedCommunity) {
        setCommunityMembers([]);
        setSelectedCommunityContext(null);
        return;
      }

      try {
        const response = await getCommunity(selectedCommunity.slug);
        const members = (response.members as CommunityMember[]) ?? [];
        const endorsements = response.endorsements ?? [];
        setCommunityMembers(members);
        setSelectedCommunityContext({
          community: response.community,
          members,
          endorsements,
        });
        setSelectedIds([]);
        setMemberSearch('');
        setRoleFilter('');
      } catch {
        setCommunityMembers([]);
        setSelectedCommunityContext(null);
      }
    };

    void loadCommunityMembers();
  }, [communityId, communities]);

  const selectedCommunity = useMemo(() => communities.find((community) => community._id === communityId) ?? null, [communities, communityId]);
  const verificationSource = selectedCommunityContext?.community.verificationMethod ?? selectedCommunity?.verificationMethod ?? null;
  const endorsementCount = selectedCommunityContext?.endorsements.length ?? 0;
  const isEndorsementBacked = verificationSource === 'ENDORSEMENT';
  const communityTrustPanel = selectedCommunity ? (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
      <p className="font-medium text-slate-900">{selectedCommunity.name} is verified and eligible for certificate issuance.</p>
      <div className="flex flex-wrap gap-2">
        <Badge tone="indigo">Source: {verificationSource ?? 'Manual review'}</Badge>
        <Badge tone={isEndorsementBacked ? 'success' : 'default'}>
          Endorsements: {isEndorsementBacked ? `${endorsementCount} verified leader endorsement${endorsementCount === 1 ? '' : 's'}` : 'Not required'}
        </Badge>
      </div>
      {selectedCommunityContext?.community.verificationNotes ? (
        <p className="text-xs text-slate-500">{selectedCommunityContext.community.verificationNotes}</p>
      ) : null}
    </div>
  ) : (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600">
      Global issuance mode lets you publish achievement certificates without attaching them to a community.
    </div>
  );

  async function handleIssueCertificate() {
    if (!communityId || !selectedIds.length) return;
    try {
      setSubmitting(true);
      setError('');
      setSuccess('');

      const response = await issueCertificatesBulk({
        communityId,
        userIds: selectedIds,
        title,
        description,
      });

      const nameById = new Map(communityMembers.map((m) => [m.user.id, m.user.fullName] as const));
      setIssued((current) => [
        ...response.certificates.map((c) => ({ ...c, recipientName: nameById.get(c.userId) })),
        ...current,
      ]);
      setSuccess(
        `Issued ${response.issued} certificate${response.issued === 1 ? '' : 's'}.` +
          (response.skipped.length ? ` Skipped: ${response.skipped.join(', ')}` : ''),
      );
      setSelectedIds([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to issue certificate');
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <DashboardShell sidebar={<DashboardSidebar />} topbar={<DashboardTopbar />}>
        <div className="flex items-center justify-center rounded-3xl border border-slate-200 bg-white p-10 shadow-sm">
          <LogoSpinner />
        </div>
      </DashboardShell>
    );
  }

  const activeMembers = communityMembers.filter((m) => !['REMOVED', 'LEFT', 'SUSPENDED'].includes(m.membership.status ?? ''));
  const availableRoles = Array.from(new Set(activeMembers.map((m) => m.membership.role)));
  const roleCounts = availableRoles.reduce<Record<string, number>>((acc, role) => {
    acc[role] = activeMembers.filter((m) => m.membership.role === role).length;
    return acc;
  }, {});
  const filteredMembers = activeMembers.filter((m) => {
    if (roleFilter && m.membership.role !== roleFilter) return false;
    const q = memberSearch.trim().toLowerCase();
    if (!q) return true;
    const uname = m.user.profile?.username?.toLowerCase() ?? '';
    return m.user.fullName.toLowerCase().includes(q) || uname.includes(q);
  });
  const filteredIds = filteredMembers.map((m) => m.user.id);
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedIds.includes(id));

  function toggleMember(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  }

  function toggleSelectAll() {
    setSelectedIds((current) => {
      if (allFilteredSelected) return current.filter((id) => !filteredIds.includes(id));
      return Array.from(new Set([...current, ...filteredIds]));
    });
  }

  return (
    <DashboardShell sidebar={<DashboardSidebar />} topbar={<DashboardTopbar />}>
      <SectionHeader
        eyebrow="Certificates"
        title="Certificate Center"
        subtitle="Issue verified certificates from trusted communities or issue global achievement certificates, then preview recent outputs."
      />

      {error ? <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {success ? <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-600">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Issue Certificate</h2>
              <p className="text-sm text-slate-500">Only verified communities can issue official certificates.</p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Community</span>
              <select className="input" value={communityId} onChange={(event) => setCommunityId(event.target.value)}>
                <option value="">Select a verified community…</option>
                {communities.map((community) => (
                  <option key={community._id} value={community._id}>
                    {community.name}
                  </option>
                ))}
              </select>
            </label>

            {communityId ? communityTrustPanel : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Choose a verified community to load its members, then pick who should receive the certificate.
              </div>
            )}

            {communityId ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">Recipients {selectedIds.length ? `(${selectedIds.length} selected)` : ''}</span>
                  {filteredMembers.length ? (
                    <button type="button" onClick={toggleSelectAll} className="text-xs font-medium text-indigo-600 hover:underline">
                      {allFilteredSelected ? 'Clear selection' : 'Select all'}
                    </button>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setRoleFilter('')}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${roleFilter === '' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    All ({activeMembers.length})
                  </button>
                  {availableRoles.map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setRoleFilter(role)}
                      className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition ${roleFilter === role ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      {role.replace(/_/g, ' ').toLowerCase()} ({roleCounts[role]})
                    </button>
                  ))}
                </div>

                <input
                  className="input"
                  placeholder="Search by name or @username"
                  value={memberSearch}
                  onChange={(event) => setMemberSearch(event.target.value)}
                />

                {roleFilter && filteredMembers.length ? (
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="w-full rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100"
                  >
                    {allFilteredSelected ? `Deselect all ${roleFilter.replace(/_/g, ' ').toLowerCase()}s` : `Select all ${filteredMembers.length} ${roleFilter.replace(/_/g, ' ').toLowerCase()}${filteredMembers.length === 1 ? '' : 's'}`}
                  </button>
                ) : null}

                <div className="max-h-64 space-y-1 overflow-y-auto rounded-2xl border border-slate-200 p-2">
                  {filteredMembers.length ? (
                    filteredMembers.map((member) => {
                      const checked = selectedIds.includes(member.user.id);
                      return (
                        <label
                          key={member.user.id}
                          className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${checked ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
                        >
                          <input type="checkbox" checked={checked} onChange={() => toggleMember(member.user.id)} className="h-4 w-4 rounded border-slate-300 text-indigo-600" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium text-slate-900">{member.user.fullName}</span>
                            <span className="block truncate text-xs text-slate-500">
                              {member.user.profile?.username ? `@${member.user.profile.username} · ` : ''}{member.membership.role.replace(/_/g, ' ')}
                            </span>
                          </span>
                        </label>
                      );
                    })
                  ) : (
                    <p className="px-3 py-4 text-center text-sm text-slate-500">No matching members.</p>
                  )}
                </div>
              </div>
            ) : null}

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Certificate Title</span>
              <input className="input" value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Description</span>
              <textarea className="input min-h-28" value={description} onChange={(event) => setDescription(event.target.value)} />
            </label>

            <Button variant="primary" className="w-full" onClick={handleIssueCertificate} disabled={submitting || !communityId || !selectedIds.length}>
              {submitting ? 'Issuing…' : selectedIds.length > 1 ? `Issue ${selectedIds.length} certificates` : 'Issue Certificate'}
            </Button>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Badge tone="indigo">Verified communities only</Badge>
            <Badge tone="success">Leadership gated</Badge>
            <Badge tone="default">Issuer: {currentUserId || '—'}</Badge>
          </div>

          <style jsx>{`
            .input {
              width: 100%;
              border-radius: 1rem;
              border: 1px solid rgb(226 232 240);
              padding: 0.875rem 1rem;
              font-size: 0.95rem;
              outline: none;
            }
            .input:focus {
              border-color: rgb(99 102 241);
              box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
            }
          `}</style>
        </Card>

        <div className="space-y-6">
          {issued.length ? (
            issued.map((certificate) => (
              <CertificatePreview
                key={certificate.id}
                title={certificate.title}
                recipient={certificate.recipientName || certificate.userId}
                issueDate={new Date(certificate.occurredAt).toLocaleDateString()}
                verificationCode={certificate.id.toUpperCase().slice(0, 8)}
              />
            ))
          ) : (
            <Card className="p-8 text-center text-sm text-slate-500">
              No certificates issued yet. Issued certificates will appear here.
            </Card>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}