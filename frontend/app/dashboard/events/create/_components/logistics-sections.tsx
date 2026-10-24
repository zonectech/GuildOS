'use client';

import { useState } from 'react';

import { SelectMenu } from '../../../../../components/guildos/ui/select-menu';
import { Section, Field, Toggle } from '../../../../../components/guildos/events/event-form-ui';
import { NIGERIAN_STATES, resolveEventImageUrl, uploadEventMedia, type EventInput } from '../../../../../components/guildos/event-api';
import { DASHED_ADD_BUTTON, REMOVE_LINK, type SectionProps } from './form-model';

const FILE_INPUT = 'text-xs text-slate-600 dark:text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-200 dark:file:bg-slate-800 dark:file:text-slate-300 dark:hover:file:bg-slate-700';
const MAX_GALLERY = 6;

export function LocationSection({ form, update }: SectionProps) {
  const showVenue = form.mode === 'PHYSICAL' || form.mode === 'HYBRID';
  const showLink = form.mode === 'VIRTUAL' || form.mode === 'HYBRID';

  return (
    <Section title="Location">
      <Field label="Mode">
        <SelectMenu
          aria-label="Event mode"
          value={form.mode ?? 'PHYSICAL'}
          onChange={(v) => update('mode', v as EventInput['mode'])}
          options={['PHYSICAL', 'HYBRID', 'VIRTUAL'].map((m) => ({ value: m, label: m }))}
        />
      </Field>
      {form.mode === 'HYBRID' ? (
        <p className="rounded-xl bg-indigo-50 px-3 py-2 text-xs text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">Hybrid events need <strong>both</strong> a physical venue and an online meeting link so every attendee knows where to go.</p>
      ) : null}
      {showVenue ? (
        <>
          <Field label={form.mode === 'HYBRID' ? 'Venue Name (required)' : 'Venue Name'}><input className="ev-input" value={form.venue ?? ''} onChange={(e) => update('venue', e.target.value)} /></Field>
          <Field label="Address"><input className="ev-input" value={form.address ?? ''} onChange={(e) => update('address', e.target.value)} /></Field>
          <Field label="State">
            <SelectMenu
              aria-label="State"
              value={form.state ?? ''}
              onChange={(v) => update('state', v)}
              options={[{ value: '', label: 'Not set' }, ...NIGERIAN_STATES.map((s) => ({ value: s, label: s }))]}
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Helps students nearby find this event. It powers the state filter on the Discover page.</p>
          </Field>
          <Toggle label="Refreshments will be provided (Item 7)" checked={Boolean(form.refreshments)} onChange={(v) => update('refreshments', v)} />
        </>
      ) : null}
      {showLink ? (
        <Field label={form.mode === 'HYBRID' ? 'Meeting Link (required)' : 'Meeting Link'}><input className="ev-input" placeholder="Zoom / Teams / Google Meet link" value={form.meetingLink ?? ''} onChange={(e) => update('meetingLink', e.target.value)} /></Field>
      ) : null}
    </Section>
  );
}

export function ContactsSection({ form, update }: SectionProps) {
  const contacts = form.contacts ?? [];
  const patchContact = (index: number, patch: Partial<(typeof contacts)[number]>) =>
    update('contacts', contacts.map((c, i) => (i === index ? { ...c, ...patch } : c)));

  return (
    <Section title="Contact persons">
      <p className="text-xs text-slate-500 dark:text-slate-400">Shown on the event page so attendees can reach the organizers (up to 3). Each contact needs a phone or email.</p>
      {contacts.map((contact, index) => (
        <div key={index} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Name"><input className="ev-input" placeholder="e.g. Amina Bello" value={contact.name} onChange={(e) => patchContact(index, { name: e.target.value.slice(0, 60) })} /></Field>
            <Field label="Phone / WhatsApp"><input className="ev-input" placeholder="e.g. 0803 123 4567" value={contact.phone} onChange={(e) => patchContact(index, { phone: e.target.value.slice(0, 30) })} /></Field>
            <Field label="Email"><input className="ev-input" placeholder="e.g. events@club.org" value={contact.email} onChange={(e) => patchContact(index, { email: e.target.value.slice(0, 120) })} /></Field>
          </div>
          <div className="mt-2 flex items-center justify-between">
            {contact.name && !contact.phone && !contact.email ? (
              <span className="text-xs font-medium text-rose-600">Add a phone or email. Contacts without one aren’t saved.</span>
            ) : <span />}
            <button type="button" className={REMOVE_LINK} onClick={() => update('contacts', contacts.filter((_, i) => i !== index))}>Remove</button>
          </div>
        </div>
      ))}
      {contacts.length < 3 ? (
        <button type="button" className={DASHED_ADD_BUTTON} onClick={() => update('contacts', [...contacts, { name: '', phone: '', email: '' }])}>
          + Add contact person
        </button>
      ) : null}
    </Section>
  );
}

