'use client';

import { useEffect, useState, type ReactNode, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { GeneratedCover } from '../visuals/generated-cover';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../ui/button';
import { EditorModal, EditorOption } from '../ui/editor-modal';
import { SelectMenu } from '../ui/select-menu';
import {
  uploadCommunityImages, uploadCommunityGallery, MAX_COMMUNITY_GALLERY,
  CHAT_PLATFORM_OPTIONS, MAX_CHAT_LINKS, isValidChatLink,
  type ChatLink, type ChatPlatform, type CommunityCreateInput,
} from '../api/community-api';
import { getCommunity, resolveAvatarUrl, updateCommunity } from '../api/community-list-api';


type VerificationStatus = 'DRAFT' | 'PENDING' | 'VERIFIED';


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

  const [panel, setPanel] = useState<number | null>(null);
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
  const [gallery, setGallery] = useState<string[]>([]);
  const [galleryUploading, setGalleryUploading] = useState(false);
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
        setGallery(community.gallery ?? []);
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

  useEffect(() => () => { if (logoPreview.startsWith('blob:')) URL.revokeObjectURL(logoPreview); }, [logoPreview]);
  useEffect(() => () => { if (coverImagePreview.startsWith('blob:')) URL.revokeObjectURL(coverImagePreview); }, [coverImagePreview]);



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
    if (index === 1) return Boolean((form.logo.trim() || logoFile) && form.description?.trim());
    if (index === 2) {
      const links = form.chatLinks ?? [];
      const channel = (form.channelLink ?? '').trim();
      const httpsUrl = /^https:\/\/\S+$/;
      return Boolean(form.university.trim()) && links.length > 0 && links.every((link) => isValidChatLink(link)) && (!channel || httpsUrl.test(channel));
    }
    return true;
  }

  async function handleSubmit() {
    const incomplete = [0, 1, 2].find(index => !stepComplete(index));
    if (incomplete !== undefined) { setError('Complete the required '+(['basic information', 'images and description', 'school and chat links', 'visibility', 'verification'][incomplete])+' before saving.'); if (incomplete > 0) setPanel(incomplete); else window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
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

      const response = await updateCommunity(communityId, { ...nextForm, gallery });
      const community = response.community as { slug?: string; verificationStatus?: string };
      setVerificationStatus((community.verificationStatus as VerificationStatus) ?? 'PENDING');
      router.push(`/communities/${slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update community');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGalleryFiles(files: FileList | null) {
    if (!files?.length) return;
    const room = MAX_COMMUNITY_GALLERY - gallery.length;
    if (room <= 0) {
      setError(`You can add up to ${MAX_COMMUNITY_GALLERY} photos. Remove one first.`);
      return;
    }
    try {
      setGalleryUploading(true);
      setError('');
      const photos = await uploadCommunityGallery(Array.from(files).slice(0, room));
      setGallery((current) => [...current, ...photos].slice(0, MAX_COMMUNITY_GALLERY));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to upload photos');
    } finally {
      setGalleryUploading(false);
    }
  }

  if (loading) return <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">Loading...</div>;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800"><div><p className="text-xs font-medium text-slate-500">Community</p><h1 className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">Edit community</h1></div><Button variant="ghost" onClick={()=>router.push(communityHref)}>Back to communities</Button></div>
      {error ? <p role="alert" className="mb-5 rounded-lg bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p> : null}
      <div className="grid items-start gap-8 lg:grid-cols-[380px_minmax(0,1fr)] lg:gap-12">
        <div className="space-y-3 lg:sticky lg:top-6"><button type="button" onClick={()=>setPanel(1)} className="relative grid aspect-square w-full place-items-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-800 dark:bg-slate-900">{coverImagePreview && !coverPreviewBroken ? <img src={coverImagePreview} alt="Community cover" className="h-full w-full object-cover" onError={()=>setCoverPreviewBroken(true)}/> : logoPreview && !logoPreviewBroken ? <img src={logoPreview} alt="Community logo" className="h-28 w-28 rounded-xl object-cover" onError={()=>setLogoPreviewBroken(true)}/> : <><GeneratedCover seed={form.name} type="COMMUNITY" label={form.category || "Community"} className="absolute inset-0"/><span className="absolute left-3 top-3 rounded-lg bg-white px-3 py-2 text-xs font-medium text-slate-900 shadow">Add community images</span></>}</button><button type="button" onClick={()=>setPanel(1)} className="text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white">Edit logo, cover & description →</button><p className="text-xs leading-5 text-slate-500 dark:text-slate-400">Use images that help students recognise your community.</p></div>
        <div className="min-w-0 space-y-6"><div className="space-y-5"><>
              <Field label="Community Name" required>
                <input className="input" value={form.name} onChange={(e) => updateField('name', e.target.value)} />
              </Field>
              <Field label="Slogan" required>
                <textarea className="input min-h-20" value={form.shortDescription} onChange={(e) => updateField('shortDescription', e.target.value)} />
              </Field>
              <Field label="Category" required>
                <input className="input" value={form.category} onChange={(e) => updateField('category', e.target.value)} />
              </Field>
            </></div><div className="rounded-xl border border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900"><EditorOption label="Images & description" value={(form.logo || logoFile)? 'Images added':'Add images'} onClick={()=>setPanel(1)}/><EditorOption label="School & chat links" value={form.university || 'Choose school'} onClick={()=>setPanel(2)}/><EditorOption label="Visibility & joining" value={form.visibility === 'PRIVATE'?'Private':'Public'} onClick={()=>setPanel(3)}/><EditorOption label="Review" value="Check community details" onClick={()=>setPanel(4)}/></div><p className="text-xs leading-5 text-slate-500 dark:text-slate-400">Open only the settings you need. Required details are checked before saving.</p></div>
      </div>
      <div className="sticky bottom-0 z-30 mt-8 flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 bg-[var(--page-surface)] py-4 pr-20 [padding-bottom:max(1rem,env(safe-area-inset-bottom))] dark:border-slate-800"><Button variant="secondary" onClick={()=>setPanel(4)}>Review details</Button><Button variant="primary" onClick={()=>void handleSubmit()} disabled={submitting || galleryUploading}>{submitting?'Saving…':'Save changes'}</Button></div>
      <EditorModal open={panel === 1} title="Images & description" onClose={()=>setPanel(null)} error={error}><>
              <Field label="Community Logo" required>
                <div className="space-y-3">
                  <input ref={logoInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const file = e.target.files?.[0] ?? null; setLogoFile(file); setLogoPreview(file ? URL.createObjectURL(file) : ''); setLogoPreviewBroken(false); }} />
                  <Button variant="secondary" type="button" onClick={() => logoInputRef.current?.click()}>{logoFile ? 'Change Logo' : 'Upload Logo'}</Button>
                  {logoPreview && !logoPreviewBroken ? <img src={logoPreview} alt="Logo preview" onError={() => setLogoPreviewBroken(true)} className="h-24 w-24 rounded-lg object-cover border border-slate-200 dark:border-slate-800" /> : null}
                  {logoPreview && logoPreviewBroken ? <p className="text-sm text-slate-500 dark:text-slate-400">Could not load logo preview. Please upload a different image.</p> : null}
                </div>
              </Field>
              <Field label="Cover Image (Optional)">
                <div className="space-y-3">
                  <input ref={coverInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const file = e.target.files?.[0] ?? null; setCoverImageFile(file); setCoverImagePreview(file ? URL.createObjectURL(file) : ''); setCoverPreviewBroken(false); }} />
                  <Button variant="secondary" type="button" onClick={() => coverInputRef.current?.click()}>{coverImageFile ? 'Change Cover Image' : 'Upload Cover Image'}</Button>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Recommended cover: <span className="font-semibold">1600 × 440 px</span> (about 3.6:1) for the best fit.</p>
                  {coverImagePreview && !coverPreviewBroken ? <img src={coverImagePreview} alt="Cover preview" onError={() => setCoverPreviewBroken(true)} className="aspect-[40/11] w-full rounded-lg border border-slate-200 object-cover dark:border-slate-800" /> : null}
                  {!coverImagePreview ? <p className="text-sm text-slate-500 dark:text-slate-400">Optional</p> : null}
                  {coverImagePreview && coverPreviewBroken ? <p className="text-sm text-slate-500 dark:text-slate-400">Could not load cover preview. Please upload a different image.</p> : null}
                </div>
              </Field>
              <Field label="Description" required>
                <textarea className="input min-h-28" value={form.description ?? ''} onChange={(e) => updateField('description', e.target.value)} />
              </Field>
              <Field label={`Photos (Optional, up to ${MAX_COMMUNITY_GALLERY})`}>
                <div className="space-y-3">
                  <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={galleryUploading} onChange={(e) => { void handleGalleryFiles(e.target.files); e.target.value = ''; }} className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-xl file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-indigo-700 dark:text-slate-400 dark:file:bg-indigo-500/15 dark:file:text-indigo-300" />
                  <p className="text-xs text-slate-500 dark:text-slate-400">Meetups, flyers, your team. They play as a slideshow on your community page. Recommended: <span className="font-semibold">1080 × 1350 px</span> (4:5 portrait) so every slide fills the frame.</p>
                  {galleryUploading ? <p className="text-sm text-slate-500 dark:text-slate-400">Uploading…</p> : null}
                  {gallery.length ? (
                    <div className="flex flex-wrap gap-2">
                      {gallery.map((img, i) => (
                        <div key={img} className="relative">
                          <img src={resolveAvatarUrl(img)} alt={`Photo ${i + 1}`} className="h-20 w-16 rounded-xl border border-slate-200 object-cover dark:border-slate-800" />
                          <button type="button" onClick={() => setGallery((current) => current.filter((g) => g !== img))} className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-rose-600 text-[11px] font-bold text-white shadow" aria-label={`Remove photo ${i + 1}`}>×</button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </Field>
            </></EditorModal>
<EditorModal open={panel === 2} title="School & chat links" onClose={()=>setPanel(null)} error={error}><>
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
                  WhatsApp, Discord, Telegram, Slack, or any other https:// link. Keep at least one so members can reach you.
                </p>
              </Field>
              <Field label="Channel link (Optional)">
                <input className="input" placeholder="https://whatsapp.com/channel/… or Telegram/Discord" value={form.channelLink ?? ''} onChange={(e) => updateField('channelLink', e.target.value)} />
              </Field>
            </></EditorModal>
<EditorModal open={panel === 3} title="Visibility & rules" onClose={()=>setPanel(null)} error={error}><>
            <Field label="Visibility" as="div">
              <div className="grid gap-3 sm:grid-cols-2">
                {(['PUBLIC', 'PRIVATE'] as const).map((value) => (
                  <label key={value} className={`cursor-pointer rounded-lg border p-4 transition ${form.visibility === value ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-500/15' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'}`}>
                    <input type="radio" name="visibility" className="mr-2" checked={form.visibility === value} onChange={() => updateField('visibility', value)} />
                    <span className="font-medium text-slate-900 dark:text-slate-100">{value === 'PUBLIC' ? 'Public Community' : 'Private Community'}</span>
                  </label>
                ))}
              </div>
              {form.visibility === 'PUBLIC' ? (
                <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
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
            </></EditorModal>
<EditorModal open={panel === 4} title="Review" onClose={()=>setPanel(null)} error={error}><div className="space-y-4">
              <SummaryRow label="Name" value={form.name} />
              <SummaryRow label="Category" value={form.category} />
              <SummaryRow label="University" value={form.university} />
              <SummaryRow label="Visibility" value={form.visibility} />
              <SummaryRow label="Verification" value={verificationStatus} />
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
  return <Wrapper className="block space-y-2"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label} {required ? <span className="text-rose-500">*</span> : null}</span>{children}</Wrapper>;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3"><span className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</span><span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{value || 'Not set'}</span></div>;
}