'use client';
import { ErrorState } from '@/components/ui/error-state';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, Pencil } from 'lucide-react';
import { myCertificates, myIssues, myProfile, myRegistrations, privateDetails, stampsOf } from '@/lib/api/profile';
import { myMemberships } from '@/lib/api/communities';
import { useLoginGate, useSession } from '@/lib/session';
import { Passport, type PassportData } from '@/components/profile/passport';
import { Btn } from '@/components/ui/bits';

/** Your own passport, with everything (privacy only applies to what others see). */
export function MyPassport() {
  const router = useRouter();
  const { user, loading } = useSession();
  const [data, setData] = useState<PassportData | null>(null);
  const [error, setError] = useState<unknown>(null);
  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [base, priv] = await Promise.all([myProfile(), privateDetails().catch(() => null)]);
      const profile = { ...base, pronouns: priv?.pronouns || undefined };
      setData((d) => ({ profile, stamps: d?.stamps ?? null, certificates: d?.certificates ?? null, communities: d?.communities ?? null, registrations: d?.registrations, issues: d?.issues }));
      const [stamps, certificates, communities, registrations, issues] = await Promise.all([
        profile.username ? stampsOf(profile.username).catch(() => []) : Promise.resolve([]),
        myCertificates().catch(() => []), myMemberships(user.id).catch(() => []), myRegistrations().catch(() => []), myIssues().catch(() => []),
      ]);
      setData({ profile, stamps, certificates, communities, registrations, issues });
    } catch (e) { setError(e); }
  }, [user]);
  const gate = useLoginGate('/me');
  useEffect(() => { void load(); }, [load]);

  if (!user) return gate;
  if (error && !data) return <ErrorState error={error} title="Your passport didn’t load" onRetry={() => { setError(null); void load(); }} />;
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
