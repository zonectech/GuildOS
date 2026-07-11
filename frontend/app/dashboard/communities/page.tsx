'use client';

import { confirmDialog } from '../../../components/guildos/ui/confirm-dialog';
import { LogoSpinner } from '../../../components/guildos/ui/loading';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, ShieldCheck, Users, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { DashboardShell } from '../../../components/guildos/dashboard-shell';
import { DashboardSidebar } from '../../../components/guildos/dashboard-sidebar';
import { DashboardTopbar } from '../../../components/guildos/dashboard-topbar';
import { SectionHeader } from '../../../components/guildos/ui/section-header';
import { Button } from '../../../components/guildos/ui/button';
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
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="h-36 overflow-hidden bg-gradient-to-r from-indigo-600 to-sky-500">
        {community.coverImage ? (
          <img
            src={normalizeCommunityImageUrl(community.coverImage)}
            alt={`${community.name} cover`}
            className="h-full w-full cursor-zoom-in object-cover"
            onClick={() => setMediaPreview({ src: normalizeCommunityImageUrl(community.coverImage), alt: `${community.name} cover` })}
          />
        ) : null}
      </div>

      <div className="p-6">
        <div className="-mt-16 flex items-end gap-4">
          <div className="h-20 w-20 overflow-hidden rounded-2xl border-4 border-white bg-white shadow-md">
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

          <div className="pb-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold text-slate-950">{community.name}</h2>
              {isVerified ? <ShieldCheck className="h-5 w-5 text-emerald-600" /> : null}
            </div>
            <p className="text-sm text-slate-500">{community.category}</p>
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

          <Button variant="secondary" disabled>
            Create Event
          </Button>
        </div>
      </div>
      {mediaPreview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setMediaPreview(null)}>
          <button
            onClick={(event) => {
              event.stopPropagation();
              setMediaPreview(null);
            }}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label="Close image preview"
          >
            <XCircle className="h-5 w-5" />
          </button>
          <img
            src={mediaPreview.src}
            alt={mediaPreview.alt}
            className="max-h-[90vh] w-auto max-w-[95vw] rounded-xl object-contain"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      ) : null}
    </section>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{children}</span>;
}
