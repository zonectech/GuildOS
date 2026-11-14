'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import * as m from 'motion/react-m';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { safeNext } from '@/lib/next-path';
import { api } from '@/lib/api/client';
import { GENDERS, myProfile, privateDetails, setGender, updateProfile, type Gender } from '@/lib/api/profile';
import { join, suggestedCommunities, type CommunityCard } from '@/lib/api/communities';
import { spring } from '@/lib/motion';
import { useLoginGate, useSession } from '@/lib/session';
import { StepFlow } from '@/components/flow/step-flow';
import { CommunityLogo, VerifiedTick } from '@/components/communities/bits';
import { Btn } from '@/components/ui/bits';
import { inputCls } from '@/components/auth/auth-bits';
import { useToast } from '@/components/ui/toast';

const STEPS = ['Your school', 'Interests', 'Communities'];
const LEVELS = ['100', '200', '300', '400', '500', '600', 'Postgraduate'];
/** A level that isn't on the list (ND, HND, pre-degree…) is "Other" with what they typed. */
const isOtherLevel = (l: string) => Boolean(l) && !LEVELS.includes(l);
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
  const [otherLevel, setOtherLevel] = useState(false);
  const [customInterest, setCustomInterest] = useState('');
  const [gender, setGenderValue] = useState<Gender>('');
  const [interests, setInterests] = useState<string[]>([]);
  const [suggested, setSuggested] = useState<(CommunityCard & { reason: string })[] | null>(null);
  const [joined, setJoined] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const gate = useLoginGate('/onboarding');
  useEffect(() => {
    if (!user) return;
    // Fill only what's still empty, once per person: never overwrite what was just typed.
    myProfile().then((p) => { setSchool((v) => v || p.school); setDepartment((v) => v || p.department); setLevel((v) => v || p.level); if (isOtherLevel(p.level)) setOtherLevel(true); setInterests((v) => (v.length ? v : p.interests)); }).catch(() => undefined);
    privateDetails().then((d) => setGenderValue((v) => v || d.gender)).catch(() => undefined);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const go = (n: number) => { setDir(n > step ? 1 : -1); setStep(n); };

  async function saveAndNext() {
    setBusy(true);
    try {
      await updateProfile({ university: school.trim(), department: department.trim(), level, interests });
      if (step === 0 && gender) await setGender(gender);
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
    try { await updateProfile({ interests }); await api('/api/profile/onboarding/complete', { method: 'POST' }); await reload(); router.replace(safeNext(next)); }
    catch (e) { toast(e instanceof Error ? e.message : 'Unable to finish'); setBusy(false); }
  }
  if (!user) return gate;
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
                  <button key={l} type="button" role="radio" aria-checked={!otherLevel && level === l} onClick={() => { setOtherLevel(false); setLevel(l); }} className={`h-10 rounded-full border-2 px-4 text-[14px] font-semibold ${!otherLevel && level === l ? 'border-green-text bg-tint text-green-text' : 'border-line'}`}>{l}</button>
                ))}
                  <button type="button" role="radio" aria-checked={otherLevel} onClick={() => { setOtherLevel(true); if (LEVELS.includes(level)) setLevel(''); }} className={`h-10 rounded-full border-2 px-4 text-[14px] font-semibold ${otherLevel ? 'border-green-text bg-tint text-green-text' : 'border-line'}`}>Other</button>
                </div>
                {otherLevel ? <input autoFocus className={inputCls} value={level} maxLength={30} onChange={(e) => setLevel(e.target.value)} placeholder="Type your level, e.g. ND 2, HND 1, Pre-degree" aria-label="Your level" /> : null}
              </div>
              <div className="flex flex-col gap-2"><span className="text-[14px] font-semibold">Gender <span className="font-normal text-muted">· hidden unless you choose to show it</span></span>
                <div role="radiogroup" aria-label="Gender" className="flex flex-wrap gap-2">{GENDERS.map(([v, l]) => (
                  <button key={v} type="button" role="radio" aria-checked={gender === v} onClick={() => setGenderValue(v)} className={`h-10 rounded-full border-2 px-4 text-[14px] font-semibold ${gender === v ? 'border-green-text bg-tint text-green-text' : 'border-line'}`}>{l}</button>
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
              })}
                {interests.filter((t) => !INTERESTS.includes(t)).map((t) => (
                  <button key={t} type="button" aria-pressed onClick={() => setInterests((x) => x.filter((y) => y !== t))} className="inline-flex h-10 items-center gap-1.5 rounded-full border-2 border-green-text bg-green px-4 text-[14.5px] font-semibold text-white"><Check size={15} strokeWidth={3} />{t}</button>
                ))}
              </div>
              <form onSubmit={(e) => { e.preventDefault(); const t = customInterest.trim(); if (t && !interests.includes(t)) setInterests((x) => [...x, t.slice(0, 40)]); setCustomInterest(''); }} className="flex gap-2">
                <input className={inputCls} value={customInterest} onChange={(e) => setCustomInterest(e.target.value)} placeholder="Other: type an interest, e.g. Robotics" aria-label="Other interest" />
                <Btn type="submit" kind="secondary" disabled={!customInterest.trim()}>Add</Btn>
              </form>
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
          {step > 0 ? <Btn kind="secondary" onClick={() => go(step - 1)}><ArrowLeft size={17} />Back</Btn> : <button type="button" onClick={() => router.replace(safeNext(next))} className="text-[14px] font-semibold text-muted hover:text-ink">Skip for now</button>}
          {step < STEPS.length - 1 ? <Btn onClick={() => void saveAndNext()} disabled={busy}>{busy ? 'Saving…' : 'Next'}<ArrowRight size={17} /></Btn>
            : <Btn size="lg" onClick={() => void finish()} disabled={busy}>{busy ? 'Finishing…' : 'Start exploring'}</Btn>}
        </div>
      </div>
    </div>
  );
}
export default function OnboardingPage() { return <Suspense fallback={null}><Onboarding /></Suspense>; }
