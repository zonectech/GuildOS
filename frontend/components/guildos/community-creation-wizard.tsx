'use client';

import { useEffect, useMemo, useState, type ReactNode, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from './ui/button';
import { SelectMenu } from './ui/select-menu';
import {
  createCommunity, listInstitutions, uploadCommunityImages, uploadEndorsementLetter,
  CHAT_PLATFORM_OPTIONS, MAX_CHAT_LINKS, isValidChatLink,
  type ChatLink, type ChatPlatform, type CommunityCreateInput, type InstitutionOption,
} from './community-api';

type VerificationStatus = 'DRAFT' | 'UNVERIFIED' | 'PENDING' | 'VERIFIED';
type VerificationMethod = 'UNIVERSITY_EMAIL' | 'ENDORSEMENT' | 'MANUAL' | 'NONE';

const steps = ['Basic Information', 'Identity', 'Academic Scope', 'Visibility', 'Verification', 'Review'];

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
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>('DRAFT');
  const [verificationMethod, setVerificationMethod] = useState<VerificationMethod>('MANUAL');
  const [form, setForm] = useState<CommunityCreateInput>(initialForm);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [coverImagePreview, setCoverImagePreview] = useState<string>('');
  const [logoPreviewBroken, setLogoPreviewBroken] = useState(false);
  const [coverPreviewBroken, setCoverPreviewBroken] = useState(false);
  const [institutions, setInstitutions] = useState<InstitutionOption[]>([]);
  const [letterFile, setLetterFile] = useState<File | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const letterInputRef = useRef<HTMLInputElement | null>(null);

  const canContinue = useMemo(() => {
    if (step === 0) return Boolean(form.name.trim() && form.shortDescription.trim() && form.category.trim());
    if (step === 1) return Boolean(logoFile && form.description?.trim());
    if (step === 2) {
      const links = form.chatLinks ?? [];
      const channel = (form.channelLink ?? '').trim();
      const httpsUrl = /^https:\/\/\S+$/;
      return Boolean(form.university.trim()) && links.length > 0 && links.every((link) => isValidChatLink(link)) && (!channel || httpsUrl.test(channel));
    }
    if (step === 4) return verificationMethod === 'MANUAL' ? Boolean(letterFile) : Boolean(verificationMethod);
    return true;
  }, [form, step, verificationMethod, logoFile, letterFile]);

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

  /** Whether a given step's required fields are filled (mirrors canContinue rules). */
  function stepComplete(index: number) {
    if (index === 0) return Boolean(form.name.trim() && form.shortDescription.trim() && form.category.trim());
    if (index === 1) return Boolean(logoFile && form.description?.trim());
    if (index === 2) {
      const links = form.chatLinks ?? [];
      const channel = (form.channelLink ?? '').trim();
      const httpsUrl = /^https:\/\/\S+$/;
      return Boolean(form.university.trim()) && links.length > 0 && links.every((link) => isValidChatLink(link)) && (!channel || httpsUrl.test(channel));
    }
    if (index === 4) return verificationMethod === 'MANUAL' ? Boolean(letterFile) : Boolean(verificationMethod);
    return true;
  }

  /** Jump via the stepper: backwards freely; forwards only past completed steps. */
  function goToStep(target: number) {
    if (target === step) return;
    if (target > step) {
      for (let i = step; i < target; i += 1) {
        if (!stepComplete(i)) return;
      }
    }
    setError('');
    setStep(target);
  }

  function nextStep() {
    if (!canContinue) return;
    setError('');
    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  function previousStep() {
    setError('');
    setStep((current) => Math.max(current - 1, 0));
  }

  useEffect(() => {
    listInstitutions()
      .then((response) => setInstitutions(response.institutions))
      .catch(() => setError('Unable to load the verified institution registry. Please try again.'));
  }, []);

  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
      if (coverImagePreview) URL.revokeObjectURL(coverImagePreview);
    };
  }, [logoPreview, coverImagePreview]);

  async function handleSubmit() {
    try {
      setSubmitting(true);
      setError('');

      const uploadPayload = new FormData();
      if (logoFile) uploadPayload.append('logo', logoFile);
      if (coverImageFile) uploadPayload.append('coverImage', coverImageFile);

      const uploaded = await uploadCommunityImages(uploadPayload);
      let endorsementLetter = '';
      if (verificationMethod === 'MANUAL' && letterFile) {
        const letterUploaded = await uploadEndorsementLetter(letterFile);
        endorsementLetter = letterUploaded.letter;
      }
      const nextForm = {
        ...form,
        logo: uploaded.logo,
        coverImage: uploaded.coverImage || '',
        chatLinks: (form.chatLinks ?? []).map((link) => ({ ...link, url: link.url.trim() })).filter((link) => link.url),
        verificationMethod,
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
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <p className="text-sm font-medium text-indigo-600">Create Community</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">Community Creation Wizard</h1>
          </div>
          <div className="rounded-full bg-slate-100 dark:bg-slate-950 px-3 py-1 text-sm font-medium text-slate-700 dark:text-slate-300">
            Step {step + 1} of {steps.length}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {steps.map((label, index) => {
            const reachable = index <= step || stepComplete(step);
            return (
              <button
                key={label}
                type="button"
                onClick={() => goToStep(index)}
                aria-current={index === step ? 'step' : undefined}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  index === step
                    ? 'bg-indigo-600 text-white'
                    : index < step
                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                      : reachable
                        ? 'bg-slate-100 dark:bg-slate-950 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200'
                        : 'cursor-not-allowed bg-slate-100 dark:bg-slate-950 text-slate-400 dark:text-slate-600'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {error ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

        <div className="mt-6 space-y-5">
          {step === 0 && (
            <>
              <Field label="Community Name" required>
                <input className="input" value={form.name} onChange={(e) => updateField('name', e.target.value)} />
              </Field>
              <Field label="Short Description" required>
                <textarea className="input min-h-28" value={form.shortDescription} onChange={(e) => updateField('shortDescription', e.target.value)} />
              </Field>
              <Field label="Category" required>
                <input className="input" value={form.category} onChange={(e) => updateField('category', e.target.value)} />
              </Field>
            </>
          )}

          {step === 1 && (
            <>
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
                  {logoPreview && !logoPreviewBroken ? <img src={logoPreview} alt="Logo preview" onError={() => setLogoPreviewBroken(true)} className="h-24 w-24 rounded-2xl object-cover border border-slate-200 dark:border-slate-800" /> : null}
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
                  {coverImagePreview && !coverPreviewBroken ? <img src={coverImagePreview} alt="Cover preview" onError={() => setCoverPreviewBroken(true)} className="aspect-[40/11] w-full rounded-2xl border border-slate-200 object-cover dark:border-slate-800" /> : null}
                  {!coverImagePreview ? <p className="text-sm text-slate-500 dark:text-slate-400">Optional</p> : null}
                  {coverImagePreview && coverPreviewBroken ? <p className="text-sm text-slate-500 dark:text-slate-400">Could not load cover preview. Please upload a different image.</p> : null}
                  {coverImageFile ? <p className="text-sm text-slate-600 dark:text-slate-400">Selected: {coverImageFile.name}</p> : null}
                </div>
              </Field>
              <Field label="Description" required>
                <textarea className="input min-h-28" value={form.description ?? ''} onChange={(e) => updateField('description', e.target.value)} />
              </Field>
            </>
          )}

          {step === 2 && (
            <>
              <Field label="University" required>
                <SelectMenu
                  aria-label="University"
                  value={form.university}
                  onChange={(v) => updateField('university', v)}
                  placeholder="Select a verified institution"
                  options={institutions.map((institution) => ({
                    value: institution.name,
                    label: institution.name + (institution.country ? ` (${institution.country})` : ''),
                  }))}
                />
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">If your institution is missing, ask a GuildOS administrator to verify and add it.</p>
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
                  Where your members chat — WhatsApp, Discord, Telegram, Slack, or any other https:// link. Add at least one; new members will use these to reach you.
                </p>
              </Field>
              <Field label="Channel link (Optional)">
                <input className="input" placeholder="https://whatsapp.com/channel/… or Telegram/Discord" value={form.channelLink ?? ''} onChange={(e) => updateField('channelLink', e.target.value)} />
              </Field>
            </>
          )}

          {step === 3 && (
            <>
              <Field label="Visibility">
                <div className="grid gap-3 sm:grid-cols-2">
                  {(['PUBLIC', 'PRIVATE'] as const).map((value) => (
                    <label
                      key={value}
                      className={`cursor-pointer rounded-2xl border p-4 transition ${form.visibility === value ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-500/15' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'}`}
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
                <Field label="Join Approval">
                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
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
            </>
          )}

          {step === 4 && (
            <Field label="Verification Method">
              <div className="grid gap-3">
                {([
                  {
                    value: 'UNIVERSITY_EMAIL',
                    title: 'University email (instant)',
                    description:
                      'Your verified school email must match the selected institution for immediate official status. Ambassador or organizational emails cannot prove your institution — use the endorsement letter instead.',
                  },
                  {
                    value: 'MANUAL',
                    title: 'Endorsement letter',
                    description:
                      'No matching university email? Upload an endorsement letter written by a recognized leader — a professor, political office holder, SUG or MSSN leader, or any known leadership from an institution or organization. A GuildOS admin reviews it.',
                  },
                  {
                    value: 'NONE',
                    title: 'Skip for now — create unverified',
                    description:
                      'No email or letter? Start unverified: members can join and follow, and you can host free events. Certificates, reputation points, leadership roles, and paid events stay locked until you verify later.',
                  },
                ] as const).map((option) => (
                  <label
                    key={option.value}
                    className={`cursor-pointer rounded-2xl border p-4 transition ${verificationMethod === option.value ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-500/15' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'}`}
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
              {verificationMethod === 'MANUAL' ? (
                <div className="mt-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
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
            </Field>
          )}

          {step === 5 && (
            <div className="space-y-4">
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
                  verificationMethod === 'MANUAL'
                    ? 'Endorsement letter (admin review)'
                    : verificationMethod === 'NONE'
                      ? 'None — unverified (limited features)'
                      : verificationMethod
                }
              />
              {verificationMethod === 'MANUAL' ? <SummaryRow label="Endorsement letter" value={letterFile?.name ?? ''} /> : null}
              <SummaryRow label="Verification" value={verificationStatus} />
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-4 text-sm text-slate-600 dark:text-slate-400">
                {verificationMethod === 'NONE'
                  ? 'Unverified communities can host free events and grow members, but cannot issue certificates, award reputation points, assign leadership roles, or sell tickets. You can verify any time from community settings.'
                  : 'Communities can only issue official certificates once verification is approved.'}
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
          <Button variant="secondary" onClick={previousStep} disabled={step === 0 || submitting}>
            Back
          </Button>

          {step < steps.length - 1 ? (
            <Button variant="primary" onClick={nextStep} disabled={!canContinue || submitting}>
              Next
            </Button>
          ) : (
            <Button variant="primary" onClick={handleSubmit} disabled={submitting || !canContinue}>
              {submitting ? 'Creating...' : 'Create Community'}
            </Button>
          )}
        </div>
      </section>

      <aside className="space-y-6">
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Verification</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Your community may be marked pending while verification is reviewed based on platform policy.
          </p>
          <div className="mt-4 rounded-2xl bg-slate-50 dark:bg-slate-900 p-4 text-sm text-slate-700 dark:text-slate-300">
            <p className="font-medium text-slate-900 dark:text-slate-100">Current status</p>
            <p className="mt-1">{verificationStatus}</p>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">What you can do</h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-400">
            <li>• Organize members</li>
            <li>• Host events</li>
            <li>• Assign leadership roles</li>
            <li>• Issue attendance and certificates after verification</li>
          </ul>
        </div>
      </aside>

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

function Field({ label, required = false, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
        {label} {required ? <span className="text-rose-500">*</span> : null}
      </span>
      {children}
    </label>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3">
      <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{value || '—'}</span>
    </div>
  );
}
