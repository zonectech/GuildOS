import { shareCard } from '@/lib/og-card';
import { fetchPublic } from '@/lib/share';
import type { AttendanceStamp, CertificateItem, FullUser } from '@/lib/account';

export async function GET(_req: Request, { params }: { params: { username: string } }) {
  const name = encodeURIComponent(params.username);
  const [profile, stamps, certs] = await Promise.all([
    fetchPublic<{ user: FullUser }>(`/api/profile/${name}`),
    fetchPublic<{ stamps: AttendanceStamp[] }>(`/api/profile/${name}/attendance`),
    fetchPublic<{ certificates: CertificateItem[] }>(`/api/profile/${name}/certificates`),
  ]);
  const user = profile?.user;
  if (!user) return shareCard({ kicker: 'Profile', title: 'This profile is private' });
  const attended = stamps?.stamps.length ?? 0;
  const earned = certs?.certificates.length ?? 0;
  const counts = [attended ? `${attended} event${attended === 1 ? '' : 's'} attended` : '', earned ? `${earned} certificate${earned === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ');
  return shareCard({
    kicker: 'Student profile',
    title: user.fullName,
    lines: [user.profile?.showUniversity === false ? '' : user.profile?.university ?? '', counts].filter(Boolean),
  });
}

// The image generator's Node build cannot find its font on Windows; the edge build bundles it.
export const runtime = 'edge';
