'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  BadgeCheck, CircleCheck, FileText, Grid3x3, IdCard, Link2, Mail, MapPin,
  MessageSquare, Phone, Trophy, UserPlus, Award, ExternalLink, X
} from 'lucide-react';

import { getPublicProfile, getCurrentUser } from '../../../components/guildos/auth-api';
import { navigateBack } from '../../../components/guildos/back-navigation';
import { getUserLeadershipHistory, type LeadershipHistoryEntry } from '../../../components/guildos/community-list-api';
import {
  getProfileCertificates, getPublicTimeline, getReputationSummary,
  type ProfileCertificate, type ReputationActivityEntry, type ReputationSummary,
} from '../../../components/guildos/reputation-api';
import { resolveFeedAvatar } from '../../../components/guildos/feed-api';
import { UserPosts } from '../../../components/guildos/feed/user-posts';
import { StudentNav } from '../../../components/guildos/student-nav';
import { startConversation } from '../../../components/guildos/message-api';
import {
  getConnectionState, removeConnection, respondToConnection,
  sendConnectionRequest, type ConnectionState,
} from '../../../components/guildos/connection-api';
import { SocialLinks } from '../../../components/guildos/social-link';

/* ── Helpers ─────────────────────────────────────────────────── */

const LEVEL_TONE: Record<string, { grad: string; text: string }> = {
  'Explorer Guild': { grad: 'from-slate-500 to-slate-700', text: 'text-slate-300' },
  'Bronze Guild':   { grad: 'from-amber-600 to-orange-700', text: 'text-orange-200' },
  'Silver Guild':   { grad: 'from-slate-400 to-slate-600', text: 'text-slate-200' },
  'Gold Guild':     { grad: 'from-yellow-400 to-amber-600', text: 'text-yellow-100' },
  'Platinum Guild': { grad: 'from-cyan-400 to-sky-600', text: 'text-cyan-100' },
  'Elite Guild':    { grad: 'from-fuchsia-500 to-indigo-700', text: 'text-fuchsia-100' },
};

function fmt(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short' });
}

/* Animated score counter */
function CountUp({ target }: { target: number }) {
  const [val, setVal] = useState(0);
  const visible = useRef(false);
  const ref = useRef<HTMLSpanElement>(null);

  function animateTo(nextTarget: number) {
    const duration = 1200;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(eased * nextTarget));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // First animation only once the counter scrolls into view.
  useEffect(() => {
    if (!ref.current || visible.current) return;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      visible.current = true;
      io.disconnect();
      animateTo(target);
    }, { threshold: 0.5 });
    io.observe(ref.current);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-animate whenever the real value arrives after the initial load (target starts at 0
  // while stats are still fetching, then jumps to the real number) -- without this the counter
  // was stuck at 0 forever once the intersection observer had already fired once.
  useEffect(() => {
    if (!visible.current) return;
    animateTo(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return <span ref={ref}>{val.toLocaleString()}</span>;
}

/* Fade-up on scroll */
function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    if (rect.top < window.innerHeight) { setVis(true); return; }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVis(true); io.disconnect(); }
    }, { threshold: 0.08 });
    io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ${vis ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0'} ${className}`}
    >
      {children}
    </div>
  );
}

type Tab = 'posts' | 'profile';

/* ── Page ─────────────────────────────────────────────────────── */

