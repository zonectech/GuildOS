'use client';

import { useEffect, useMemo, useState, type ReactNode, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from './ui/button';
import { SelectMenu } from './ui/select-menu';
import {
  uploadCommunityImages,
  CHAT_PLATFORM_OPTIONS, MAX_CHAT_LINKS, isValidChatLink,
  type ChatLink, type ChatPlatform, type CommunityCreateInput,
} from './community-api';
import { getCommunity, resolveAvatarUrl, updateCommunity } from './community-list-api';


type VerificationStatus = 'DRAFT' | 'PENDING' | 'VERIFIED';

const steps = ['Basic Information', 'Identity', 'Academic Scope', 'Visibility', 'Review'];

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
};

export function CommunityEditWizard() {
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;
  const communityHref = slug ? `/communities/${slug}` : '/dashboard/communities';

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>('DRAFT');
  const [communityId, setCommunityId] = useState('');
  const [form, setForm] = useState<CommunityCreateInput>(initialForm);
  const [rulesText, setRulesText] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [coverImagePreview, setCoverImagePreview] = useState<string>('');
  const [logoPreviewBroken, setLogoPreviewBroken] = useState(false);
  const [coverPreviewBroken, setCoverPreviewBroken] = useState(false);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        if (!slug) return;
        const response = await getCommunity(slug);
        const community = response.community;
        setCommunityId(community._id);
        setVerificationStatus((community.verificationStatus as VerificationStatus) ?? 'PENDING');
        setForm({
          name: community.name,
          shortDescription: community.shortDescription,
          description: community.description,
          logo: community.logo,
          coverImage: community.coverImage,
          category: community.category,
          university: community.university,
          faculty: community.faculty,
          department: community.department,
          whatsappLink: community.whatsappLink ?? '',
          channelLink: community.channelLink ?? '',
          chatLinks: community.chatLinks?.length
            ? community.chatLinks.map((link) => ({ platform: link.platform as ChatPlatform, url: link.url, label: link.label }))
            : community.whatsappLink
              ? [{ platform: 'WHATSAPP' as ChatPlatform, url: community.whatsappLink }]
              : [{ platform: 'WHATSAPP' as ChatPlatform, url: '' }],
          visibility: community.visibility,
          autoApprove: community.autoApprove ?? false,
        });
        setRulesText((community.rules ?? []).join('\n'));
        setLogoPreview(resolveAvatarUrl(community.logo));
        setCoverImagePreview(resolveAvatarUrl(community.coverImage));
        setLogoPreviewBroken(false);
        setCoverPreviewBroken(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load community');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [slug]);

  useEffect(() => {
    return () => {
      if (logoPreview.startsWith('blob:')) URL.revokeObjectURL(logoPreview);
      if (coverImagePreview.startsWith('blob:')) URL.revokeObjectURL(coverImagePreview);
    };
  }, [logoPreview, coverImagePreview]);

  const canContinue = useMemo(() => {
    if (step === 0) return Boolean(form.name.trim() && form.shortDescription.trim() && form.category.trim());
    if (step === 1) return Boolean(form.logo.trim() && form.description?.trim());
    if (step === 2) {
      const links = form.chatLinks ?? [];
      const channel = (form.channelLink ?? '').trim();
      const httpsUrl = /^https:\/\/\S+$/;
      return Boolean(form.university.trim()) && links.length > 0 && links.every((link) => isValidChatLink(link)) && (!channel || httpsUrl.test(channel));
    }
    return true;
  }, [form, step]);

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
    if (index === 1) return Boolean(form.logo.trim() && form.description?.trim());
    if (index === 2) {
      const links = form.chatLinks ?? [];
      const channel = (form.channelLink ?? '').trim();
      const httpsUrl = /^https:\/\/\S+$/;
      return Boolean(form.university.trim()) && links.length > 0 && links.every((link) => isValidChatLink(link)) && (!channel || httpsUrl.test(channel));
    }
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

  async function handleSubmit() {
    try {
      setSubmitting(true);
      setError('');

      const uploadPayload = new FormData();
      if (logoFile) uploadPayload.append('logo', logoFile);
      if (coverImageFile) uploadPayload.append('coverImage', coverImageFile);

      let nextForm = { ...form };
      nextForm.rules = rulesText
        .split('\n')
        .map((r) => r.trim())
        .filter(Boolean)
        .slice(0, 10);
      nextForm.chatLinks = (form.chatLinks ?? []).map((link) => ({ ...link, url: link.url.trim() })).filter((link) => link.url);
      if (logoFile || coverImageFile) {
        const uploaded = await uploadCommunityImages(uploadPayload);
        nextForm = {
          ...nextForm,
          logo: uploaded.logo || form.logo,
          coverImage: uploaded.coverImage || form.coverImage || '',
        };
      }

      const response = await updateCommunity(communityId, nextForm);
      const community = response.community as { slug?: string; verificationStatus?: string };
      setVerificationStatus((community.verificationStatus as VerificationStatus) ?? 'PENDING');
      router.push(`/communities/${slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update community');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">Loading...</div>;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <button
          type="button"
          onClick={() => router.push(communityHref)}
          className="mb-4 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to community
        </button>

        <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <p className="text-sm font-medium text-indigo-600">Edit Community</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">Community Edit Wizard</h1>
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
                  <input ref={logoInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const file = e.target.files?.[0] ?? null; setLogoFile(file); setLogoPreview(file ? URL.createObjectURL(file) : ''); setLogoPreviewBroken(false); }} />
                  <Button variant="secondary" type="button" onClick={() => logoInputRef.current?.click()}>{logoFile ? 'Change Logo' : 'Upload Logo'}</Button>
                  {logoPreview && !logoPreviewBroken ? <img src={logoPreview} alt="Logo preview" onError={() => setLogoPreviewBroken(true)} className="h-24 w-24 rounded-2xl object-cover border border-slate-200 dark:border-slate-800" /> : null}
                  {logoPreview && logoPreviewBroken ? <p className="text-sm text-slate-500 dark:text-slate-400">Could not load logo preview. Please upload a different image.</p> : null}
                </div>
              </Field>
              <Field label="Cover Image (Optional)">
                <div className="space-y-3">
                  <input ref={coverInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const file = e.target.files?.[0] ?? null; setCoverImageFile(file); setCoverImagePreview(file ? URL.createObjectURL(file) : ''); setCoverPreviewBroken(false); }} />
                  <Button variant="secondary" type="button" onClick={() => coverInputRef.current?.click()}>{coverImageFile ? 'Change Cover Image' : 'Upload Cover Image'}</Button>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Recommended cover: <span className="font-semibold">1600 × 440 px</span> (about 3.6:1) for the best fit.</p>
                  {coverImagePreview && !coverPreviewBroken ? <img src={coverImagePreview} alt="Cover preview" onError={() => setCoverPreviewBroken(true)} className="aspect-[40/11] w-full rounded-2xl border border-slate-200 object-cover dark:border-slate-800" /> : null}
                  {!coverImagePreview ? <p className="text-sm text-slate-500 dark:text-slate-400">Optional</p> : null}
                  {coverImagePreview && coverPreviewBroken ? <p className="text-sm text-slate-500 dark:text-slate-400">Could not load cover preview. Please upload a different image.</p> : null}
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
                <input className="input" value={form.university} onChange={(e) => updateField('university', e.target.value)} />
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
                  WhatsApp, Discord, Telegram, Slack, or any other https:// link — keep at least one so members can reach you.
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
                  <label key={value} className={`cursor-pointer rounded-2xl border p-4 transition ${form.visibility === value ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-500/15' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'}`}>
                    <input type="radio" name="visibility" className="mr-2" checked={form.visibility === value} onChange={() => updateField('visibility', value)} />
                    <span className="font-medium text-slate-900 dark:text-slate-100">{value === 'PUBLIC' ? 'Public Community' : 'Private Community'}</span>
                  </label>
                ))}
              </div>
              {form.visibility === 'PUBLIC' ? (
                <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={Boolean(form.autoApprove)}
                    onChange={(e) => updateField('autoApprove', e.target.checked)}
                  />
                  <span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">Auto-approve new members</span>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">When on, anyone can join instantly. When off, requests need approval.</p>
                  </span>
                </label>
              ) : null}
            </Field>
            <Field label="Community rules (Optional)">
              <textarea
                className="input min-h-28"
                placeholder={'One rule per line, e.g.\nBe respectful.\nNo spam or self-promotion.'}
                value={rulesText}
                onChange={(e) => setRulesText(e.target.value)}
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">Up to 10 rules, shown on your community profile.</p>
            </Field>
            </>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <SummaryRow label="Name" value={form.name} />
              <SummaryRow label="Category" value={form.category} />
              <SummaryRow label="University" value={form.university} />
              <SummaryRow label="Visibility" value={form.visibility} />
              <SummaryRow label="Verification" value={verificationStatus} />
            </div>
          )}
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
          <Button variant="secondary" onClick={previousStep} disabled={step === 0 || submitting}>Back</Button>
          {step < steps.length - 1 ? <Button variant="primary" onClick={nextStep} disabled={!canContinue || submitting}>Next</Button> : <Button variant="primary" onClick={handleSubmit} disabled={submitting || !canContinue}>{submitting ? 'Saving...' : 'Save Changes'}</Button>}
        </div>
      </section>

      <aside className="space-y-6">
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Verification</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Current status: {verificationStatus}</p>
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
  return <label className="block space-y-2"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label} {required ? <span className="text-rose-500">*</span> : null}</span>{children}</label>;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3"><span className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</span><span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{value || '—'}</span></div>;
}