'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { User as UserIcon } from 'lucide-react';
import { imageUrl } from '@/lib/api';
import { completeOnboarding, getFullProfile, saveProfile, uploadAvatar } from '@/lib/account';
import { useSession } from '@/lib/session';
import { BRAND_NAME } from '@/lib/brand';

// The same five steps and fields as the current site's profile setup.
const STEPS = [
  { title: `Welcome to ${BRAND_NAME}`, text: 'Set up your profile in about two minutes so communities can find you and your record starts building.' },
  { title: 'About you', text: 'Where you are based and, if you are a student, where you study.' },
  { title: 'What are you into?', text: 'Pick a few topics so we can suggest communities and events you will actually care about.' },
  { title: 'Add a photo', text: 'A clear photo helps people recognise you at events. You can skip this for now.' },
  { title: 'Your links', text: 'Optional. GitHub, LinkedIn or a portfolio help people see your work.' },
];
const INTERESTS = ['Software Engineering', 'Artificial Intelligence', 'Agriculture', 'Robotics', 'Product Design', 'Data Science', 'Cybersecurity', 'Cloud Computing', 'Entrepreneurship', 'Research', 'Leadership', 'Volunteering', 'Finance', 'Web Development', 'Mobile Development'];
const LEVELS = ['100 Level', '200 Level', '300 Level', '400 Level', '500 Level', '600 Level', 'Postgraduate'];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading, reload } = useSession();
  const [step, setStep] = useState(0);
  const [f, setF] = useState({ fullName: '', location: '', isStudent: true, university: '', course: '', faculty: '', level: '', interests: [] as string[], skills: '', github: '', linkedin: '', portfolio: '' });
  const [username, setUsername] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace('/login?next=/onboarding'); return; }
    getFullProfile().then(({ user: u }) => {
      const p = u.profile ?? {};
      setUsername(p.username ?? '');
      setF((x) => ({ ...x, fullName: u.fullName, location: p.location ?? '', university: p.university ?? '', course: p.department ?? '', faculty: p.faculty ?? '', level: p.level ?? '', interests: p.interests ?? [], skills: (p.skills ?? []).join(', ') }));
    }).catch(() => undefined);
  }, [loading, user, router]);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  function check() {
    if (step === 0 && !f.fullName.trim()) return 'Enter your full name.';
    if (step === 1 && f.isStudent && !f.university.trim()) return 'Enter your university.';
    if (step === 2 && !f.interests.length) return 'Pick at least one interest.';
    if (step === 2 && f.interests.length > 10) return 'Pick up to 10 interests.';
    return '';
  }

  async function next() {
    const problem = check();
    if (problem) { setError(problem); return; }
    setError('');
    if (step < STEPS.length - 1) { setStep(step + 1); return; }
    setBusy(true);
    try {
      const payload = {
        fullName: f.fullName.trim(), location: f.location.trim(), showUniversity: f.isStudent,
        university: f.isStudent ? f.university.trim() : '', faculty: f.isStudent ? f.faculty.trim() : '', department: f.isStudent ? f.course.trim() : '', level: f.isStudent ? f.level : '',
        interests: f.interests, skills: f.skills.split(',').map((s) => s.trim()).filter(Boolean),
        socialLinks: [f.github, f.linkedin, f.portfolio].map((s) => s.trim()).filter(Boolean),
      };
      // No username field here, so a taken name must not block setup: keep yours, else try the name, then add digits.
      const base = f.fullName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'student';
      const names = username ? [username] : [base, ...[1, 2, 3].map(() => `${base}${Math.floor(100 + Math.random() * 900)}`)];
      for (let i = 0; i < names.length; i++) {
        try { await saveProfile({ ...payload, username: names[i] } as never); break; }
        catch (e) { if (!(e instanceof Error && /username/i.test(e.message)) || i === names.length - 1) throw e; }
      }
      if (photo) await uploadAvatar(photo);
      await completeOnboarding();
      await reload();
      router.replace('/events');
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save your profile'); }
    finally { setBusy(false); }
  }

  const s = STEPS[step];
  return (
    <div className="wrap page" style={{ maxWidth: 560 }}>
      <div className="prog5" aria-hidden="true">{STEPS.map((_, i) => <i key={i} className={i <= step ? '' : 'off'} />)}</div>
      <p className="sect">Step {step + 1} of {STEPS.length}</p>
      <div className="stack" style={{ gap: 6 }}><h1 style={{ fontSize: 32 }}>{s.title}</h1><p className="muted">{s.text}</p></div>

      {step === 0 ? <>
        <b>Hi{f.fullName ? ` ${f.fullName.split(' ')[0]}` : ''}! Is this right?</b>
        <label className="field"><span>Your full name <em>*</em></span><input className="input" autoComplete="name" value={f.fullName} onChange={(e) => set('fullName', e.target.value)} /></label>
        <label className="field"><span>Email (verified)</span><input className="input" value={user?.email ?? ''} readOnly /></label>
      </> : null}
      {step === 1 ? <>
        <label className="field"><span>Where are you based? <em>*</em></span><input className="input" placeholder="For example Zaria, Kaduna" value={f.location} onChange={(e) => set('location', e.target.value)} /></label>
        <label className="tog"><span>Are you currently a student?</span><input type="checkbox" checked={f.isStudent} onChange={(e) => set('isStudent', e.target.checked)} /></label>
        {f.isStudent ? <>
          <label className="field"><span>University <em>*</em></span><input className="input" value={f.university} onChange={(e) => set('university', e.target.value)} /></label>
          <label className="field"><span>Course</span><input className="input" value={f.course} onChange={(e) => set('course', e.target.value)} /></label>
          <div className="two">
            <label className="field"><span>Faculty (optional)</span><input className="input" value={f.faculty} onChange={(e) => set('faculty', e.target.value)} /></label>
            <label className="field"><span>Current study level</span><select className="input" value={f.level} onChange={(e) => set('level', e.target.value)}><option value="">Choose</option>{LEVELS.map((l) => <option key={l}>{l}</option>)}</select></label>
          </div>
        </> : null}
      </> : null}
      {step === 2 ? <>
        <span className="field"><span>Interests <em>*</em></span></span>
        <div className="tags">{INTERESTS.map((t) => { const on = f.interests.includes(t); return <button key={t} type="button" className={`pick${on ? ' on' : ''}`} aria-pressed={on} onClick={() => set('interests', on ? f.interests.filter((x) => x !== t) : [...f.interests, t])}>{t}</button>; })}</div>
        <label className="field"><span>Skills</span><input className="input" placeholder="Python, Figma, public speaking" value={f.skills} onChange={(e) => set('skills', e.target.value)} /><span className="small">Separate skills with commas. We use them to show you the right events.</span></label>
      </> : null}
      {step === 3 ? (
        <div className="stack" style={{ alignItems: 'center', gap: 12, padding: '12px 0' }}>
          <span className="pc">{photo ? <img src={URL.createObjectURL(photo)} alt="" /> : user?.profile?.avatar ? <img src={imageUrl(user.profile.avatar)} alt="" /> : <UserIcon size={44} />}</span>
          <label className="btn s">{photo ? 'Choose another photo' : 'Upload photo'}<input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} /></label>
          {!photo ? <button type="button" className="linkb" style={{ color: 'var(--ink)' }} onClick={() => setStep(4)}>Skip for now</button> : null}
        </div>
      ) : null}
      {step === 4 ? <>
        <label className="field"><span>GitHub</span><input className="input" placeholder="github.com/yourname" value={f.github} onChange={(e) => set('github', e.target.value)} /></label>
        <label className="field"><span>LinkedIn</span><input className="input" placeholder="linkedin.com/in/yourname" value={f.linkedin} onChange={(e) => set('linkedin', e.target.value)} /></label>
        <label className="field"><span>Portfolio</span><input className="input" placeholder="yourname.dev" value={f.portfolio} onChange={(e) => set('portfolio', e.target.value)} /></label>
      </> : null}

      {error ? <p className="error" role="alert">{error}</p> : null}
      <div className="row" style={{ justifyContent: 'space-between' }}>
        {step > 0 ? <button type="button" className="btn s" onClick={() => setStep(step - 1)}>Back</button> : <span />}
        <button type="button" className="btn p" disabled={busy} onClick={next}>{busy ? 'Saving…' : step === STEPS.length - 1 ? 'Go to events' : 'Continue'}</button>
      </div>
    </div>
  );
}
