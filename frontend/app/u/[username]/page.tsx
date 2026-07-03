'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { BadgeCheck, Camera, Grid3x3, IdCard, Link2, MapPin, PencilLine } from 'lucide-react';

import { getCurrentUser, uploadCover } from '../../../components/guildos/auth-api';
import { getUserLeadershipHistory, type LeadershipHistoryEntry } from '../../../components/guildos/community-list-api';
import {
  getProfileCertificates,
  getPublicTimeline,
  getReputationSummary,
  type ProfileCertificate,
  type ReputationActivityEntry,
  type ReputationSummary,
} from '../../../components/guildos/reputation-api';
import { getUserPosts, resolveFeedAvatar, type FeedPost } from '../../../components/guildos/feed-api';
import { PostCard } from '../../../components/guildos/feed/feed';
import { StudentNav } from '../../../components/guildos/student-nav';

const LEVEL_TONE: Record<string, string> = {
  'Explorer Guild': 'from-slate-500 to-slate-700',
  'Bronze Guild': 'from-amber-600 to-orange-700',
  'Silver Guild': 'from-slate-400 to-slate-600',
  'Gold Guild': 'from-yellow-400 to-amber-600',
  'Platinum Guild': 'from-cyan-400 to-sky-600',
  'Elite Guild': 'from-fuchsia-500 to-indigo-700',
};

function formatMonth(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
}

type Tab = 'posts' | 'profile';

