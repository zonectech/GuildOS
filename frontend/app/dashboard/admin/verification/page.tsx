'use client';

import { useEffect, useState } from 'react';

import { getCurrentUser } from '../../../../components/guildos/auth-api';
import { Badge } from '../../../../components/guildos/ui/badge';
import { Button } from '../../../../components/guildos/ui/button';
import { Card } from '../../../../components/guildos/ui/card';
import { SectionHeader } from '../../../../components/guildos/ui/section-header';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type PendingCommunity = {
  _id: string;
  name: string;
  university: string;
  category: string;
  verificationMethod: 'UNIVERSITY_EMAIL' | 'ENDORSEMENT' | 'MANUAL' | null;
  verificationNotes: string;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  endorsementLetter?: string;
};

type Endorsement = {
  endorsement: { _id: string; note: string; createdAt: string };
  user: { fullName: string };
};

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(init?.headers ?? {}),
    },
    credentials: 'include',
    ...init,
  });

  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(typeof payload === 'object' && payload && 'error' in payload && payload.error ? payload.error : 'Request failed');
  }

  return payload;
}

export default function VerificationPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState<{ id: string; fullName: string } | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<'STUDENT' | 'COMMUNITY_LEADER' | 'ADMIN' | 'RECRUITER' | ''>('');
  const [pendingCommunities, setPendingCommunities] = useState<PendingCommunity[]>([]);
  const [endorsements, setEndorsements] = useState<Record<string, Endorsement[]>>({});
  const [noteByCommunity, setNoteByCommunity] = useState<Record<string, string>>({});
  const [adminNoteByCommunity, setAdminNoteByCommunity] = useState<Record<string, string>>({});
  const [busyCommunity, setBusyCommunity] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const user = await getCurrentUser();
        if (!user) {
          window.location.href = '/login';
          return;
        }

        setCurrentUser({ id: user.id, fullName: user.fullName });
        setCurrentUserRole(user.role);
        const response = await requestJson<{ communities: PendingCommunity[] }>('/api/admin/communities/pending');
        setPendingCommunities(response.communities);

        const endorsementMap: Record<string, Endorsement[]> = {};
        await Promise.all(
          response.communities.map(async (community) => {
            try {
              const endorsementResponse = await requestJson<{ endorsements: Endorsement[] }>(`/api/communities/${encodeURIComponent(community._id)}/endorsements`);
              endorsementMap[community._id] = endorsementResponse.endorsements;
            } catch {
              endorsementMap[community._id] = [];
            }
          }),
        );
        setEndorsements(endorsementMap);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load verification dashboard');
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, []);

  async function handleEndorse(communityId: string) {
    try {
      setBusyCommunity(communityId);
      setError('');

      await requestJson<{ endorsement: unknown }>(`/api/communities/${encodeURIComponent(communityId)}/endorsements`, {
        method: 'POST',
        body: JSON.stringify({ note: noteByCommunity[communityId] ?? '' }),
      });

      const updated = await requestJson<{ endorsements: Endorsement[] }>(`/api/communities/${encodeURIComponent(communityId)}/endorsements`);
      setEndorsements((current) => ({ ...current, [communityId]: updated.endorsements }));
      setNoteByCommunity((current) => ({ ...current, [communityId]: '' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to endorse community');
    } finally {
      setBusyCommunity('');
    }
  }

  async function handleVerify(communityId: string) {
    try {
      setBusyCommunity(communityId);
      setError('');

      await requestJson<{ community: PendingCommunity }>(`/api/admin/communities/${encodeURIComponent(communityId)}/verify`, {
        method: 'PATCH',
        body: JSON.stringify({ notes: adminNoteByCommunity[communityId] ?? '' }),
      });

      setPendingCommunities((current) => current.filter((community) => community._id !== communityId));
      setAdminNoteByCommunity((current) => ({ ...current, [communityId]: '' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to verify community');
    } finally {
      setBusyCommunity('');
    }
  }

  async function handleReject(communityId: string) {
    try {
      setBusyCommunity(communityId);
      setError('');

      await requestJson<{ community: PendingCommunity }>(`/api/admin/communities/${encodeURIComponent(communityId)}/reject`, {
        method: 'PATCH',
        body: JSON.stringify({ notes: adminNoteByCommunity[communityId] ?? '' }),
      });

      setPendingCommunities((current) => current.filter((community) => community._id !== communityId));
      setAdminNoteByCommunity((current) => ({ ...current, [communityId]: '' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reject community');
    } finally {
      setBusyCommunity('');
    }
  }

  if (isLoading) {
    return (
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center shadow-sm">Loading verification queue...</div>
    );
  }

  return (
    <>
      <SectionHeader
        eyebrow="Verification"
        title="Community Verification"
        subtitle="Review pending communities, collect endorsements from verified leaders, and complete manual review when ready."
      />

      {error ? <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Verification Methods</h2>
          <div className="mt-4 grid gap-3">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
              <p className="font-medium text-slate-900 dark:text-slate-100">University Email</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Can auto-verify when the community email domain matches the institution.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
              <p className="font-medium text-slate-900 dark:text-slate-100">Endorsement</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Requires at least one endorsement from a verified community leader before admin approval.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
              <p className="font-medium text-slate-900 dark:text-slate-100">Manual Review</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">GuildOS admins can approve after review.</p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <Badge tone="warning">Pending</Badge>
            <Badge tone="success">Verified</Badge>
            <Badge tone="danger">Rejected</Badge>
          </div>
          {currentUser ? <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Signed in as {currentUser.fullName}</p> : null}
          {currentUserRole ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Role: {currentUserRole}</p> : null}
        </Card>

        <div className="space-y-6">
          {pendingCommunities.length ? (
            pendingCommunities.map((community) => (
              <Card key={community._id} className="p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-slate-950 dark:text-white">{community.name}</h3>
                      <Badge tone="warning">{community.verificationMethod ?? 'MANUAL'}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{community.university}</p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{community.category}</p>
                    {community.verificationNotes ? <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">{community.verificationNotes}</p> : null}
                    {community.endorsementLetter ? (
                      <a
                        href={community.endorsementLetter.startsWith('http') ? community.endorsementLetter : `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}${community.endorsementLetter}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300"
                      >
                        View endorsement letter
                      </a>
                    ) : null}
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Endorsements</p>
                  <div className="mt-3 space-y-3">
                    {(endorsements[community._id] ?? []).length ? (
                      endorsements[community._id].map((endorsement) => (
                        <div key={endorsement.endorsement._id} className="rounded-xl bg-slate-50 dark:bg-slate-900 px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                          <p className="font-medium text-slate-900 dark:text-slate-100">{endorsement.user.fullName}</p>
                          <p>{endorsement.endorsement.note || 'No note provided'}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500 dark:text-slate-400">No endorsements yet.</p>
                    )}
                  </div>

                  <div className="mt-4 space-y-3">
                    <textarea
                      className="input min-h-24"
                      placeholder="Add an endorsement note"
                      value={noteByCommunity[community._id] ?? ''}
                      onChange={(event) => setNoteByCommunity((current) => ({ ...current, [community._id]: event.target.value }))}
                    />
                    <Button variant="secondary" onClick={() => void handleEndorse(community._id)} disabled={busyCommunity === community._id}>
                      {busyCommunity === community._id ? 'Submitting...' : 'Add Endorsement'}
                    </Button>
                  </div>
                </div>

                {currentUserRole === 'ADMIN' ? (
                  <div className="mt-6 space-y-3 border-t border-slate-200 dark:border-slate-800 pt-4">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Admin Review</p>
                    <textarea
                      className="input min-h-24"
                      placeholder="Add admin review notes"
                      value={adminNoteByCommunity[community._id] ?? ''}
                      onChange={(event) => setAdminNoteByCommunity((current) => ({ ...current, [community._id]: event.target.value }))}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button variant="primary" onClick={() => void handleVerify(community._id)} disabled={busyCommunity === community._id}>
                        {busyCommunity === community._id ? 'Processing...' : 'Verify Community'}
                      </Button>
                      <Button variant="secondary" onClick={() => void handleReject(community._id)} disabled={busyCommunity === community._id}>
                        Reject Community
                      </Button>
                    </div>
                  </div>
                ) : null}
              </Card>
            ))
          ) : (
            <Card className="p-6">
              <p className="text-sm text-slate-500 dark:text-slate-400">No pending communities found.</p>
            </Card>
          )}
        </div>
      </div>

      <style jsx>{`
        .input {
          width: 100%;
          border-radius: 1rem;
          border: 1px solid rgb(226 232 240);
          background: #ffffff;
          color: rgb(15 23 42);
          padding: 0.875rem 1rem;
          font-size: 0.95rem;
          outline: none;
        }
        .input::placeholder {
          color: rgb(148 163 184);
        }
        :global(.dark) .input {
          border-color: rgb(30 41 59);
          background: rgb(2 6 23);
          color: rgb(241 245 249);
        }
        :global(.dark) .input::placeholder {
          color: rgb(100 116 139);
        }
        .input:focus {
          border-color: rgb(99 102 241);
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
        }
      `}</style>
    </>
  );
}