'use client';

import { useEffect, useState, type ReactNode, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { GeneratedCover } from '../visuals/generated-cover';
import { Button } from '../ui/button';
import { EditorModal, EditorOption } from '../ui/editor-modal';
import { SchoolPicker } from '../school-picker';
import { CommunitySchoolVerification } from './community-school-verification';
import { getMyCommunityAccess, resolveCommunitySchool, type CommunitySchoolMatch } from '../api/community-access-api';
import { SelectMenu } from '../ui/select-menu';
import {
  createCommunity, listInstitutions, uploadCommunityImages, uploadEndorsementLetter,
  CHAT_PLATFORM_OPTIONS, MAX_CHAT_LINKS, isValidChatLink,
  type ChatLink, type ChatPlatform, type CommunityCreateInput, type InstitutionOption,
} from '../api/community-api';

type VerificationStatus = 'DRAFT' | 'UNVERIFIED' | 'PENDING' | 'VERIFIED';
type VerificationMethod = 'UNIVERSITY_EMAIL' | 'ENDORSEMENT' | 'MANUAL' | 'NONE';


const initialForm: CommunityCreateInput = {
  name: '',
  shortDescription: '',
  description: '',
  logo: '',
  coverImage: '',
  category: '',
  university: '',
  faculty: '',
  department: '',
  whatsappLink: '',
  channelLink: '',
  chatLinks: [{ platform: 'WHATSAPP', url: '' }],
  visibility: 'PUBLIC',
  autoApprove: true,
  verificationMethod: 'MANUAL',
};

export function CommunityCreationWizard() {
  const router = useRouter();
  const [panel, setPanel] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>('DRAFT');
  const [verificationMethod, setVerificationMethod] = useState<VerificationMethod | ''>('');
  const [form, setForm] = useState<CommunityCreateInput>(initialForm);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [coverImagePreview, setCoverImagePreview] = useState<string>('');
  const [logoPreviewBroken, setLogoPreviewBroken] = useState(false);
  const [coverPreviewBroken, setCoverPreviewBroken] = useState(false);
  const [institutions, setInstitutions] = useState<InstitutionOption[]>([]);
  const [schoolProof,setSchoolProof]=useState<CommunitySchoolMatch|null>(null);
  const [schoolRevision,setSchoolRevision]=useState(0);
  const [schoolLoading,setSchoolLoading]=useState(true);
  const [schoolError,setSchoolError]=useState('');
  const effectiveVerification = schoolProof?.verified ? 'UNIVERSITY_EMAIL' : verificationMethod || 'MANUAL';
  const [letterFile, setLetterFile] = useState<File | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const letterInputRef = useRef<HTMLInputElement | null>(null);


  function updateField<K extends keyof CommunityCreateInput>(key: K, value: CommunityCreateInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateChatLink(index: number, patch: Partial<ChatLink>) {
    setForm((current) => ({ ...current, chatLinks: (current.chatLinks ?? []).map((link, i) => (i === index ? { ...link, ...patch } : link)) }));
  }

  function addChatLink() {
    setForm((current) => ({ ...current, chatLinks: [...(current.chatLinks ?? []), { platform: 'OTHER' as ChatPlatform, url: '' }] }));
  }

  function removeChatLink(index: number) {
    setForm((current) => ({ ...current, chatLinks: (current.chatLinks ?? []).filter((_, i) => i !== index) }));
  }

  /** Validate every required section before the single create/save action. */
  function stepComplete(index: number) {
    if (index === 0) return Boolean(form.name.trim() && form.shortDescription.trim() && form.category.trim());
    if (index === 1) return Boolean(logoFile && form.description?.trim());
    if (index === 2) {
      const links = form.chatLinks ?? [];
      const channel = (form.channelLink ?? '').trim();
      const httpsUrl = /^https:\/\/\S+$/;
      return Boolean(form.university.trim()) && links.length > 0 && links.every((link) => isValidChatLink(link)) && (!channel || httpsUrl.test(channel));
    }
    if (index === 4) return schoolProof?.verified || (verificationMethod === 'MANUAL' ? Boolean(letterFile) : verificationMethod === 'UNIVERSITY_EMAIL' ? false : Boolean(verificationMethod));
    return true;
  }

  useEffect(()=>{
    let active=true;
    setSchoolLoading(true);setSchoolError('');
    void (async()=>{
      try {
        const proof=await resolveCommunitySchool(form.university);
        if(!active)return;
        setSchoolProof(proof);
        setForm(current=>({...current,university:current.university||proof.matchedSchool||proof.profileSchool}));
      } catch {
        try {
          const access=await getMyCommunityAccess();
          if(!active)return;
          setSchoolProof(current=>({email:access.schoolEmail,verified:access.schoolEmailVerified,matchedSchool:current?.matchedSchool||'',selectedSchool:form.university,selectedMatches:false,profileSchool:current?.profileSchool||'',faculty:current?.faculty||'',department:current?.department||''}));
          setSchoolError('School matching is temporarily unavailable. Your existing email verification has been preserved.');
        } catch { if(active)setSchoolError('Unable to check your existing verification. Try again before requesting a new code.'); }
      } finally {if(active)setSchoolLoading(false);}
    })();
    return()=>{active=false;};
  },[form.university,schoolRevision]);
  useEffect(()=>{const refresh=()=>setSchoolRevision(value=>value+1);window.addEventListener('focus',refresh);return()=>window.removeEventListener('focus',refresh);},[]);

  useEffect(() => {
    listInstitutions()
      .then((response) => setInstitutions(response.institutions))
      .catch(() => setError('Unable to load the verified institution registry. Please try again.'));
  }, []);

  useEffect(() => () => { if (logoPreview.startsWith('blob:')) URL.revokeObjectURL(logoPreview); }, [logoPreview]);
  useEffect(() => () => { if (coverImagePreview.startsWith('blob:')) URL.revokeObjectURL(coverImagePreview); }, [coverImagePreview]);


  async function handleSubmit() {
    const incomplete = [0, 1, 2, 4].find(index => !stepComplete(index));
    if (incomplete !== undefined) { setError('Complete the required '+(['basic information', 'images and description', 'school and chat links', 'visibility', 'verification'][incomplete])+' before creating the community.'); if (incomplete > 0) setPanel(incomplete); else window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    try {
      setSubmitting(true);
      setError('');

      const uploadPayload = new FormData();
      if (logoFile) uploadPayload.append('logo', logoFile);
      if (coverImageFile) uploadPayload.append('coverImage', coverImageFile);

      const uploaded = await uploadCommunityImages(uploadPayload);
      let endorsementLetter = '';
      if (effectiveVerification === 'MANUAL' && letterFile) {
        const letterUploaded = await uploadEndorsementLetter(letterFile);
        endorsementLetter = letterUploaded.letter;
      }
      const nextForm = {
        ...form,
        logo: uploaded.logo,
        coverImage: uploaded.coverImage || '',
        chatLinks: (form.chatLinks ?? []).map((link) => ({ ...link, url: link.url.trim() })).filter((link) => link.url),
        verificationMethod: effectiveVerification,
        endorsementLetter,
      };

      const response = await createCommunity(nextForm);
      const community = response.community as { slug?: string; verificationStatus?: string };
      setVerificationStatus((community.verificationStatus as VerificationStatus) ?? 'PENDING');
      if (community.slug) {
        router.push(`/communities/${community.slug}`);
      } else {
        router.push('/dashboard/communities');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create community');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800"><div><p className="text-xs font-medium text-slate-500">Community</p><h1 className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">Create a community</h1></div><Button variant="ghost" onClick={()=>router.push('/dashboard/communities')}>Back to communities</Button></div>
      {error ? <p role="alert" className="mb-5 rounded-lg bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p> : null}
      <div className="grid items-start gap-8 lg:grid-cols-[380px_minmax(0,1fr)] lg:gap-12">
        <div className="space-y-3 lg:sticky lg:top-6"><button type="button" onClick={()=>setPanel(1)} className="relative grid aspect-square w-full place-items-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-800 dark:bg-slate-900">{coverImagePreview && !coverPreviewBroken ? <img src={coverImagePreview} alt="Community cover" className="h-full w-full object-cover" onError={()=>setCoverPreviewBroken(true)}/> : logoPreview && !logoPreviewBroken ? <img src={logoPreview} alt="Community logo" className="h-28 w-28 rounded-xl object-cover" onError={()=>setLogoPreviewBroken(true)}/> : <><GeneratedCover seed={form.name} type="COMMUNITY" label={form.category || "Community"} className="absolute inset-0"/><span className="absolute left-3 top-3 rounded-lg bg-white px-3 py-2 text-xs font-medium text-slate-900 shadow">Add community images</span></>}</button><button type="button" onClick={()=>setPanel(1)} className="text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white">Edit logo, cover & description →</button><p className="text-xs leading-5 text-slate-500 dark:text-slate-400">Use images that help students recognise your community.</p></div>
        <div className="min-w-0 space-y-6"><div className="space-y-5"><>
              <Field label="Community Name" required>
                <input className="input" value={form.name} onChange={(e) => updateField('name', e.target.value)} />
              </Field>
              <Field label="Slogan" required>
                <textarea className="input min-h-20" placeholder="A short line about your community" value={form.shortDescription} onChange={(e) => updateField('shortDescription', e.target.value)} />
              </Field>
              <Field label="Category" required>
                <input className="input" value={form.category} onChange={(e) => updateField('category', e.target.value)} />
              </Field>
            </></div><div className="rounded-xl border border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900"><EditorOption label="Images & description" value={logoFile? 'Images added':'Add images'} done={stepComplete(1)} required onClick={()=>setPanel(1)}/><EditorOption label="School & chat links" value={form.university || 'Choose school'} done={stepComplete(2)} required onClick={()=>setPanel(2)}/><EditorOption label="Visibility & joining" value={form.visibility === 'PRIVATE'?'Private':'Public'} done required onClick={()=>setPanel(3)}/>{schoolProof?.verified ? <p className="flex items-center gap-2 border-b border-slate-200 px-1 py-4 text-sm text-emerald-700 dark:border-slate-800 dark:text-emerald-300"><span className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-emerald-600 text-white"><Check className="h-3 w-3" strokeWidth={3} aria-hidden /></span>Verified school email reused · Awaiting admin approval</p> : <EditorOption label="Verification" value={schoolLoading?'Checking existing verification…':schoolError?'Retry verification check':verificationMethod === 'MANUAL'?'Endorsement letter':verificationMethod === 'UNIVERSITY_EMAIL'?'Verify school email':verificationMethod || 'Choose verification method'} done={Boolean(stepComplete(4))} required onClick={()=>{setPanel(4);setSchoolRevision(value=>value+1);}}/>}<EditorOption label="Review" value="Check community details" onClick={()=>setPanel(5)}/></div><p className="text-xs leading-5 text-slate-500 dark:text-slate-400">Open only the settings you need. Required details are checked before creating your community.</p></div>
      </div>
      <div className="sticky bottom-0 z-30 mt-8 flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 bg-[var(--page-surface)] py-4 pr-20 [padding-bottom:max(1rem,env(safe-area-inset-bottom))] dark:border-slate-800"><Button variant="secondary" onClick={()=>setPanel(5)}>Review details</Button><Button variant="primary" onClick={()=>void handleSubmit()} disabled={submitting}>{submitting?'Creating…':'Create community'}</Button></div>
      <EditorModal open={panel === 1} title="Images & description" onClose={()=>setPanel(null)} error={error}><>
              <Field label="Community Logo" required>
                <div className="space-y-3">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      setLogoFile(file);
                      setLogoPreview(file ? URL.createObjectURL(file) : '');
                      setLogoPreviewBroken(false);
                    }}
                  />
                  <Button variant="secondary" type="button" onClick={() => logoInputRef.current?.click()}>
                    {logoFile ? 'Change Logo' : 'Upload Logo'}
                  </Button>
                  {logoPreview && !logoPreviewBroken ? <img src={logoPreview} alt="Logo preview" onError={() => setLogoPreviewBroken(true)} className="h-24 w-24 rounded-lg object-cover border border-slate-200 dark:border-slate-800" /> : null}
                  {logoPreview && logoPreviewBroken ? <p className="text-sm text-slate-500 dark:text-slate-400">Could not load logo preview. Please upload a different image.</p> : null}
                  {logoFile ? <p className="text-sm text-slate-600 dark:text-slate-400">Selected: {logoFile.name}</p> : null}
                </div>
              </Field>
              <Field label="Cover Image (Optional)">
                <div className="space-y-3">
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      setCoverImageFile(file);
                      setCoverImagePreview(file ? URL.createObjectURL(file) : '');
                      setCoverPreviewBroken(false);
                    }}
                  />
                  <Button variant="secondary" type="button" onClick={() => coverInputRef.current?.click()}>
                    {coverImageFile ? 'Change Cover Image' : 'Upload Cover Image'}
                  </Button>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Recommended cover: <span className="font-semibold">1600 × 440 px</span> (about 3.6:1) for the best fit.</p>
                  {coverImagePreview && !coverPreviewBroken ? <img src={coverImagePreview} alt="Cover preview" onError={() => setCoverPreviewBroken(true)} className="aspect-[40/11] w-full rounded-lg border border-slate-200 object-cover dark:border-slate-800" /> : null}
                  {!coverImagePreview ? <p className="text-sm text-slate-500 dark:text-slate-400">Optional</p> : null}
                  {coverImagePreview && coverPreviewBroken ? <p className="text-sm text-slate-500 dark:text-slate-400">Could not load cover preview. Please upload a different image.</p> : null}
                  {coverImageFile ? <p className="text-sm text-slate-600 dark:text-slate-400">Selected: {coverImageFile.name}</p> : null}
                </div>
              </Field>
              <Field label="Description" required>
                <textarea className="input min-h-28" value={form.description ?? ''} onChange={(e) => updateField('description', e.target.value)} />
              </Field>
            </></EditorModal>
<EditorModal open={panel === 2} title="School & chat links" onClose={()=>setPanel(null)} error={error}><>
              <Field label="University" required>
                <SchoolPicker value={form.university} onChange={v=>updateField('university',v)} options={institutions.map(institution=>institution.name)} required/>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">We match your verified email first. If the school is not listed, enter its full name. An administrator will review it.</p>
              </Field>
              <Field label="Faculty (Optional)">
                <input className="input" value={form.faculty ?? ''} onChange={(e) => updateField('faculty', e.target.value)} />
              </Field>
              <Field label="Department (Optional)">
                <input className="input" value={form.department ?? ''} onChange={(e) => updateField('department', e.target.value)} />
              </Field>
              <Field label="Chat links" required>
                <div className="space-y-3">
                  {(form.chatLinks ?? []).map((link, index) => (
                    <div key={index} className="flex flex-wrap items-center gap-2">
                      <div className="w-40">
                        <SelectMenu
                          aria-label="Chat platform"
                          value={link.platform}
                          onChange={(v) => updateChatLink(index, { platform: v as ChatPlatform })}
                          options={CHAT_PLATFORM_OPTIONS.map((p) => ({ value: p.value, label: p.label }))}
                        />
                      </div>
                      <input
                        className="input min-w-52 flex-1"
                        placeholder={CHAT_PLATFORM_OPTIONS.find((p) => p.value === link.platform)?.placeholder ?? 'https://…'}
                        value={link.url}
                        onChange={(e) => updateChatLink(index, { url: e.target.value })}
                      />
                      {(form.chatLinks?.length ?? 0) > 1 ? (
                        <Button variant="secondary" type="button" onClick={() => removeChatLink(index)}>
                          Remove
                        </Button>
                      ) : null}
                    </div>
                  ))}
                  {(form.chatLinks?.length ?? 0) < MAX_CHAT_LINKS ? (
                    <Button variant="secondary" type="button" onClick={addChatLink}>
                      Add another platform
                    </Button>
                  ) : null}
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Where your members chat: WhatsApp, Discord, Telegram, Slack, or any other https:// link. Add at least one; new members will use these to reach you.
                </p>
              </Field>
              <Field label="Channel link (Optional)">
                <input className="input" placeholder="https://whatsapp.com/channel/… or Telegram/Discord" value={form.channelLink ?? ''} onChange={(e) => updateField('channelLink', e.target.value)} />
              </Field>
            </></EditorModal>
<EditorModal open={panel === 3} title="Visibility & joining" onClose={()=>setPanel(null)} error={error}><>
              <Field label="Visibility" as="div" required>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(['PUBLIC', 'PRIVATE'] as const).map((value) => (
                    <label
                      key={value}
                      className={`cursor-pointer rounded-lg border p-4 transition ${form.visibility === value ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-500/15' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'}`}
                    >
                      <input
                        type="radio"
                        name="visibility"
                        className="mr-2"
                        checked={form.visibility === value}
                        onChange={() => updateField('visibility', value)}
                      />
                      <span className="font-medium text-slate-900 dark:text-slate-100">{value === 'PUBLIC' ? 'Public Community' : 'Private Community'}</span>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {value === 'PUBLIC' ? 'Anyone can discover it and join, instantly by default.' : 'Only invited members can join.'}
                      </p>
                    </label>
                  ))}
                </div>
              </Field>
              {form.visibility === 'PUBLIC' ? (
                <Field label="Join Approval" as="div">
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={Boolean(form.autoApprove)}
                      onChange={(e) => updateField('autoApprove', e.target.checked)}
                    />
                    <span>
                      <span className="font-medium text-slate-900 dark:text-slate-100">Auto-approve new members</span>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        When on, anyone can join instantly (open community). When off, join requests must be approved by leadership.
                      </p>
                    </span>
                  </label>
                </Field>
              ) : null}
            </></EditorModal>
<EditorModal open={panel === 4} title="Verification" onClose={()=>setPanel(null)} error={error}><div className="mb-3">{schoolLoading?<p role="status" className="text-sm text-slate-500">Checking your existing school verification…</p>:null}{schoolError?<p role="alert" className="text-sm text-amber-700 dark:text-amber-300">{schoolError} <button type="button" className="underline" onClick={()=>setSchoolRevision(value=>value+1)}>Check again</button></p>:null}</div>{schoolProof?.verified ? <CommunitySchoolVerification proof={schoolProof} onVerified={()=>setSchoolRevision(value=>value+1)} /> : null}{!schoolLoading && schoolProof && !schoolProof.verified ? <Field label="Verification Method" as="div">
              <div className="grid gap-3">
                {([
                  {
                    value: 'UNIVERSITY_EMAIL',
                    title: 'Verify university email',
                    description:
                      'Verify your school inbox with a code. Previously verified school emails are reused. An admin reviews the community and school match.',
                  },
                  {
                    value: 'MANUAL',
                    title: 'Endorsement letter',
                    description:
                      'No matching university email? Upload an endorsement letter written by a recognized leader: a professor, political office holder, SUG or MSSN leader, or any known leadership from an institution or organization. A GuildOS admin reviews it.',
                  },
                ] as const).map((option) => (
                  <label
                    key={option.value}
                    className={`cursor-pointer rounded-lg border p-4 transition ${verificationMethod === option.value ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-500/15' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'}`}
                  >
                    <input
                      type="radio"
                      name="verificationMethod"
                      className="mr-2"
                      checked={verificationMethod === option.value}
                      onChange={() => setVerificationMethod(option.value)}
                    />
                    <span className="font-medium text-slate-900 dark:text-slate-100">{option.title}</span>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{option.description}</p>
                  </label>
                ))}
              </div>
              {verificationMethod === 'UNIVERSITY_EMAIL' ? <CommunitySchoolVerification proof={schoolProof} onVerified={()=>setSchoolRevision(value=>value+1)} /> : null}
              {verificationMethod === 'MANUAL' ? (
                <div className="mt-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Endorsement letter <span className="text-red-500">*</span></p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    PDF or photo (max 10MB). The letter should be on letterhead or signed, naming your community and the endorser&apos;s position.
                  </p>
                  <input
                    ref={letterInputRef}
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => setLetterFile(e.target.files?.[0] ?? null)}
                  />
                  <div className="mt-3 flex items-center gap-3">
                    <Button variant="secondary" type="button" onClick={() => letterInputRef.current?.click()}>
                      {letterFile ? 'Replace letter' : 'Upload letter'}
                    </Button>
                    {letterFile ? <p className="text-sm text-slate-600 dark:text-slate-400">Selected: {letterFile.name}</p> : <p className="text-sm text-amber-600">Required to continue</p>}
                  </div>
                </div>
              ) : null}
            </Field> : null}</EditorModal>
<EditorModal open={panel === 5} title="Review" onClose={()=>setPanel(null)} error={error}><div className="space-y-4">
              <SummaryRow label="Name" value={form.name} />
              <SummaryRow label="Category" value={form.category} />
              <SummaryRow label="University" value={form.university} />
              <SummaryRow
                label="Chat links"
                value={(form.chatLinks ?? [])
                  .filter((link) => link.url.trim())
                  .map((link) => `${CHAT_PLATFORM_OPTIONS.find((p) => p.value === link.platform)?.label ?? link.platform}: ${link.url.trim()}`)
                  .join(' · ')}
              />
              <SummaryRow label="Visibility" value={form.visibility} />
              <SummaryRow
                label="Verification Method"
                value={
                  !schoolProof?.verified && !verificationMethod ? 'Choose a verification method' : effectiveVerification === 'MANUAL'
                    ? 'Endorsement letter (admin review)'
                    : verificationMethod === 'NONE'
                      ? 'Admin review required'
                      : effectiveVerification
                }
              />
              {!schoolProof?.verified && verificationMethod === 'MANUAL' ? <SummaryRow label="Endorsement letter" value={letterFile?.name ?? ''} /> : null}
              <SummaryRow label="Verification" value="Pending admin approval" />
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-4 text-sm text-slate-600 dark:text-slate-400">
                {verificationMethod === 'NONE'
                  ? 'Unverified communities can host free events and grow members, but cannot issue certificates, award reputation points, assign leadership roles, or sell tickets. You can verify any time from community settings.'
                  : 'All new communities require admin approval before official verification.'}
              </div>
            </div></EditorModal>
      <style jsx>{`
        .input {
          width: 100%;
          border-radius: 1rem;
          border: 1px solid var(--border-soft);
          background: var(--field-surface);
          color: var(--text);
          padding: 0.875rem 1rem;
          font-size: 0.95rem;
          outline: none;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .input::placeholder {
          color: var(--text-secondary);
          opacity: 0.8;
        }
        .input:focus {
          border-color: rgb(99 102 241);
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
        }
      `}</style>
    </div>
  );
}
function Field({ label, required = false, children, as = 'label' }: { label: string; required?: boolean; children: ReactNode; as?: 'label' | 'div' }) {
  const Wrapper = as;
  return (
    <Wrapper className="block space-y-2">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
        {label} {required ? <span className="text-rose-500">*</span> : null}
      </span>
      {children}
    </Wrapper>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3">
      <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{value || 'Not set'}</span>
    </div>
  );
}
