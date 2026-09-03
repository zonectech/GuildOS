'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Award, BadgeCheck, Calendar, Camera, ChevronDown, CircleCheck, Crown, Download, FileText, Grid3x3, HeartHandshake, IdCard,
  ExternalLink, Link2, Mail, MapPin, Mic, MessageSquare, PencilLine, Phone, Sparkles, Trophy, UserMinus, UserPlus, X,
  type LucideIcon,
} from 'lucide-react';

import { VerifiedBadge } from '../../../components/guildos/verified-badge';
import { getCurrentUser, uploadCover, getPublicProfile } from '../../../components/guildos/auth-api';
import { navigateBack } from '../../../components/guildos/back-navigation';
import { getUserLeadershipHistory, type LeadershipHistoryEntry } from '../../../components/guildos/community-list-api';
import {
  getProfileCertificates, getPublicTimeline, getReputationSummary,
  type ProfileCertificate, type ReputationActivityEntry, type ReputationSummary,
} from '../../../components/guildos/reputation-api';
import { getUserPosts, resolveFeedAvatar, type FeedPost } from '../../../components/guildos/feed-api';
import { PostCard } from '../../../components/guildos/feed/feed';
import { UserPosts } from '../../../components/guildos/feed/user-posts';
import { StudentNav } from '../../../components/guildos/student-nav';
import { startConversation } from '../../../components/guildos/message-api';
import {
  getConnectionState, removeConnection, respondToConnection,
  sendConnectionRequest, type ConnectionState,
} from '../../../components/guildos/connection-api';
import { SocialLinks } from '../../../components/guildos/social-link';
import { OtherCredentialsSection } from '../../../components/guildos/other-credentials';

/* ── helpers ─────────────────────────────────────────────────── */

const LEVEL_TONE: Record<string, { grad: string; text: string }> = {
  'Explorer Guild': { grad: 'from-slate-500 to-slate-700',   text: 'text-slate-300' },
  'Bronze Guild':   { grad: 'from-amber-600 to-orange-700',  text: 'text-orange-200' },
  'Silver Guild':   { grad: 'from-slate-400 to-slate-600',   text: 'text-slate-200' },
  'Gold Guild':     { grad: 'from-yellow-400 to-amber-600',  text: 'text-yellow-100' },
  'Platinum Guild': { grad: 'from-cyan-400 to-sky-600',      text: 'text-cyan-100' },
  'Elite Guild':    { grad: 'from-fuchsia-500 to-indigo-700', text: 'text-fuchsia-100' },
};

/** Icon + tint per reputation activity category, so the timeline reads at a glance instead of
 * every entry looking identical. */
const CATEGORY_META: Record<string, { Icon: LucideIcon; tint: string; iconColor: string; label: string }> = {
  ATTENDANCE: { Icon: Calendar, tint: 'bg-sky-50', iconColor: 'text-sky-600', label: 'Attendance' },
  LEADERSHIP: { Icon: Crown, tint: 'bg-amber-50', iconColor: 'text-amber-600', label: 'Leadership' },
  VOLUNTEER: { Icon: HeartHandshake, tint: 'bg-emerald-50', iconColor: 'text-emerald-600', label: 'Volunteering' },
  SPEAKER: { Icon: Mic, tint: 'bg-violet-50', iconColor: 'text-violet-600', label: 'Speaking' },
  ORGANIZER: { Icon: Sparkles, tint: 'bg-indigo-50', iconColor: 'text-indigo-600', label: 'Organizing' },
};

function monthLabel(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? 'Earlier' : d.toLocaleDateString('en-NG', { month: 'long', year: 'numeric' });
}

/** Groups already-sorted (newest first) timeline entries under month headings, preserving order. */
function groupByMonth<T extends { createdAt: string }>(entries: T[]): { label: string; items: T[] }[] {
  const groups: { label: string; items: T[] }[] = [];
  for (const entry of entries) {
    const label = monthLabel(entry.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(entry);
    else groups.push({ label, items: [entry] });
  }
  return groups;
}

function fmt(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-NG', { year: 'numeric', month: 'short' });
}

function CountUp({ target }: { target: number }) {
  const [val, setVal] = useState(0);
  const visible = useRef(false);
  const ref = useRef<HTMLSpanElement>(null);

  function animateTo(nextTarget: number) {
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / 1200, 1);
      setVal(Math.round((1 - Math.pow(1 - p, 3)) * nextTarget));
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

  return <span ref={ref}>{val.toLocaleString('en-NG')}</span>;
}

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
    <div ref={ref} style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ${vis ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0'} ${className}`}>
      {children}
    </div>
  );
}

