'use client';

import { useEffect, useMemo, useState, type ReactNode, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from './ui/button';
import { SelectMenu } from './ui/select-menu';
import { createCommunity, listInstitutions, uploadCommunityImages, type CommunityCreateInput, type InstitutionOption } from './community-api';

type VerificationStatus = 'DRAFT' | 'PENDING' | 'VERIFIED';
type VerificationMethod = 'UNIVERSITY_EMAIL' | 'ENDORSEMENT' | 'MANUAL';

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
  const [institutions, setInstitutions] = useState<InstitutionOption[]>([]);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  const canContinue = useMemo(() => {
    if (step === 0) return Boolean(form.name.trim() && form.shortDescription.trim() && form.category.trim());
    if (step === 1) return Boolean(logoFile);
    if (step === 2) return Boolean(form.university.trim());
    if (step === 4) return Boolean(verificationMethod);
    return true;
  }, [form, step, verificationMethod]);

  function updateField<K extends keyof CommunityCreateInput>(key: K, value: CommunityCreateInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
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
      const nextForm = {
        ...form,
        logo: uploaded.logo,
        coverImage: uploaded.coverImage || '',
        verificationMethod,
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
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <p className="text-sm font-medium text-indigo-600">Create Community</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-950">Community Creation Wizard</h1>
          </div>
          <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
            Step {step + 1} of {steps.length}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {steps.map((label, index) => (
            <div
              key={label}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                index === step ? 'bg-indigo-600 text-white' : index < step ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {label}
            </div>
          ))}
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
                    }}
                  />
                  <Button variant="secondary" type="button" onClick={() => logoInputRef.current?.click()}>
                    {logoFile ? 'Change Logo' : 'Upload Logo'}
                  </Button>
                  {logoPreview ? <img src={logoPreview} alt="Logo preview" className="h-24 w-24 rounded-2xl object-cover border border-slate-200" /> : null}
                  {logoFile ? <p className="text-sm text-slate-600">Selected: {logoFile.name}</p> : null}
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
                    }}
                  />
                  <Button variant="secondary" type="button" onClick={() => coverInputRef.current?.click()}>
                    {coverImageFile ? 'Change Cover Image' : 'Upload Cover Image'}
                  </Button>
                  {coverImagePreview ? <img src={coverImagePreview} alt="Cover preview" className="h-32 w-full rounded-2xl object-cover border border-slate-200" /> : <p className="text-sm text-slate-500">Optional</p>}
                  {coverImageFile ? <p className="text-sm text-slate-600">Selected: {coverImageFile.name}</p> : null}
                </div>
              </Field>
              <Field label="Description">
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
                <p className="mt-2 text-xs text-slate-500">If your institution is missing, ask a GuildOS administrator to verify and add it.</p>
              </Field>
              <Field label="Faculty (Optional)">
                <input className="input" value={form.faculty ?? ''} onChange={(e) => updateField('faculty', e.target.value)} />
              </Field>
              <Field label="Department (Optional)">
                <input className="input" value={form.department ?? ''} onChange={(e) => updateField('department', e.target.value)} />
              </Field>
              <Field label="WhatsApp group link (Optional)">
                <input className="input" placeholder="https://chat.whatsapp.com/…" value={form.whatsappLink ?? ''} onChange={(e) => updateField('whatsappLink', e.target.value)} />
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
                      className={`cursor-pointer rounded-2xl border p-4 transition ${form.visibility === value ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 bg-white'}`}
                    >
                      <input
                        type="radio"
                        name="visibility"
                        className="mr-2"
                        checked={form.visibility === value}
                        onChange={() => updateField('visibility', value)}
                      />
                      <span className="font-medium text-slate-900">{value === 'PUBLIC' ? 'Public Community' : 'Private Community'}</span>
                      <p className="mt-1 text-sm text-slate-500">
                        {value === 'PUBLIC' ? 'Anyone can discover it and join, instantly by default.' : 'Only invited members can join.'}
                      </p>
                    </label>
                  ))}
                </div>
              </Field>
              {form.visibility === 'PUBLIC' ? (
                <Field label="Join Approval">
                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={Boolean(form.autoApprove)}
                      onChange={(e) => updateField('autoApprove', e.target.checked)}
                    />
                    <span>
                      <span className="font-medium text-slate-900">Auto-approve new members</span>
                      <p className="mt-1 text-sm text-slate-500">
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
                    title: 'University Email Verification',
                    description: 'Use a verified university email when available for immediate official status.',
                  },
                  {
                    value: 'ENDORSEMENT',
                    title: 'Endorsement',
                    description: 'Request endorsement from existing verified leaders. Status remains pending until approved.',
                  },
                  {
                    value: 'MANUAL',
                    title: 'Manual Approval',
                    description: 'Send the community for GuildOS admin review.',
                  },
                ] as const).map((option) => (
                  <label
                    key={option.value}
                    className={`cursor-pointer rounded-2xl border p-4 transition ${verificationMethod === option.value ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 bg-white'}`}
                  >
                    <input
                      type="radio"
                      name="verificationMethod"
                      className="mr-2"
                      checked={verificationMethod === option.value}
                      onChange={() => setVerificationMethod(option.value)}
                    />
                    <span className="font-medium text-slate-900">{option.title}</span>
                    <p className="mt-1 text-sm text-slate-500">{option.description}</p>
                  </label>
                ))}
              </div>
            </Field>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <SummaryRow label="Name" value={form.name} />
              <SummaryRow label="Category" value={form.category} />
              <SummaryRow label="University" value={form.university} />
              <SummaryRow label="Visibility" value={form.visibility} />
              <SummaryRow label="Verification Method" value={verificationMethod} />
              <SummaryRow label="Verification" value={verificationStatus} />
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                Communities can only issue official certificates once verification is approved.
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
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Verification</h2>
          <p className="mt-2 text-sm text-slate-600">
            Your community may be marked pending while verification is reviewed based on platform policy.
          </p>
          <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
            <p className="font-medium text-slate-900">Current status</p>
            <p className="mt-1">{verificationStatus}</p>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">What you can do</h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-600">
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
          border: 1px solid rgb(226 232 240);
          padding: 0.875rem 1rem;
          font-size: 0.95rem;
          outline: none;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
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
      <span className="text-sm font-medium text-slate-700">
        {label} {required ? <span className="text-rose-500">*</span> : null}
      </span>
      {children}
    </label>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <span className="text-sm font-medium text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-900">{value || '—'}</span>
    </div>
  );
}
