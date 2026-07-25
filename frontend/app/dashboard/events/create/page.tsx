'use client';

import { LogoSpinner } from '../../../../components/guildos/ui/loading';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';

import { getCurrentUser } from '../../../../components/guildos/auth-api';
import {
  createEvent,
  getEvent,
  getPremiumStatus,
  startEventPremiumCheckout,
  verifyEventPremium,
  reconcileEventPayment,
  publishEvent,
  updateEvent,
  uploadEventMedia,
  resolveEventImageUrl,
  EVENT_TYPES,
  type EventInput,
  type EventDraft,
  type EventSpeaker,
  type EventSponsor,
} from '../../../../components/guildos/event-api';
import { DashboardShell } from '../../../../components/guildos/dashboard-shell';
import { DashboardSidebar } from '../../../../components/guildos/dashboard-sidebar';
import { DashboardTopbar } from '../../../../components/guildos/dashboard-topbar';
import { MarkdownTextarea } from '../../../../components/guildos/ui/markdown-textarea';
import { navigateBack } from '../../../../components/guildos/back-navigation';
import { Button } from '../../../../components/guildos/ui/button';
import { SectionHeader } from '../../../../components/guildos/ui/section-header';
import { Section, Field, Toggle } from '../../../../components/guildos/events/event-form-ui';
import { AiEventAssistant } from '../../../../components/guildos/events/ai-event-assistant';
import { CertificateDesigner } from '../../../../components/guildos/events/certificate-designer';
import { SpeakersSponsorsEditor } from '../../../../components/guildos/events/speakers-sponsors-editor';
import { SponsorshipEditor } from '../../../../components/guildos/events/sponsorship-editor';
import { PartnershipEditor } from '../../../../components/guildos/events/partnership-editor';

const DEFAULT_PLACEMENT = { x: 50, y: 55, fontSize: 6, color: '#111111', align: 'center' as const };
const DEFAULT_THEME = { accent: '#b8933a', background: 'IVORY' as const, font: 'SERIF' as const };
const DEFAULT_CONTENT = { title: '', presentation: '', message: '', signatories: [] as { name: string; title: string; image: string }[], logo: '', logoPlacement: 'NONE' as const };

const emptyForm: EventInput = {
  title: '',
  type: 'WORKSHOP',
  shortDescription: '',
  description: '',
  theme: '',
  features: [],
  days: [],
  minimumAttendanceDays: 0,
  contacts: [],
  bannerImage: '',
  mode: 'PHYSICAL',
  venue: '',
  address: '',
  meetingLink: '',
  startDate: null,
  endDate: null,
  timezone: '',
  registrationPolicy: 'OPEN',
  registrationDeadline: null,
  capacity: 0,
  waitlistEnabled: false,
  allowWalkIns: true,
  qrEnabled: true,
  certificateEnabled: false,
  certificateMode: 'STANDARD',
  certificateType: 'ATTENDANCE',
  certificateTemplate: '',
  certificateNamePlacement: DEFAULT_PLACEMENT,
  certificateTheme: DEFAULT_THEME,
  certificateStyle: 'CLASSIC',
  certificateContent: DEFAULT_CONTENT,
  sponsorshipOpen: false,
  sponsorshipPitch: '',
  sponsorshipPackages: [],
  partners: [],
  minimumAttendanceDuration: 0,
  checkOutRequired: true,
  visibility: 'PUBLIC',
};

function toLocalInput(value?: string | null) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

export default function EventFormPage() {
  return (
    <Suspense fallback={null}>
      <EventFormPageInner />
    </Suspense>
  );
}

function EventFormPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const communityId = params.get('communityId') ?? '';
  const slug = params.get('slug') ?? '';

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState<EventInput>(emptyForm);
  const [tagsText, setTagsText] = useState<string | null>(null);
  const [featuresText, setFeaturesText] = useState<string | null>(null);
  const [dayFeaturesText, setDayFeaturesText] = useState<Record<number, string>>({});
  const [eventId, setEventId] = useState('');
  const [speakers, setSpeakers] = useState<EventSpeaker[]>([]);
  const [sponsors, setSponsors] = useState<EventSponsor[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [eventUnlocked, setEventUnlocked] = useState(false);
  const [eventTotal, setEventTotal] = useState<number | undefined>(undefined);
  const [paymentsEnabled, setPaymentsEnabled] = useState(false);
  const [unlockBusy, setUnlockBusy] = useState(false);
  const [verifiedRef, setVerifiedRef] = useState('');

  const isEditing = Boolean(slug);

  useEffect(() => {
    void (async () => {
      try {
        const user = await getCurrentUser();
        if (!user) {
          router.replace('/login');
          return;
        }
        if (slug) {
          const detail = await getEvent(slug);
          setEventId(detail.event._id);
          setForm({ ...emptyForm, ...detail.event } as EventInput);
          setSpeakers(detail.speakers);
          setSponsors(detail.sponsors);
          if (detail.event.premiumUnlocked) setEventUnlocked(true);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load event');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [router, slug]);

  useEffect(() => {
    const cid = communityId || '';
    if (!cid) return;
    void (async () => {
      try {
        const status = await getPremiumStatus(cid);
        setIsPremium(status.isPremium);
        setEventTotal(status.eventTotal);
        setPaymentsEnabled(status.paymentsEnabled);
      } catch {
        setIsPremium(false);
      }
    })();
  }, [communityId]);

  // Verify a returning per-event premium payment (Paystack appends ?reference=, Flutterwave ?tx_ref=).
  useEffect(() => {
    const reference = params.get('reference') || params.get('trxref') || params.get('tx_ref') || '';
    if (!reference || !eventId || reference === verifiedRef) return;
    setVerifiedRef(reference);
    void (async () => {
      try {
        const result = await verifyEventPremium(eventId, reference);
        if (result.status === 'PAID') {
          setEventUnlocked(true);
          setError('');
        }
      } catch {
        /* ignore — user can retry */
      }
    })();
  }, [eventId, params, verifiedRef]);

  async function handleUnlockEvent() {
    try {
      setUnlockBusy(true);
      setError('');
      const id = await ensureSaved();
      const { authorizationUrl } = await startEventPremiumCheckout(id);
      window.location.assign(authorizationUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start payment');
      setUnlockBusy(false);
    }
  }

  async function handleCheckEventPayment() {
    if (!eventId) return;
    try {
      setUnlockBusy(true);
      setError('');
      const result = await reconcileEventPayment(eventId);
      if (result.unlocked) {
        setEventUnlocked(true);
      } else {
        setError(result.pending > 0 ? 'Payment still pending. If you were charged, try again in a minute.' : 'No pending payment found for this event.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to check payment');
    } finally {
      setUnlockBusy(false);
    }
  }

  function update<K extends keyof EventInput>(key: K, value: EventInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateForm(patch: Partial<EventInput>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  async function ensureSaved(): Promise<string> {
    if (eventId) {
      await updateEvent(eventId, form);
      return eventId;
    }
    const response = await createEvent(communityId, form);
    setEventId(response.event._id);
    return response.event._id;
  }

  async function handleSaveDraft() {
    try {
      setSaving(true);
      setError('');
      await ensureSaved();
      router.push('/dashboard/events');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save event');
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    try {
      setSaving(true);
      setError('');
      const id = await ensureSaved();
      await publishEvent(id);
      router.push('/dashboard/events');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to publish event');
    } finally {
      setSaving(false);
    }
  }

  async function handleBannerUpload(file: File | null) {
    if (!file) return;
    try {
      setUploading(true);
      setError('');
      const fd = new FormData();
      fd.append('banner', file);
      const uploaded = await uploadEventMedia(fd);
      update('bannerImage', uploaded.banner);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to upload banner');
    } finally {
      setUploading(false);
    }
  }

  async function handleGalleryUpload(files: FileList | null) {
    if (!files?.length) return;
    const existing = form.gallery ?? [];
    const room = 6 - existing.length;
    if (room <= 0) {
      setError('You can add up to 6 gallery images. Remove one first.');
      return;
    }
    try {
      setUploading(true);
      setError('');
      const fd = new FormData();
      Array.from(files).slice(0, room).forEach((file) => fd.append('gallery', file));
      const uploaded = await uploadEventMedia(fd);
      update('gallery', [...existing, ...uploaded.gallery].slice(0, 6));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to upload gallery images');
    } finally {
      setUploading(false);
    }
  }

  function applyDraft(draft: EventDraft) {
    const parts = [draft.description];
    if (draft.agenda?.length) parts.push('Agenda:\n' + draft.agenda.map((a) => `- ${a}`).join('\n'));
    if (draft.audience) parts.push(`Who should attend: ${draft.audience}`);
    if (draft.outcomes?.length) parts.push('You will learn to:\n' + draft.outcomes.map((o) => `- ${o}`).join('\n'));
    setForm((current) => ({
      ...current,
      title: draft.title || current.title,
      shortDescription: (draft.description || '').slice(0, 160),
      description: parts.filter(Boolean).join('\n\n'),
    }));
  }

  const canSave = useMemo(() => Boolean(communityId && (form.title ?? '').trim()), [communityId, form.title]);
  const showVenue = form.mode === 'PHYSICAL' || form.mode === 'HYBRID';
  const showLink = form.mode === 'VIRTUAL' || form.mode === 'HYBRID';
  const placement = form.certificateNamePlacement ?? DEFAULT_PLACEMENT;

  if (isLoading) {
    return (
      <DashboardShell sidebar={<DashboardSidebar />} topbar={<DashboardTopbar />}>
        <div className="flex items-center justify-center rounded-3xl border border-slate-200 bg-white p-10 shadow-sm">
          <LogoSpinner />
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell sidebar={<DashboardSidebar />} topbar={<DashboardTopbar />}>
      <button onClick={() => navigateBack(router, '/dashboard/events')} className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Back to events
      </button>

      <SectionHeader eyebrow="Events" title={isEditing ? 'Edit Event' : 'Create Event'} subtitle="Set up details, schedule, media, and registration." />

      {error ? <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {!communityId ? <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Select a community from the Events page first.</div> : null}

      <div className="space-y-6">
        <AiEventAssistant onApply={applyDraft} />

        <Section title="Basic Information">
          <Field label="Event Title"><input className="ev-input" value={form.title ?? ''} onChange={(e) => update('title', e.target.value)} /></Field>
          <Field label="Theme / Topic (optional)">
            <input
              className="ev-input"
              placeholder="e.g. AI for Social Good"
              value={form.theme ?? ''}
              onChange={(e) => update('theme', e.target.value.slice(0, 120))}
            />
          </Field>
          <Field label="Event Type">
            <select className="ev-input" value={form.type} onChange={(e) => update('type', e.target.value)}>
              {EVENT_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
          </Field>
          <Field label="Short Description"><input className="ev-input" value={form.shortDescription ?? ''} onChange={(e) => update('shortDescription', e.target.value)} /></Field>
          <Field label="Full Description">
            <MarkdownTextarea className="ev-input min-h-56 w-full" value={form.description ?? ''} onChange={(v) => update('description', v)} />
          </Field>
          <Field label="Tags (comma separated, up to 5)">
            <input
              className="ev-input"
              placeholder="e.g. AI, Careers, Networking"
              value={tagsText ?? (form.tags ?? []).join(', ')}
              onChange={(e) => {
                setTagsText(e.target.value);
                update('tags', e.target.value.split(',').map((t) => t.trim().slice(0, 30)).filter(Boolean).slice(0, 5));
              }}
            />
          </Field>
          <Field label="Event features — what attendees get (one per line, up to 10)">
            <textarea
              className="ev-input min-h-24"
              placeholder={'Hands-on workshops\nFree Wi-Fi\nCertificate of attendance\nNetworking session'}
              value={featuresText ?? (form.features ?? []).join('\n')}
              onChange={(e) => {
                setFeaturesText(e.target.value);
                update('features', e.target.value.split('\n').map((f) => f.trim().slice(0, 80)).filter(Boolean).slice(0, 10));
              }}
            />
          </Field>
        </Section>

        <Section title="Schedule">
          <Field label="Start"><input type="datetime-local" className="ev-input" value={toLocalInput(form.startDate)} onChange={(e) => update('startDate', e.target.value ? new Date(e.target.value).toISOString() : null)} /></Field>
          <Field label="End"><input type="datetime-local" className="ev-input" value={toLocalInput(form.endDate)} onChange={(e) => update('endDate', e.target.value ? new Date(e.target.value).toISOString() : null)} /></Field>
          <Field label="Timezone"><input className="ev-input" placeholder="e.g. Africa/Lagos" value={form.timezone ?? ''} onChange={(e) => update('timezone', e.target.value)} /></Field>
        </Section>

        <Section title="Day-by-day agenda (multi-day events)">
          <p className="text-xs text-slate-500">
            Running a summit or bootcamp across several days? Give each day its own sub-theme, venue, and activities — the
            “Theme / Topic” above stays the grand theme for the whole event. Attendees scan the same QR pass each day.
          </p>
          {(form.days ?? []).map((day, index) => (
            <div key={index} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">Day {index + 1}</span>
                <button type="button" className="text-xs font-medium text-slate-400 hover:text-rose-600" onClick={() => { update('days', (form.days ?? []).filter((_, i) => i !== index)); setDayFeaturesText((prev) => { const next = { ...prev }; delete next[index]; return next; }); }}>Remove</button>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Date">
                  <input
                    type="date"
                    className="ev-input"
                    value={toLocalInput(day.date).slice(0, 10)}
                    onChange={(e) => update('days', (form.days ?? []).map((d, i) => (i === index ? { ...d, date: e.target.value ? new Date(`${e.target.value}T00:00`).toISOString() : null } : d)))}
                  />
                </Field>
                <Field label="Starts">
                  <input
                    type="time"
                    className="ev-input"
                    value={day.startTime ?? ''}
                    onChange={(e) => update('days', (form.days ?? []).map((d, i) => (i === index ? { ...d, startTime: e.target.value } : d)))}
                  />
                </Field>
                <Field label="Ends">
                  <input
                    type="time"
                    className="ev-input"
                    value={day.endTime ?? ''}
                    onChange={(e) => update('days', (form.days ?? []).map((d, i) => (i === index ? { ...d, endTime: e.target.value } : d)))}
                  />
                </Field>
                <Field label="Day theme">
                  <input className="ev-input" placeholder="e.g. Day 1: Foundations" value={day.theme} onChange={(e) => update('days', (form.days ?? []).map((d, i) => (i === index ? { ...d, theme: e.target.value.slice(0, 120) } : d)))} />
                </Field>
                <Field label="Venue (if different)">
                  <input className="ev-input" placeholder="Defaults to the event venue" value={day.venue} onChange={(e) => update('days', (form.days ?? []).map((d, i) => (i === index ? { ...d, venue: e.target.value.slice(0, 160) } : d)))} />
                </Field>
              </div>
              <div className="mt-3">
                <Field label="Activities / highlights (one per line, up to 8)">
                  <textarea
                    className="ev-input min-h-20"
                    placeholder={'Keynote: The future of robotics\nHands-on lab\nLightning talks'}
                    value={dayFeaturesText[index] ?? day.features.join('\n')}
                    onChange={(e) => {
                      setDayFeaturesText((prev) => ({ ...prev, [index]: e.target.value }));
                      update('days', (form.days ?? []).map((d, i) => (i === index ? { ...d, features: e.target.value.split('\n').map((f) => f.trim().slice(0, 80)).filter(Boolean).slice(0, 8) } : d)));
                    }}
                  />
                </Field>
              </div>
              <div className="mt-3">
                <p className="mb-1.5 text-xs font-medium text-slate-600">Facilitators / anchors for this day (up to 6)</p>
                {(day.facilitators ?? []).map((person, pIndex) => (
                  <div key={pIndex} className="mb-2 flex items-center gap-2">
                    <input
                      className="ev-input flex-1"
                      placeholder="Name — e.g. Dr. Amina Bello"
                      value={person.name}
                      onChange={(e) => update('days', (form.days ?? []).map((d, i) => (i === index ? { ...d, facilitators: (d.facilitators ?? []).map((p, j) => (j === pIndex ? { ...p, name: e.target.value.slice(0, 80) } : p)) } : d)))}
                    />
                    <input
                      className="ev-input flex-1"
                      placeholder="Role — e.g. Lead Facilitator, MC"
                      value={person.title}
                      onChange={(e) => update('days', (form.days ?? []).map((d, i) => (i === index ? { ...d, facilitators: (d.facilitators ?? []).map((p, j) => (j === pIndex ? { ...p, title: e.target.value.slice(0, 100) } : p)) } : d)))}
                    />
                    <button
                      type="button"
                      className="shrink-0 text-xs font-medium text-slate-400 hover:text-rose-600"
                      onClick={() => update('days', (form.days ?? []).map((d, i) => (i === index ? { ...d, facilitators: (d.facilitators ?? []).filter((_, j) => j !== pIndex) } : d)))}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                {(day.facilitators ?? []).length < 6 ? (
                  <button
                    type="button"
                    className="rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-indigo-400 hover:text-indigo-600"
                    onClick={() => update('days', (form.days ?? []).map((d, i) => (i === index ? { ...d, facilitators: [...(d.facilitators ?? []), { name: '', title: '' }] } : d)))}
                  >
                    + Add facilitator
                  </button>
                ) : null}
              </div>
              <div className="mt-3">
                <p className="mb-1.5 text-xs font-medium text-slate-600">Timed sessions (optional — for days with several programmes at different times/venues, up to 8)</p>
                {(day.sessions ?? []).map((session, sIndex) => (
                  <div key={sIndex} className="mb-2 grid gap-2 sm:grid-cols-[110px_1fr_1fr_1fr_auto]">
                    <input
                      type="time"
                      className="ev-input"
                      value={session.time}
                      onChange={(e) => update('days', (form.days ?? []).map((d, i) => (i === index ? { ...d, sessions: (d.sessions ?? []).map((s, j) => (j === sIndex ? { ...s, time: e.target.value } : s)) } : d)))}
                    />
                    <input
                      className="ev-input"
                      placeholder="Session — e.g. Amir's Cup Final"
                      value={session.title}
                      onChange={(e) => update('days', (form.days ?? []).map((d, i) => (i === index ? { ...d, sessions: (d.sessions ?? []).map((s, j) => (j === sIndex ? { ...s, title: e.target.value.slice(0, 120) } : s)) } : d)))}
                    />
                    <input
                      className="ev-input"
                      placeholder="Venue (optional)"
                      value={session.venue}
                      onChange={(e) => update('days', (form.days ?? []).map((d, i) => (i === index ? { ...d, sessions: (d.sessions ?? []).map((s, j) => (j === sIndex ? { ...s, venue: e.target.value.slice(0, 160) } : s)) } : d)))}
                    />
                    <input
                      className="ev-input"
                      placeholder="Facilitator (optional)"
                      value={session.facilitator}
                      onChange={(e) => update('days', (form.days ?? []).map((d, i) => (i === index ? { ...d, sessions: (d.sessions ?? []).map((s, j) => (j === sIndex ? { ...s, facilitator: e.target.value.slice(0, 80) } : s)) } : d)))}
                    />
                    <button
                      type="button"
                      className="shrink-0 self-center text-xs font-medium text-slate-400 hover:text-rose-600"
                      onClick={() => update('days', (form.days ?? []).map((d, i) => (i === index ? { ...d, sessions: (d.sessions ?? []).filter((_, j) => j !== sIndex) } : d)))}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                {(day.sessions ?? []).length < 8 ? (
                  <button
                    type="button"
                    className="rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-indigo-400 hover:text-indigo-600"
                    onClick={() => update('days', (form.days ?? []).map((d, i) => (i === index ? { ...d, sessions: [...(d.sessions ?? []), { time: '', title: '', venue: '', facilitator: '' }] } : d)))}
                  >
                    + Add session
                  </button>
                ) : null}
              </div>
            </div>
          ))}
          {(form.days ?? []).length < 14 ? (
            <button
              type="button"
              className="rounded-xl border border-dashed border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:border-indigo-400 hover:text-indigo-600"
              onClick={() => update('days', [...(form.days ?? []), { date: null, theme: '', venue: '', startTime: '', endTime: '', features: [], facilitators: [], sessions: [] }])}
            >
              + Add day
            </button>
          ) : null}
          {(form.days ?? []).length > 1 ? (
            <Field label="Days required for a certificate (0 = attend every day)">
              <input
                type="number"
                min={0}
                max={(form.days ?? []).length}
                className="ev-input"
                value={form.minimumAttendanceDays ?? 0}
                onChange={(e) => update('minimumAttendanceDays', Math.max(0, Math.min((form.days ?? []).length, Math.round(Number(e.target.value) || 0))))}
              />
              <p className="mt-1 text-xs text-slate-500">Attendees check in each day with the same QR pass; certificates go to those who attend at least this many days.</p>
            </Field>
          ) : null}
        </Section>

        <Section title="Location">
          <Field label="Mode">
            <select className="ev-input" value={form.mode} onChange={(e) => update('mode', e.target.value as EventInput['mode'])}>
              {['PHYSICAL', 'HYBRID', 'VIRTUAL'].map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
          {form.mode === 'HYBRID' ? (
            <p className="rounded-xl bg-indigo-50 px-3 py-2 text-xs text-indigo-700">Hybrid events need <strong>both</strong> a physical venue and an online meeting link so every attendee knows where to go.</p>
          ) : null}
          {showVenue ? (
            <>
              <Field label={form.mode === 'HYBRID' ? 'Venue Name (required)' : 'Venue Name'}><input className="ev-input" value={form.venue ?? ''} onChange={(e) => update('venue', e.target.value)} /></Field>
              <Field label="Address"><input className="ev-input" value={form.address ?? ''} onChange={(e) => update('address', e.target.value)} /></Field>
              <Toggle label="Refreshments will be provided (Item 7)" checked={Boolean(form.refreshments)} onChange={(v) => update('refreshments', v)} />
            </>
          ) : null}
          {showLink ? (
            <Field label={form.mode === 'HYBRID' ? 'Meeting Link (required)' : 'Meeting Link'}><input className="ev-input" placeholder="Zoom / Teams / Google Meet link" value={form.meetingLink ?? ''} onChange={(e) => update('meetingLink', e.target.value)} /></Field>
          ) : null}
        </Section>

        <Section title="Contact persons">
          <p className="text-xs text-slate-500">Shown on the event page so attendees can reach the organizers (up to 3). Each contact needs a phone or email.</p>
          {(form.contacts ?? []).map((contact, index) => (
            <div key={index} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Name"><input className="ev-input" placeholder="e.g. Amina Bello" value={contact.name} onChange={(e) => update('contacts', (form.contacts ?? []).map((c, i) => (i === index ? { ...c, name: e.target.value.slice(0, 60) } : c)))} /></Field>
                <Field label="Phone / WhatsApp"><input className="ev-input" placeholder="e.g. 0803 123 4567" value={contact.phone} onChange={(e) => update('contacts', (form.contacts ?? []).map((c, i) => (i === index ? { ...c, phone: e.target.value.slice(0, 30) } : c)))} /></Field>
                <Field label="Email"><input className="ev-input" placeholder="e.g. events@club.org" value={contact.email} onChange={(e) => update('contacts', (form.contacts ?? []).map((c, i) => (i === index ? { ...c, email: e.target.value.slice(0, 120) } : c)))} /></Field>
              </div>
              <div className="mt-2 flex items-center justify-between">
                {contact.name && !contact.phone && !contact.email ? (
                  <span className="text-xs font-medium text-rose-600">Add a phone or email — contacts without one aren’t saved.</span>
                ) : <span />}
                <button type="button" className="text-xs font-medium text-slate-400 hover:text-rose-600" onClick={() => update('contacts', (form.contacts ?? []).filter((_, i) => i !== index))}>Remove</button>
              </div>
            </div>
          ))}
          {(form.contacts ?? []).length < 3 ? (
            <button
              type="button"
              className="rounded-xl border border-dashed border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:border-indigo-400 hover:text-indigo-600"
              onClick={() => update('contacts', [...(form.contacts ?? []), { name: '', phone: '', email: '' }])}
            >
              + Add contact person
            </button>
          ) : null}
        </Section>

        <Section title="Capacity">
          <Field label="Maximum Participants (0 = unlimited)"><input type="number" className="ev-input" value={form.capacity ?? 0} onChange={(e) => update('capacity', Number(e.target.value))} /></Field>
          <Toggle label="Enable waitlist" checked={Boolean(form.waitlistEnabled)} onChange={(v) => update('waitlistEnabled', v)} />
        </Section>

        <Section title="Media">
          <Field label="Event Banner (required to publish)">
            <input type="file" accept="image/*" onChange={(e) => void handleBannerUpload(e.target.files?.[0] ?? null)} />
            {uploading ? <p className="mt-2 text-sm text-slate-500">Uploading…</p> : null}
            {form.bannerImage ? <img src={resolveEventImageUrl(form.bannerImage)} alt="Banner" className="mt-3 h-32 w-full rounded-2xl object-cover" /> : null}
          </Field>
          <Field label="Flyers & photos (optional, up to 6)">
            <input type="file" accept="image/*" multiple onChange={(e) => { void handleGalleryUpload(e.target.files); e.target.value = ''; }} />
            <p className="mt-1 text-xs text-slate-500">Event flyers, speaker cards, past-edition photos — shown as a slideshow on the event page.</p>
            {(form.gallery ?? []).length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {(form.gallery ?? []).map((img, i) => (
                  <div key={img} className="relative">
                    <img src={resolveEventImageUrl(img)} alt={`Gallery ${i + 1}`} className="h-20 w-20 rounded-xl border border-slate-200 object-cover" />
                    <button
                      type="button"
                      onClick={() => update('gallery', (form.gallery ?? []).filter((g) => g !== img))}
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

        <Section title="Registration Settings">
          <Field label="Registration Policy">
            <select className="ev-input" value={form.registrationPolicy} onChange={(e) => update('registrationPolicy', e.target.value as EventInput['registrationPolicy'])}>
              {/* INVITE is intentionally hidden: there is no event-invite flow yet, so it would dead-end registration. */}
              {['OPEN', 'APPROVAL'].map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="Registration Deadline"><input type="datetime-local" className="ev-input" value={toLocalInput(form.registrationDeadline)} onChange={(e) => update('registrationDeadline', e.target.value ? new Date(e.target.value).toISOString() : null)} /></Field>
          <Toggle label="Allow walk-ins" checked={Boolean(form.allowWalkIns)} onChange={(v) => update('allowWalkIns', v)} />
          <Toggle label="Enable QR attendance" checked={Boolean(form.qrEnabled)} onChange={(v) => update('qrEnabled', v)} />
          <Field label="Visibility">
            <select className="ev-input" value={form.visibility} onChange={(e) => update('visibility', e.target.value as EventInput['visibility'])}>
              {['PUBLIC', 'PRIVATE', 'UNLISTED'].map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </Field>
        </Section>

        <Section title="Thank-you email (after the event)">
          <div className="grid gap-3 sm:grid-cols-3">
            {([
              { value: 'AUTO' as const, title: 'Auto', desc: 'System sends a branded thank-you to attendees automatically when certificates are issued.' },
              { value: 'CUSTOM' as const, title: 'Custom', desc: 'You design the email yourself (tone, subject, message, button) from the Attendees page.' },
              { value: 'OFF' as const, title: 'Off', desc: 'No thank-you email is sent.' },
            ]).map((opt) => (
              <label key={opt.value} className={`cursor-pointer rounded-2xl border p-4 transition ${(form.appreciationMode ?? 'AUTO') === opt.value ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 bg-white hover:border-indigo-300'}`}>
                <input type="radio" name="appreciationMode" className="sr-only" checked={(form.appreciationMode ?? 'AUTO') === opt.value} onChange={() => update('appreciationMode', opt.value)} />
                <p className="font-semibold text-slate-900">{opt.title}</p>
                <p className="mt-1 text-xs text-slate-500">{opt.desc}</p>
              </label>
            ))}
          </div>
        </Section>

        <CertificateDesigner
          enabled={Boolean(form.certificateEnabled)}
          mode={form.certificateMode ?? 'STANDARD'}
          certificateType={form.certificateType ?? 'ATTENDANCE'}
          template={form.certificateTemplate ?? ''}
          placement={placement}
          theme={form.certificateTheme ?? DEFAULT_THEME}
          style={form.certificateStyle ?? 'CLASSIC'}
          content={form.certificateContent ?? DEFAULT_CONTENT}
          isPremium={isPremium || eventUnlocked}
          premiumHref={communityId ? `/dashboard/premium?communityId=${communityId}` : undefined}
          communityId={communityId}
          eventTitle={form.title ?? ''}
          partners={form.partners ?? []}
          onUnlockEvent={!isPremium && !eventUnlocked && paymentsEnabled ? handleUnlockEvent : undefined}
          eventUnlockTotal={eventTotal}
          eventUnlockBusy={unlockBusy}
          onCheckPayment={!isPremium && !eventUnlocked && paymentsEnabled && eventId ? handleCheckEventPayment : undefined}
          minimumAttendanceDuration={form.minimumAttendanceDuration ?? 0}
          checkOutRequired={Boolean(form.checkOutRequired)}
          onChange={updateForm}
          onError={setError}
        />

        <SpeakersSponsorsEditor
          initialEventId={eventId}
          initialSpeakers={speakers}
          initialSponsors={sponsors}
          dayCount={(form.days ?? []).length}
          ensureSaved={ensureSaved}
          onError={setError}
        />

        <SponsorshipEditor
          eventId={eventId}
          eventSlug={slug}
          certificateMode={form.certificateMode ?? 'STANDARD'}
          open={Boolean(form.sponsorshipOpen)}
          pitch={form.sponsorshipPitch ?? ''}
          packages={form.sponsorshipPackages ?? []}
          onChange={updateForm}
          onError={setError}
        />

        <PartnershipEditor
          eventId={eventId}
          partners={form.partners ?? []}
          ensureSaved={ensureSaved}
          onChange={updateForm}
          onError={setError}
        />

        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => void handleSaveDraft()} disabled={!canSave || saving}>{saving ? 'Saving…' : 'Save Draft'}</Button>
          <Button variant="primary" onClick={() => void handlePublish()} disabled={!canSave || saving}>Publish Event</Button>
          <Button variant="ghost" onClick={() => router.push('/dashboard/events')}>Cancel</Button>
        </div>
      </div>
    </DashboardShell>
  );
}