function InfoCard({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white dark:bg-slate-900 p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        {icon ? <span className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">{icon}</span> : null}
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300">{title}</h2>
      </div>
      {children}
    </div>
  );
}

type Tab = 'posts' | 'profile' | 'certificates';

const CERT_TYPE_LABEL: Record<string, string> = {
  ATTENDANCE: 'Certificate of Attendance',
  COMPLETION: 'Certificate of Completion',
  LEADERSHIP: 'Certificate of Leadership',
  VOLUNTEER: 'Certificate of Volunteering',
};

const CERT_TYPE_ACCENT: Record<string, string> = {
  ATTENDANCE: 'from-indigo-600 to-sky-500',
  COMPLETION: 'from-emerald-600 to-teal-500',
  LEADERSHIP: 'from-amber-500 to-orange-500',
  VOLUNTEER: 'from-rose-500 to-pink-500',
};

/* ── page ─────────────────────────────────────────────────────── */

export default function UniversalProfilePage() {
  const router = useRouter();
  const params = useParams<{ username: string }>();
  const username = typeof params?.username === 'string' ? decodeURIComponent(params.username) : '';

  // isOwner = current user IS viewing their own page
  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  const [user, setUser] = useState<any>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('posts');
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [summary, setSummary] = useState<ReputationSummary | null>(null);
  const [leadership, setLeadership] = useState<LeadershipHistoryEntry[]>([]);
  const [certificates, setCertificates] = useState<ProfileCertificate[]>([]);
  const [timeline, setTimeline] = useState<ReputationActivityEntry[]>([]);
  const [copied, setCopied] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<{ src: string; alt: string } | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);
  const [error, setError] = useState('');
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  // Determine ownership and load data
  useEffect(() => {
    if (!username) return;
    let cancelled = false;
    void (async () => {
      try {
        const me = await getCurrentUser();
        if (cancelled) return;
        if (!me) { router.replace('/login'); return; }
        setViewerId(me.id);
        const myUsername = me.profile?.username ?? '';
        const mine = myUsername.toLowerCase() === username.toLowerCase();
        setIsOwner(mine);
        if (mine) {
          // Owner — use cached session data, no extra fetch needed
          setUser(me);
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
            const certs = await getProfileCertificates(myUsername).catch(() => ({ certificates: [] }));
            if (!cancelled) setCertificates(certs.certificates);
          }
        } else {
          // Visitor — fetch target user's public profile
          const result = await getPublicProfile(username);
          if (cancelled) return;
          setUser(result.user);
          setPostsLoading(false);
          const targetId = (typeof result.user.id === 'string' && result.user.id)
            ? result.user.id
            : (typeof (result.user as { _id?: string })._id === 'string' ? (result.user as { _id?: string })._id ?? '' : '');
          if (!targetId) {
            throw new Error('Unable to resolve profile');
          }
          const uname = result.user.profile?.username ?? username;
          const [rep, lead, tl] = await Promise.allSettled([
            getReputationSummary(targetId),
            getUserLeadershipHistory(targetId),
            getPublicTimeline(targetId, 30),
          ]);
          if (cancelled) return;
          if (rep.status === 'fulfilled') setSummary(rep.value);
          if (lead.status === 'fulfilled') setLeadership(lead.value.leadershipHistory ?? []);
          if (tl.status === 'fulfilled') setTimeline(tl.value.activity);
          if (uname) {
            const certs = await getProfileCertificates(uname).catch(() => ({ certificates: [] }));
            if (!cancelled) setCertificates(certs.certificates);
          }
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load profile');
      }
    })();
    return () => { cancelled = true; };
  }, [username, router]);

  function patchPost(id: string, updater: (p: FeedPost) => FeedPost) {
    setPosts((list) => list.map((p) => (p.id === id ? updater(p) : p)));
  }

  async function share() {
    const url = `${window.location.origin}/u/${encodeURIComponent(username)}`;
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch {}
  }

  async function onCoverSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setCoverUploading(true);
      const form = new FormData();
      form.append('coverImage', file);
      const { user: updated } = await uploadCover(form);
      setUser(updated);
    } catch {} finally { setCoverUploading(false); }
  }

  /* Skeleton */
  if (isOwner === null || !user) {
    return (
      <div className="min-h-screen bg-[#F4F6FA]">
        <StudentNav />
        <main className="mx-auto max-w-4xl px-4 py-6">
          <div className="overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md">
            <div className="h-44 animate-pulse bg-gradient-to-r from-slate-200 to-slate-300 sm:h-52" />
            <div className="px-6 pb-8">
              <div className="flex items-end justify-between">
                <div className="-mt-14 h-28 w-28 animate-pulse rounded-2xl border-4 border-white bg-slate-200 shadow-md" />
                <div className="flex gap-2 pt-3"><div className="h-9 w-24 animate-pulse rounded-xl bg-slate-200" /><div className="h-9 w-20 animate-pulse rounded-xl bg-slate-200" /></div>
              </div>
              <div className="mt-4 space-y-2">
                <div className="h-6 w-48 animate-pulse rounded-full bg-slate-200" />
                <div className="h-4 w-32 animate-pulse rounded-full bg-slate-200" />
                <div className="mt-5 grid grid-cols-4 gap-2">{Array.from({length:4}).map((_,i)=><div key={i} className="h-14 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-950"/>)}</div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#F4F6FA]"><StudentNav />
        <main className="mx-auto max-w-4xl px-4 py-8">
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center dark:border-rose-500/30 dark:bg-rose-950/50">
            <p className="text-rose-600">{error}</p>
            <button onClick={() => navigateBack(router, '/home')} className="mt-4 text-sm font-medium text-slate-600 dark:text-slate-400 hover:underline">← Go back</button>
          </div>
        </main>
      </div>
    );
  }

  const targetUserId =
    typeof user?.id === 'string' && user.id
      ? user.id
      : typeof user?._id === 'string' && user._id
        ? user._id
        : '';
  const profile = user.profile ?? {};
  const avatar = resolveFeedAvatar(profile.avatar);
  const cover = resolveFeedAvatar(profile.coverImage);
  const tone = LEVEL_TONE[summary?.reputation.level ?? ''] ?? { grad: 'from-indigo-600 to-sky-500', text: 'text-indigo-100' };
  const headline = [profile.department, profile.university].filter(Boolean).join(' · ');
  const bioText = typeof profile.bio === 'string' && profile.bio.trim() ? profile.bio.trim() : (typeof user.bio === 'string' ? user.bio.trim() : '');
  const showAcademicSection = isOwner || profile.showUniversity !== false || Boolean(
    profile.university || profile.faculty || profile.department || profile.level || profile.graduationYear,
  );

  const statItems = isOwner
    ? [
        { label: 'Posts', value: posts.length },
        { label: 'Guild Score', value: summary?.reputation.guildScore ?? 0 },
        { label: 'Communities', value: summary?.stats.communitiesJoined ?? 0 },
        { label: 'Certificates', value: summary?.stats.certificatesEarned ?? certificates.length },
        { label: 'Leadership', value: summary?.stats.leadershipRoles ?? leadership.length },
      ]
    : [
        { label: 'Guild Score', value: summary?.reputation.guildScore ?? 0 },
        { label: 'Communities', value: summary?.stats.communitiesJoined ?? 0 },
        { label: 'Certificates', value: summary?.stats.certificatesEarned ?? certificates.length },
        { label: 'Leadership', value: summary?.stats.leadershipRoles ?? leadership.length },
      ];

  return (
    <div className="min-h-screen bg-[#F4F6FA]">
      <StudentNav />
      <main className="mx-auto max-w-4xl space-y-5 px-4 py-6">

        {/* ── Profile card ── */}
        <section className="rounded-3xl border border-slate-200/80 bg-white dark:bg-slate-900 shadow-md">
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
            <div className="absolute inset-0 pointer-events-none opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%,white 1px,transparent 1px),radial-gradient(circle at 80% 20%,white 1px,transparent 1px)', backgroundSize: '40px 40px' }} />
            {summary ? (
              <div className={`absolute bottom-3 right-4 inline-flex items-center gap-1.5 rounded-full bg-black/30 px-3 py-1 text-xs font-semibold backdrop-blur ${tone.text}`}>
                <Trophy className="h-3.5 w-3.5" /> {summary.reputation.level}
                {summary.rank ? ` · Rank #${summary.rank}` : ''}
              </div>
            ) : null}
            {/* Cover upload — owner only */}
            {isOwner ? (
              <>
                <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={onCoverSelected} />
                <button
                  onClick={() => coverInputRef.current?.click()}
                  disabled={coverUploading}
                  className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1.5 text-xs font-medium text-white backdrop-blur transition hover:bg-black/60 disabled:opacity-60"
                >
                  <Camera className="h-3.5 w-3.5" /> {coverUploading ? 'Uploading…' : cover ? 'Change cover' : 'Add cover'}
                </button>
              </>
            ) : null}
          </div>

          <div className="relative px-4 pb-6 sm:px-6">
            <div className="flex items-end justify-between gap-3">
              {/* Avatar — overlaps cover across all breakpoints */}
              <div className="relative -mt-12 z-10 w-fit shrink-0 sm:-mt-16">
                <AvatarWithFallback
                  src={avatar}
                  name={user.fullName}
                  gradClass={`bg-gradient-to-br ${tone.grad}`}
                  onImageClick={() => setMediaPreview({ src: avatar, alt: user.fullName })}
                />
              </div>

              {/* Buttons — compact on mobile; desktop: full labels */}
              <div className="flex flex-wrap items-center gap-2 sm:justify-end sm:pb-2 sm:pt-3">
                {isOwner ? (
                  <>
                    <Link href="/account" className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-800">
                      <PencilLine className="h-4 w-4" /> Edit profile
                    </Link>
                    <button
                      onClick={() => void share()}
                      aria-label={copied ? 'Link copied' : 'Share profile'}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-medium text-slate-700 dark:text-slate-300 shadow-sm transition hover:-translate-y-0.5 hover:shadow sm:h-auto sm:w-auto sm:gap-1.5 sm:px-3.5 sm:py-2"
                    >
                      <Link2 className="h-4 w-4" />
                      <span className="hidden sm:inline">{copied ? 'Copied!' : 'Share'}</span>
                    </button>
                  </>
                ) : (
                  <>
                    {targetUserId ? <ConnectButton targetId={targetUserId} /> : null}
                    {targetUserId ? <MessageButton candidateId={targetUserId} /> : null}
                    <button
                      onClick={() => void share()}
                      aria-label={copied ? 'Link copied' : 'Share profile'}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-medium text-slate-700 dark:text-slate-300 shadow-sm transition hover:-translate-y-0.5 hover:shadow sm:h-auto sm:w-auto sm:gap-1.5 sm:px-3.5 sm:py-2"
                    >
                      <Link2 className="h-4 w-4" />
                      <span className="hidden sm:inline">{copied ? 'Copied!' : 'Share'}</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Name + meta */}
            <div className="mt-4">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-3xl">{user.fullName}</h1>
                <VerifiedBadge />
              </div>
              {profile.username ? <p className="mt-0.5 text-sm font-medium text-slate-400 dark:text-slate-500">@{profile.username}</p> : null}
              {headline ? <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{headline}</p> : null}
              {bioText ? <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">{bioText}</p> : null}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {user.email ? <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400"><Mail className="h-3.5 w-3.5" /> {user.email}</span> : null}
                {profile.phoneNumber ? <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400"><Phone className="h-3.5 w-3.5" /> {profile.phoneNumber}</span> : null}
                {profile.location ? <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400"><MapPin className="h-3.5 w-3.5" /> {profile.location}</span> : null}
                {profile.availability === 'OPEN' ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> Open to opportunities
                  </span>
                ) : profile.availability === 'CASUAL' ? (
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30">● Casually looking</span>
                ) : null}
              </div>
            </div>

            {/* Stats */}
            <div className={`mt-5 grid gap-2 ${isOwner ? 'grid-cols-3 sm:grid-cols-5' : 'grid-cols-2 sm:grid-cols-4'}`}>
              {statItems.map((s, i) => (
                <Reveal key={s.label} delay={i * 60} className="rounded-2xl bg-slate-50 dark:bg-slate-900 p-3 text-center ring-1 ring-slate-100">
                  <p className="text-xl font-extrabold tabular-nums text-slate-950 dark:text-white"><CountUp target={s.value} /></p>
                  <p className="mt-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">{s.label}</p>
                </Reveal>
              ))}
            </div>

            {/* Links */}
            <div className="mt-4 flex flex-wrap gap-2">
              {isOwner ? (
                <>
                  <Link href="/connections" className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 shadow-sm transition hover:-translate-y-0.5 hover:shadow">Connections</Link>
                  <Link href={`/portfolio/${encodeURIComponent(profile.username ?? '')}`} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 shadow-sm transition hover:-translate-y-0.5 hover:shadow"><FileText className="h-4 w-4" /> Portfolio</Link>
                  <Link href={`/resume/${encodeURIComponent(profile.username ?? '')}`} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 shadow-sm transition hover:-translate-y-0.5 hover:shadow"><IdCard className="h-4 w-4" /> Resume</Link>
                  <Link href="/verification" className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 shadow-sm transition hover:-translate-y-0.5 hover:shadow">Verification</Link>
                </>
              ) : (
                <>
                  <Link href={`/portfolio/${encodeURIComponent(profile.username ?? '')}`} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 shadow-sm transition hover:-translate-y-0.5 hover:shadow"><FileText className="h-4 w-4" /> Portfolio</Link>
                  <Link href={`/resume/${encodeURIComponent(profile.username ?? '')}`} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 shadow-sm transition hover:-translate-y-0.5 hover:shadow"><IdCard className="h-4 w-4" /> Resume</Link>
                </>
              )}
            </div>
          </div>
        </section>

        {/* ── Tabs ── */}
        <div className="sticky top-2 z-10 grid grid-cols-3 gap-1 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1 shadow-sm">
          {(['posts', 'profile', 'certificates'] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${tab === t ? 'bg-slate-900 text-white shadow' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
              {t === 'posts' ? <><Grid3x3 className="h-4 w-4" /> Posts</> : t === 'profile' ? <><IdCard className="h-4 w-4" /> Profile</> : <><Award className="h-4 w-4" /> Certificates</>}
            </button>
          ))}
        </div>

        {/* ── Tab: Posts ── */}
        {tab === 'posts' ? (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            {isOwner ? (
              postsLoading ? (
                Array.from({length:3}).map((_,i) => <div key={i} className="mb-4 h-28 animate-pulse rounded-2xl bg-white dark:bg-slate-900" />)
              ) : posts.length ? (
                <div className="space-y-4">
                  {posts.map((post) => (
                    <PostCard key={post.id} post={post} currentUserId={user.id}
                      onPatch={patchPost} onDelete={(id) => setPosts((l) => l.filter((p) => p.id !== id))} />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center">
                  <p className="text-sm text-slate-500 dark:text-slate-400">You haven&apos;t posted anything yet.</p>
                  <Link href="/home" className="mt-3 inline-block rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700">Share your first post</Link>
                </div>
              )
            ) : (
              targetUserId ? <UserPosts userId={targetUserId} currentUserId={viewerId ?? undefined} /> : null
            )}
          </div>
        ) : tab === 'certificates' ? (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            {!isOwner && profile.showCertificates === false ? (
              <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-10 text-center">
                <Award className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">This user keeps their certificates private.</p>
              </div>
            ) : certificates.length ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {certificates.map((c, i) => {
                  const revoked = c.status === 'REVOKED';
                  return (
                    <Reveal key={c.serial} delay={i * 40}>
                      <Link
                        href={`/certificates/${encodeURIComponent(c.serial)}`}
                        className={`group relative block overflow-hidden rounded-2xl border bg-white dark:bg-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${revoked ? 'border-red-200 opacity-70' : 'border-slate-200 dark:border-slate-800 hover:border-indigo-300'}`}
                      >
                        <div className={`h-1.5 bg-gradient-to-r ${CERT_TYPE_ACCENT[c.type] ?? 'from-indigo-600 to-sky-500'}`} />
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white ${CERT_TYPE_ACCENT[c.type] ?? 'from-indigo-600 to-sky-500'}`}>
                              <Award className="h-5 w-5" />
                            </div>
                            {revoked ? (
                              <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-500/15 dark:text-red-300">Revoked</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                                <BadgeCheck className="h-3 w-3" /> Verified
                              </span>
                            )}
                          </div>
                          <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{CERT_TYPE_LABEL[c.type] ?? 'Certificate'}</p>
                          <h3 className="mt-0.5 line-clamp-2 font-semibold text-slate-950 dark:text-white">{c.eventTitle}</h3>
                          <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{c.communityName}</p>
                          <div className="mt-3 flex items-center justify-between border-t border-dashed border-slate-200 dark:border-slate-800 pt-3">
                            <span className="text-[11px] text-slate-400 dark:text-slate-500">Issued {new Date(c.issuedAt).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 opacity-0 transition group-hover:opacity-100">
                              <Download className="h-3 w-3" /> View &amp; download
                            </span>
                          </div>
                        </div>
                      </Link>
                    </Reveal>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-10 text-center">
                <Award className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                  {isOwner ? 'You haven\u2019t earned any certificates yet. Attend and complete events to earn verifiable certificates.' : 'No certificates earned yet.'}
                </p>
                {isOwner ? (
                  <Link href="/events" className="mt-3 inline-block rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700">Discover events</Link>
                ) : null}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">

            {/* Guild Score */}
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
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{l}</span>
                        <span className="text-right text-xs font-semibold text-slate-900 dark:text-slate-100">{v || '—'}</span>
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
                        <span key={interest} className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-100 dark:bg-indigo-500/15 dark:text-indigo-300 dark:ring-indigo-500/30">{interest}</span>
                      ))}
                    </div>
                  ) : <p className="text-xs text-slate-400 dark:text-slate-500">No interests listed.</p>}
                </InfoCard>
              </Reveal>
              {profile.skills?.length ? (
                <Reveal delay={130}>
                  <InfoCard title="Skills" icon={<Sparkles className="h-4 w-4" />}>
                    <div className="flex flex-wrap gap-2">
                      {profile.skills.map((skill: string) => (
                        <span key={skill} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30">{skill}</span>
                      ))}
                    </div>
                  </InfoCard>
                </Reveal>
              ) : null}
              {profile.socialLinks?.length ? (
                <Reveal delay={140}>
                  <InfoCard title="Social" icon={<Link2 className="h-4 w-4" />}>
                    <SocialLinks links={profile.socialLinks} />
                  </InfoCard>
                </Reveal>
              ) : null}
            </div>

            <OtherCredentialsSection username={username} />

            {/* Leadership */}
            {(isOwner || profile.showLeadership !== false) && (
              <Reveal delay={160}>
                <InfoCard title="Leadership history">
                  {leadership.length ? (
                    <div className="space-y-3">
                      {leadership.map((entry, i) => (
                        <Reveal key={entry.id} delay={i * 40}>
                          <div className="flex flex-col gap-1.5 rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3 md:flex-row md:items-center md:justify-between">
                            <div>
                              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{entry.role.replace(/_/g, ' ')}
                                {entry.community ? <span className="ml-1.5 font-normal text-slate-500 dark:text-slate-400">· {entry.community.name}</span> : null}
                              </p>
                              <p className="text-xs text-slate-400 dark:text-slate-500">{entry.session ? `${entry.session} session${entry.current ? ' · Current' : ''}` : <>{new Date(entry.startDate).toLocaleDateString('en-NG')} – {entry.endDate ? new Date(entry.endDate).toLocaleDateString('en-NG') : 'Present'}</>}</p>
                            </div>
                            <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${entry.verificationStatus === 'VERIFIED' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 dark:bg-slate-950 text-slate-500 dark:text-slate-400'}`}>
                              {entry.verificationStatus === 'VERIFIED' ? <><CircleCheck className="h-3.5 w-3.5" aria-hidden /> Verified</> : 'Pending'}
                            </span>
                          </div>
                        </Reveal>
                      ))}
                    </div>
                  ) : <p className="text-sm text-slate-400 dark:text-slate-500">No leadership history recorded yet.</p>}
                </InfoCard>
              </Reveal>
            )}

            {/* Timeline */}
            {(isOwner || profile.showTimeline !== false) && timeline.length ? (
              <Reveal delay={240}>
                <InfoCard title="Activity timeline">
                  <div className="space-y-5">
                    {groupByMonth(timeline).map((group, gi) => (
                      <div key={group.label}>
                        <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{group.label}</p>
                        <ol className="relative space-y-3.5 border-l-2 border-slate-100 pl-8">
                          {group.items.map((a, i) => {
                            const meta = CATEGORY_META[a.category] ?? CATEGORY_META.ATTENDANCE;
                            const { Icon } = meta;
                            return (
                              <Reveal key={a.id} delay={(gi * group.items.length + i) * 30}>
                                <li className="relative">
                                  <span className={`absolute -left-[2.35rem] grid h-7 w-7 place-items-center rounded-full ring-4 ring-white ${meta.tint}`}>
                                    <Icon className={`h-3.5 w-3.5 ${meta.iconColor}`} />
                                  </span>
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{a.description || a.type}</p>
                                      <p className="text-xs text-slate-400 dark:text-slate-500">{meta.label} · {fmt(a.createdAt)}</p>
                                    </div>
                                    <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30">+{a.scoreAwarded}</span>
                                  </div>
                                </li>
                              </Reveal>
                            );
                          })}
                        </ol>
                      </div>
                    ))}
                  </div>
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

/* ── Visitor-only buttons ─────────────────────────────────────── */

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
        className="h-20 w-20 rounded-2xl border-4 border-white object-cover shadow-lg ring-2 ring-slate-100 sm:h-32 sm:w-32 cursor-zoom-in"
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
  const [open, setOpen] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const fetchState = (id: string) => {
    let cancelled = false;
    setLoadError(false);
    void getConnectionState(id)
      .then((r) => { if (!cancelled) { setState(r.state); setMutual(r.mutual); } })
      .catch(() => { if (!cancelled) setLoadError(true); });
    return () => { cancelled = true; };
  };

  useEffect(() => fetchState(targetId), [targetId]);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  async function run(fn: () => Promise<{ state: ConnectionState }>) {
    try {
      setBusy(true);
      await fn();
      const r = await getConnectionState(targetId);
      setState(r.state);
      setMutual(r.mutual);
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }

  if (state === null && !loadError) return <div className="h-9 w-24 animate-pulse rounded-xl bg-slate-200" />;
  if (loadError) return (
    <button onClick={() => { setState(null); fetchState(targetId); }} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 shadow-sm transition hover:bg-slate-50 dark:hover:bg-slate-800">
      Retry
    </button>
  );
  if (state === 'SELF') return null;
  const ml = mutual > 0 ? <span className="ml-1.5 hidden text-xs font-normal opacity-70 sm:inline">{mutual} mutual</span> : null;
  if (state === 'CONNECTED') return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20">
        <CircleCheck className="h-4 w-4" aria-hidden /> Connected{ml} <ChevronDown className="h-3.5 w-3.5" />
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-20 mt-1.5 w-40 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl">
          <button
            onClick={() => { setOpen(false); void run(() => removeConnection(targetId)); }}
            disabled={busy}
            className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-60"
          >
            <UserMinus className="h-4 w-4" /> Disconnect
          </button>
        </div>
      ) : null}
    </div>
  );
  if (state === 'PENDING_OUTGOING') return (
    <button onClick={() => void run(() => removeConnection(targetId))} disabled={busy} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 shadow-sm transition hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60">Pending · Cancel</button>
  );
  if (state === 'PENDING_INCOMING') return (
    <span className="inline-flex items-center gap-2">
      <button onClick={() => void run(() => respondToConnection(targetId, true))} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"><CircleCheck className="h-4 w-4" aria-hidden /> Accept{ml}</button>
      <button onClick={() => void run(() => respondToConnection(targetId, false))} disabled={busy} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 shadow-sm transition hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60">Ignore</button>
    </span>
  );
  return (
    <button onClick={() => void run(() => sendConnectionRequest(targetId))} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:opacity-60">
      <UserPlus className="h-4 w-4" /> Connect{ml}
    </button>
  );
}
