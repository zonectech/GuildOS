'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { canManage, myMemberships, type MyMembership } from '@/lib/api/communities';
import { useLoginGate, useSession } from '@/lib/session';
import { CommunityLogo } from '@/components/communities/bits';
import { Btn } from '@/components/ui/bits';

/** Community inbox: pick which community you're answering for (straight in if you lead one). */
export default function TeamInboxPicker() {
  const router = useRouter();
  const { user, loading } = useSession();
  const [led, setLed] = useState<MyMembership[] | null>(null);
  const gate = useLoginGate('/inbox/team');
  useEffect(() => { if (user) myMemberships(user.id).then((ms) => { const l = ms.filter((x) => canManage(x.role)); if (l.length === 1) router.replace(`/inbox/team/${l[0].slug}`); else setLed(l); }).catch(() => setLed([])); }, [user, router]);
  if (!user) return gate;
  if (!led) return <div className="mx-auto max-w-lg px-4 pt-12"><div className="shimmer h-40 rounded-[24px]" /></div>;
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 pt-10 pb-20">
      <h1 className="text-[34px] font-extrabold">Community inbox</h1>
      {led.length ? led.map((c) => <Btn key={c.communityId} kind="secondary" size="lg" wide href={`/inbox/team/${c.slug}`}><CommunityLogo c={c} size={28} />{c.name}</Btn>)
        : <p className="text-muted">You don&apos;t lead a community yet. Owners and Admins answer students here.</p>}
    </div>
  );
}