export default function PublicProfilePage() {
  const params = useParams<{ username: string }>();
  const router = useRouter();
  const username = typeof params?.username === 'string' ? decodeURIComponent(params.username) : '';

  const [user, setUser] = useState<any>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('posts');
  const [summary, setSummary] = useState<ReputationSummary | null>(null);
  const [leadership, setLeadership] = useState<LeadershipHistoryEntry[]>([]);
  const [certificates, setCertificates] = useState<ProfileCertificate[]>([]);
  const [timeline, setTimeline] = useState<ReputationActivityEntry[]>([]);
  const [copied, setCopied] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<{ src: string; alt: string } | null>(null);

  useEffect(() => {
    if (!username) return;
    let cancelled = false;
    void getCurrentUser().then((me) => {
      if (cancelled) return;
      setViewerId(me?.id ?? null);
      if (me?.profile?.username && me.profile.username.toLowerCase() === username.toLowerCase()) {
        router.replace(`/u/${encodeURIComponent(username)}`);
      }
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [username, router]);

  useEffect(() => {
    if (!username) return;
    let cancelled = false;
    void (async () => {
      try {
        const result = await getPublicProfile(username);
        const normalizedId =
          (typeof result.user.id === 'string' && result.user.id)
            ? result.user.id
            : (typeof (result.user as { _id?: string })._id === 'string' ? (result.user as { _id?: string })._id ?? '' : '');
        if (!normalizedId) {
          throw new Error('Unable to resolve profile');
        }
        if (!cancelled) {
          setUser({ ...result.user, id: normalizedId });
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load profile');
      }
    })();
    return () => { cancelled = true; };
  }, [username]);

  const targetUserId =
    typeof user?.id === 'string' && user.id
      ? user.id
      : typeof user?._id === 'string' && user._id
        ? user._id
        : '';

  useEffect(() => {
    const userId = targetUserId;
    const uname = user?.profile?.username ?? user?.username;
    if (!userId) return;
    let cancelled = false;
    void (async () => {
      const [rep, lead, tl] = await Promise.allSettled([
        getReputationSummary(userId),
        getUserLeadershipHistory(userId),
        getPublicTimeline(userId, 30),
      ]);
      if (cancelled) return;
      if (rep.status === 'fulfilled') setSummary(rep.value);
      if (lead.status === 'fulfilled') setLeadership(lead.value.leadershipHistory ?? []);
      if (tl.status === 'fulfilled') setTimeline(tl.value.activity);
      if (uname) {
        try {
          const certs = await getProfileCertificates(uname);
          if (!cancelled) setCertificates(certs.certificates);
        } catch { if (!cancelled) setCertificates([]); }
      }
    })();
    return () => { cancelled = true; };
  }, [targetUserId, user?.profile?.username, user?.username]);

  async function share() {
    const url = `${window.location.origin}/profile/${encodeURIComponent(user?.profile?.username ?? username)}`;
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch {}
  }

  /* Skeleton */
  if (!user && !error) {
    return (
      <div className="min-h-screen bg-slate-100">
        <StudentNav />
        <main className="mx-auto max-w-4xl px-4 py-6">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="h-44 animate-pulse bg-gradient-to-r from-slate-200 to-slate-300 sm:h-52" />
            <div className="px-6 pb-8 pt-0">
              <div className="flex items-end justify-between">
                <div className="-mt-14 h-28 w-28 animate-pulse rounded-2xl border-4 border-white bg-slate-200 shadow-md" />
                <div className="flex gap-2 pt-3">
                  <div className="h-9 w-24 animate-pulse rounded-xl bg-slate-200" />
                  <div className="h-9 w-20 animate-pulse rounded-xl bg-slate-200" />
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <div className="h-6 w-48 animate-pulse rounded-full bg-slate-200" />
                <div className="h-4 w-32 animate-pulse rounded-full bg-slate-200" />
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-100">
        <StudentNav />
        <main className="mx-auto max-w-4xl px-4 py-8">
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center">
            <p className="text-rose-600">{error}</p>
            <button onClick={() => navigateBack(router, '/home')} className="mt-4 text-sm font-medium text-slate-600 hover:underline">← Go back</button>
          </div>
        </main>
      </div>
    );
  }

  const profile = user.profile ?? user;
  const avatar = resolveFeedAvatar(profile.avatar);
  const cover = resolveFeedAvatar(profile.coverImage);
  const tone = LEVEL_TONE[summary?.reputation.level ?? ''] ?? { grad: 'from-indigo-600 to-sky-500', text: 'text-indigo-100' };
  const headline = [profile.department, profile.university].filter(Boolean).join(' · ');
  const bioText = typeof profile.bio === 'string' && profile.bio.trim() ? profile.bio.trim() : (typeof user.bio === 'string' ? user.bio.trim() : '');
  const showAcademicSection = profile.showUniversity !== false || Boolean(profile.university || profile.faculty || profile.department || profile.level || profile.graduationYear);

  const stats = [
    { label: 'Guild Score', value: summary?.reputation.guildScore ?? 0 },
    { label: 'Communities', value: summary?.stats.communitiesJoined ?? 0 },
    { label: 'Certificates', value: summary?.stats.certificatesEarned ?? certificates.length },
    { label: 'Leadership', value: summary?.stats.leadershipRoles ?? leadership.length },
  ];

  return (
    <div className="min-h-screen bg-[#F4F6FA]">
      <StudentNav />
      <main className="mx-auto max-w-4xl space-y-5 px-4 py-6">

        {/* ── Profile Card ── */}
        <section className="rounded-3xl border border-slate-200/80 bg-white shadow-md">
          {/* Cover */}
          <div className={`relative overflow-hidden rounded-t-3xl h-44 bg-gradient-to-br ${tone.grad} sm:h-52`}>
            {cover ? (
              <img
                src={cover}
                alt={`${user.fullName} cover`}
                className="h-full w-full cursor-zoom-in object-cover"
                onClick={() => setMediaPreview({ src: cover, alt: `${user.fullName} cover` })}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            ) : null}
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
            {/* Level pill */}
            {summary ? (
              <div className={`absolute bottom-3 left-4 inline-flex items-center gap-1.5 rounded-full bg-black/30 px-3 py-1 text-xs font-semibold backdrop-blur ${tone.text}`}>
                <Trophy className="h-3.5 w-3.5" /> {summary.reputation.level}
              </div>
            ) : null}
          </div>

          <div className="px-4 pb-6 sm:px-6">
            {/* Avatar row */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="-mt-14 shrink-0 sm:-mt-16">
                <AvatarWithFallback
                  src={avatar}
                  name={user.fullName}
                  gradClass={`bg-gradient-to-br ${tone.grad}`}
                  onImageClick={() => setMediaPreview({ src: avatar, alt: user.fullName })}
                />
              </div>
              <div className="flex w-full flex-wrap items-center gap-2 pb-1 sm:w-auto sm:justify-end sm:pt-3">
                {targetUserId ? <ConnectButton targetId={targetUserId} /> : null}
                {targetUserId ? <MessageButton candidateId={targetUserId} /> : null}
                <button
                  onClick={() => void share()}
                  aria-label={copied ? 'Link copied' : 'Share profile'}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow sm:h-auto sm:w-auto sm:gap-1.5 sm:px-3.5 sm:py-2"
                >
                  <Link2 className="h-4 w-4" />
                  <span className="hidden sm:inline">{copied ? 'Copied!' : 'Share'}</span>
                </button>
              </div>
            </div>

            {/* Name + meta */}
            <div className="mt-4">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">{user.fullName}</h1>
                <BadgeCheck className="h-5 w-5 text-sky-500" />
              </div>
              {profile.username ? <p className="mt-0.5 text-sm font-medium text-slate-400">@{profile.username}</p> : null}
              {headline ? <p className="mt-1 text-sm text-slate-600">{headline}</p> : null}
              {bioText ? <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">{bioText}</p> : null}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {user.email ? (
                  <span className="inline-flex items-center gap-1 text-xs text-slate-500"><Mail className="h-3.5 w-3.5" /> {user.email}</span>
                ) : null}
                {profile.phoneNumber ? (
                  <span className="inline-flex items-center gap-1 text-xs text-slate-500"><Phone className="h-3.5 w-3.5" /> {profile.phoneNumber}</span>
                ) : null}
                {profile.location ? (
                  <span className="inline-flex items-center gap-1 text-xs text-slate-500"><MapPin className="h-3.5 w-3.5" /> {profile.location}</span>
                ) : null}
                {profile.availability === 'OPEN' ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> Open to opportunities</span>
                ) : profile.availability === 'CASUAL' ? (
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">● Casually looking</span>
                ) : null}
              </div>
            </div>

            {/* Stats */}
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {stats.map((s, i) => (
                <Reveal key={s.label} delay={i * 60} className="rounded-2xl bg-slate-50 p-3 text-center ring-1 ring-slate-100">
                  <p className="text-xl font-extrabold tabular-nums text-slate-950"><CountUp target={s.value} /></p>
                  <p className="mt-0.5 text-[11px] font-medium text-slate-500">{s.label}</p>
                </Reveal>
              ))}
            </div>

            {/* Quick links */}
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={`/portfolio/${encodeURIComponent(profile.username ?? '')}`} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow">
                <FileText className="h-4 w-4" /> Portfolio
              </Link>
              <Link href={`/resume/${encodeURIComponent(profile.username ?? '')}`} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow">
                <IdCard className="h-4 w-4" /> Resume
              </Link>
            </div>
          </div>
        </section>

        {/* ── Tabs ── */}
        <div className="sticky top-2 z-10 grid grid-cols-2 gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
          {(['posts', 'profile'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${tab === t ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              {t === 'posts' ? <><Grid3x3 className="h-4 w-4" /> Posts</> : <><IdCard className="h-4 w-4" /> Profile</>}
            </button>
          ))}
        </div>

        {/* ── Tab: Posts ── */}
        {tab === 'posts' ? (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            {targetUserId ? <UserPosts userId={targetUserId} currentUserId={viewerId ?? undefined} /> : null}
          </div>
        ) : (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">

            {/* Guild Score card */}
            {summary ? (
              <Reveal>
                <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${tone.grad} p-6 text-white shadow-md`}>
                  <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
                  <div className="relative flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest opacity-75">Guild Score</p>
                      <p className="mt-1 text-5xl font-extrabold tabular-nums"><CountUp target={summary.reputation.guildScore} /></p>
                      <p className="mt-1.5 text-sm font-medium opacity-90">{summary.reputation.level}{summary.rank ? ` · Rank #${summary.rank}` : ''}</p>
                    </div>
                    {summary.reputation.badges.length ? (
                      <div className="flex flex-wrap justify-end gap-2">
                        {summary.reputation.badges.map((b) => (
                          <span key={b.code} className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur">
                            <span>{b.icon}</span>{b.label}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </Reveal>
            ) : null}

            {/* Academic + Interests */}
            <div className="grid gap-4 md:grid-cols-2">
              {showAcademicSection ? (
                <Reveal delay={80}>
                  <InfoCard title="Academic" icon={<Award className="h-4 w-4" />}>
                    {([
                      ['University', profile.university],
                      ['Faculty', profile.faculty],
                      ['Department', profile.department],
                      ['Level', profile.level],
                      ...(profile.graduationYear ? [['Graduation', String(profile.graduationYear)]] : []),
                      ...(profile.location ? [['Location', profile.location]] : []),
                    ] as [string, string][]).map(([l, v]) => (
                      <div key={l} className="flex justify-between gap-2 border-b border-slate-50 py-2.5 last:border-b-0">
                        <span className="text-xs font-medium text-slate-500">{l}</span>
                        <span className="text-right text-xs font-semibold text-slate-900">{v || '—'}</span>
                      </div>
                    ))}
                  </InfoCard>
                </Reveal>
              ) : null}

              <Reveal delay={120}>
                <InfoCard title="Interests" icon={<Trophy className="h-4 w-4" />}>
                  {profile.interests?.length ? (
                    <div className="flex flex-wrap gap-2">
                      {profile.interests.map((interest: string) => (
                        <span key={interest} className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-100">{interest}</span>
                      ))}
                    </div>
                  ) : <p className="text-xs text-slate-400">No interests listed.</p>}
                </InfoCard>
              </Reveal>
              {profile.socialLinks?.length ? (
                <Reveal delay={140}>
                  <InfoCard title="Social" icon={<Link2 className="h-4 w-4" />}>
                    <SocialLinks links={profile.socialLinks} />
                  </InfoCard>
                </Reveal>
              ) : null}
            </div>

            {/* Leadership */}
            {profile.showLeadership !== false ? (
              <Reveal delay={160}>
                <InfoCard title="Leadership history">
                  {leadership.length ? (
                    <div className="space-y-3">
                      {leadership.map((entry, i) => (
                        <Reveal key={entry.id} delay={i * 40}>
                          <div className="flex flex-col gap-1.5 rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3 md:flex-row md:items-center md:justify-between">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">
                                {entry.role.replace(/_/g, ' ')}
                                {entry.community ? <span className="ml-1.5 font-normal text-slate-500">· {entry.community.name}</span> : null}
                              </p>
                              <p className="text-xs text-slate-400">{new Date(entry.startDate).toLocaleDateString()} – {entry.endDate ? new Date(entry.endDate).toLocaleDateString() : 'Present'}</p>
                            </div>
                            <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${entry.verificationStatus === 'VERIFIED' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                              {entry.verificationStatus === 'VERIFIED' ? <><CircleCheck className="h-3.5 w-3.5" aria-hidden /> Verified</> : 'Pending'}
                            </span>
                          </div>
                        </Reveal>
                      ))}
                    </div>
                  ) : <p className="text-sm text-slate-400">No leadership history recorded yet.</p>}
                </InfoCard>
              </Reveal>
            ) : null}

            {/* Certificates */}
            {profile.showCertificates !== false && certificates.length ? (
              <Reveal delay={200}>
                <InfoCard title="Certificates">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {certificates.map((c, i) => (
                      <Reveal key={c.serial} delay={i * 40}>
                        <Link href={`/certificates/${encodeURIComponent(c.serial)}`} className="group flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-sm">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">{c.eventTitle}</p>
                            <p className="truncate text-xs text-slate-500">{c.communityName} · {new Date(c.issuedAt).toLocaleDateString()}</p>
                          </div>
                          <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${c.status === 'VERIFIED' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-rose-50 text-rose-700'}`}>
                            {c.status === 'VERIFIED' ? <><CircleCheck className="h-3.5 w-3.5" aria-hidden /> Verified</> : 'Revoked'}
                          </span>
                        </Link>
                      </Reveal>
                    ))}
                  </div>
                </InfoCard>
              </Reveal>
            ) : null}

            {/* Timeline */}
            {profile.showTimeline !== false && timeline.length ? (
              <Reveal delay={240}>
                <InfoCard title="Activity timeline">
                  <ol className="relative space-y-0 border-l-2 border-indigo-100 pl-5">
                    {timeline.map((a, i) => (
                      <Reveal key={a.id} delay={i * 30}>
                        <li className="pb-4 last:pb-0">
                          <div className="absolute -left-[7px] mt-1 h-3 w-3 rounded-full border-2 border-indigo-400 bg-white" />
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{a.description || a.type}</p>
                              <p className="text-xs text-slate-400">{fmt(a.createdAt)}</p>
                            </div>
                            <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">+{a.scoreAwarded}</span>
                          </div>
                        </li>
                      </Reveal>
                    ))}
                  </ol>
                </InfoCard>
              </Reveal>
            ) : null}
          </div>
        )}
        {mediaPreview ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            onClick={() => setMediaPreview(null)}
          >
            <button
              onClick={(event) => {
                event.stopPropagation();
                setMediaPreview(null);
              }}
              className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
              aria-label="Close image preview"
            >
              <X className="h-5 w-5" />
            </button>
            <img
              src={mediaPreview.src}
              alt={mediaPreview.alt}
              className="max-h-[90vh] w-auto max-w-[95vw] rounded-xl object-contain"
              onClick={(event) => event.stopPropagation()}
            />
          </div>
        ) : null}
      </main>
    </div>
  );
}

/* ── Shared sub-components ────────────────────────────────────── */

function InfoCard({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        {icon ? <span className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-50 text-indigo-600">{icon}</span> : null}
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function MessageButton({ candidateId }: { candidateId: string }) {
  const router = useRouter();
  const [canMessage, setCanMessage] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setChecking(true);
    void (async () => {
      const u = await getCurrentUser().catch(() => null);
      if (cancelled) return;
      if (!u || u.id === candidateId) {
        setCanMessage(false);
        setChecking(false);
        return;
      }
      if (u.role === 'RECRUITER' || u.role === 'ADMIN') {
        setCanMessage(true);
        setChecking(false);
        return;
      }
      const st = await getConnectionState(candidateId).catch(() => null);
      if (cancelled) return;
      setCanMessage(st?.state === 'CONNECTED');
      setChecking(false);
    })();
    return () => { cancelled = true; };
  }, [candidateId]);
  if (checking) {
    return <div className="h-9 w-9 animate-pulse rounded-xl bg-slate-200 sm:w-24" />;
  }
  if (!canMessage) return null;
  async function open() {
    try { setBusy(true); const { conversationId } = await startConversation(candidateId); router.push(`/messages?c=${conversationId}`); } finally { setBusy(false); }
  }
  return (
    <button onClick={() => void open()} disabled={busy} aria-label="Message user" className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-indigo-700 disabled:opacity-60 sm:h-auto sm:w-auto sm:gap-1.5 sm:px-3.5 sm:py-2">
      <MessageSquare className="h-4 w-4" />
      <span className="hidden sm:inline">Message</span>
    </button>
  );
}

function AvatarWithFallback({
  src,
  name,
  gradClass,
  onImageClick,
}: {
  src: string;
  name: string;
  gradClass: string;
  onImageClick?: () => void;
}) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name}
        onClick={onImageClick}
        className="h-20 w-20 cursor-zoom-in rounded-2xl border-4 border-white object-cover shadow-lg ring-2 ring-slate-100 sm:h-32 sm:w-32"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <div className={`grid h-20 w-20 place-items-center rounded-2xl border-4 border-white ${gradClass} text-3xl font-bold text-white shadow-lg sm:h-32 sm:w-32 sm:text-4xl`}>
      {name.slice(0, 1)}
    </div>
  );
}

function ConnectButton({ targetId }: { targetId: string }) {
  const [state, setState] = useState<ConnectionState | null>(null);
  const [mutual, setMutual] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const fetchState = (id: string) => {
    let cancelled = false;
    setLoadError(false);
    void getConnectionState(id)
      .then((r) => { if (!cancelled) { setState(r.state); setMutual(r.mutual); } })
      .catch(() => { if (!cancelled) setLoadError(true); });
    return () => { cancelled = true; };
  };

  useEffect(() => fetchState(targetId), [targetId]);

  async function run(fn: () => Promise<{ state: ConnectionState }>) {
    try {
      setBusy(true);
      await fn();
      // Always re-fetch real state from the API after any action
      // so the UI reflects truth, not just the optimistic response.
      const r = await getConnectionState(targetId);
      setState(r.state);
      setMutual(r.mutual);
    } finally {
      setBusy(false);
    }
  }

  // Loading skeleton
  if (state === null && !loadError) {
    return <div className="h-9 w-24 animate-pulse rounded-xl bg-slate-200" />;
  }
  // Error: show retry instead of defaulting to NONE (which caused wrong Connect button)
  if (loadError) {
    return (
      <button onClick={() => { setState(null); fetchState(targetId); }} className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-500 shadow-sm transition hover:bg-slate-50">
        Retry
      </button>
    );
  }
  if (state === 'SELF') return null;
  const ml = mutual > 0 ? <span className="ml-1.5 hidden text-xs font-normal opacity-70 sm:inline">{mutual} mutual</span> : null;
  if (state === 'CONNECTED') return (
    <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-sm font-semibold text-emerald-700"><CircleCheck className="h-4 w-4" aria-hidden /> Connected{ml}</span>
  );
  if (state === 'PENDING_OUTGOING') return (
    <button onClick={() => void run(() => removeConnection(targetId))} disabled={busy} className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-60">Pending · Cancel</button>
  );
  if (state === 'PENDING_INCOMING') return (
    <span className="inline-flex items-center gap-2">
      <button onClick={() => void run(() => respondToConnection(targetId, true))} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"><CircleCheck className="h-4 w-4" aria-hidden /> Accept{ml}</button>
      <button onClick={() => void run(() => respondToConnection(targetId, false))} disabled={busy} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-60">Ignore</button>
    </span>
  );
  return (
    <button onClick={() => void run(() => sendConnectionRequest(targetId))} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:opacity-60">
      <UserPlus className="h-4 w-4" /> Connect{ml}
    </button>
  );
}
