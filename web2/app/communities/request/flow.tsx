'use client';
import { ResendVerification } from '@/components/auth/verify-email';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as m from 'motion/react-m';
import { AnimatePresence } from 'motion/react';
import { ArrowLeft, ArrowRight, BadgeCheck, FileText, ImagePlus, Info, Mail, ShieldCheck, Upload } from 'lucide-react';
import { useLoginGate, useSession } from '@/lib/session';
import { schoolProof, sendSchoolCode, submitCommunity, uploadImages, uploadLetter, verifySchoolCode, type SchoolProof } from '@/lib/api/review';
import { spring } from '@/lib/motion';
import { StepFlow } from '@/components/flow/step-flow';
import { Crest } from '@/components/brand/crest';
import { Btn, Chip } from '@/components/ui/bits';
import { ChatIcon } from '@/components/brand/chat-icon';
import { useToast } from '@/components/ui/toast';
import { LogoCropper } from '@/components/ui/logo-cropper';

const CATEGORIES = ['Tech', 'Faith', 'Career', 'Arts', 'Sports', 'Departmental', 'Social', 'Health', 'Entrepreneurship', 'Other'];
const ROLES = ['Founder', 'President', 'Executive member', 'Faculty adviser', 'Other'];
const DRAFT = 'otr-community-request';

type Draft = { name: string; school: string; category: string; otherCategory: string; summary: string; description: string; role: string; otherRole: string; chatLink: string; method: 'SCHOOL_EMAIL' | 'LETTER'; note: string };
const EMPTY: Draft = { name: '', school: '', category: '', otherCategory: '', summary: '', description: '', role: '', otherRole: '', chatLink: '', method: 'LETTER', note: '' };
/** "Other" means what they typed. */
const categoryOf = (d: Draft) => (d.category === 'Other' ? d.otherCategory.trim() : d.category);
const roleOf = (d: Draft) => (d.role === 'Other' ? d.otherRole.trim() : d.role);

const field = 'h-12 w-full rounded-2xl border border-line bg-surface px-4 text-[16px] outline-none transition-colors focus:border-green-text';
/** A field label; `required` adds a red asterisk (screen readers hear "required"). */
const Label = ({ children, hint, required }: { children: React.ReactNode; hint?: string; required?: boolean }) => (
  <span className="flex flex-col gap-0.5"><span className="text-[14px] font-semibold">{children}{required ? <><span aria-hidden className="ml-0.5 text-coral-text">*</span><span className="sr-only"> (required)</span></> : null}</span>{hint ? <small className="text-[12.5px] text-muted">{hint}</small> : null}</span>
);
const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/**
 * Asking to create a community: details → evidence → review and submit. Saved as you go, so you can
 * leave and come back. Submitting sends it to the platform reviewers (the existing admin review).
 */
