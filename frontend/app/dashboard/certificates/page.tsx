'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';

import { getCurrentUser } from '../../../components/guildos/auth-api';
import { issueCertificate } from '../../../components/guildos/certificate-api';
import { getCommunity, getCommunities, type CommunityEndorsement, type CommunitySummary } from '../../../components/guildos/community-list-api';
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
  occurredAt: string;
};

type CommunityMember = {
  membership: { _id?: string; role: string };
  user: { id: string; fullName: string };
};

type SelectedCommunityContext = {
  community: CommunitySummary;
  members: CommunityMember[];
  endorsements: CommunityEndorsement[];
};

const seedCertificates = [
  ['Innovation Week Attendance', 'Aisha Mensah', '12 Apr 2026', 'GOS-8F21'],
  ['Leadership Summit Certificate', 'Kofi Owusu', '14 Apr 2026', 'GOS-2A90'],
] as const;

export default function CertificatesPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [communities, setCommunities] = useState<CommunitySummary[]>([]);
  const [currentUserId, setCurrentUserId] = useState('');
  const [title, setTitle] = useState('Community Achievement Certificate');
  const [description, setDescription] = useState('Recognizes verified participation and leadership contribution.');
  const [recipientUserId, setRecipientUserId] = useState('');
  const [communityId, setCommunityId] = useState('');
  const [communityMembers, setCommunityMembers] = useState<CommunityMember[]>([]);
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
        const response = await getCommunities();
        setCommunities(response.communities.filter((community) => community.verificationStatus === 'VERIFIED'));
        setRecipientUserId(user.id);
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

        const firstMember = members[0];
        if (firstMember) {
          setRecipientUserId(firstMember.user.id);
        }
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
    try {
      setSubmitting(true);
      setError('');
      setSuccess('');

      const response = await issueCertificate({
        userId: recipientUserId,
        communityId: communityId || undefined,
        title,
        description,
      });

      setIssued((current) => [{ ...response.certificate }, ...current]);
      setSuccess('Certificate issued successfully.');
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
          <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
        </div>
      </DashboardShell>
    );
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
              <span className="text-sm font-medium text-slate-700">Recipient User ID</span>
              <input className="input" value={recipientUserId} onChange={(event) => setRecipientUserId(event.target.value)} />
            </label>

            {communityMembers.length ? (
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">Recipient Member</span>
                <select
                  className="input"
                  value={recipientUserId}
                  onChange={(event) => setRecipientUserId(event.target.value)}
                >
                  {communityMembers.map((member) => (
                    <option key={member.user.id} value={member.user.id}>
                      {member.user.fullName} · {member.membership.role}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Community</span>
              <select className="input" value={communityId} onChange={(event) => setCommunityId(event.target.value)}>
                <option value="">Global issuance mode</option>
                {communities.map((community) => (
                  <option key={community._id} value={community._id}>
                    {community.name}
                  </option>
                ))}
              </select>
            </label>

            {communityTrustPanel}

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Certificate Title</span>
              <input className="input" value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Description</span>
              <textarea className="input min-h-28" value={description} onChange={(event) => setDescription(event.target.value)} />
            </label>

            <Button variant="primary" className="w-full" onClick={handleIssueCertificate} disabled={submitting || !recipientUserId.trim()}>
              {submitting ? 'Issuing...' : 'Issue Certificate'}
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
                recipient={certificate.userId}
                issueDate={new Date(certificate.occurredAt).toLocaleDateString()}
                verificationCode={certificate.id.toUpperCase().slice(0, 8)}
              />
            ))
          ) : (
            seedCertificates.map((certificate) => (
              <CertificatePreview
                key={certificate[3]}
                title={certificate[0]}
                recipient={certificate[1]}
                issueDate={certificate[2]}
                verificationCode={certificate[3]}
              />
            ))
          )}
        </div>
      </div>
    </DashboardShell>
  );
}