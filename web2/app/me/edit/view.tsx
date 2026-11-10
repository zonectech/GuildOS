'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as m from 'motion/react-m';
import { ArrowLeft, Camera, X } from 'lucide-react';
import type { GuestVisibility } from '@/lib/api/types';
import { GENDERS, guestVisibility, myProfile, privateDetails, setGender, setPronouns, setGuestVisibility, updatePrivacy, updateProfile, uploadAvatar, type Gender, type Profile } from '@/lib/api/profile';
import { spring } from '@/lib/motion';
import { useSession } from '@/lib/session';
import { Avatar } from '@/components/ui/avatar';
import { Btn } from '@/components/ui/bits';
import { useToast } from '@/components/ui/toast';

const field = 'w-full rounded-2xl border border-line bg-surface px-4 py-3 text-[15.5px] outline-none focus:border-green-text';
const LEVELS = ['100', '200', '300', '400', '500', '600', 'Postgraduate'];

function Switch({ on, onChange, title, body }: { on: boolean; onChange: (v: boolean) => void; title: string; body: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="flex w-full items-center justify-between gap-4 rounded-2xl border border-line p-4 text-left hover:bg-mist">
      <span><b className="block text-[15px]">{title}</b><small className="text-[13px] text-muted">{body}</small></span>
      <span className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${on ? 'bg-green' : 'bg-line'}`}><m.span layout transition={spring.snap} className={`absolute top-1 size-5 rounded-full bg-white shadow ${on ? 'right-1' : 'left-1'}`} /></span>
    </button>
  );
}

/** Tag input: type and press Enter or comma. */
function Tags({ value, onChange, placeholder, label }: { value: string[]; onChange: (v: string[]) => void; placeholder: string; label: string }) {
  const [draft, setDraft] = useState('');
  const add = () => { const t = draft.trim().replace(/,$/, ''); if (t && !value.includes(t) && value.length < 15) onChange([...value, t.slice(0, 40)]); setDraft(''); };
  return (
    <div className={`${field} flex flex-wrap items-center gap-1.5 py-2`}>
      {value.map((t) => <span key={t} className="inline-flex items-center gap-1 rounded-full bg-tint py-1 pr-1.5 pl-3 text-[13.5px] font-semibold text-green-text">{t}<button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(value.filter((x) => x !== t))} className="grid size-5 place-items-center rounded-full hover:bg-surface"><X size={12} /></button></span>)}
      <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } }} onBlur={add} placeholder={value.length ? '' : placeholder} aria-label={label} className="min-w-[120px] flex-1 bg-transparent py-1 outline-none" />
    </div>
  );
}

export function EditProfile() {
  const router = useRouter();
  const toast = useToast();
  const { user, loading, setUser } = useSession();
  const [p, setP] = useState<Profile | null>(null);
  // null until loaded: never save a default over the student's real choice.
  const [guests, setGuests] = useState<GuestVisibility | null>(null);
  // null until loaded, like the guest list choice: never save a blank over a real answer.
  const [gender, setGenderValue] = useState<Gender | null>(null);
  const [showGender, setShowGender] = useState(false);
  const [pronouns, setPronounsValue] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!loading && !user) router.replace('/login?next=/me/edit'); }, [loading, user, router]);
  useEffect(() => { if (user) { myProfile().then((x) => setP((cur) => cur ?? x)).catch(() => undefined); privateDetails().then((d) => { setGenderValue((cur) => cur ?? d.gender); setShowGender((cur) => cur || d.showGender); setPronounsValue((cur) => cur ?? d.pronouns); }).catch(() => undefined); guestVisibility().then((v) => setGuests((cur) => cur ?? v)).catch(() => setTimeout(() => void guestVisibility().then(setGuests).catch(() => undefined), 3000)); } }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!user || !p) return <div className="mx-auto max-w-2xl px-4 pt-10"><div className="shimmer h-[520px] rounded-[28px]" /></div>;
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP((x) => (x ? { ...x, [k]: v } : x));

  async function photo(f: File | null) {
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { toast('That photo is over 5 MB'); return; }
    try { const next = await uploadAvatar(f); set('avatar', next.avatar); if (user) setUser({ ...user, avatar: next.avatar }); toast('Photo updated'); }
    catch (e) { toast(e instanceof Error ? e.message : 'Upload failed'); }
  }
  async function save() {
    if (!p) return;
    setBusy(true);
    try {
      await updateProfile({ fullName: p.fullName.trim(), username: p.username.trim(), bio: p.bio.trim(), university: p.school.trim(), department: p.department.trim(), level: p.level, interests: p.interests, skills: p.skills });
      await updatePrivacy({ profileVisibility: p.visibility, showUniversity: p.showSchool, showCertificates: p.showCertificates, showTimeline: p.showHistory });
      if (guests) await setGuestVisibility(guests);
      if (pronouns !== null) await setPronouns(pronouns.trim());
      if (gender !== null) await setGender(gender, showGender && gender !== 'PREFER_NOT_TO_SAY' && gender !== '');
      if (user) setUser({ ...user, fullName: p.fullName.trim(), username: p.username.trim(), school: p.school.trim(), department: p.department.trim() || undefined, level: p.level || undefined, guestListVisibility: guests ?? user.guestListVisibility });
      toast('Saved');
      router.push('/me');
    } catch (e) { toast(e instanceof Error ? e.message : 'Unable to save'); }
    finally { setBusy(false); }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 pt-6 pb-24 sm:px-6 lg:pt-10">
      <Link href="/me" className="inline-flex w-fit items-center gap-1.5 text-[14.5px] font-semibold text-muted hover:text-ink"><ArrowLeft size={17} />Your passport</Link>
      <h1 className="text-[32px] font-extrabold">Edit profile</h1>

      <section className="flex flex-col gap-4 rounded-[22px] border border-line bg-surface p-5">
        <label className="flex w-fit cursor-pointer items-center gap-4">
          <span className="relative"><Avatar name={p.fullName} src={p.avatar} size={80} /><span className="absolute -right-1 -bottom-1 grid size-8 place-items-center rounded-full bg-ink text-paper"><Camera size={15} /></span></span>
          <span className="font-semibold">Change photo</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => void photo(e.target.files?.[0] ?? null)} />
        </label>
        <label className="flex flex-col gap-1.5"><span className="text-[14px] font-semibold">Name</span><input className={field} value={p.fullName} maxLength={80} onChange={(e) => set('fullName', e.target.value)} /></label>
        <label className="flex flex-col gap-1.5"><span className="text-[14px] font-semibold">Pronouns <span className="font-normal text-muted">(optional, shown next to your name)</span></span><input className={field} value={pronouns ?? ''} maxLength={30} onChange={(e) => setPronounsValue(e.target.value)} placeholder="e.g. she/her, he/him, they/them" /></label>
        <label className="flex flex-col gap-1.5"><span className="text-[14px] font-semibold">Username</span><input className={field} value={p.username} maxLength={30} onChange={(e) => set('username', e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ''))} /></label>
        <label className="flex flex-col gap-1.5"><span className="text-[14px] font-semibold">Bio</span><textarea className={`${field} min-h-[90px]`} maxLength={300} value={p.bio} onChange={(e) => set('bio', e.target.value)} placeholder="A line about you" /></label>
        {gender !== null ? (
          <div className="flex flex-col gap-2"><span className="text-[14px] font-semibold">Gender <span className="font-normal text-muted">· hidden unless you choose to show it</span></span>
            <div role="radiogroup" aria-label="Gender" className="flex flex-wrap gap-2">{GENDERS.map(([v, l]) => (
              <button key={v} type="button" role="radio" aria-checked={gender === v} onClick={() => setGenderValue(v)} className={`h-10 rounded-full border-2 px-4 text-[14px] font-semibold ${gender === v ? 'border-green-text bg-tint text-green-text' : 'border-line'}`}>{l}</button>
            ))}</div>
          </div>
        ) : null}
        <label className="flex flex-col gap-1.5"><span className="text-[14px] font-semibold">School</span><input className={field} value={p.school} onChange={(e) => set('school', e.target.value)} placeholder="e.g. Ahmadu Bello University" /></label>
        <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
          <label className="flex flex-col gap-1.5"><span className="text-[14px] font-semibold">Department</span><input className={field} value={p.department} onChange={(e) => set('department', e.target.value)} placeholder="e.g. Computer Science" /></label>
          <label className="flex flex-col gap-1.5"><span className="text-[14px] font-semibold">Level</span><select className={field} value={p.level} onChange={(e) => set('level', e.target.value)}><option value="">Choose</option>{LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}</select></label>
        </div>
        <div className="flex flex-col gap-1.5"><span className="text-[14px] font-semibold">Interests</span><Tags value={p.interests} onChange={(v) => set('interests', v)} placeholder="AI, Design, Debate…" label="Add an interest" /></div>
        <div className="flex flex-col gap-1.5"><span className="text-[14px] font-semibold">Skills</span><Tags value={p.skills} onChange={(v) => set('skills', v)} placeholder="Python, Public speaking…" label="Add a skill" /></div>
      </section>

      <section className="flex flex-col gap-4 rounded-[22px] border border-line bg-surface p-5">
        <h2 className="text-[20px] font-extrabold">Privacy</h2>
        <div className="flex flex-col gap-2"><span className="text-[14px] font-semibold">On event guest lists</span>
          {guests === null ? <div className="shimmer h-[74px] rounded-2xl" /> : <div role="radiogroup" aria-label="On event guest lists" className="grid gap-2 sm:grid-cols-3">
            {([['VISIBLE', 'Show me', 'Name and photo, for everyone signed in'], ['DEPARTMENT_ONLY', 'Department only', 'Only students in my department see me'], ['HIDDEN', 'Hide me', 'Counted, never named']] as const).map(([v, t, s]) => (
              <button key={v} type="button" role="radio" aria-checked={guests === v} onClick={() => setGuests(v)} className={`flex flex-col items-start gap-1 rounded-2xl border-2 p-3 text-left ${guests === v ? 'border-green-text bg-tint' : 'border-line'}`}><b className="text-[14.5px]">{t}</b><small className="text-[12.5px] text-muted">{s}</small></button>
            ))}
          </div>}
        </div>
        {gender && gender !== 'PREFER_NOT_TO_SAY' ? <Switch on={showGender} onChange={setShowGender} title="Show my gender on my profile" body="Off by default. Never shown on guest lists." /> : null}
        <Switch on={p.showHistory} onChange={(v) => set('showHistory', v)} title="Public participation history" body="Show your stamps on your public profile. Off by default." />
        <Switch on={p.showCertificates} onChange={(v) => set('showCertificates', v)} title="Show certificates" body="Let people see and verify your certificates on your profile." />
        <Switch on={p.showSchool} onChange={(v) => set('showSchool', v)} title="Show my school" body="Your school on your public profile." />
        <Switch on={p.visibility === 'PRIVATE'} onChange={(v) => set('visibility', v ? 'PRIVATE' : 'PUBLIC')} title="Private profile" body="Nobody else can open your profile. You still appear on guest lists by the choice above." />
      </section>

      <div className="sticky bottom-[calc(88px+env(safe-area-inset-bottom))] flex justify-end lg:bottom-6">
        <Btn size="lg" onClick={() => void save()} disabled={busy || p.fullName.trim().length < 2}>{busy ? 'Saving…' : 'Save'}</Btn>
      </div>
    </div>
  );
}