export default function AccountProfilePage() {
  const router = useRouter();
  const params = useParams<{ username: string }>();
  const username = typeof params?.username === 'string' ? decodeURIComponent(params.username) : '';

  const [user, setUser] = useState<any>(null);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>('posts');
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [summary, setSummary] = useState<ReputationSummary | null>(null);
  const [leadership, setLeadership] = useState<LeadershipHistoryEntry[]>([]);
  const [certificates, setCertificates] = useState<ProfileCertificate[]>([]);
  const [timeline, setTimeline] = useState<ReputationActivityEntry[]>([]);
  const [copied, setCopied] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const me = await getCurrentUser();
      if (cancelled) return;
      if (!me) {
        router.replace('/login');
        return;
      }
      const myUsername = me.profile?.username ?? '';
      if (username && myUsername && myUsername.toLowerCase() !== username.toLowerCase()) {
        router.replace(`/profile/${encodeURIComponent(username)}`);
        return;
      }
      setUser(me);
      setReady(true);

      const [postsRes, rep, lead, tl] = await Promise.allSettled([
        getUserPosts(me.id),
        getReputationSummary(me.id),
        getUserLeadershipHistory(me.id),
        getPublicTimeline(me.id, 30),
      ]);
      if (cancelled) return;
      if (postsRes.status === 'fulfilled') setPosts(postsRes.value.posts);
      setPostsLoading(false);
      if (rep.status === 'fulfilled') setSummary(rep.value);
      if (lead.status === 'fulfilled') setLeadership(lead.value.leadershipHistory ?? []);
      if (tl.status === 'fulfilled') setTimeline(tl.value.activity);
      if (myUsername) {
        try {
          const certs = await getProfileCertificates(myUsername);
          if (!cancelled) setCertificates(certs.certificates);
        } catch {
          /* ignore */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, username]);

  function patchPost(id: string, updater: (p: FeedPost) => FeedPost) {
    setPosts((list) => list.map((p) => (p.id === id ? updater(p) : p)));
  }

  async function share() {
    const url = `${window.location.origin}/profile/${encodeURIComponent(user?.profile?.username ?? username)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }

  async function onCoverSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      setCoverUploading(true);
      const form = new FormData();
      form.append('coverImage', file);
      const { user: updated } = await uploadCover(form);
      setUser(updated);
    } catch {
      /* ignore */
    } finally {
      setCoverUploading(false);
    }
  }

  if (!ready || !user) {
    return (
      <div className="min-h-screen bg-slate-100">
        <StudentNav />
        <main className="mx-auto max-w-4xl px-4 py-8">
          <div className="h-64 animate-pulse rounded-3xl bg-white" />
        </main>
      </div>
    );
  }

  const profile = user.profile ?? {};
  const avatar = resolveFeedAvatar(profile.avatar);
  const cover = resolveFeedAvatar(profile.coverImage);
  const levelTone = summary ? LEVEL_TONE[summary.reputation.level] ?? 'from-indigo-600 to-sky-500' : 'from-indigo-600 to-sky-500';
  const headline = [profile.department, profile.university].filter(Boolean).join(' · ');

  const statItems = [
    { label: 'Posts', value: posts.length },
    { label: 'Guild Score', value: summary ? summary.reputation.guildScore : 0 },
    { label: 'Communities', value: summary ? summary.stats.communitiesJoined : 0 },
    { label: 'Certificates', value: summary ? summary.stats.certificatesEarned : certificates.length },
    { label: 'Leadership', value: summary ? summary.stats.leadershipRoles : leadership.length },
  ];

  return (
    <div className="min-h-screen bg-slate-100">
      <StudentNav />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className={`relative h-40 bg-gradient-to-r ${levelTone} sm:h-48`}>
            {cover ? <img src={cover} alt="Cover" className="h-full w-full object-cover" /> : null}
            <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={onCoverSelected} />
            <button
              onClick={() => coverInputRef.current?.click()}
              disabled={coverUploading}
              className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/45 px-3 py-1.5 text-xs font-medium text-white backdrop-blur transition hover:bg-black/60 disabled:opacity-60"
            >
              <Camera className="h-3.5 w-3.5" /> {coverUploading ? 'Uploading…' : cover ? 'Change cover' : 'Add cover'}
            </button>
          </div>

          <div className="relative z-10 px-4 pb-6 sm:px-6">
            <div className="flex items-start justify-between gap-4">
              <div className="relative z-10 -mt-12 shrink-0 sm:-mt-14">
                {avatar ? (
                  <img src={avatar} alt={user.fullName} className="h-24 w-24 rounded-2xl border-4 border-white object-cover shadow-md sm:h-28 sm:w-28" />
                ) : (
                  <span className="grid h-24 w-24 place-items-center rounded-2xl border-4 border-white bg-indigo-500 text-3xl font-semibold text-white shadow-md sm:h-28 sm:w-28">{user.fullName.slice(0, 1)}</span>
                )}
              </div>
              <div className="flex flex-wrap justify-end gap-2 pt-3">
                <Link href="/account" className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800">
                  <PencilLine className="h-4 w-4" /> Edit profile
                </Link>
                <button onClick={() => void share()} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
                  <Link2 className="h-4 w-4" /> {copied ? 'Copied!' : 'Share'}
                </button>
              </div>
            </div>

            <div className="mt-3">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold text-slate-950">{user.fullName}</h1>
                <BadgeCheck className="h-5 w-5 text-sky-500" />
              </div>
              {profile.username ? <p className="text-sm text-slate-500">@{profile.username}</p> : null}
              {headline ? <p className="mt-0.5 text-sm text-slate-600">{headline}</p> : null}
            </div>

            {profile.bio ? <p className="mt-3 max-w-2xl whitespace-pre-line text-sm text-slate-700">{profile.bio}</p> : null}
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-500">
              {profile.location ? <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" /> {profile.location}</span> : null}
              {profile.availability === 'OPEN' ? <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">● Open to opportunities</span> : null}
              {profile.availability === 'CASUAL' ? <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">● Casually looking</span> : null}
              {summary ? <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">{summary.reputation.level}{summary.rank ? ` · Rank #${summary.rank}` : ''}</span> : null}
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2 rounded-2xl border border-slate-100 bg-slate-50/60 p-3 sm:grid-cols-5">
              {statItems.map((s) => (
                <div key={s.label} className="text-center">
                  <p className="text-lg font-semibold tabular-nums text-slate-950">{s.value.toLocaleString()}</p>
                  <p className="text-xs text-slate-500">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={`/portfolio/${encodeURIComponent(profile.username ?? '')}`} className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50">View Portfolio</Link>
              <Link href={`/resume/${encodeURIComponent(profile.username ?? '')}`} className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50">View Resume</Link>
              <Link href="/verification" className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50">Verification Center</Link>
              <Link href={`/profile/${encodeURIComponent(profile.username ?? '')}`} className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50">Public view</Link>
            </div>
          </div>
        </section>

        <div className="sticky top-2 z-10 mt-6 grid grid-cols-2 gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
          <button onClick={() => setTab('posts')} className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${tab === 'posts' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Grid3x3 className="h-4 w-4" /> Posts
          </button>
          <button onClick={() => setTab('profile')} className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${tab === 'profile' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
            <IdCard className="h-4 w-4" /> Profile details
          </button>
        </div>

        {tab === 'posts' ? (
          <div className="mt-6 space-y-4">
            {postsLoading ? (
              Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-white" />)
            ) : posts.length ? (
              posts.map((post) => (
                <PostCard key={post.id} post={post} currentUserId={user.id} onPatch={patchPost} onDelete={(id) => setPosts((l) => l.filter((p) => p.id !== id))} />
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center">
                <p className="text-sm text-slate-500">You haven&apos;t posted anything yet.</p>
                <Link href="/home" className="mt-3 inline-block rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700">Share your first post</Link>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {summary ? (
              <div className={`rounded-3xl bg-gradient-to-br ${levelTone} p-6 text-white shadow-sm`}>
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-sm opacity-80">Guild Score</p>
                    <p className="text-4xl font-bold tabular-nums">{summary.reputation.guildScore.toLocaleString()}</p>
                    <p className="mt-1 text-sm font-medium">{summary.reputation.level}{summary.rank ? ` · Rank #${summary.rank}` : ''}</p>
                  </div>
                  {summary.reputation.badges.length ? (
                    <div className="flex max-w-md flex-wrap justify-end gap-2">
                      {summary.reputation.badges.map((b) => (
                        <span key={b.code} className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
                          <span aria-hidden>{b.icon}</span>{b.label}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="grid gap-6 md:grid-cols-2">
              <Panel title="Academic information">
                <div className="space-y-2 text-sm text-slate-700">
                  <Row label="University" value={profile.university || '—'} />
                  <Row label="Faculty" value={profile.faculty || '—'} />
                  <Row label="Department" value={profile.department || '—'} />
                  <Row label="Level" value={profile.level || '—'} />
                  {profile.graduationYear ? <Row label="Graduation" value={String(profile.graduationYear)} /> : null}
                  {profile.location ? <Row label="Location" value={profile.location} /> : null}
                </div>
              </Panel>

              <Panel title="Interests">
                <div className="flex flex-wrap gap-2">
                  {profile.interests?.length ? (
                    profile.interests.map((interest: string) => (
                      <span key={interest} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">{interest}</span>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">No interests listed.</p>
                  )}
                </div>
                {profile.socialLinks?.length ? (
                  <div className="mt-4 space-y-1">
                    {profile.socialLinks.map((link: string) => (
                      <a key={link} href={link} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm text-indigo-600 hover:underline">
                        <Link2 className="h-3.5 w-3.5" /> <span className="truncate">{link}</span>
                      </a>
                    ))}
                  </div>
                ) : null}
              </Panel>
            </div>

            <Panel title="Leadership history">
              <div className="space-y-3">
                {leadership.length ? (
                  leadership.map((entry) => (
                    <div key={entry.id} className="flex flex-col gap-1 rounded-2xl border border-slate-200 px-4 py-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-medium text-slate-900">{entry.role.replace(/_/g, ' ')}{entry.community ? <span className="text-slate-500"> · {entry.community.name}</span> : null}</p>
                        <p className="text-sm text-slate-500">{new Date(entry.startDate).toLocaleDateString()} – {entry.endDate ? new Date(entry.endDate).toLocaleDateString() : 'Present'}</p>
                      </div>
                      <span className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${entry.verificationStatus === 'VERIFIED' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{entry.verificationStatus === 'VERIFIED' ? 'Verified' : 'Pending'}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">No leadership history recorded yet.</p>
                )}
              </div>
            </Panel>

            {certificates.length ? (
              <Panel title="Certificates">
                <div className="grid gap-3 sm:grid-cols-2">
                  {certificates.map((c) => (
                    <Link key={c.serial} href={`/certificates/${encodeURIComponent(c.serial)}`} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-3 hover:border-indigo-300">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">{c.eventTitle}</p>
                        <p className="truncate text-xs text-slate-500">{c.communityName} · {new Date(c.issuedAt).toLocaleDateString()}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${c.status === 'VERIFIED' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{c.status === 'VERIFIED' ? 'Verified' : 'Revoked'}</span>
                    </Link>
                  ))}
                </div>
              </Panel>
            ) : null}

            {timeline.length ? (
              <Panel title="Activity timeline">
                <ol className="space-y-3">
                  {timeline.map((a) => (
                    <li key={a.id} className="flex items-start justify-between gap-3 border-l-2 border-slate-100 pl-4">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900">{a.description || a.type}</p>
                        <p className="text-xs text-slate-500">{formatMonth(a.createdAt)}</p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-emerald-600">+{a.scoreAwarded}</span>
                    </li>
                  ))}
                </ol>
              </Panel>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 py-2 last:border-b-0">
      <span className="text-slate-500">{label}</span>
      <span className="text-right text-slate-900">{value}</span>
    </div>
  );
}