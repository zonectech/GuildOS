'use client';
import { useState } from 'react';
import Link from 'next/link';
import { BadgeCheck } from 'lucide-react';
import { imageUrl, joinCommunity, type Community } from '@/lib/api';
import { useSession } from '@/lib/session';
import { useRouter } from 'next/navigation';
import { Avatar } from './ui';

/** A community in a list: logo, name, school and a Join button that works in place. */
export function CommunityRow({ community, joined }: { community: Community; joined?: boolean }) {
  const { user } = useSession();
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'asked'>(joined ? 'done' : 'idle');
  const [error, setError] = useState('');

  async function join() {
    if (!user) { router.push(`/login?next=${encodeURIComponent('/communities')}`); return; }
    setState('busy'); setError('');
    try {
      const result = await joinCommunity(community._id);
      setState(/request/i.test(result.message) ? 'asked' : 'done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to join');
      setState('idle');
    }
  }

  return (
    <div className="crow">
      <Link href={`/communities/${community.slug}`} className="crow-main">
        <Avatar name={community.name} src={imageUrl(community.logo)} size={48} />
        <span className="stack" style={{ gap: 1 }}>
          <b className="row" style={{ gap: 5 }}>{community.name}{community.verificationStatus === 'VERIFIED' ? <BadgeCheck size={16} color="var(--green)" aria-label="Verified" /> : null}</b>
          <span className="small">{[community.university, `${community.memberCount} ${community.memberCount === 1 ? 'member' : 'members'}`].filter(Boolean).join(' · ')}</span>
          {error ? <span className="small" style={{ color: 'var(--clay)' }}>{error}</span> : null}
        </span>
      </Link>
      {state === 'done' ? <span className="chip ok">Joined</span> : state === 'asked' ? <span className="chip off">Requested</span> : (
        <button type="button" className="btn s sm" onClick={join} disabled={state === 'busy'}>{community.visibility === 'PRIVATE' ? 'Ask to join' : 'Join'}</button>
      )}
    </div>
  );
}
