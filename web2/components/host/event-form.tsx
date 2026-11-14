'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as m from 'motion/react-m';
import { AnimatePresence } from 'motion/react';
import { ArrowLeft, ArrowRight, Award, CalendarClock, Check, Copy, Eye, ImagePlus, Link2, MapPin, Share2, Sparkles, Ticket, Video, X } from 'lucide-react';
import type { Event } from '@/lib/api/types';
import { createDraft, EVENT_TYPES, emptyDraft, importLink, publishEvent, saveDraft, uploadCover, type EventDraft, type HostEvent } from '@/lib/api/host';
import { canManage, myMemberships, type MyMembership } from '@/lib/api/communities';
import { ApiError, mediaUrl } from '@/lib/api/client';
import { typeStyle } from '@/lib/events';
import { spring } from '@/lib/motion';
import { useSession } from '@/lib/session';
import { StepFlow } from '@/components/flow/step-flow';
import { Celebration } from '@/components/celebrate/celebration';
import { SealText, Stamp } from '@/components/brand/stamp';
import { EventCard } from '@/components/events/event-card';
import { CommunityLogo } from '@/components/communities/bits';
import { Btn } from '@/components/ui/bits';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { Opt, Req, RequiredNote } from '@/components/ui/req';

const STEPS = ['Basics', 'How students join', 'Certificate', 'Preview'];
const field = 'w-full rounded-2xl border border-line bg-surface px-4 py-3 text-[15.5px] outline-none transition-colors focus:border-green-text';
const label = 'text-[14px] font-semibold';
/** Africa/Lagos is UTC+1 all year (no daylight saving), so the conversion is a fixed offset. */
const toLagosInput = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + 3600_000).toISOString().slice(0, 16) : '');
const fromLagosInput = (v: string) => (v ? new Date(`${v}:00+01:00`).toISOString() : '');
const typeLabel = (t: string) => typeStyle(t).label;

/** The preview card is the real event card, fed by the form as you type. */
function previewEvent(d: EventDraft, c: MyMembership | undefined, cover: string): Event {
  return {
    id: 'preview', slug: 'preview', title: d.title || 'Your event title', type: d.type === 'OTHER' && d.typeLabel.trim() ? d.typeLabel.trim() : d.type, status: 'PUBLISHED', mode: d.mode, summary: d.shortDescription, description: d.description,
    cover, startDate: d.startDate, endDate: d.endDate, timezone: d.timezone, venue: d.mode === 'VIRTUAL' ? '' : d.venue, state: '',
    community: { id: c?.communityId ?? '', name: c?.name ?? 'Your community', slug: c?.slug ?? '', logo: c?.logo ?? '', verified: true },
    goingCount: 0, checkedInCount: 0, attendedCount: 0, capacity: d.capacity, certificate: d.certificateEnabled && d.attendanceSource === 'GUILDOS' ? 'AFTER_EVENT' : 'NONE',
    cancellationReason: '', registrationPolicy: 'OPEN', registrationClosed: false, registrationDeadline: d.registrationDeadline,
    externalRegistration: d.attendanceSource === 'EXTERNAL' && d.partnerRegistrationUrl ? { url: d.partnerRegistrationUrl, label: d.partnerRegistrationLabel || 'the partner site' } : null, multiDay: false, external: d.attendanceSource === 'EXTERNAL', finalized: false, finalizesAt: null,
  };
}

type Save = { state: 'idle' | 'saving' | 'saved' | 'error'; at: number; message?: string };

/**
 * Create or edit an event. Feels like editing the real event page: the live card beside the form
 * (a Preview button on phones). Drafts autosave a moment after you stop typing.
 */