export function CapacitySection({ form, update }: SectionProps) {
  return (
    <Section title="Capacity">
      <Field label="Maximum Participants (0 = unlimited)"><input type="number" className="ev-input" value={form.capacity ?? 0} onChange={(e) => update('capacity', Number(e.target.value))} /></Field>
      <Toggle label="Enable waitlist" checked={Boolean(form.waitlistEnabled)} onChange={(v) => update('waitlistEnabled', v)} />
    </Section>
  );
}

/** Banner (required to publish) + up to 6 flyers/photos for the event-page slideshow. */
export function MediaSection({ form, update, onError }: SectionProps & { onError: (message: string) => void }) {
  const [uploading, setUploading] = useState(false);
  // Measured from the uploaded banner; anything far from 2:1 gets cropped on every card.
  const [bannerRatio, setBannerRatio] = useState<number | null>(null);
  const gallery = form.gallery ?? [];

  async function upload(fd: FormData, fallbackError: string, apply: (uploaded: Awaited<ReturnType<typeof uploadEventMedia>>) => void) {
    try {
      setUploading(true);
      onError('');
      apply(await uploadEventMedia(fd));
    } catch (err) {
      onError(err instanceof Error ? err.message : fallbackError);
    } finally {
      setUploading(false);
    }
  }

  function handleBannerUpload(file: File | null) {
    if (!file) return;
    const fd = new FormData();
    fd.append('banner', file);
    void upload(fd, 'Unable to upload banner', (uploaded) => update('bannerImage', uploaded.banner));
  }

  function handleGalleryUpload(files: FileList | null) {
    if (!files?.length) return;
    const room = MAX_GALLERY - gallery.length;
    if (room <= 0) {
      onError(`You can add up to ${MAX_GALLERY} gallery images. Remove one first.`);
      return;
    }
    const fd = new FormData();
    Array.from(files).slice(0, room).forEach((file) => fd.append('gallery', file));
    void upload(fd, 'Unable to upload gallery images', (uploaded) => update('gallery', [...gallery, ...uploaded.gallery].slice(0, MAX_GALLERY)));
  }

  return (
    <Section title="Media">
      <Field label="Event Banner (required to publish)">
        <input type="file" accept="image/*" onChange={(e) => handleBannerUpload(e.target.files?.[0] ?? null)} className={FILE_INPUT} />
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Recommended size: <span className="font-semibold">1600 × 800 px</span> (2:1 landscape) · JPG or PNG · up to 5 MB. The preview below shows exactly how it will be cropped on the event page.</p>
        {uploading ? <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Uploading…</p> : null}
        {form.bannerImage && bannerRatio !== null && Math.abs(bannerRatio - 2) > 0.25 ? (
          <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            This image is {bannerRatio < 2 ? 'taller' : 'wider'} than 2:1, so parts of it will be cut off on event cards. For the best result, upload a 1600 × 800 px banner.
          </p>
        ) : null}
        {form.bannerImage ? <img src={resolveEventImageUrl(form.bannerImage)} alt="Banner" onLoad={(e) => setBannerRatio(e.currentTarget.naturalWidth / Math.max(1, e.currentTarget.naturalHeight))} className="mt-3 aspect-[2/1] w-full rounded-2xl object-cover" /> : null}
      </Field>
      <Field label="Flyers & photos (optional, up to 6)" as="div">
        <input type="file" accept="image/*" multiple onChange={(e) => { handleGalleryUpload(e.target.files); e.target.value = ''; }} className={FILE_INPUT} />
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Event flyers, speaker cards, past-edition photos, shown as a slideshow on the event page. Recommended: <span className="font-semibold">1080 × 1350 px</span> (4:5 portrait, the usual flyer size), so every slide fills the frame.</p>
        {gallery.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {gallery.map((img, i) => (
              <div key={img} className="relative">
                <img src={resolveEventImageUrl(img)} alt={`Gallery ${i + 1}`} className="h-20 w-20 rounded-xl border border-slate-200 dark:border-slate-800 object-cover" />
                <button
                  type="button"
                  onClick={() => update('gallery', gallery.filter((g) => g !== img))}
                  className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-rose-600 text-[11px] font-bold text-white shadow"
                  title="Remove image"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </Field>
    </Section>
  );
}