export function RequestFlow() {
  const router = useRouter();
  const toast = useToast();
  const { user, loading } = useSession();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [d, setD] = useState<Draft>(EMPTY);
  const [saved, setSaved] = useState<number | null>(null);
  const [logo, setLogo] = useState<File | null>(null);
  // A picked logo goes through the round cropper first.
  const [rawLogo, setRawLogo] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [letter, setLetter] = useState<{ file: File; path: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [proof, setProof] = useState<SchoolProof | null>(null);
  const [schoolEmail, setSchoolEmail] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const loaded = useRef(false);

  const gate = useLoginGate('/communities/request');
  // Pick up a saved draft, or start with the student's own school.
  useEffect(() => {
    if (loaded.current || loading) return;
    loaded.current = true;
    try { const raw = localStorage.getItem(DRAFT); if (raw) { setD({ ...EMPTY, ...JSON.parse(raw) }); return; } } catch { /* storage blocked */ }
    if (user?.school) setD((x) => ({ ...x, school: user.school ?? '' }));
  }, [loading, user]);
  useEffect(() => {
    if (!loaded.current) return;
    const t = setTimeout(() => { try { localStorage.setItem(DRAFT, JSON.stringify(d)); setSaved(Date.now()); } catch { /* storage blocked */ } }, 500);
    return () => clearTimeout(t);
  }, [d]);
  useEffect(() => { if (step === 1 && d.school) schoolProof(d.school).then(setProof).catch(() => setProof(null)); }, [step, d.school]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const logoUrl = useObjectUrl(logo);
  const coverUrl = useObjectUrl(cover);
  const schoolVerified = Boolean(proof?.verified && proof.selectedMatches);

  const missingDetails = [
    d.name.trim().length < 3 ? 'community name' : '', d.school.trim().length < 2 ? 'school' : '', !d.category ? 'category' : d.category === 'Other' && d.otherCategory.trim().length < 2 ? 'your category' : '',
    d.summary.trim().length < 10 ? 'what your community does' : '', !d.role ? 'your role' : d.role === 'Other' && d.otherRole.trim().length < 2 ? 'what your role is' : '',
    !/^https?:\/\/\S+\.\S+/.test(d.chatLink.trim()) ? 'group chat link' : '', !logo ? 'logo' : '',
  ].filter(Boolean);
  const stepOk = [
    missingDetails.length === 0,
    d.method === 'SCHOOL_EMAIL' ? schoolVerified : Boolean(letter) && d.note.trim().length >= 20,
    true,
  ];
  const go = (to: number) => { setError(''); setDir(to > step ? 1 : -1); setStep(to); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  async function chooseLetter(f?: File) {
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) { setError('That file is over 8 MB. Use a smaller PDF or photo.'); return; }
    setUploading(true); setError('');
    try { const r = await uploadLetter(f); setLetter({ file: f, path: r.letter }); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to upload the letter'); }
    finally { setUploading(false); }
  }
  async function sendCode() {
    setBusy(true); setError('');
    try { await sendSchoolCode(schoolEmail.trim()); setCodeSent(true); toast('Code sent. Check your school inbox.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to send the code'); }
    finally { setBusy(false); }
  }
  async function confirmCode() {
    setBusy(true); setError('');
    try { await verifySchoolCode(code.trim()); setProof(await schoolProof(d.school)); toast('School email verified'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to verify the code'); }
    finally { setBusy(false); }
  }
  async function submit() {
    setBusy(true); setError('');
    try {
      // Logo required, cover optional.
      const images = await uploadImages(logo, cover);
      const req = await submitCommunity({
        name: d.name.trim(), school: d.school.trim(), category: categoryOf(d), summary: d.summary.trim(), description: d.description.trim(),
        chatLink: d.chatLink.trim(), logo: images.logo, cover: images.coverImage, method: d.method, letter: letter?.path ?? '',
        note: [`Role: ${roleOf(d)}.`, d.note.trim()].filter(Boolean).join(' '),
      });
      try { localStorage.removeItem(DRAFT); } catch { /* storage blocked */ }
      router.push(`/communities/request/status?sent=${req.id}`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to send your request'); setBusy(false); }
  }

  if (!user) return gate;
  // The server refuses community requests from unverified accounts; say so before the form, not after it.
  if (user.emailVerified === false) return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-6 py-20 text-center">
      <h1 className="text-[28px] font-extrabold">Verify your email first</h1>
      <p className="text-[15px] text-muted">Starting a community needs a verified email address. We sent a link to <b className="text-ink">{user.email}</b>.</p>
      <p className="text-[15px]"><ResendVerification email={user.email} className="text-green-text" /></p>
    </div>
  );
  return (
    <div className="mesh mx-auto flex max-w-[760px] flex-col gap-7 px-4 pt-6 pb-16 sm:px-6 lg:pt-10">
      <header className="flex flex-col gap-2">
        <Link href="/communities/request/status" className="text-[14px] font-semibold text-green-text hover:underline">Your requests</Link>
        <h1 className="text-[40px] font-extrabold sm:text-[48px]">Start a community</h1>
        <p className="max-w-xl text-[16px] text-muted">Tell us about your community and show you&apos;re allowed to run it. A reviewer checks every request once; after that you run events freely.</p>
        <span className="text-[12.5px] text-muted" aria-live="polite">{saved ? 'Draft saved on this device' : ' '}</span>
      </header>

      <p className="-mb-2 text-[13px] text-muted"><span aria-hidden className="text-coral-text">*</span> Required</p>
      <StepFlow steps={['Details', 'Evidence', 'Review']} current={step} direction={dir}>
        {step === 0 ? (
          <section className="flex flex-col gap-5">
            <label className="flex flex-col gap-1.5"><Label required>Community name</Label><input className={field} value={d.name} maxLength={80} onChange={(e) => set('name', e.target.value)} placeholder="e.g. AI Society ABU" /></label>
            <label className="flex flex-col gap-1.5"><Label required hint="Communities belong to one school.">School</Label><input className={field} value={d.school} onChange={(e) => set('school', e.target.value)} placeholder="e.g. Ahmadu Bello University" /></label>
            <div className="flex flex-col gap-2"><Label required>Category</Label>
              <div className="flex flex-wrap gap-2">{CATEGORIES.map((c) => <Chip key={c} on={d.category === c} onClick={() => set('category', c)}>{c}</Chip>)}</div>
              {d.category === 'Other' ? <input autoFocus className={field} value={d.otherCategory} maxLength={40} onChange={(e) => set('otherCategory', e.target.value)} placeholder="Type your category, e.g. Environment" aria-label="Your category" /> : null}
            </div>
            <label className="flex flex-col gap-1.5"><Label required hint="One or two sentences. Students see this on your card.">What does your community do?</Label>
              <textarea className={`${field} h-auto min-h-[88px] py-3`} maxLength={160} value={d.summary} onChange={(e) => set('summary', e.target.value)} placeholder="We run weekly AI workshops and a hackathon every semester." />
              <small className="self-end text-[12px] text-muted">{d.summary.length}/160</small>
            </label>
            <label className="flex flex-col gap-1.5"><Label hint="Goals, activities, who can join.">More about it <span className="font-normal text-muted">(optional)</span></Label>
              <textarea className={`${field} h-auto min-h-[110px] py-3`} maxLength={2000} value={d.description} onChange={(e) => set('description', e.target.value)} />
            </label>
            <div className="flex flex-col gap-2"><Label required>Your role</Label>
              <div className="flex flex-wrap gap-2">{ROLES.map((r) => <Chip key={r} on={d.role === r} onClick={() => set('role', r)}>{r}</Chip>)}</div>
              {d.role === 'Other' ? <input autoFocus className={field} value={d.otherRole} maxLength={60} onChange={(e) => set('otherRole', e.target.value)} placeholder="Type your role, e.g. Publicity secretary" aria-label="Your role" /> : null}
            </div>
            <label className="flex flex-col gap-1.5"><Label required hint="WhatsApp, Telegram or Discord. Members use it to reach the community.">Group chat link</Label>
              <span className="relative">
                <input className={`${field} pr-11`} inputMode="url" value={d.chatLink} onChange={(e) => set('chatLink', e.target.value)} placeholder="https://chat.whatsapp.com/…" />
                {d.chatLink ? <span className="absolute top-1/2 right-3.5 -translate-y-1/2"><ChatIcon url={d.chatLink} size={20} /></span> : null}
              </span>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <ImagePick label="Logo" required hint="Square works best. You can zoom and position it." url={logoUrl} onPick={setRawLogo} round />
              <LogoCropper file={rawLogo} onDone={(f) => { setLogo(f); setRawLogo(null); }} onCancel={() => setRawLogo(null)} />
              <ImagePick label="Cover" optional hint="1600 × 600 works best. You can add it later." url={coverUrl} onPick={setCover} />
            </div>
          </section>
        ) : step === 1 ? (
          <section className="flex flex-col gap-5">
            <p className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4 text-[14.5px]">
              <Info size={18} className="mt-0.5 shrink-0 text-green-text" />
              <span>A school email shows you&apos;re a student there. It doesn&apos;t prove you lead this community, so reviewers check both <b>who you are</b> and <b>that you&apos;re allowed to run it</b>. Choose the evidence you have.</span>
            </p>
            <div role="radiogroup" aria-label="Evidence" className="grid gap-3 sm:grid-cols-2">
              {([['SCHOOL_EMAIL', Mail, 'Verify a school email', 'Get a 6-digit code at your school address.'], ['LETTER', FileText, 'Upload an authorization letter', 'From your adviser, SUG or faculty. PDF or photo.']] as const).map(([v, Icon, title, sub]) => (
                <m.button key={v} type="button" role="radio" aria-checked={d.method === v} onClick={() => set('method', v)} whileTap={{ scale: 0.98 }}
                  className={`flex flex-col items-start gap-2 rounded-2xl border-2 p-4 text-left transition-colors ${d.method === v ? 'border-green-text bg-tint' : 'border-line bg-surface hover:border-[color-mix(in_srgb,var(--ink)_20%,var(--line))]'}`}>
                  <Icon size={22} className="text-green-text" /><b className="text-[15.5px]">{title}</b><small className="text-[13px] text-muted">{sub}</small>
                </m.button>
              ))}
            </div>

            <AnimatePresence mode="wait" initial={false}>
              {d.method === 'SCHOOL_EMAIL' ? (
                <m.div key="email" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-3">
                  {schoolVerified ? (
                    <p className="flex items-center gap-2.5 rounded-2xl bg-tint px-4 py-3 text-[15px] font-semibold text-green-text"><BadgeCheck size={20} />{proof?.email} is verified for {proof?.matchedSchool || d.school}.</p>
                  ) : (
                    <>
                      <label className="flex flex-col gap-1.5"><Label required hint="Your official address, like name@abu.edu.ng. Gmail and Outlook do not count.">School email</Label>
                        <span className="flex gap-2"><input className={field} type="email" value={schoolEmail} onChange={(e) => setSchoolEmail(e.target.value)} placeholder="name@school.edu.ng" />
                          <Btn kind="secondary" onClick={() => void sendCode()} disabled={busy || !schoolEmail.includes('@')}>{codeSent ? 'Resend' : 'Send code'}</Btn></span>
                      </label>
                      {codeSent ? (
                        <label className="flex flex-col gap-1.5"><Label required>6-digit code</Label>
                          <span className="flex gap-2"><input className={`${field} font-mono tracking-[.4em]`} inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
                            <Btn onClick={() => void confirmCode()} disabled={busy || code.length !== 6}>Confirm</Btn></span>
                        </label>
                      ) : null}
                      {proof && proof.verified && !proof.selectedMatches ? <p className="text-[13.5px] text-coral-text">Your verified school email is for {proof.matchedSchool}, not {d.school}. Use an address from {d.school}, or upload a letter.</p> : null}
                    </>
                  )}
                  <label className="flex flex-col gap-1.5"><Label hint="Anything that helps the reviewer.">Note to the reviewer <span className="font-normal text-muted">(optional)</span></Label>
                    <textarea className={`${field} h-auto min-h-[80px] py-3`} maxLength={500} value={d.note} onChange={(e) => set('note', e.target.value)} />
                  </label>
                </m.div>
              ) : (
                <m.div key="letter" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-3">
                  <label className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed p-4 transition-colors ${letter ? 'border-green-text bg-tint' : 'border-line bg-surface hover:border-green-text'}`}>
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-surface text-green-text shadow-card">{uploading ? <Upload size={20} className="animate-pulse" /> : <FileText size={20} />}</span>
                    <span className="min-w-0 flex-1">
                      {letter ? <><b className="block truncate text-[15px]">{letter.file.name}</b><small className="text-[13px] text-muted">{kb(letter.file.size)} · uploaded · tap to replace</small></>
                        : <><b className="block text-[15px]">{uploading ? 'Uploading…' : 'Choose the letter'}</b><small className="text-[13px] text-muted">PDF, JPG or PNG, up to 8 MB</small></>}
                    </span>
                    <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { void chooseLetter(e.target.files?.[0]); e.target.value = ''; }} />
                  </label>
                  <label className="flex flex-col gap-1.5"><Label required hint="Who signed the letter and how the reviewer can confirm it (at least a sentence).">Short note</Label>
                    <textarea className={`${field} h-auto min-h-[90px] py-3`} maxLength={500} value={d.note} onChange={(e) => set('note', e.target.value)} placeholder="Signed by our faculty adviser, reachable at the department office." />
                  </label>
                </m.div>
              )}
            </AnimatePresence>
          </section>
        ) : (
          <section className="flex flex-col gap-4">
            <div className="overflow-hidden rounded-[24px] border border-line bg-surface shadow-card">
              <div className="relative h-36 bg-mist">{coverUrl ? <img src={coverUrl} alt="" className="size-full object-cover" /> : <div className="size-full bg-[linear-gradient(135deg,var(--tint),var(--mist))]" />}</div>
              <div className="flex items-end gap-4 px-5 pb-5">
                <div className="-mt-12 shrink-0 rounded-full bg-surface p-1 shadow-card">
                  {logoUrl ? <img src={logoUrl} alt="" className="size-24 rounded-full object-cover" /> : <Crest name={d.name || 'Community'} size={96} tilt={0} />}
                </div>
                <div className="min-w-0 pb-1"><b className="block truncate font-display text-[22px]">{d.name}</b><small className="text-[13.5px] text-muted">{d.school} · {categoryOf(d)}</small></div>
              </div>
              <p className="border-t border-line px-5 py-4 text-[15px]">{d.summary}</p>
            </div>
            <dl className="grid gap-2 rounded-2xl border border-line bg-surface p-4 text-[14.5px] sm:grid-cols-[150px_1fr]">
              <dt className="text-muted">Your role</dt><dd className="font-semibold">{roleOf(d)}</dd>
              <dt className="text-muted">Evidence</dt><dd className="font-semibold">{d.method === 'SCHOOL_EMAIL' ? `School email: ${proof?.email}` : `Letter: ${letter?.file.name}`}</dd>
              <dt className="text-muted">Group chat</dt><dd className="truncate font-semibold">{d.chatLink}</dd>
              {d.note ? <><dt className="text-muted">Note</dt><dd>{d.note}</dd></> : null}
            </dl>
            <p className="flex items-start gap-2.5 text-[13.5px] text-muted"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-green-text" />A reviewer looks at every request. You&apos;ll get a notification when there&apos;s a decision or a question; you can also check your requests any time.</p>
          </section>
        )}
      </StepFlow>

      {error ? <m.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={spring.snap} role="alert" className="rounded-2xl bg-[color-mix(in_srgb,var(--coral)_14%,transparent)] px-4 py-3 text-[14px] font-semibold text-coral-text">{error}</m.p> : null}

      <div className="flex items-center justify-between gap-3">
        {step > 0 ? <Btn kind="ghost" onClick={() => go(step - 1)} disabled={busy}><ArrowLeft size={17} />Back</Btn> : <span />}
        {step < 2 ? (
          <span className="flex flex-col items-end gap-1.5">
            <Btn onClick={() => go(step + 1)} disabled={!stepOk[step]}>Continue<ArrowRight size={17} /></Btn>
            {step === 0 && missingDetails.length ? <small className="max-w-[320px] text-right text-[12.5px] text-muted">Still needed: {missingDetails.join(', ')}</small> : null}
          </span>
        )
          : <Btn size="lg" onClick={() => void submit()} disabled={busy}>{busy ? 'Sending…' : 'Submit for review'}</Btn>}
      </div>
    </div>
  );
}

function useObjectUrl(file: File | null) {
  const [url, setUrl] = useState('');
  useEffect(() => { if (!file) { setUrl(''); return; } const u = URL.createObjectURL(file); setUrl(u); return () => URL.revokeObjectURL(u); }, [file]);
  return url;
}

function ImagePick({ label, hint, url, onPick, round, required, optional }: { label: string; hint: string; url: string; onPick: (f: File | null) => void; round?: boolean; required?: boolean; optional?: boolean }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-line bg-surface p-3 hover:bg-mist">
      <span className={`grid size-14 shrink-0 place-items-center overflow-hidden bg-mist text-muted ${round ? 'rounded-full' : 'rounded-xl'}`}>{url ? <img src={url} alt="" className="size-full object-cover" /> : <ImagePlus size={20} />}</span>
      <span className="min-w-0"><b className="block text-[14.5px]">{label}{required ? <><span aria-hidden className="ml-0.5 text-coral-text">*</span><span className="sr-only"> (required)</span></> : null}{optional ? <span className="ml-1 font-normal text-muted">(optional)</span> : null}</b><small className="text-[12.5px] text-muted">{hint}</small></span>
      <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => onPick(e.target.files?.[0] ?? null)} />
    </label>
  );
}
