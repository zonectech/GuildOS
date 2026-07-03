'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { getPublicProfile } from '../../../components/guildos/auth-api';
import { getUserLeadershipHistory, type LeadershipHistoryEntry } from '../../../components/guildos/community-list-api';
import {
  getProfileCertificates,
  getPublicTimeline,
  getReputationSummary,
  type ProfileCertificate,
  type ReputationActivityEntry,
  type ReputationSummary,
} from '../../../components/guildos/reputation-api';
import { getProfileCompletion } from '../../../components/guildos/profile-completion';
import { Card } from '../../../components/guildos/ui/card';
import { ProfileDashboardHeader } from '../../../components/guildos/profile-dashboard-header';

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

export default function PublicProfilePage() {
  const params = useParams<{ username: string }>();
  const username = typeof params?.username === 'string' ? decodeURIComponent(params.username) : '';
  const [user, setUser] = useState<any>(null);
  const [error, setError] = useState('');
  const [leadershipHistory, setLeadershipHistory] = useState<LeadershipHistoryEntry[]>([]);
  const [summary, setSummary] = useState<ReputationSummary | null>(null);
  const [timeline, setTimeline] = useState<ReputationActivityEntry[]>([]);
  const [certificates, setCertificates] = useState<ProfileCertificate[]>([]);

  console.log('[PublicProfilePage] render state:', { username, hasUser: Boolean(user), hasProfile: Boolean(user?.profile), error });

  const profileSummary = useMemo(() => {
    const profile = user?.profile ?? user;
    if (!profile) return null;

    return {
      ...getProfileCompletion({
        fullName: user.fullName,
        username: profile.username,
        avatar: profile.avatar,
        bio: profile.bio,
        location: profile.location,
        socialLinks: profile.socialLinks,
        university: profile.university,
        faculty: profile.faculty,
        department: profile.department,
        level: profile.level,
        interests: profile.interests,
        graduationYear: profile.graduationYear,
      }),
      stats: [
        { label: 'Certificates earned', value: user?.certificates?.length ?? 0 },
        { label: 'Events attended', value: user?.events?.length ?? 0 },
        { label: 'Communities joined', value: user?.communities?.length ?? 0 },
        { label: 'Leadership roles', value: user?.leadership?.length ?? 0 },
      ],
    };
  }, [user]);

  useEffect(() => {
    if (!username) return;

    let cancelled = false;

    void (async () => {
      try {
        console.log('[PublicProfilePage] loading username:', username);
        const result = await getPublicProfile(username);
        console.log('[PublicProfilePage] response:', result);
        if (!cancelled) setUser(result.user);
      } catch (err) {
        console.error('[PublicProfilePage] load failed:', err);
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load profile');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [username]);

  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;

    let cancelled = false;
    void (async () => {
      try {
        const result = await getUserLeadershipHistory(userId);
        if (!cancelled) setLeadershipHistory(result.leadershipHistory ?? []);
      } catch {
        if (!cancelled) setLeadershipHistory([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    const userId = user?.id;
    const uname = user?.profile?.username ?? user?.username;
    if (!userId) return;

    let cancelled = false;
    void (async () => {
      const [rep, tl] = await Promise.allSettled([getReputationSummary(userId), getPublicTimeline(userId, 30)]);
      if (cancelled) return;
      if (rep.status === 'fulfilled') setSummary(rep.value);
      if (tl.status === 'fulfilled') setTimeline(tl.value.activity);
      if (uname) {
        try {
          const certs = await getProfileCertificates(uname);
          if (!cancelled) setCertificates(certs.certificates);
        } catch {
          if (!cancelled) setCertificates([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.profile?.username, user?.username]);

  if (error) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10">
        <Card className="p-6">
          <p className="text-red-600">{error}</p>
        </Card>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10">
        <Card className="p-6">
          <p>Loading profile...</p>
        </Card>
      </main>
    );
  }

        const profile = user.profile ?? user;

    return (
    <main className="mx-auto max-w-5xl px-4 py-10 space-y-6">
      <ProfileDashboardHeader
      fullName={user.fullName}
      username={profile.username}
      joinDate={user.createdAt}
      title={profile.department || profile.level}
      avatar={profile.avatar}
      visibility={profile.profileVisibility}
      completion={profileSummary?.completion ?? 0}
      missingFields={profileSummary?.missingFields ?? []}
      stats={profileSummary?.stats ?? []}
      meterVariant="public"
      />

      <div className="flex flex-wrap gap-3">
      <a
        className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        href={`/portfolio/${encodeURIComponent(profile.username)}`}
      >
        View Portfolio
      </a>
      <a
        className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-900"
        href={`/resume/${encodeURIComponent(profile.username)}`}
      >
        View Resume
      </a>

      </div>

      {summary ? (
        <div className={`rounded-3xl bg-gradient-to-br ${LEVEL_TONE[summary.reputation.level] ?? 'from-slate-600 to-slate-800'} p-6 text-white shadow-sm`}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm opacity-80">Guild Score</p>
              <p className="text-4xl font-bold tabular-nums">{summary.reputation.guildScore.toLocaleString()}</p>
              <p className="mt-1 text-sm font-medium">{summary.reputation.level}{summary.rank ? ` · Rank #${summary.rank}` : ''}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {profile.availability === 'OPEN' ? <span className="rounded-full bg-emerald-400/90 px-3 py-1 text-xs font-semibold text-emerald-950">● Open to opportunities</span> : null}
              {profile.availability === 'CASUAL' ? <span className="rounded-full bg-amber-300/90 px-3 py-1 text-xs font-semibold text-amber-950">● Casually looking</span> : null}
              <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium">✓ Verified Student</span>
              {summary.reputation.leadershipScore > 0 ? <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium">✓ Verified Community Leader</span> : null}
              {summary.reputation.speakerScore > 0 ? <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium">✓ Verified Speaker</span> : null}
              {summary.reputation.volunteerScore > 0 ? <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium">✓ Verified Volunteer</span> : null}
              {certificates.length ? <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium">✓ Verified Certificate Holder</span> : null}
            </div>
          </div>
          {summary.reputation.badges.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {summary.reputation.badges.map((b) => (
                <span key={b.code} className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
                  <span aria-hidden>{b.icon}</span>{b.label}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {summary ? (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-950">Reputation Summary</h2>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <SummaryStat label="Guild Score" value={summary.reputation.guildScore.toLocaleString()} />
            <SummaryStat label="Rank" value={summary.rank ? `#${summary.rank}` : '—'} />
            <SummaryStat label="Events Completed" value={summary.stats.eventsCompleted} />
            <SummaryStat label="Communities" value={summary.stats.communitiesJoined} />
            <SummaryStat label="Leadership Roles" value={summary.stats.leadershipRoles} />
            <SummaryStat label="Certificates" value={summary.stats.certificatesEarned} />
          </div>
        </Card>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2">
        {profile.showUniversity ? (
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-slate-950">Academic Information</h2>
            <div className="mt-4 space-y-2 text-sm text-slate-700">
              <p>University: {profile.university}</p>
              <p>Faculty: {profile.faculty}</p>
              <p>Department: {profile.department}</p>
              <p>Level: {profile.level}</p>
              {profile.location ? <p>Location: {profile.location}</p> : null}
              {profile.graduationYear ? <p>Graduation Year: {profile.graduationYear}</p> : null}
              {profile.socialLinks?.length ? <p>Social Links: {profile.socialLinks.length}</p> : null}
            </div>
          </Card>
        ) : null}

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-950">Interests</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {profile.interests?.length ? (
              profile.interests.map((interest: string) => (
                <span key={interest} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
                  {interest}
                </span>
              ))
            ) : (
              <p className="text-sm text-slate-500">No interests listed</p>
            )}
          </div>
        </Card>
      </div>

      {profile.showLeadership !== false ? (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-950">Leadership History</h2>
          <p className="mt-1 text-sm text-slate-500">Verified leadership roles held across GuildOS communities.</p>
          <div className="mt-4 space-y-3">
            {leadershipHistory.length ? (
              leadershipHistory.map((entry) => (
                <div key={entry.id} className="flex flex-col gap-1 rounded-2xl border border-slate-200 px-4 py-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-medium text-slate-900">
                      {entry.role.replace(/_/g, ' ')}
                      {entry.community ? <span className="text-slate-500"> · {entry.community.name}</span> : null}
                    </p>
                    <p className="text-sm text-slate-500">
                      {new Date(entry.startDate).toLocaleDateString()} – {entry.endDate ? new Date(entry.endDate).toLocaleDateString() : 'Present'}
                    </p>
                  </div>
                  <span
                    className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${
                      entry.verificationStatus === 'VERIFIED' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {entry.verificationStatus === 'VERIFIED' ? 'Verified' : 'Pending'}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">No leadership history recorded yet.</p>
            )}
          </div>
        </Card>
      ) : null}

      {profile.showCertificates !== false && certificates.length ? (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-950">Certificates</h2>
          <p className="mt-1 text-sm text-slate-500">Verified credentials earned through completed events.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {certificates.map((c) => (
              <a
                key={c.serial}
                href={`/certificates/${encodeURIComponent(c.serial)}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-3 hover:border-indigo-300"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{c.eventTitle}</p>
                  <p className="truncate text-xs text-slate-500">{c.communityName} · {new Date(c.issuedAt).toLocaleDateString()}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${c.status === 'VERIFIED' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{c.status === 'VERIFIED' ? 'Verified' : 'Revoked'}</span>
              </a>
            ))}
          </div>
        </Card>
      ) : null}

      {profile.showTimeline !== false && timeline.length ? (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-950">Activity Timeline</h2>
          <p className="mt-1 text-sm text-slate-500">Chronological feed of verified contributions.</p>
          <ol className="mt-4 space-y-3">
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
        </Card>
      ) : null}
    </main>
  );

}

function SummaryStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-3">
      <p className="text-xl font-semibold tabular-nums text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}