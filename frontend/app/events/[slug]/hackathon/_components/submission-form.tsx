'use client';

import { useState } from 'react';
import { ImagePlus, Rocket, X } from 'lucide-react';

import { resolveEventImageUrl, uploadEventMedia } from '../../../../../components/guildos/event-api';
import { saveHackathonSubmission, type HackathonHub } from '../../../../../components/guildos/hackathon-api';
import { CARD, INPUT, PRIMARY_BUTTON } from '../../../../../components/guildos/hackathon/hackathon-ui';

const MAX_IMAGES = 6;

/** The team's project — any member can create or edit it while submissions are open. */
export function SubmissionForm({ hub, onSaved, onError }: { hub: HackathonHub; onSaved: () => Promise<void>; onError: (message: string) => void }) {
  const { event, settings, viewer } = hub;
  const existing = viewer.submission;
  const [form, setForm] = useState({
    title: existing?.title ?? '',
    tagline: existing?.tagline ?? '',
    description: existing?.description ?? '',
    repoUrl: existing?.repoUrl ?? '',
    demoUrl: existing?.demoUrl ?? '',
    videoUrl: existing?.videoUrl ?? '',
  });
  const [techText, setTechText] = useState((existing?.techStack ?? []).join(', '));
  const [images, setImages] = useState<string[]>(existing?.images ?? []);
  const [trackKeys, setTrackKeys] = useState<string[]>(existing?.trackKeys ?? []);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);

  const team = viewer.team;
  if (!team) return null;
  const tooSmall = team.members.length < settings.teamSizeMin;
  const locked = !settings.submissionsOpen;
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setSaved(false);
  };

  async function handleImages(files: FileList | null) {
    if (!files?.length) return;
    const room = MAX_IMAGES - images.length;
    if (room <= 0) return onError(`Up to ${MAX_IMAGES} screenshots`);
    try {
      setUploading(true);
      const fd = new FormData();
      Array.from(files).slice(0, room).forEach((file) => fd.append('gallery', file));
      const uploaded = await uploadEventMedia(fd);
      setImages((current) => [...current, ...(uploaded.gallery ?? [])].slice(0, MAX_IMAGES));
      setSaved(false);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unable to upload screenshots');
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      setBusy(true);
      onError('');
      await saveHackathonSubmission(event.id, {
        ...form,
        images,
        trackKeys,
        techStack: techText.split(',').map((t) => t.trim()).filter(Boolean),
      });
      setSaved(true);
      await onSaved();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unable to save your project');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className={CARD}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100">
          <Rocket className="h-4 w-4 text-indigo-500" /> {existing ? 'Your project' : 'Submit your project'}
        </h2>
        {existing && <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">Submitted · visible in the gallery</span>}
      </div>
      {locked && <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">{settings.submissionsClosedReason}</p>}
      {!locked && tooSmall && <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">Teams need at least {settings.teamSizeMin} members to submit.</p>}

      <fieldset disabled={locked || busy} className="mt-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">Project name *
            <input className={`mt-1 ${INPUT}`} maxLength={100} value={form.title} onChange={set('title')} placeholder="e.g. FarmLink" />
          </label>
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">One-line pitch
            <input className={`mt-1 ${INPUT}`} maxLength={160} value={form.tagline} onChange={set('tagline')} placeholder="Connecting farmers to buyers by SMS" />
          </label>
        </div>
        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">What it does, how you built it, what's next
          <textarea className={`mt-1 min-h-32 ${INPUT}`} maxLength={5000} value={form.description} onChange={set('description')} />
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">Code repository
            <input className={`mt-1 ${INPUT}`} type="url" value={form.repoUrl} onChange={set('repoUrl')} placeholder="https://github.com/…" />
          </label>
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">Live demo
            <input className={`mt-1 ${INPUT}`} type="url" value={form.demoUrl} onChange={set('demoUrl')} placeholder="https://…" />
          </label>
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">Demo video
            <input className={`mt-1 ${INPUT}`} type="url" value={form.videoUrl} onChange={set('videoUrl')} placeholder="YouTube / Loom link" />
          </label>
        </div>
        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">Built with (comma separated)
          <input className={`mt-1 ${INPUT}`} value={techText} onChange={(e) => { setTechText(e.target.value); setSaved(false); }} placeholder="React, Node.js, Firebase" />
        </label>

        {settings.tracks.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">Prize tracks you're entering</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {settings.tracks.map((t) => {
                const on = trackKeys.includes(t.key);
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => { setTrackKeys((keys) => (on ? keys.filter((k) => k !== t.key) : [...keys, t.key])); setSaved(false); }}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${on ? 'border-violet-400 bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300' : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-400'}`}
                  >
                    {on ? '✓ ' : ''}{t.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">Screenshots (up to {MAX_IMAGES})</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {images.map((src) => (
              <div key={src} className="relative">
                <img src={resolveEventImageUrl(src)} alt="" className="h-20 w-32 rounded-xl border border-slate-200 object-cover dark:border-slate-700" />
                <button type="button" aria-label="Remove screenshot" onClick={() => { setImages((list) => list.filter((s) => s !== src)); setSaved(false); }} className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-rose-600 text-white shadow">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {images.length < MAX_IMAGES && (
              <label className="grid h-20 w-32 cursor-pointer place-items-center rounded-xl border-2 border-dashed border-slate-200 text-slate-400 transition hover:border-indigo-300 hover:text-indigo-500 dark:border-slate-700">
                {uploading ? <span className="text-xs">Uploading…</span> : <ImagePlus className="h-5 w-5" />}
                <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { void handleImages(e.target.files); e.target.value = ''; }} />
              </label>
            )}
          </div>
        </div>
      </fieldset>

      {!locked && (
        <div className="mt-4 flex items-center gap-3">
          <button type="submit" disabled={busy || uploading || tooSmall || !form.title.trim()} className={PRIMARY_BUTTON}>
            {busy ? 'Saving…' : existing ? 'Save changes' : 'Submit project'}
          </button>
          {saved && <span className="text-xs font-medium text-emerald-600">Saved</span>}
        </div>
      )}
    </form>
  );
}