export function EventForm({ existing }: { existing?: HostEvent & { community: { id: string; name: string; slug: string; logo: string } | null } }) {
  const router = useRouter();
  const toast = useToast();
  const { user, loading } = useSession();
  const [led, setLed] = useState<MyMembership[] | null>(null);
  const [communityId, setCommunityId] = useState(existing?.communityId ?? '');
  const [draft, setDraft] = useState<EventDraft>(existing?.draft ?? emptyDraft());
  const [ev, setEv] = useState<HostEvent | null>(existing ?? null);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [save, setSave] = useState<Save>({ state: existing ? 'saved' : 'idle', at: Date.now() });
  const [now, setNow] = useState(Date.now());
  const [showPreview, setShowPreview] = useState(false);
  const [published, setPublished] = useState<HostEvent | null>(null);
  const [busy, setBusy] = useState(false);
  const dirty = useRef(false);
  const latest = useRef(draft);
  latest.current = draft;
  const published0 = Boolean(existing && existing.status !== 'DRAFT');

  useEffect(() => { if (!loading && !user) router.replace(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`); }, [loading, user, router]);
  useEffect(() => {
    if (!user) return;
    myMemberships(user.id).then((ms) => {
      const mine = ms.filter((x) => canManage(x.role));
      setLed(mine);
      const want = new URLSearchParams(window.location.search).get('community');
      setCommunityId((cur) => cur || mine.find((x) => x.slug === want)?.communityId || mine[0]?.communityId || '');
    }).catch(() => setLed([]));
  }, [user]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(t); }, []);

  const community = led?.find((x) => x.communityId === communityId) ?? (existing?.community ? { communityId: existing.community.id, name: existing.community.name, slug: existing.community.slug, logo: existing.community.logo, role: '', membershipId: '' } : undefined);
  const set = <K extends keyof EventDraft>(k: K, v: EventDraft[K]) => { dirty.current = true; setDraft((d) => ({ ...d, [k]: v })); };

  /* Autosave: a draft is created once there is a title, then patched 1.2 s after the last change. */
  const persist = useCallback(async (d: EventDraft) => {
    if (!communityId || d.title.trim().length < 3) return;
    setSave({ state: 'saving', at: Date.now() });
    try {
      const body = { ...d, shortDescription: d.shortDescription || d.description.slice(0, 240) };
      const next = ev ? await saveDraft(ev.id, body) : await createDraft(communityId, body);
      if (!ev) window.history.replaceState(null, '', `/events/${next.slug}/edit`);
      setEv(next);
      setSave({ state: 'saved', at: Date.now() });
    } catch (e) {
      // New events are limited to one a minute per organizer: wait, then save again by itself.
      if (e instanceof ApiError && e.status === 429) {
        setSave({ state: 'error', at: Date.now(), message: 'saving again in a minute (one new event a minute)' });
        setTimeout(() => { dirty.current = false; void persistRef.current(latest.current); }, 61_000);
        return;
      }
      setSave({ state: 'error', at: Date.now(), message: e instanceof Error ? e.message : 'Not saved' });
    }
  }, [communityId, ev]);
  const persistRef = useRef(persist);
  persistRef.current = persist;
  useEffect(() => {
    if (!dirty.current || published0) return;
    const t = setTimeout(() => { dirty.current = false; void persist(draft); }, 1200);
    return () => clearTimeout(t);
  }, [draft, persist, published0]);

  const cover = mediaUrl(draft.bannerImage);
  const preview = useMemo(() => previewEvent(draft, community, cover), [draft, community, cover]);
  const go = (n: number) => { setDir(n > step ? 1 : -1); setStep(n); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const problems = [
    draft.title.trim().length < 3 ? 'Add a title' : '',
    draft.type === 'OTHER' && draft.typeLabel.trim().length < 2 ? 'Type what kind of event it is' : '',
    draft.description.trim().length < 20 ? 'Write a description (a few sentences)' : '',
    new Date(draft.endDate) <= new Date(draft.startDate) ? 'The end must be after the start' : '',
    new Date(draft.startDate).getTime() < Date.now() ? 'Pick a start time in the future' : '',
    draft.mode !== 'VIRTUAL' && !draft.venue.trim() ? 'Add the venue' : '',
    draft.mode !== 'PHYSICAL' && !draft.meetingLink.trim() ? 'Add the online link' : '',
    draft.attendanceSource === 'EXTERNAL' && !/^https:\/\//.test(draft.partnerRegistrationUrl) ? 'Add the official registration link (https://)' : '',
  ].filter(Boolean);

  async function publish() {
    setBusy(true);
    try {
      dirty.current = false;
      const body = { ...draft, shortDescription: draft.shortDescription || draft.description.slice(0, 240) };
      const saved = ev ? await saveDraft(ev.id, body) : await createDraft(communityId, body);
      const done = published0 ? saved : await publishEvent(saved.id);
      setEv(done);
      if (published0) { toast('Changes saved'); router.push(`/events/${done.slug}/manage`); return; }
      setPublished(done);
    } catch (e) { toast(e instanceof Error ? e.message : 'Unable to publish'); }
    finally { setBusy(false); }
  }

  if (!user || led === null) return <div className="mx-auto max-w-[1200px] px-4 pt-10"><div className="shimmer h-[420px] rounded-[28px]" /></div>;
  if (!existing && !led.length) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-6 py-24 text-center">
        <Stamp state="empty" size={120} />
        <h1 className="text-[30px] font-extrabold">Events are run by communities</h1>
        <p className="text-muted">Lead or help run a verified community to create events. Start one, or ask your club&apos;s Owner to make you an Admin.</p>
        <Btn href="/communities/request">Start a community</Btn>
      </div>
    );
  }

  const saveLabel = save.state === 'saving' ? 'Saving…' : save.state === 'error' ? `Not saved: ${save.message}` : save.state === 'saved' ? `Saved · ${now - save.at < 45000 ? 'just now' : `${Math.round((now - save.at) / 60000)} min ago`}` : draft.title.trim().length < 3 ? 'Add a title to save a draft' : '';

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-4 pt-6 pb-28 sm:px-6 lg:px-8 lg:pt-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={ev && published0 ? `/events/${ev.slug}/manage` : community ? `/communities/${community.slug}/manage?tab=events` : '/events'} className="inline-flex items-center gap-1.5 text-[14.5px] font-semibold text-muted hover:text-ink"><ArrowLeft size={17} />{published0 ? 'Event workspace' : 'Back'}</Link>
        <span aria-live="polite" className={`inline-flex items-center gap-1.5 text-[13px] font-semibold ${save.state === 'error' ? 'text-coral-text' : 'text-muted'}`}>
          {save.state === 'saved' ? <m.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={spring.bouncy}><Check size={14} className="text-green-text" /></m.span> : null}{saveLabel}
        </span>
      </div>
      <h1 className="text-[34px] font-extrabold sm:text-[42px]">{existing ? (published0 ? 'Edit event' : 'Finish your draft') : 'Create an event'}</h1>
      <RequiredNote className="-mt-4" />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0">
          <StepFlow steps={STEPS} current={step} direction={dir}>
            {step === 0 ? (
              <div className="flex flex-col gap-5">
                {led.length > 1 && !existing ? (
                  <div className="flex flex-col gap-2"><span className={label}>Hosted by<Req /></span>
                    <div className="flex flex-wrap gap-2">{led.map((c) => (
                      <button key={c.communityId} type="button" onClick={() => setCommunityId(c.communityId)} aria-pressed={communityId === c.communityId} className={`flex items-center gap-2 rounded-2xl border-2 py-1.5 pr-3.5 pl-1.5 text-[14px] font-semibold ${communityId === c.communityId ? 'border-green-text bg-tint' : 'border-line'}`}><CommunityLogo c={c} size={28} />{c.name}</button>
                    ))}</div>
                  </div>
                ) : null}
                {!existing ? <ImportBox communityId={communityId} onImport={(d) => { dirty.current = true; setDraft((cur) => ({ ...cur, ...Object.fromEntries(Object.entries(d).filter(([, v]) => v !== undefined && v !== '' && v !== null)), attendanceSource: d.partnerRegistrationUrl ? 'EXTERNAL' : cur.attendanceSource })); }} /> : null}
                <label className="flex flex-col gap-1.5"><span className={label}>Title<Req /></span><input className={`${field} text-[20px] font-bold`} value={draft.title} maxLength={120} onChange={(e) => set('title', e.target.value)} placeholder="Intro to Machine Learning" /></label>
                <CoverPicker draft={draft} onUpload={(p) => set('bannerImage', p)} onClear={() => set('bannerImage', '')} onType={(t) => set('type', t)} />
                {draft.type === 'OTHER' ? <input autoFocus className={field} value={draft.typeLabel} maxLength={40} onChange={(e) => set('typeLabel', e.target.value)} placeholder="What kind of event is it? e.g. Career fair" aria-label="Event type" /> : null}
                <label className="flex flex-col gap-1.5"><span className={label}>Description<Req /></span><textarea className={`${field} min-h-[150px]`} value={draft.description} maxLength={8000} onChange={(e) => set('description', e.target.value)} placeholder="What will students do and learn? Who is it for? What should they bring?" /></label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5"><span className={label}>Starts<Req /></span><input type="datetime-local" className={field} value={toLagosInput(draft.startDate)} onChange={(e) => { const s = fromLagosInput(e.target.value); if (!s) return; const len = new Date(draft.endDate).getTime() - new Date(draft.startDate).getTime(); dirty.current = true; setDraft((d) => ({ ...d, startDate: s, endDate: new Date(new Date(s).getTime() + Math.max(len, 3600_000)).toISOString() })); }} /></label>
                  <label className="flex flex-col gap-1.5"><span className={label}>Ends<Req /></span><input type="datetime-local" className={field} value={toLagosInput(draft.endDate)} onChange={(e) => { const s = fromLagosInput(e.target.value); if (s) set('endDate', s); }} /></label>
                </div>
                <p className="-mt-2 flex items-center gap-1.5 text-[12.5px] text-muted"><CalendarClock size={14} />Times are in Lagos time (WAT).</p>
                <div className="flex flex-col gap-2"><span className={label}>Where<Req /></span>
                  <div role="radiogroup" aria-label="Where" className="grid grid-cols-3 gap-2">
                    {([['PHYSICAL', 'In person', MapPin], ['VIRTUAL', 'Online', Video], ['HYBRID', 'Both', Sparkles]] as const).map(([v, t, Icon]) => (
                      <button key={v} type="button" role="radio" aria-checked={draft.mode === v} onClick={() => set('mode', v)} className={`flex flex-col items-center gap-1 rounded-2xl border-2 p-3 text-[14px] font-semibold ${draft.mode === v ? 'border-green-text bg-tint' : 'border-line'}`}><Icon size={18} />{t}</button>
                    ))}
                  </div>
                  {draft.mode !== 'VIRTUAL' ? <input className={field} value={draft.venue} onChange={(e) => set('venue', e.target.value)} placeholder="Venue, e.g. LT 2, Faculty of Engineering" aria-label="Venue" /> : null}
                  {draft.mode !== 'PHYSICAL' ? <input className={field} inputMode="url" value={draft.meetingLink} onChange={(e) => set('meetingLink', e.target.value)} placeholder="Online link (shared with registered students)" aria-label="Online link" /> : null}
                </div>
              </div>
            ) : step === 1 ? (
              <JoinStep draft={draft} set={set} school={community ? '' : ''} />
            ) : step === 2 ? (
              <CertificateStep draft={draft} set={set} />
            ) : (
              <div className="flex flex-col gap-5">
                <div className="lg:hidden"><EventCard event={preview} /></div>
                <ul className="flex flex-col gap-2 rounded-[22px] border border-line bg-surface p-5 text-[14.5px]">
                  <li><b>{draft.type === 'OTHER' && draft.typeLabel.trim() ? draft.typeLabel.trim() : typeLabel(draft.type)}</b> · {draft.mode === 'PHYSICAL' ? draft.venue || 'Venue not set' : draft.mode === 'VIRTUAL' ? 'Online' : `${draft.venue || 'Venue not set'} + online`}</li>
                  <li>{draft.attendanceSource === 'EXTERNAL' ? <>Listing only: students register on <b>{draft.partnerRegistrationLabel || 'the partner site'}</b>. No OnTheRoll check-in or certificate.</> : <>Register on OnTheRoll · {draft.capacity ? `${draft.capacity} places` : 'no limit'} · {draft.audience === 'SCHOOL' ? 'my school only' : 'open to everyone'} · guest list {draft.guestListVisible ? 'visible' : 'hidden'} · {draft.qrEnabled ? `QR check-in${draft.checkOutRequired ? ' and check-out' : ''}` : 'no check-in'}</>}</li>
                  <li>{draft.certificateEnabled && draft.attendanceSource === 'GUILDOS' ? 'Platform participation certificate for eligible, finalized attendees' : 'No certificate'}</li>
                </ul>
                {problems.length && !published0 ? (
                  <div className="rounded-2xl bg-[color-mix(in_srgb,var(--gold)_22%,var(--surface))] p-4 text-[14.5px]"><b>Before you publish</b><ul className="mt-1 list-disc pl-5">{problems.map((p) => <li key={p}>{p}</li>)}</ul></div>
                ) : null}
              </div>
            )}
          </StepFlow>
          <div className="mt-8 flex items-center justify-between gap-3">
            {step > 0 ? <Btn kind="secondary" onClick={() => go(step - 1)}><ArrowLeft size={17} />Back</Btn> : <span />}
            {step < STEPS.length - 1 ? <Btn onClick={() => go(step + 1)}>Next<ArrowRight size={17} /></Btn>
              : <Btn size="lg" onClick={() => void publish()} disabled={busy || (!published0 && problems.length > 0)}>{busy ? 'Publishing…' : published0 ? 'Save changes' : 'Publish event'}</Btn>}
          </div>
        </div>

        <aside className="hidden lg:block" aria-label="Live preview">
          <div className="sticky top-8 flex flex-col gap-3">
            <p className="flex items-center gap-1.5 text-[13px] font-bold tracking-[.08em] text-muted uppercase"><Eye size={15} />Live preview</p>
            <EventCard event={preview} />
            <p className="text-[12.5px] text-muted">This is how your event appears on Events and on {community?.name ?? 'your community'}&apos;s page.</p>
          </div>
        </aside>
      </div>

      <button type="button" onClick={() => setShowPreview(true)} className="fixed right-4 bottom-[calc(84px+env(safe-area-inset-bottom))] z-30 inline-flex h-11 items-center gap-2 rounded-full bg-ink px-4 text-[14px] font-bold text-paper shadow-lift lg:hidden"><Eye size={17} />Preview</button>
      <Sheet open={showPreview} onClose={() => setShowPreview(false)} title="Preview"><div className="px-5 pb-6"><EventCard event={preview} /></div></Sheet>

      <Celebration open={Boolean(published)} onClose={() => router.push(`/events/${published?.slug}/manage`)}
      seal={<Stamp label={community?.name ?? 'Published'} center={<SealText>{"LIVE"}</SealText>} size={190} tilt={-10} />}
        title="Your event is published"
        body={<PublishedBody event={published} community={community} preview={preview} />}
        action={<Btn kind="gold" size="lg" href={published ? `/events/${published.slug}/manage` : '/events'}>Open event workspace</Btn>} />
    </div>
  );
}

/** After publishing: the card flies into the community's Upcoming list, then share options. */
function PublishedBody({ event, community, preview }: { event: HostEvent | null; community?: MyMembership; preview: Event }) {
  const toast = useToast();
  if (!event) return null;
  const url = typeof window !== 'undefined' ? `${window.location.origin}/events/${event.slug}` : '';
  return (
    <div className="flex flex-col gap-4 text-left">
      <span>It&apos;s now on Events and in {community?.name ?? 'your community'}&apos;s Upcoming list. Members who follow you get a notification.</span>
      <m.div initial={{ y: -90, scale: 0.85, rotate: -4, opacity: 0 }} animate={{ y: 0, scale: 1, rotate: 0, opacity: 1 }} transition={{ ...spring.bouncy, delay: 0.5 }} className="pointer-events-none">
        <div className="rounded-2xl border border-line bg-surface p-2 text-ink"><p className="px-2 pb-1 text-[11px] font-bold tracking-[.08em] text-muted uppercase">Upcoming · {community?.name}</p><div className="max-h-[150px] overflow-hidden rounded-xl"><EventCard event={{ ...preview, id: event.id, slug: event.slug }} /></div></div>
      </m.div>
      <div className="flex flex-wrap gap-2">
        <Btn kind="secondary" size="sm" onClick={() => void navigator.clipboard.writeText(url).then(() => toast('Link copied'))}><Copy size={15} />Copy event link</Btn>
        <Btn kind="secondary" size="sm" onClick={() => void (navigator.share ? navigator.share({ url, title: event.draft.title }).catch(() => undefined) : navigator.clipboard.writeText(url).then(() => toast('Link copied')))}><Share2 size={15} />Share</Btn>
      </div>
    </div>
  );
}

function ImportBox({ communityId, onImport }: { communityId: string; onImport: (d: Partial<EventDraft>) => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(() => new URLSearchParams(window.location.search).has('import'));
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  async function run() {
    setBusy(true);
    try { const r = await importLink(communityId, url.trim()); onImport(r.draft); setWarnings(r.warnings); toast('Imported. Check the details'); }
    catch (e) { toast(e instanceof Error ? e.message : 'Could not read that page'); }
    finally { setBusy(false); }
  }
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="inline-flex w-fit items-center gap-2 rounded-full border border-dashed border-line px-3.5 py-2 text-[13.5px] font-semibold text-muted hover:border-green-text hover:text-ink"><Link2 size={15} />Import from a Luma or Eventbrite link</button>;
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4">
      <span className={label}>Event page link</span>
      <div className="flex gap-2"><input className={field} inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://lu.ma/…" /><Btn onClick={() => void run()} disabled={busy || !/^https?:\/\//.test(url.trim())}>{busy ? 'Reading…' : 'Import'}</Btn></div>
      <p className="text-[12.5px] text-muted">We read the public page and fill in the basics. It becomes a listing that links to that page; review everything before publishing.</p>
      {warnings.length ? <ul className="list-disc pl-5 text-[12.5px] text-muted">{warnings.map((w) => <li key={w}>{w}</li>)}</ul> : null}
    </div>
  );
}

function CoverPicker({ draft, onUpload, onClear, onType }: { draft: EventDraft; onUpload: (path: string) => void; onClear: () => void; onType: (t: EventDraft['type']) => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function pick(f: File | null) {
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { toast('That image is over 5 MB'); return; }
    setBusy(true);
    try { onUpload(await uploadCover(f)); } catch (e) { toast(e instanceof Error ? e.message : 'Upload failed'); } finally { setBusy(false); }
  }
  return (
    <div className="flex flex-col gap-2">
      <span className={label}>Event type<Req /> and cover<Opt /></span>
      <div className="no-bar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {EVENT_TYPES.map((t) => {
          const st = typeStyle(t);
          return (
            <m.button key={t} type="button" whileTap={{ scale: 0.94 }} onClick={() => onType(t)} aria-pressed={draft.type === t}
              className={`flex shrink-0 items-center gap-2 rounded-full border-2 py-1 pr-3 pl-1 text-[13.5px] font-semibold ${draft.type === t ? 'border-green-text' : 'border-transparent bg-mist'}`}>
              <span className="size-6 rounded-full" style={{ background: `radial-gradient(circle at 30% 30%, ${st.accent}, ${st.bg})` }} />{st.label}
            </m.button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className={`inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-line px-3.5 py-2.5 text-[14px] font-semibold hover:bg-mist ${busy ? 'opacity-60' : ''}`}>
          <ImagePlus size={17} className="text-green-text" />{busy ? 'Uploading…' : draft.bannerImage ? 'Change photo' : 'Upload a cover photo'}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => void pick(e.target.files?.[0] ?? null)} disabled={busy} />
        </label>
        {draft.bannerImage ? <button type="button" onClick={onClear} className="inline-flex items-center gap-1 text-[13.5px] font-semibold text-muted hover:text-ink"><X size={14} />Use the {typeStyle(draft.type).label.toLowerCase()} pattern instead</button>
          : <span className="text-[12.5px] text-muted">No photo? The cover uses a pattern for the type you pick.</span>}
      </div>
    </div>
  );
}

function Toggle({ on, onChange, title, body }: { on: boolean; onChange: (v: boolean) => void; title: string; body: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="flex w-full items-center justify-between gap-4 rounded-2xl border border-line p-4 text-left hover:bg-mist">
      <span><b className="block text-[15px]">{title}</b><small className="text-[13px] text-muted">{body}</small></span>
      <span className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${on ? 'bg-green' : 'bg-line'}`}><m.span layout transition={spring.snap} className={`absolute top-1 size-5 rounded-full bg-white shadow ${on ? 'right-1' : 'left-1'}`} /></span>
    </button>
  );
}

function JoinStep({ draft, set }: { draft: EventDraft; set: <K extends keyof EventDraft>(k: K, v: EventDraft[K]) => void; school: string }) {
  const external = draft.attendanceSource === 'EXTERNAL';
  return (
    <div className="flex flex-col gap-5">
      <div role="radiogroup" aria-label="How students join" className="grid gap-2 sm:grid-cols-2">
        {([['GUILDOS', 'On OnTheRoll', 'Students register here, get a QR pass, and earn a stamp when attendance is finalized.', Ticket], ['EXTERNAL', 'External link', 'Students register on Luma, Eventbrite or another site. A listing only.', Link2]] as const).map(([v, t, s, Icon]) => (
          <button key={v} type="button" role="radio" aria-checked={draft.attendanceSource === v} onClick={() => set('attendanceSource', v)} className={`flex flex-col items-start gap-1.5 rounded-2xl border-2 p-4 text-left ${draft.attendanceSource === v ? 'border-green-text bg-tint' : 'border-line'}`}>
            <Icon size={20} className="text-green-text" /><b className="text-[15.5px]">{t}</b><small className="text-[13px] text-muted">{s}</small>
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <m.div key={draft.attendanceSource} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={spring.soft} className="flex flex-col gap-4">
          {external ? (
            <>
              <label className="flex flex-col gap-1.5"><span className={label}>Official registration link<Req /></span><input className={field} inputMode="url" value={draft.partnerRegistrationUrl} onChange={(e) => set('partnerRegistrationUrl', e.target.value)} placeholder="https://lu.ma/your-event" /></label>
              <label className="flex flex-col gap-1.5"><span className={label}>Organizer or site name<Opt /></span><input className={field} value={draft.partnerRegistrationLabel} maxLength={60} onChange={(e) => set('partnerRegistrationLabel', e.target.value)} placeholder="Luma" /></label>
              <p className="rounded-2xl bg-mist p-4 text-[14px]">This is a listing only. OnTheRoll doesn&apos;t see who registers or attends there, so the event page won&apos;t claim verified attendance, and there are no stamps or certificates. <b>Pilot:</b> after the event you can upload that site&apos;s attendance report; only people whose verified email matches are counted.</p>
            </>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5"><span className={label}>Capacity<Opt /></span><input type="number" min={0} className={field} value={draft.capacity || ''} onChange={(e) => set('capacity', Number(e.target.value) || 0)} placeholder="No limit" /></label>
                <label className="flex flex-col gap-1.5"><span className={label}>Registration closes<Opt /></span><input type="datetime-local" className={field} value={toLagosInput(draft.registrationDeadline)} onChange={(e) => set('registrationDeadline', fromLagosInput(e.target.value) || null)} /></label>
              </div>
              <div className="flex flex-col gap-2"><span className={label}>Who can attend<Req /></span>
                <div role="radiogroup" aria-label="Who can attend" className="grid grid-cols-2 gap-2">
                  {([['EVERYONE', 'Everyone'], ['SCHOOL', 'My school only']] as const).map(([v, t]) => (
                    <button key={v} type="button" role="radio" aria-checked={draft.audience === v} onClick={() => set('audience', v)} className={`rounded-2xl border-2 p-3 text-[14.5px] font-semibold ${draft.audience === v ? 'border-green-text bg-tint' : 'border-line'}`}>{t}</button>
                  ))}
                </div>
              </div>
              <Toggle on={draft.guestListVisible} onChange={(v) => set('guestListVisible', v)} title="Show the guest list" body="Attendees see who else is going. Each student can still hide themselves." />
              <Toggle on={draft.qrEnabled} onChange={(v) => set('qrEnabled', v)} title="QR check-in" body="Scan passes at the door. Attendance only counts for scanned students." />
              {draft.qrEnabled ? <Toggle on={draft.checkOutRequired} onChange={(v) => set('checkOutRequired', v)} title="Check-out too" body="Scan again when people leave, to confirm they stayed to the end." /> : null}
            </>
          )}
        </m.div>
      </AnimatePresence>
    </div>
  );
}

function CertificateStep({ draft, set }: { draft: EventDraft; set: <K extends keyof EventDraft>(k: K, v: EventDraft[K]) => void }) {
  if (draft.attendanceSource === 'EXTERNAL') return <p className="rounded-2xl bg-mist p-5 text-[15px]">External listings don&apos;t get OnTheRoll certificates, because attendance isn&apos;t verified here.</p>;
  return (
    <div className="flex flex-col gap-4">
      <div role="radiogroup" aria-label="Certificate" className="grid gap-2 sm:grid-cols-2">
        {([[true, 'Participation certificate', 'The platform’s standard certificate, with your community’s name and a verification link.'], [false, 'No certificate', 'Attendees still get their stamp.']] as const).map(([v, t, s]) => (
          <button key={t} type="button" role="radio" aria-checked={draft.certificateEnabled === v} onClick={() => set('certificateEnabled', v)} className={`flex flex-col items-start gap-1.5 rounded-2xl border-2 p-4 text-left ${draft.certificateEnabled === v ? 'border-green-text bg-tint' : 'border-line'}`}>
            {v ? <Award size={20} className="text-[var(--stamp-gold)]" /> : <X size={20} className="text-muted" />}<b className="text-[15.5px]">{t}</b><small className="text-[13px] text-muted">{s}</small>
          </button>
        ))}
      </div>
      {draft.certificateEnabled ? (
        <div className="rounded-2xl border border-line bg-surface p-5 text-[14.5px]">
          <b>Who gets one</b>
          <ul className="mt-2 flex flex-col gap-1.5">
            {[draft.qrEnabled ? 'Scanned in at the door' : 'Checked in (turn on QR check-in in the previous step)', ...(draft.qrEnabled && draft.checkOutRequired ? ['Scanned out at or after the end time'] : []), 'You finalize attendance after the event'].map((r) => <li key={r} className="flex items-start gap-2"><Check size={16} className="mt-0.5 shrink-0 text-green-text" />{r}</li>)}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
