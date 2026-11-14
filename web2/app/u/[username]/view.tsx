'use client';
import { ApiError, isNotFound } from '@/lib/api/client';
import { NotFoundPanel } from '@/components/ui/not-found-panel';
import { ErrorState } from '@/components/ui/error-state';
import { useEffect, useState } from 'react';
import { ArrowLeft, Eye, Lock } from 'lucide-react';
import { certificatesOf, myProfile, privateDetails, publicProfile, stampsOf, type Profile } from '@/lib/api/profile';
import { myMemberships } from '@/lib/api/communities';
import { useSession } from '@/lib/session';
import { Passport, type PassportData } from '@/components/profile/passport';
import { Btn } from '@/components/ui/bits';

/**
 * Someone's public profile. With ?preview=1 on your own profile, it shows exactly what others see:
 * the same privacy rules the backend applies to visitors are applied here.
 */
export function PublicPassport({ username }: { username: string }) {
  const { user } = useSession();
  const [data, setData] = useState<PassportData | null>(null);
  const [blocked, setBlocked] = useState('');
  const [preview, setPreview] = useState(false);
  const [missing, setMissing] = useState(false);
  const [failed, setFailed] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { setPreview(new URLSearchParams(window.location.search).has('preview')); }, []);

  useEffect(() => {
    let off = false;
    (async () => {
      try {
        const own = user?.username === username;
        // Your own preview uses your real settings: gender appears only if you chose to show it.
        const profile: Profile = own ? await myProfile().then(async (p) => { const d = await privateDetails().catch(() => null); return { ...p, pronouns: d?.pronouns || undefined, gender: preview && d?.showGender && d.gender !== 'PREFER_NOT_TO_SAY' ? d.gender : undefined }; }) : await publicProfile(username);
        if (own && preview && profile.visibility !== 'PUBLIC') { if (!off) setBlocked(profile.visibility === 'PRIVATE' ? 'Your profile is private, so others see only that it exists.' : 'Your profile is unlisted: only people with the link can find it.'); }
        const [stamps, certificates, communities] = await Promise.all([
          // Only ask for what this person shares (you always see your own, unless previewing).
          profile.showHistory || (own && !preview) ? stampsOf(username).catch(() => []) : Promise.resolve([]),
          profile.showCertificates || (own && !preview) ? certificatesOf(username).catch(() => []) : Promise.resolve([]),
          // Memberships are private to their owner; others don't see them here.
          own ? myMemberships(profile.id).catch(() => []) : Promise.resolve(null),
        ]);
        if (!off) setData({ profile, stamps, certificates, communities });
      } catch (e) {
        if (off) return;
        if (isNotFound(e)) setMissing(true);
        else if (e instanceof ApiError && e.status === 403) setBlocked(e.message);
        else setFailed(e);
      }
    })();
    return () => { off = true; };
  }, [username, user, preview, attempt]);

  const own = user?.username === username;
  if (missing) return <NotFoundPanel title="No one with this username" body="They may have changed it, or the link is mistyped." />;
  if (failed && !data) return <ErrorState error={failed} onRetry={() => { setFailed(null); setAttempt((n) => n + 1); }} />;
  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-5 px-4 pt-6 pb-20 sm:px-6 lg:px-8 lg:pt-10">
      {own && preview ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-ink px-4 py-3 text-paper">
          <span className="flex items-center gap-2 text-[14.5px] font-semibold"><Eye size={17} />Preview: this is what other students see</span>
          <Btn size="sm" kind="secondary" href="/me"><ArrowLeft size={15} />Back to your passport</Btn>
        </div>
      ) : null}
      {blocked && !data ? <div className="flex flex-col items-center gap-3 py-24 text-center"><Lock size={32} className="text-muted" /><p className="text-[17px] font-semibold">{blocked}</p></div> : null}
      {blocked && data ? <p className="flex items-center gap-2 rounded-2xl bg-mist p-4 text-[14.5px]"><Lock size={16} />{blocked}</p> : null}
      {data ? <Passport data={data} mode={own && !preview ? 'owner' : 'public'} /> : !blocked ? <div className="shimmer h-[520px] rounded-[28px]" /> : null}
    </div>
  );
}
