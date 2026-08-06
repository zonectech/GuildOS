'use client';

import { confirmDialog } from '../../../components/guildos/ui/confirm-dialog';
import { LogoSpinner } from '../../../components/guildos/ui/loading';

import { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { DashboardShell } from '../../../components/guildos/dashboard-shell';
import { DashboardSidebar } from '../../../components/guildos/dashboard-sidebar';
import { DashboardTopbar } from '../../../components/guildos/dashboard-topbar';
import { SectionHeader } from '../../../components/guildos/ui/section-header';
import { Button } from '../../../components/guildos/ui/button';
import { MediaPreviewDialog } from '../../../components/guildos/ui/media-preview-dialog';
import { getCurrentUser } from '../../../components/guildos/auth-api';
import { createCommunityInviteLink, deleteCommunity, getManagedCommunities, revokeCommunityInviteLink, type CommunitySummary } from '../../../components/guildos/community-list-api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function normalizeCommunityImageUrl(url?: string) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return `${API_BASE_URL}${url}`;
  return `${API_BASE_URL}/${url}`;
}

export default function CommunitiesPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{ id: string; fullName: string } | null>(null);
  const [communities, setCommunities] = useState<CommunitySummary[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const user = await getCurrentUser();
        if (!user) {
          router.replace('/login');
          return;
        }

        const response = await getManagedCommunities();
        setCurrentUser({ id: user.id, fullName: user.fullName });
        setCommunities(response.communities);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load communities');
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, [router]);

  const sortedCommunities = useMemo(() => communities, [communities]);

  return (
    <DashboardShell sidebar={<DashboardSidebar />} topbar={<DashboardTopbar />}>
      <SectionHeader
        eyebrow="Communities"
        title="Discover & Manage Communities"
        subtitle="Browse communities, view verification status, and manage leadership, invitations, and events."
      />

      <div className="mb-6 flex flex-wrap justify-end gap-2">
        <Button variant="secondary" asChild href="/dashboard/communities/history">
          View history
        </Button>
        <Button variant="primary" asChild href="/dashboard/communities/create">
          Create Community
        </Button>
      </div>

      {error ? <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      {isLoading ? (
        <div className="flex items-center justify-center rounded-3xl border border-slate-200 bg-white p-10 shadow-sm">
          <LogoSpinner />
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          {sortedCommunities.map((community) => (
            <CommunityCard key={community._id} community={community} currentUserId={currentUser?.id ?? ''} onView={() => router.push(`/communities/${community.slug}`)} />
          ))}
        </div>
      )}
    </DashboardShell>
  );
}

function CommunityCard({ community, currentUserId, onView }: { community: CommunitySummary; currentUserId: string; onView: () => void }) {
  const isFounder = community.founder === currentUserId;
  const isVerified = community.verificationStatus === 'VERIFIED';
  const [inviteLink, setInviteLink] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [cardError, setCardError] = useState('');
  const [mediaPreview, setMediaPreview] = useState<{ src: string; alt: string } | null>(null);

  async function handleCreateInviteLink() {
    try {
      setInviteBusy(true);
      setCardError('');
      const result = await createCommunityInviteLink(community._id);
      setInviteLink(`${window.location.origin}${result.inviteLink}`);
    } catch (err) {
      setCardError(err instanceof Error ? err.message : 'Unable to create invite link');
    } finally {
      setInviteBusy(false);
    }
  }

  async function handleCopyInviteLink() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
    } catch {
      setCardError('Unable to copy invite link');
    }
  }

  async function handleRevokeInviteLink() {
    try {
      setInviteBusy(true);
      setCardError('');
      await revokeCommunityInviteLink(community._id);
      setInviteLink('');
    } catch (err) {
      setCardError(err instanceof Error ? err.message : 'Unable to revoke invite link');
    } finally {
      setInviteBusy(false);
    }
  }

  async function handleDeleteCommunity() {
    const confirmed = await confirmDialog({ title: `Delete ${community.name}?`, message: 'This cannot be undone.', confirmLabel: 'Delete', tone: 'danger' });
    if (!confirmed) return;
    try {
      setInviteBusy(true);
      setCardError('');
      await deleteCommunity(community._id);
      window.location.reload();
    } catch (err) {
      setCardError(err instanceof Error ? err.message : 'Unable to delete community');
    } finally {
      setInviteBusy(false);
    }
  }

  return (
    <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:border-indigo-200 hover:shadow-md">
      <div className="h-36 overflow-hidden bg-gradient-to-br from-indigo-600 via-sky-500 to-cyan-400">
        {community.coverImage ? (
          <img
            src={normalizeCommunityImageUrl(community.coverImage)}
            alt={`${community.name} cover`}
            className="h-full w-full cursor-zoom-in object-cover"
            onClick={() => setMediaPreview({ src: normalizeCommunityImageUrl(community.coverImage), alt: `${community.name} cover` })}
          />
        ) : null}
      </div>

      <div className="absolute left-6 top-24 z-20">
        <div className="h-20 w-20 overflow-hidden rounded-2xl border-4 border-white bg-white shadow-md ring-1 ring-slate-900/5">
          {community.logo ? (
            <img
              src={normalizeCommunityImageUrl(community.logo)}
              alt={community.name}
              className="h-full w-full cursor-zoom-in object-cover"
              onClick={() => setMediaPreview({ src: normalizeCommunityImageUrl(community.logo), alt: `${community.name} logo` })}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-slate-100 text-lg font-semibold text-slate-500">
              {community.name.slice(0, 1)}
            </div>
          )}
        </div>
      </div>

      <div className="p-6 pt-12">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-xl font-semibold text-slate-950">{community.name}</h2>
              {isVerified ? <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600" /> : null}
            </div>
            <p className="mt-0.5 text-sm font-medium uppercase tracking-wide text-indigo-600">{community.category}</p>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-slate-600">{community.shortDescription}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Badge>{community.visibility}</Badge>
          <Badge>{community.verificationStatus}</Badge>
          <Badge>
            <Users className="mr-1 h-3.5 w-3.5" />
            {community.memberCount} members
          </Badge>
        </div>

        {cardError ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{cardError}</div> : null}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Button variant="primary" onClick={onView}>
            View Community
          </Button>

          {isFounder ? (
            <Button asChild href={`/dashboard/communities/${community.slug}/edit`} variant="secondary">
              Edit Community
            </Button>
          ) : (
            <Button variant="secondary" disabled>
              Member Access
            </Button>
          )}

          {isFounder ? (
            <Button variant="secondary" onClick={handleCreateInviteLink} disabled={inviteBusy}>
              Generate Invite Link
            </Button>
          ) : (
            <Button variant="secondary" disabled>
              Join Community
            </Button>
          )}

          {inviteLink ? (
            <Button variant="secondary" onClick={handleCopyInviteLink}>
              Copy Invite Link
            </Button>
          ) : null}

          {inviteLink ? (
            <Button variant="secondary" onClick={handleRevokeInviteLink} disabled={inviteBusy}>
              Revoke Invite Link
            </Button>
          ) : null}

          {isFounder ? (
            <Button variant="secondary" onClick={handleDeleteCommunity} disabled={inviteBusy}>
              Delete Community
            </Button>
          ) : null}

          <Button variant="secondary" asChild href={`/dashboard/events/create?communityId=${community._id}`}>
            Create Event
          </Button>
        </div>
      </div>
      <MediaPreviewDialog preview={mediaPreview} onClose={() => setMediaPreview(null)} />
    </section>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{children}</span>;
}
