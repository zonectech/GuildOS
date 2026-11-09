'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, Pencil } from 'lucide-react';
import { myCertificates, myIssues, myProfile, myRegistrations, stampsOf } from '@/lib/api/profile';
import { myMemberships } from '@/lib/api/communities';
import { useSession } from '@/lib/session';
import { Passport, type PassportData } from '@/components/profile/passport';
import { Btn } from '@/components/ui/bits';

/** Your own passport, with everything (privacy only applies to what others see). */
export function MyPassport() {
  const router = useRouter();
  const { user, loading } = useSession();
  const [data, setData] = useState<PassportData | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!user) return;
    try {
      const profile = await myProfile();
      setData((d) => ({ profile, stamps: d?.stamps ?? null, certificates: d?.certificates ?? null, communities: d?.communities ?? null, registrations: d?.registrations, issues: d?.issues }));
      const [stamps, certificates, communities, registrations, issues] = await Promise.all([
        profile.username ? stampsOf(profile.username).catch(() => []) : Promise.resolve([]),
        myCertificates().catch(() => []), myMemberships(user.id).catch(() => []), myRegistrations().catch(() => []), myIssues().catch(() => []),
      ]);
      setData({ profile, stamps, certificates, communities, registrations, issues });
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load your profile'); }
  }, [user]);
  useEffect(() => { if (!loading && !user) router.replace('/login?next=/me'); }, [loading, user, router]);
  useEffect(() => { void load(); }, [load]);

  if (!user) return null;
  if (error) return <div className="px-6 py-24 text-center font-semibold">{error}</div>;
  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-5 px-4 pt-6 pb-20 sm:px-6 lg:px-8 lg:pt-10">
      <div className="flex flex-wrap justify-end gap-2">
        {data?.profile.username ? <Btn kind="secondary" size="sm" href={`/u/${data.profile.username}?preview=1`}><Eye size={15} />See what others see</Btn> : null}
        <Btn kind="secondary" size="sm" href="/me/edit"><Pencil size={15} />Edit profile and privacy</Btn>
      </div>
      {data ? <Passport data={data} mode="owner" onIssueSent={(stamp, message) => {
        // Show it straight away, then refresh from the server.
        setData((d) => (d ? { ...d, issues: [{ id: `new-${Date.now()}`, status: 'SENT', message, response: '', createdAt: new Date().toISOString(), reviewedAt: null, event: { title: stamp.eventTitle, slug: stamp.eventSlug } }, ...(d.issues ?? [])] } : d));
        void load();
      }} /> : <div className="shimmer h-[520px] rounded-[28px]" />}
    </div>
  );
}
