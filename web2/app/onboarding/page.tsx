'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import * as m from 'motion/react-m';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { api } from '@/lib/api/client';
import { myProfile, updateProfile } from '@/lib/api/profile';
import { join, suggestedCommunities, type CommunityCard } from '@/lib/api/communities';
import { spring } from '@/lib/motion';
import { useSession } from '@/lib/session';
import { StepFlow } from '@/components/flow/step-flow';
import { CommunityLogo, VerifiedTick } from '@/components/communities/bits';
import { Btn } from '@/components/ui/bits';
import { inputCls } from '@/components/auth/auth-bits';
import { useToast } from '@/components/ui/toast';

const STEPS = ['Your school', 'Interests', 'Communities'];
const LEVELS = ['100', '200', '300', '400', '500', '600', 'Postgraduate'];
const INTERESTS = ['Tech', 'AI', 'Design', 'Business', 'Entrepreneurship', 'Career', 'Faith', 'Arts', 'Music', 'Sports', 'Health', 'Writing', 'Debate', 'Volunteering', 'Research', 'Photography'];

/** Three quick steps after sign-up, so Events and Communities start out relevant. Every step can be skipped. */
function Onboarding() {
  const router = useRouter();
  const toast = useToast();
  const next = useSearchParams().get('next');
  const { user, loading, reload } = useSession();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [school, setSchool] = useState('');
  const [department, setDepartment] = useState('');
  const [level, setLevel] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [suggested, setSuggested] = useState<(CommunityCard & { reason: string })[] | null>(null);
  const [joined, setJoined] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!loading && !user) router.replace('/login?next=/onboarding'); }, [loading, user, router]);
  useEffect(() => { if (user) myProfile().then((p) => { setSchool(p.school); setDepartment(p.department); setLevel(p.level); setInterests(p.interests); }).catch(() => undefined); }, [user]);
  const go = (n: number) => { setDir(n > step ? 1 : -1); setStep(n); };

  async function saveAndNext() {
    setBusy(true);
    try {
      await updateProfile({ university: school.trim(), department: department.trim(), level, interests });
      if (step === 1) suggestedCommunities().then(setSuggested).catch(() => setSuggested([]));
      go(step + 1);
    } catch (e) { toast(e instanceof Error ? e.message : 'Unable to save'); } finally { setBusy(false); }
  }
  async function toggleJoin(c: CommunityCard) {
    if (joined.includes(c.id)) return;
    setJoined((j) => [...j, c.id]);
    try { await join(c.id); } catch (e) { setJoined((j) => j.filter((x) => x !== c.id)); toast(e instanceof Error ? e.message : 'Unable to join'); }
  }
  async function finish() {
    setBusy(true);
    try { await updateProfile({ interests }); await api('/api/profile/onboarding/complete', { method: 'POST' }); await reload(); router.replace(next && next.startsWith('/') ? next : '/events'); }
    catch (e) { toast(e instanceof Error ? e.message : 'Unable to finish'); setBusy(false); }
  }
  if (!user) return null;
  return (
    <div className="mesh grid min-h-[86dvh] place-items-start justify-center px-4 py-10">
      <div className="flex w-full max-w-[560px] flex-col gap-6">
        <div><h1 className="text-[36px] font-extrabold">Welcome, {user.fullName.split(' ')[0]}</h1><p className="text-[15.5px] text-muted">Three quick steps so the events you see are the ones you&apos;d go to.</p></div>
        <StepFlow steps={STEPS} current={step} direction={dir}>
          {step === 0 ? (
            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5"><span className="text-[14px] font-semibold">School</span><input className={inputCls} value={school} onChange={(e) => setSchool(e.target.value)} placeholder="e.g. Ahmadu Bello University" autoComplete="organization" /></label>
              <label className="flex flex-col gap-1.5"><span className="text-[14px] font-semibold">Department</span><input className={inputCls} value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. Computer Science" /></label>
              <div className="flex flex-col gap-2"><span className="text-[14px] font-semibold">Level</span>
                <div role="radiogroup" aria-label="Level" className="flex flex-wrap gap-2">{LEVELS.map((l) => (
                  <button key={l} type="button" role="radio" aria-checked={level === l} onClick={() => setLevel(l)} className={`h-10 rounded-full border-2 px-4 text-[14px] font-semibold ${level === l ? 'border-green-text bg-tint text-green-text' : 'border-line'}`}>{l}</button>
                ))}</div>
              </div>
              <p className="text-[13px] text-muted">Classmates in your department can find you on guest lists. You choose who sees you in Profile → Privacy.</p>
            </div>
          ) : step === 1 ? (
            <div className="flex flex-col gap-3">
              <p className="text-[15px]">Pick a few. We use them to suggest events and communities.</p>
              <div className="flex flex-wrap gap-2">{INTERESTS.map((t, i) => {
                const on = interests.includes(t);
                return (
                  <m.button key={t} type="button" aria-pressed={on} onClick={() => setInterests((x) => (on ? x.filter((y) => y !== t) : [...x, t]))} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} whileTap={{ scale: 0.92 }} transition={{ ...spring.snap, delay: i * 0.02 }}
                    className={`inline-flex h-10 items-center gap-1.5 rounded-full border-2 px-4 text-[14.5px] font-semibold ${on ? 'border-green-text bg-green text-white' : 'border-line bg-surface'}`}>
                    {on ? <Check size={15} strokeWidth={3} /> : null}{t}
                  </m.button>
                );
              })}</div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-[15px]">Join a few to see their events first. You can leave any time.</p>
              {suggested === null ? <div className="shimmer h-40 rounded-2xl" /> : suggested.length ? (
                <ul className="flex flex-col gap-2">{suggested.slice(0, 6).map((c) => {
                  const on = joined.includes(c.id);
                  return (
                    <li key={c.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
                      <CommunityLogo c={c} size={44} />
                      <span className="min-w-0 flex-1"><b className="flex items-center gap-1 truncate text-[15px]">{c.name}{c.verified ? <VerifiedTick size={14} /> : null}</b><small className="block truncate text-[12.5px] text-muted">{c.reason || c.school}</small></span>
                      <Btn size="sm" kind={on ? 'secondary' : 'primary'} onClick={() => void toggleJoin(c)} disabled={on}>{on ? <><Check size={14} />{c.autoApprove && c.visibility === 'PUBLIC' ? 'Joined' : 'Requested'}</> : 'Join'}</Btn>
                    </li>
                  );
                })}</ul>
              ) : <p className="rounded-2xl bg-mist p-4 text-[14.5px] text-muted">No suggestions yet. Browse all communities after this.</p>}
            </div>
          )}
        </StepFlow>
        <div className="flex items-center justify-between gap-3">
          {step > 0 ? <Btn kind="secondary" onClick={() => go(step - 1)}><ArrowLeft size={17} />Back</Btn> : <button type="button" onClick={() => router.replace(next && next.startsWith('/') ? next : '/events')} className="text-[14px] font-semibold text-muted hover:text-ink">Skip for now</button>}
          {step < STEPS.length - 1 ? <Btn onClick={() => void saveAndNext()} disabled={busy}>{busy ? 'Saving…' : 'Next'}<ArrowRight size={17} /></Btn>
            : <Btn size="lg" onClick={() => void finish()} disabled={busy}>{busy ? 'Finishing…' : 'Start exploring'}</Btn>}
        </div>
      </div>
    </div>
  );
}
export default function OnboardingPage() { return <Suspense fallback={null}><Onboarding /></Suspense>; }
