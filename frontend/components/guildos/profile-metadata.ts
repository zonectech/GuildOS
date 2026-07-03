import type { Metadata } from 'next';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

function absoluteAsset(path?: string) {
  if (!path) return undefined;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (path.startsWith('/')) return `${API_BASE_URL}${path}`;
  return `${API_BASE_URL}/uploads/${path}`;
}

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Builds Open Graph / Twitter metadata for a public profile. Used by both the
 * `/u/[username]` and `/profile/[username]` server layouts so shared links preview
 * correctly regardless of which URL is posted. Private/unlisted profiles return
 * generic, non-indexed metadata (server fetch is anonymous, so those 403).
 */
export async function buildProfileMetadata(rawUsername: string): Promise<Metadata> {
  const username = decodeURIComponent(rawUsername);
  const canonical = `${SITE_URL}/u/${encodeURIComponent(username)}`;

  const profile = await fetchJson<{ user: { id: string; fullName: string; profile: { username: string; avatar: string; university: string; department: string; bio: string } } }>(
    `/api/profile/${encodeURIComponent(username)}`,
  );

  if (!profile?.user) {
    return {
      title: 'Profile · GuildOS',
      description: 'Verified student achievements, leadership, certificates, and reputation on GuildOS.',
      alternates: { canonical },
      robots: { index: false, follow: false },
    };
  }

  const { user } = profile;
  const summary = await fetchJson<{
    reputation: { guildScore: number; level: string; badges: { label: string }[] };
  }>(`/api/reputation/${encodeURIComponent(user.id)}/summary`);

  const badgeLine = summary?.reputation.badges?.length
    ? summary.reputation.badges.map((b) => b.label).join(' | ')
    : [user.profile.department, user.profile.university].filter(Boolean).join(' · ');

  const scoreLine = summary
    ? `${summary.reputation.level} • Guild Score ${summary.reputation.guildScore.toLocaleString()}`
    : [user.profile.university, user.profile.department].filter(Boolean).join(' · ');

  const title = `${user.fullName} (@${user.profile.username}) · GuildOS`;
  const description = [scoreLine, badgeLine].filter(Boolean).join(' — ') || user.profile.bio || 'Verified student profile on GuildOS.';
  const image = absoluteAsset(user.profile.avatar);

  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: 'profile',
      url: canonical,
      title,
      description,
      siteName: 'GuildOS',
      images: image ? [{ url: image, alt: user.fullName }] : undefined,
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}
