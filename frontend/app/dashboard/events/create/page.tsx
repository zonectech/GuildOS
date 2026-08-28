'use client';

import { LogoSpinner } from '../../../../components/guildos/ui/loading';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { QRCodeCanvas } from 'qrcode.react';
import { ArrowLeft, Loader2 } from 'lucide-react';

import { getCurrentUser } from '../../../../components/guildos/auth-api';
import { getManagedCommunities, type CommunitySummary } from '../../../../components/guildos/community-list-api';
import { SelectMenu } from '../../../../components/guildos/ui/select-menu';
import {
  createEvent,
  getEvent,
  getPremiumStatus,
  getTicketSettings,
  startEventPremiumCheckout,
  payEventPremiumFromWallet,
  verifyEventPremium,
  reconcileEventPayment,
  publishEvent,
  updateEvent,
  uploadEventMedia,
  resolveEventImageUrl,
  EVENT_TYPES,
  TICKET_QR_PLACEMENTS,
  TICKET_STYLES,
  type EventInput,
  type RichEventDraft,
  type EventSpeaker,
  type EventSponsor,
  type TicketQrPlacement,
  type TicketStyle,
} from '../../../../components/guildos/event-api';
import { drawTicketCard } from '../../../../components/guildos/ticket-canvas';
import { DashboardShell } from '../../../../components/guildos/dashboard-shell';
import { DashboardSidebar } from '../../../../components/guildos/dashboard-sidebar';
import { DashboardTopbar } from '../../../../components/guildos/dashboard-topbar';
import { FormattedTextEditor } from '../../../../components/guildos/ui/formatted-text-editor';
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
const DEFAULT_CONTENT = { title: '', presentation: '', message: '', signatories: [] as { name: string; title: string; image: string }[], logo: '', logoAlign: 'CENTER' as const };

/**
 * The ~14-section form is split into 4 digestible steps. Steps hide/show with CSS
 * (never unmount) so in-progress uploads, editor state and previews survive switching,
 * and Save Draft / Publish always act on the whole form regardless of the visible step.
 */
const WIZARD_STEPS = [
  { label: 'Basics', hint: 'Title, description, schedule, day agenda' },
  { label: 'Logistics & tickets', hint: 'Venue, contacts, capacity, media, registration, pricing' },
  { label: 'Certificates & email', hint: 'Certificate design, thank-you email' },
  { label: 'Speakers & partners', hint: 'Speakers, sponsors, sponsorship, co-hosts' },
] as const;

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
  ticketPrice: 0,
  ticketTiers: [],
  ticketPromoCodes: [],
  ticketGroupDiscount: { minQuantity: 0, percentOff: 0 },
  ticketTemplate: '',
  ticketStyle: 'MIDNIGHT',
  ticketAccent: '#6366f1',
  ticketQrPlacement: 'BOTTOM_RIGHT',
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

/** Live preview of the buyer's downloadable ticket (sample name + QR). */
function TicketPreview(props: {
  eventTitle: string;
  communityName: string;
  dateLabel: string;
  venueLabel: string;
  priceLabel: string;
  tierLabel: string;
  templateImage: string;
  qrPlacement: TicketQrPlacement;
  style: TicketStyle;
  accent: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const qrWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const qrCanvas = qrWrapRef.current?.querySelector('canvas') ?? null;
    void drawTicketCard(canvas, {
      eventTitle: props.eventTitle,
      communityName: props.communityName,
      attendeeName: 'Attendee Name',
      dateLabel: props.dateLabel,
      venueLabel: props.venueLabel,
      priceLabel: props.priceLabel,
      tierLabel: props.tierLabel,
      reference: '',
      qrCanvas,
      templateImage: props.templateImage,
      qrPlacement: props.qrPlacement,
      style: props.style,
      accent: props.accent,
    });
  }, [props.eventTitle, props.communityName, props.dateLabel, props.venueLabel, props.priceLabel, props.tierLabel, props.templateImage, props.qrPlacement, props.style, props.accent]);

  return (
    <div className="mt-3">
      <div ref={qrWrapRef} className="hidden" aria-hidden>
        <QRCodeCanvas value="guildos-ticket-preview" size={512} includeMargin />
      </div>
      <canvas ref={canvasRef} className="w-full rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm" />
      <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">Preview — each buyer's ticket carries their own name and check-in QR.</p>
    </div>
  );
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
  const slug = params.get('slug') ?? '';

  // Community context comes from the URL, but when an existing event is opened
  // via ?slug= alone (e.g. a shared edit link), fall back to the event's own community.
  const [eventCommunityId, setEventCommunityId] = useState('');
  const communityId = eventCommunityId;
  const [managedCommunities, setManagedCommunities] = useState<CommunitySummary[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState<EventInput>(emptyForm);
  const [tagsText, setTagsText] = useState<string | null>(null);
  const [featuresText, setFeaturesText] = useState<string | null>(null);
  const [dayFeaturesText, setDayFeaturesText] = useState<Record<number, string>>({});
  // Single-day vs day-by-day agenda — hides the day editor until the organizer opts in.
  const [agendaMode, setAgendaMode] = useState<'SINGLE' | 'MULTI'>('SINGLE');
  const [eventId, setEventId] = useState('');
  const [eventStatus, setEventStatus] = useState('');
  const [speakers, setSpeakers] = useState<EventSpeaker[]>([]);
  const [sponsors, setSponsors] = useState<EventSponsor[]>([]);
  const [pendingPeople, setPendingPeople] = useState<RichEventDraft['people']>(undefined);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [eventUnlocked, setEventUnlocked] = useState(false);
  const [eventTotal, setEventTotal] = useState<number | undefined>(undefined);
  const [eventPrice, setEventPrice] = useState<number | undefined>(undefined);
  const [walletBalance, setWalletBalance] = useState(0);
  const [paymentsEnabled, setPaymentsEnabled] = useState(false);
  const [unlockBusy, setUnlockBusy] = useState(false);
  const [verifiedRef, setVerifiedRef] = useState('');
  const [ticketCommission, setTicketCommission] = useState<number | null>(null);
  // Explicit Free/Paid entry choice — null until the organizer picks (or an existing event resolves it).
  const [ticketChoice, setTicketChoice] = useState<'FREE' | 'PAID' | null>(null);
  const [step, setStep] = useState(0);

  function goToStep(next: number) {
    setStep(Math.min(WIZARD_STEPS.length - 1, Math.max(0, next)));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const isEditing = Boolean(slug);

  useEffect(() => {
    void getTicketSettings().then(({ commissionPercent }) => setTicketCommission(commissionPercent)).catch(() => undefined);
  }, []);

  // Seed the community from the URL once, then load the picker options (skipped once editing an existing event—its community is fixed).
  useEffect(() => {
    const fromUrl = params.get('communityId');
    if (fromUrl) setEventCommunityId(fromUrl);
  }, [params]);

  useEffect(() => {
    if (slug) return; // editing an existing event—community is fixed, no picker needed
    void getManagedCommunities()
      .then((res) => {
        setManagedCommunities(res.communities);
        // Only one community to manage? Pick it automatically—one less click.
        if (res.communities.length === 1 && !eventCommunityId) setEventCommunityId(res.communities[0]._id);
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

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
          setEventCommunityId(detail.event.communityId ?? '');
          setEventStatus(detail.event.status ?? '');
          setForm({ ...emptyForm, ...detail.event } as EventInput);
          // One agenda day = still a single-day event (its agenda edits inline); 2+ = day-by-day.
          if ((detail.event.days ?? []).length > 1) setAgendaMode('MULTI');
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
        setEventPrice(status.eventPrice);
        setWalletBalance(status.walletAvailableNgn ?? 0);
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

  /** Unlock this event's premium using the community ticket wallet (no gateway needed). */
  async function handlePayFromWallet() {
    try {
      setUnlockBusy(true);
      setError('');
      const id = await ensureSaved();
      await payEventPremiumFromWallet(id);
      setEventUnlocked(true);
      setWalletBalance((b) => Math.max(0, b - (eventPrice ?? 0)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to pay from wallet');
    } finally {
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
      const { event } = await updateEvent(eventId, form);
      // Section keys are minted server-side — sync them back so the speakers
      // step can assign trainers to freshly added sections without a reload.
      if ((event.sections ?? []).length || (form.sections ?? []).length) {
        setForm((current) => ({ ...current, sections: event.sections ?? [] }));
      }
      return eventId;
    }
    const response = await createEvent(communityId, form);
    setEventId(response.event._id);
    if ((response.event.sections ?? []).length) {
      setForm((current) => ({ ...current, sections: response.event.sections ?? [] }));
    }
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

  async function handleTicketTemplateUpload(file: File | null) {
    if (!file) return;
    try {
      setUploading(true);
      setError('');
      const fd = new FormData();
      fd.append('ticketTemplate', file);
      const uploaded = await uploadEventMedia(fd);
      update('ticketTemplate', uploaded.ticketTemplate);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to upload ticket design');
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

  function applyDraft(draft: RichEventDraft) {
    // Agenda items like "9:00 AM - Registration" become timed day sessions so the
    // wizard's Day-by-day agenda (and the public agenda card) are actually filled.
    function agendaToSessions(items: string[]) {
      return items.slice(0, 8).map((item) => {
        const m = /^\s*(\d{1,2}):(\d{2})\s*(AM|PM)?\s*[-–—]?\s*(.*)$/i.exec(item);
        if (!m) return { time: '', title: item.trim().slice(0, 120), venue: '', facilitator: '' };
        let hours = Number(m[1]) % 12;
        if ((m[3] ?? '').toUpperCase() === 'PM') hours += 12;
        if (!m[3]) hours = Number(m[1]); // already 24h
        const time = `${String(hours).padStart(2, '0')}:${m[2]}`;
        return { time, title: (m[4] || item).trim().slice(0, 120), venue: '', facilitator: '' };
      }).filter((s) => s.title);
    }

    const agendaAsSessions = (draft.agenda ?? []).length > 0;
    const multiDay = (draft.days ?? []).length > 1;
    const parts = [draft.description];
    // Only dump the agenda into the description when it can't live as day sessions
    // (or overflows the 8-session cap) — avoids showing it twice on the event page.
    if (draft.agenda?.length && !multiDay && (!agendaAsSessions || draft.agenda.length > 8)) {
      parts.push('Agenda:\n' + draft.agenda.map((a) => `- ${a}`).join('\n'));
    }
    if (draft.audience) parts.push(`Who should attend: ${draft.audience}`);
    if (draft.outcomes?.length) parts.push('You will learn to:\n' + draft.outcomes.map((o) => `- ${o}`).join('\n'));

    // Convert YYYY-MM-DD + HH:mm into ISO datetime strings for the datetime-local inputs
    function toIso(date?: string, time?: string) {
      if (!date) return undefined;
      const t = time && /^\d{2}:\d{2}$/.test(time) ? time : '00:00';
      const d = new Date(`${date}T${t}:00`);
      return isNaN(d.getTime()) ? undefined : d.toISOString();
    }

    // Multi-day: map extracted days straight onto the wizard's day agenda.
    const extractedDays = multiDay
      ? (draft.days ?? []).slice(0, 14).map((day) => ({
          date: day.date ? new Date(`${day.date}T00:00`).toISOString() : null,
          theme: day.theme.slice(0, 120),
          venue: day.venue.slice(0, 160),
          startTime: day.startTime,
          endTime: day.endTime,
          features: [],
          facilitators: [],
          sessions: day.sessions.slice(0, 8).map((s) => ({
            time: s.time,
            title: s.title.slice(0, 120),
            venue: s.venue.slice(0, 160),
            facilitator: s.facilitator.slice(0, 80),
          })),
        }))
      : [];
    const firstDay = multiDay ? (draft.days ?? [])[0] : undefined;
    const lastDay = multiDay ? (draft.days ?? [])[(draft.days ?? []).length - 1] : undefined;

    setForm((current) => ({
      ...current,
      title: draft.title || current.title,
      shortDescription: (draft.summary || draft.description || '').slice(0, 160),
      description: parts.filter(Boolean).join('\n\n'),
      ...(draft.theme ? { theme: draft.theme } : {}),
      ...(draft.type ? { type: draft.type } : {}),
      ...(draft.mode ? { mode: draft.mode as 'PHYSICAL' | 'VIRTUAL' | 'HYBRID' } : {}),
      ...(draft.venue ? { venue: draft.venue } : {}),
      ...(draft.tags?.length ? { tags: draft.tags } : {}),
      ...(draft.features?.length ? { features: draft.features.slice(0, 10) } : {}),
      ...(draft.address ? { address: draft.address } : {}),
      ...(draft.meetingLink ? { meetingLink: draft.meetingLink } : {}),
      ...(draft.timezone ? { timezone: draft.timezone } : {}),
      ...(draft.refreshments ? { refreshments: true } : {}),
      ...(draft.capacity ? { capacity: draft.capacity } : {}),
      ...(draft.ticketPrice ? { ticketPrice: draft.ticketPrice } : {}),
      ...(draft.contacts?.length ? { contacts: draft.contacts.slice(0, 3) } : {}),
      ...(draft.registrationDeadline ? { registrationDeadline: toIso(draft.registrationDeadline, '23:59') ?? current.registrationDeadline } : {}),
      // Multi-day: start = first day, end = last day; single-day: doc date + times.
      ...(multiDay && firstDay?.date
        ? { startDate: toIso(firstDay.date, firstDay.startTime) ?? current.startDate }
        : draft.date
          ? { startDate: toIso(draft.date, draft.startTime) ?? current.startDate }
          : {}),
      ...(multiDay && lastDay?.date
        ? { endDate: toIso(lastDay.date, lastDay.endTime || '23:59') ?? current.endDate }
        : draft.date && draft.endTime
          ? { endDate: toIso(draft.date, draft.endTime) ?? current.endDate }
          : {}),
      // Fill the day agenda only when the organizer hasn't built one already.
      ...(multiDay && !(current.days ?? []).length
        ? { days: extractedDays }
        : agendaAsSessions && !multiDay && !(current.days ?? []).length
          ? {
              days: [{
                date: draft.date ? new Date(`${draft.date}T00:00`).toISOString() : null,
                theme: '',
                venue: '',
                startTime: draft.startTime && /^\d{2}:\d{2}$/.test(draft.startTime) ? draft.startTime : '',
                endTime: draft.endTime && /^\d{2}:\d{2}$/.test(draft.endTime) ? draft.endTime : '',
                features: [],
                facilitators: [],
                sessions: agendaToSessions(draft.agenda ?? []),
              }],
            }
          : {}),
    }));
    // Multi-day documents open the day-by-day editor; single-day agendas edit inline.
    if (multiDay) setAgendaMode('MULTI');
    // Queue extracted speakers/trainers for the SpeakersSponsorsEditor
    if (draft.people?.length) setPendingPeople(draft.people);
  }

  const canSave = useMemo(() => Boolean(communityId && (form.title ?? '').trim()), [communityId, form.title]);
  const showVenue = form.mode === 'PHYSICAL' || form.mode === 'HYBRID';
  const showLink = form.mode === 'VIRTUAL' || form.mode === 'HYBRID';
  const placement = form.certificateNamePlacement ?? DEFAULT_PLACEMENT;

  if (isLoading) {
    return (
      <DashboardShell sidebar={<DashboardSidebar />} topbar={<DashboardTopbar />}>
        <div className="flex items-center justify-center rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 shadow-sm">
          <LogoSpinner />
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell sidebar={<DashboardSidebar />} topbar={<DashboardTopbar />}>
      <button onClick={() => navigateBack(router, '/dashboard/events')} className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Back to events
      </button>

      <SectionHeader eyebrow="Events" title={isEditing ? 'Edit Event' : 'Create Event'} subtitle="Set up details, schedule, media, and registration." />

      {error ? <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      {!isEditing ? (
        <div className="mb-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Community</label>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Which community is this event for? Ticket pricing, certificates, and premium all follow this choice.</p>
          {managedCommunities.length ? (
            <div className="mt-2 max-w-sm">
              <SelectMenu
                aria-label="Community"
                value={communityId}
                onChange={setEventCommunityId}
                placeholder="Choose a community…"
                options={managedCommunities.map((c) => ({ value: c._id, label: c.name }))}
              />
            </div>
          ) : (
            <p className="mt-2 text-sm text-amber-800">
              You don&apos;t manage any communities yet.{' '}
              <a href="/dashboard/communities/create" className="font-semibold underline underline-offset-2">Create one first</a>.
            </p>
          )}
        </div>
      ) : null}
      {!communityId && !isEditing && managedCommunities.length ? (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Pick a community above to continue.</div>
      ) : null}

      {/* Step navigation — every step is always clickable (drafts are free-form; publish validates the whole form). */}
      <div className="mb-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-sm">
        <div className="flex flex-wrap gap-1.5">
          {WIZARD_STEPS.map((s, i) => (
            <button
              key={s.label}
              type="button"
              onClick={() => goToStep(i)}
              title={s.hint}
              className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                step === i ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <span className={`grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold ${step === i ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600 dark:text-slate-400'}`}>{i + 1}</span>
              {s.label}
            </button>
          ))}
        </div>
        <p className="mt-2 px-1 text-xs text-slate-400 dark:text-slate-500">{WIZARD_STEPS[step].hint} — your progress is kept across steps; save a draft any time.</p>
      </div>

      <div className="space-y-6">
        <div className={step === 0 ? 'space-y-6' : 'hidden'}>
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
            <SelectMenu
              aria-label="Event type"
              value={form.type ?? ''}
              onChange={(v) => update('type', v)}
              options={EVENT_TYPES.map((t) => ({ value: t, label: t.replace(/_/g, ' ') }))}
            />
          </Field>
          <Field label="Short Description"><input className="ev-input" value={form.shortDescription ?? ''} onChange={(e) => update('shortDescription', e.target.value)} /></Field>
          <Field label="Full Description" as="div">
            <FormattedTextEditor className="ev-input min-h-56 w-full" value={form.description ?? ''} onChange={(v) => update('description', v)} />
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

        <Section title="Event days">
          {(() => {
            // Published events with a day agenda can't drop days — tickets/RSVPs reference Day N.
            const daysLocked = Boolean(eventId) && eventStatus !== '' && eventStatus !== 'DRAFT' && (form.days ?? []).length > 1;
            return (
              <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-800 p-1 text-sm">
                <button
                  type="button"
                  disabled={daysLocked}
                  title={daysLocked ? 'Published events keep their day agenda — cancel a day instead' : undefined}
                  onClick={() => {
                    setAgendaMode('SINGLE');
                    // Keep Day 1's agenda — it becomes the single-day agenda below.
                    update('days', (form.days ?? []).slice(0, 1));
                    update('minimumAttendanceDays', 0);
                    setDayFeaturesText({});
                  }}
                  className={`rounded-lg px-3 py-1.5 font-medium transition ${agendaMode === 'SINGLE' ? 'bg-slate-900 text-white' : 'text-slate-600 dark:text-slate-400'} disabled:opacity-50`}
                >
                  Single day
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAgendaMode('MULTI');
                    if (!(form.days ?? []).length) {
                      update('days', [{ date: null, theme: '', venue: '', startTime: '', endTime: '', features: [], facilitators: [], sessions: [] }]);
                    }
                  }}
                  className={`rounded-lg px-3 py-1.5 font-medium transition ${agendaMode === 'MULTI' ? 'bg-slate-900 text-white' : 'text-slate-600 dark:text-slate-400'}`}
                >
                  Day-by-day (multi-day)
                </button>
              </div>
            );
          })()}
          {agendaMode === 'SINGLE' ? (
            (() => {
              const emptyDay = { date: null, theme: '', venue: '', startTime: '', endTime: '', features: [], facilitators: [], sessions: [] };
              const day0 = (form.days ?? [])[0] ?? emptyDay;
              const patchDay0 = (patch: Partial<typeof day0>) => update('days', [{ ...day0, ...patch }]);
              return (
                <>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    One-session event — the Schedule above sets the time. Optionally build the programme below
                    (it shows as the agenda on the event page). Switch to <strong>Day-by-day</strong> for summits,
                    bootcamps and workshops that run across several days.
                  </p>
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                    <div>
                      <p className="mb-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">Facilitators / anchors (up to 6)</p>
                      {(day0.facilitators ?? []).map((person, pIndex) => (
                        <div key={pIndex} className="mb-2 flex items-center gap-2">
                          <input
                            className="ev-input flex-1"
                            placeholder="Name — e.g. Dr. Amina Bello"
                            value={person.name}
                            onChange={(e) => patchDay0({ facilitators: (day0.facilitators ?? []).map((p, j) => (j === pIndex ? { ...p, name: e.target.value.slice(0, 80) } : p)) })}
                          />
                          <input
                            className="ev-input flex-1"
                            placeholder="Role — e.g. Lead Facilitator, MC"
                            value={person.title}
                            onChange={(e) => patchDay0({ facilitators: (day0.facilitators ?? []).map((p, j) => (j === pIndex ? { ...p, title: e.target.value.slice(0, 100) } : p)) })}
                          />
                          <button
                            type="button"
                            className="shrink-0 text-xs font-medium text-slate-400 dark:text-slate-500 hover:text-rose-600"
                            onClick={() => patchDay0({ facilitators: (day0.facilitators ?? []).filter((_, j) => j !== pIndex) })}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      {(day0.facilitators ?? []).length < 6 ? (
                        <button
                          type="button"
                          className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:border-indigo-400 hover:text-indigo-600"
                          onClick={() => patchDay0({ facilitators: [...(day0.facilitators ?? []), { name: '', title: '' }] })}
                        >
                          + Add facilitator
                        </button>
                      ) : null}
                    </div>
                    <div className="mt-3">
                      <p className="mb-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">Timed programme (optional — up to 8 items, shown as the agenda on the event page)</p>
                      {(day0.sessions ?? []).map((session, sIndex) => (
                        <div key={sIndex} className={`mb-2 grid gap-2 ${(form.sections ?? []).some((sec) => sec.key && sec.name) ? 'sm:grid-cols-[110px_1fr_1fr_1fr_150px_auto]' : 'sm:grid-cols-[110px_1fr_1fr_1fr_auto]'}`}>
                          <input
                            type="time"
                            className="ev-input"
                            value={session.time}
                            onChange={(e) => patchDay0({ sessions: (day0.sessions ?? []).map((s, j) => (j === sIndex ? { ...s, time: e.target.value } : s)) })}
                          />
                          <input
                            className="ev-input"
                            placeholder="Session — e.g. Opening keynote"
                            value={session.title}
                            onChange={(e) => patchDay0({ sessions: (day0.sessions ?? []).map((s, j) => (j === sIndex ? { ...s, title: e.target.value.slice(0, 120) } : s)) })}
                          />
                          <input
                            className="ev-input"
                            placeholder="Venue (optional)"
                            value={session.venue}
                            onChange={(e) => patchDay0({ sessions: (day0.sessions ?? []).map((s, j) => (j === sIndex ? { ...s, venue: e.target.value.slice(0, 160) } : s)) })}
                          />
                          <input
                            className="ev-input"
                            placeholder="Facilitator (optional)"
                            value={session.facilitator}
                            onChange={(e) => patchDay0({ sessions: (day0.sessions ?? []).map((s, j) => (j === sIndex ? { ...s, facilitator: e.target.value.slice(0, 80) } : s)) })}
                          />
                          {(form.sections ?? []).some((sec) => sec.key && sec.name) ? (
                            <select
                              className="ev-input"
                              aria-label="Session track"
                              value={session.sectionKey ?? ''}
                              onChange={(e) => patchDay0({ sessions: (day0.sessions ?? []).map((s, j) => (j === sIndex ? { ...s, sectionKey: e.target.value } : s)) })}
                            >
                              <option value="">All tracks</option>
                              {(form.sections ?? []).filter((sec) => sec.key && sec.name).map((sec) => (
                                <option key={sec.key} value={sec.key}>{sec.name} only</option>
                              ))}
                            </select>
                          ) : null}
                          <button
                            type="button"
                            className="shrink-0 self-center text-xs font-medium text-slate-400 dark:text-slate-500 hover:text-rose-600"
                            onClick={() => patchDay0({ sessions: (day0.sessions ?? []).filter((_, j) => j !== sIndex) })}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      {(day0.sessions ?? []).length < 8 ? (
                        <button
                          type="button"
                          className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:border-indigo-400 hover:text-indigo-600"
                          onClick={() => patchDay0({ sessions: [...(day0.sessions ?? []), { time: '', title: '', venue: '', facilitator: '' }] })}
                        >
                          + Add agenda item
                        </button>
                      ) : null}
                    </div>
                  </div>
                </>
              );
            })()
          ) : (
          <>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Running a summit or bootcamp across several days? Give each day its own sub-theme, venue, and activities — the
            “Theme / Topic” above stays the grand theme for the whole event. Attendees scan the same QR pass each day.
          </p>
          {(form.days ?? []).map((day, index) => (
            <div key={index} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Day {index + 1}</span>
                <button type="button" className="text-xs font-medium text-slate-400 dark:text-slate-500 hover:text-rose-600" onClick={() => { update('days', (form.days ?? []).filter((_, i) => i !== index)); setDayFeaturesText((prev) => { const next = { ...prev }; delete next[index]; return next; }); }}>Remove</button>
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
                <Field label="Day seat cap (optional)">
                  <input
                    type="number"
                    min={0}
                    className="ev-input"
                    placeholder="0 = no day-specific cap"
                    value={day.capacity || ''}
                    onChange={(e) => update('days', (form.days ?? []).map((d, i) => (i === index ? { ...d, capacity: Math.max(0, Math.round(Number(e.target.value) || 0)) } : d)))}
                  />
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
                <p className="mb-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">Facilitators / anchors for this day (up to 6)</p>
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
                      className="shrink-0 text-xs font-medium text-slate-400 dark:text-slate-500 hover:text-rose-600"
                      onClick={() => update('days', (form.days ?? []).map((d, i) => (i === index ? { ...d, facilitators: (d.facilitators ?? []).filter((_, j) => j !== pIndex) } : d)))}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                {(day.facilitators ?? []).length < 6 ? (
                  <button
                    type="button"
                    className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:border-indigo-400 hover:text-indigo-600"
                    onClick={() => update('days', (form.days ?? []).map((d, i) => (i === index ? { ...d, facilitators: [...(d.facilitators ?? []), { name: '', title: '' }] } : d)))}
                  >
                    + Add facilitator
                  </button>
                ) : null}
              </div>
              <div className="mt-3">
                <p className="mb-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">Timed sessions (optional — for days with several programmes at different times/venues, up to 8)</p>
                {(day.sessions ?? []).map((session, sIndex) => (
                  <div key={sIndex} className={`mb-2 grid gap-2 ${(form.sections ?? []).some((sec) => sec.key && sec.name) ? 'sm:grid-cols-[110px_1fr_1fr_1fr_150px_auto]' : 'sm:grid-cols-[110px_1fr_1fr_1fr_auto]'}`}>
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
                    {(form.sections ?? []).some((sec) => sec.key && sec.name) ? (
                      <select
                        className="ev-input"
                        aria-label="Session track"
                        value={session.sectionKey ?? ''}
                        onChange={(e) => update('days', (form.days ?? []).map((d, i) => (i === index ? { ...d, sessions: (d.sessions ?? []).map((s, j) => (j === sIndex ? { ...s, sectionKey: e.target.value } : s)) } : d)))}
                      >
                        <option value="">All tracks</option>
                        {(form.sections ?? []).filter((sec) => sec.key && sec.name).map((sec) => (
                          <option key={sec.key} value={sec.key}>{sec.name} only</option>
                        ))}
                      </select>
                    ) : null}
                    <button
                      type="button"
                      className="shrink-0 self-center text-xs font-medium text-slate-400 dark:text-slate-500 hover:text-rose-600"
                      onClick={() => update('days', (form.days ?? []).map((d, i) => (i === index ? { ...d, sessions: (d.sessions ?? []).filter((_, j) => j !== sIndex) } : d)))}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                {(day.sessions ?? []).length < 8 ? (
                  <button
                    type="button"
                    className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:border-indigo-400 hover:text-indigo-600"
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
              className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:border-indigo-400 hover:text-indigo-600"
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
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Attendees check in each day with the same QR pass; certificates go to those who attend at least this many days.</p>
            </Field>
          ) : null}
          </>
          )}
        </Section>

        <Section title="Sections / tracks (parallel cohorts)">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Running parallel tracks in one event — like a Data Science track and a Coding track in the same 7-day workshop?
            Add them here. Attendees pick exactly <strong>one</strong> section when they register and follow it for the whole
            event; each section can have its own trainers (assign them in the Speakers step), venue and seat cap.
          </p>
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            Use sections only when attendees must <strong>choose one</strong>. If everyone attends everything (e.g. a morning
            Data Science block and an afternoon Coding block with different trainers), skip sections — build those blocks as
            timed sessions in the day agenda above and add the trainers in the Speakers step.
          </p>
          {(form.sections ?? []).map((section, index) => (
            <div key={section.key || `new-${index}`} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Section {index + 1}</span>
                <button type="button" className="text-xs font-medium text-slate-400 dark:text-slate-500 hover:text-rose-600" onClick={() => update('sections', (form.sections ?? []).filter((_, i) => i !== index))}>Remove</button>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Section name">
                  <input className="ev-input" placeholder="e.g. Data Science" value={section.name} onChange={(e) => update('sections', (form.sections ?? []).map((s, i) => (i === index ? { ...s, name: e.target.value.slice(0, 80) } : s)))} />
                </Field>
                <Field label="Venue (if different)">
                  <input className="ev-input" placeholder="Defaults to the event venue" value={section.venue} onChange={(e) => update('sections', (form.sections ?? []).map((s, i) => (i === index ? { ...s, venue: e.target.value.slice(0, 160) } : s)))} />
                </Field>
                <Field label="Seat cap (optional)">
                  <input
                    type="number"
                    min={0}
                    className="ev-input"
                    placeholder="0 = unlimited"
                    value={section.capacity || ''}
                    onChange={(e) => update('sections', (form.sections ?? []).map((s, i) => (i === index ? { ...s, capacity: Math.max(0, Math.round(Number(e.target.value) || 0)) } : s)))}
                  />
                </Field>
              </div>
              <div className="mt-3">
                <Field label="What this section covers (shown on the section picker)">
                  <textarea
                    className="ev-input min-h-16"
                    placeholder="e.g. Python, pandas, and machine learning fundamentals — no prior experience needed"
                    value={section.description}
                    onChange={(e) => update('sections', (form.sections ?? []).map((s, i) => (i === index ? { ...s, description: e.target.value.slice(0, 300) } : s)))}
                  />
                </Field>
              </div>
            </div>
          ))}
          {(form.sections ?? []).length < 10 ? (
            <button
              type="button"
              className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:border-indigo-400 hover:text-indigo-600"
              onClick={() => update('sections', [...(form.sections ?? []), { key: '', name: '', description: '', capacity: 0, venue: '' }])}
            >
              + Add section
            </button>
          ) : null}
          {(form.sections ?? []).length > 0 ? (
            <p className="text-xs text-amber-600 dark:text-amber-400">Sections can be renamed but not removed after publishing — attendees register into them.</p>
          ) : null}
        </Section>

        </div>

        <div className={step === 1 ? 'space-y-6' : 'hidden'}>
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
          <p className="text-xs text-slate-500 dark:text-slate-400">Shown on the event page so attendees can reach the organizers (up to 3). Each contact needs a phone or email.</p>
          {(form.contacts ?? []).map((contact, index) => (
            <div key={index} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Name"><input className="ev-input" placeholder="e.g. Amina Bello" value={contact.name} onChange={(e) => update('contacts', (form.contacts ?? []).map((c, i) => (i === index ? { ...c, name: e.target.value.slice(0, 60) } : c)))} /></Field>
                <Field label="Phone / WhatsApp"><input className="ev-input" placeholder="e.g. 0803 123 4567" value={contact.phone} onChange={(e) => update('contacts', (form.contacts ?? []).map((c, i) => (i === index ? { ...c, phone: e.target.value.slice(0, 30) } : c)))} /></Field>
                <Field label="Email"><input className="ev-input" placeholder="e.g. events@club.org" value={contact.email} onChange={(e) => update('contacts', (form.contacts ?? []).map((c, i) => (i === index ? { ...c, email: e.target.value.slice(0, 120) } : c)))} /></Field>
              </div>
              <div className="mt-2 flex items-center justify-between">
                {contact.name && !contact.phone && !contact.email ? (
                  <span className="text-xs font-medium text-rose-600">Add a phone or email — contacts without one aren’t saved.</span>
                ) : <span />}
                <button type="button" className="text-xs font-medium text-slate-400 dark:text-slate-500 hover:text-rose-600" onClick={() => update('contacts', (form.contacts ?? []).filter((_, i) => i !== index))}>Remove</button>
              </div>
            </div>
          ))}
          {(form.contacts ?? []).length < 3 ? (
            <button
              type="button"
              className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:border-indigo-400 hover:text-indigo-600"
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
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Recommended size: <span className="font-semibold">1600 × 800 px</span> (2:1 landscape) · JPG or PNG · up to 5 MB. The preview below shows exactly how it will be cropped on the event page.</p>
            {uploading ? <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Uploading…</p> : null}
            {form.bannerImage ? <img src={resolveEventImageUrl(form.bannerImage)} alt="Banner" className="mt-3 aspect-[2/1] w-full rounded-2xl object-cover" /> : null}
          </Field>
          <Field label="Flyers & photos (optional, up to 6)">
            <input type="file" accept="image/*" multiple onChange={(e) => { void handleGalleryUpload(e.target.files); e.target.value = ''; }} />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Event flyers, speaker cards, past-edition photos — shown as a slideshow on the event page.</p>
            {(form.gallery ?? []).length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {(form.gallery ?? []).map((img, i) => (
                  <div key={img} className="relative">
                    <img src={resolveEventImageUrl(img)} alt={`Gallery ${i + 1}`} className="h-20 w-20 rounded-xl border border-slate-200 dark:border-slate-800 object-cover" />
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
            <SelectMenu
              aria-label="Registration policy"
              value={form.registrationPolicy ?? 'OPEN'}
              onChange={(v) => update('registrationPolicy', v as EventInput['registrationPolicy'])}
              options={[
                { value: 'OPEN', label: 'Open', description: 'Anyone registers instantly' },
                { value: 'APPROVAL', label: 'Approval', description: 'You approve each request' },
                { value: 'INVITE', label: 'Invite only', description: 'Only people with your invite link' },
              ]}
            />
            {form.registrationPolicy === 'INVITE' ? (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">After publishing, use “Copy invite link” on the Events dashboard — only people who open that link can register.</p>
            ) : null}
          </Field>
          <Field label="Registration questions (optional)" as="div">
            <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
              Ask attendees for anything you need at sign-up — phone number, matric number, T-shirt size, dietary needs.
              Phone numbers prefill from the attendee&apos;s profile so most people never type them. Answers appear on the Attendees page and in the report.
            </p>
            {(form.registrationQuestions ?? []).length ? (
              <div className="mb-1 grid grid-cols-[1fr_130px_1fr_78px_32px] gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                <span>Question</span><span>Type</span><span>Choices</span><span>Required</span><span />
              </div>
            ) : null}
            {(form.registrationQuestions ?? []).map((q, i) => (
              <div key={i} className="mb-2 grid grid-cols-[1fr_130px_1fr_78px_32px] items-center gap-2">
                <input
                  className="ev-input"
                  placeholder="e.g. Matric number"
                  maxLength={120}
                  value={q.label}
                  onChange={(e) => {
                    const qs = [...(form.registrationQuestions ?? [])];
                    qs[i] = { ...qs[i], label: e.target.value };
                    update('registrationQuestions', qs);
                  }}
                />
                <select
                  className="ev-input"
                  aria-label="Question type"
                  value={q.type}
                  onChange={(e) => {
                    const qs = [...(form.registrationQuestions ?? [])];
                    qs[i] = { ...qs[i], type: e.target.value as (typeof qs)[number]['type'] };
                    update('registrationQuestions', qs);
                  }}
                >
                  <option value="TEXT">Text</option>
                  <option value="PHONE">Phone number</option>
                  <option value="SELECT">Dropdown</option>
                  <option value="YES_NO">Yes / No</option>
                </select>
                {q.type === 'SELECT' ? (
                  <input
                    className="ev-input"
                    placeholder="Comma-separated, e.g. S, M, L, XL"
                    title="Choices for the dropdown (comma-separated)"
                    value={q.options.join(', ')}
                    onChange={(e) => {
                      const qs = [...(form.registrationQuestions ?? [])];
                      qs[i] = { ...qs[i], options: e.target.value.split(',').map((v) => v.trimStart()).slice(0, 10) };
                      update('registrationQuestions', qs);
                    }}
                  />
                ) : (
                  <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
                )}
                <input
                  type="checkbox"
                  aria-label="Required"
                  className="h-4 w-4 justify-self-center accent-indigo-600"
                  checked={q.required}
                  onChange={(e) => {
                    const qs = [...(form.registrationQuestions ?? [])];
                    qs[i] = { ...qs[i], required: e.target.checked };
                    update('registrationQuestions', qs);
                  }}
                />
                <button
                  type="button"
                  title="Remove question"
                  onClick={() => update('registrationQuestions', (form.registrationQuestions ?? []).filter((_, idx) => idx !== i))}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 hover:text-rose-600"
                >
                  ×
                </button>
              </div>
            ))}
            {(form.registrationQuestions ?? []).length < 8 ? (
              <button
                type="button"
                className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:border-indigo-400 hover:text-indigo-600"
                onClick={() => update('registrationQuestions', [...(form.registrationQuestions ?? []), { key: '', label: '', type: 'TEXT' as const, options: [], required: false }])}
              >
                + Add question
              </button>
            ) : null}
          </Field>
          {(() => {
            // Resolve the entry mode: the organizer's explicit pick wins; otherwise infer from saved data.
            const ticketing: 'FREE' | 'PAID' =
              ticketChoice ?? (((form.ticketPrice ?? 0) > 0 || (form.ticketTiers ?? []).length > 0) ? 'PAID' : 'FREE');
            const pickFree = () => {
              setTicketChoice('FREE');
              updateForm({
                ticketPrice: 0,
                ticketTiers: [],
                ticketPromoCodes: [],
                ticketGroupDiscount: { minQuantity: 0, percentOff: 0 },
              });
            };
            return (
              <>
                <Field label="Entry" as="div">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={pickFree}
                      className={`flex-1 rounded-2xl border px-4 py-3 text-left text-sm transition ${ticketing === 'FREE' ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-500/15 font-semibold text-indigo-800 dark:text-indigo-200' : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-indigo-200'}`}
                    >
                      Free event
                      <span className="mt-0.5 block text-xs font-normal text-slate-500 dark:text-slate-400">No tickets, no payment — attendees just register and get a QR pass.</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTicketChoice('PAID')}
                      className={`flex-1 rounded-2xl border px-4 py-3 text-left text-sm transition ${ticketing === 'PAID' ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-500/15 font-semibold text-indigo-800 dark:text-indigo-200' : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-indigo-200'}`}
                    >
                      Paid tickets
                      <span className="mt-0.5 block text-xs font-normal text-slate-500 dark:text-slate-400">Sell tickets through GuildOS — card, bank transfer, or USSD.</span>
                    </button>
                  </div>
                </Field>
                {ticketing === 'PAID' ? (
                  <>
          <Field label="Ticket price (₦)">
            <input
              type="number"
              min={0}
              className="ev-input"
              value={form.ticketPrice ?? 0}
              disabled={(form.ticketTiers ?? []).length > 0}
              onChange={(e) => update('ticketPrice', Math.max(0, Math.round(Number(e.target.value) || 0)))}
            />
            {(form.ticketPrice ?? 0) === 0 && !(form.ticketTiers ?? []).some((t) => t.price > 0) ? (
              <p className="mt-1 rounded-lg bg-amber-50 dark:bg-amber-950/50 px-2.5 py-1.5 text-xs font-medium text-amber-800 dark:text-amber-300">
                Set a ticket price (or add priced ticket types below) — otherwise every ticket is issued free. If the event has no tickets at all, pick “Free event” above.
              </p>
            ) : null}
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {(form.ticketTiers ?? []).length > 0 ? 'Ticket types below set the prices for this event. ' : ''}
              Paid events register through a secure checkout — buyers pay the ticket price plus the processing fee (card, bank transfer, or USSD via the payment provider).
              GuildOS keeps {ticketCommission !== null ? `a ${ticketCommission}% commission on` : 'a small commission of'} each ticket — you receive the rest in your <a href="/dashboard/wallet" className="text-indigo-600 hover:underline">Wallet</a>.
              {(form.ticketPrice ?? 0) > 0 && ticketCommission !== null ? ` Example: on a ₦${(form.ticketPrice ?? 0).toLocaleString('en-NG')} ticket you earn ₦${((form.ticketPrice ?? 0) - Math.round(((form.ticketPrice ?? 0) * ticketCommission) / 100)).toLocaleString('en-NG')}.` : ''}
              {(form.ticketPrice ?? 0) > 0 && form.registrationPolicy === 'APPROVAL' ? ' Note: paid tickets confirm instantly (approval doesn\u2019t apply to paid registrations).' : ''}
            </p>
          </Field>
          <Field label="Ticket types (optional — e.g. Early Bird / Regular / VIP)">
            {(form.ticketTiers ?? []).length ? (
              (() => {
                const hasTierDays = (form.days ?? []).length > 1;
                const hasTierSections = (form.sections ?? []).some((s) => s.key && s.name);
                const grid = hasTierDays
                  ? hasTierSections ? 'grid-cols-[1fr_90px_80px_95px_120px_32px]' : 'grid-cols-[1fr_100px_90px_110px_32px]'
                  : hasTierSections ? 'grid-cols-[1fr_100px_90px_120px_32px]' : 'grid-cols-[1fr_110px_100px_32px]';
                return (
                  <div className={`mb-1 grid ${grid} gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500`}>
                    <span>Name</span><span>Price (₦)</span><span>Available</span>{hasTierDays ? <span>Days</span> : null}{hasTierSections ? <span>Track</span> : null}<span />
                  </div>
                );
              })()
            ) : null}
            {(form.ticketTiers ?? []).map((tier, i) => {
              const hasTierDays = (form.days ?? []).length > 1;
              const hasTierSections = (form.sections ?? []).some((s) => s.key && s.name);
              const grid = hasTierDays
                ? hasTierSections ? 'grid-cols-[1fr_90px_80px_95px_120px_32px]' : 'grid-cols-[1fr_100px_90px_110px_32px]'
                : hasTierSections ? 'grid-cols-[1fr_100px_90px_120px_32px]' : 'grid-cols-[1fr_110px_100px_32px]';
              return (
              <div key={i} className={`mb-2 grid ${grid} items-center gap-2`}>
                <input className="ev-input" placeholder="Name (e.g. VIP)" value={tier.name} onChange={(e) => {
                  const tiers = [...(form.ticketTiers ?? [])];
                  tiers[i] = { ...tiers[i], name: e.target.value };
                  update('ticketTiers', tiers);
                }} />
                <input className="ev-input" type="number" min={0} placeholder="Price ₦" title="Price (₦)" value={tier.price} onChange={(e) => {
                  const tiers = [...(form.ticketTiers ?? [])];
                  tiers[i] = { ...tiers[i], price: Math.max(0, Math.round(Number(e.target.value) || 0)) };
                  update('ticketTiers', tiers);
                }} />
                <input className="ev-input" type="number" min={0} placeholder="Qty (0=∞)" title="Capacity (0 = unlimited)" value={tier.capacity} onChange={(e) => {
                  const tiers = [...(form.ticketTiers ?? [])];
                  tiers[i] = { ...tiers[i], capacity: Math.max(0, Math.round(Number(e.target.value) || 0)) };
                  update('ticketTiers', tiers);
                }} />
                {hasTierDays ? (
                  <input className="ev-input" placeholder="All days" title="Which days this ticket covers, e.g. 1,3 (blank = whole event)" value={(tier.days ?? []).join(',')} onChange={(e) => {
                    const tiers = [...(form.ticketTiers ?? [])];
                    const days = [...new Set(e.target.value.split(',').map((v) => Math.round(Number(v.trim()))))].filter((d) => Number.isFinite(d) && d >= 1 && d <= (form.days ?? []).length).sort((a, b) => a - b);
                    tiers[i] = { ...tiers[i], days };
                    update('ticketTiers', tiers);
                  }} />
                ) : null}
                {hasTierSections ? (
                  <select
                    className="ev-input"
                    aria-label="Tier track"
                    title="Buying this ticket registers the attendee into this track (Any = buyer picks)"
                    value={tier.sectionKey ?? ''}
                    onChange={(e) => {
                      const tiers = [...(form.ticketTiers ?? [])];
                      tiers[i] = { ...tiers[i], sectionKey: e.target.value };
                      update('ticketTiers', tiers);
                    }}
                  >
                    <option value="">Any track</option>
                    {(form.sections ?? []).filter((s) => s.key && s.name).map((s) => (
                      <option key={s.key} value={s.key}>{s.name}</option>
                    ))}
                  </select>
                ) : null}
                <button type="button" title="Remove tier" onClick={() => update('ticketTiers', (form.ticketTiers ?? []).filter((_, idx) => idx !== i))} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 hover:text-rose-600">×</button>
              </div>
              );
            })}
            {(form.ticketTiers ?? []).length < 5 ? (
              <button type="button" onClick={() => update('ticketTiers', [...(form.ticketTiers ?? []), { name: '', price: 0, capacity: 0 }])} className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:border-indigo-300 hover:text-indigo-600">
                + Add ticket type
              </button>
            ) : null}
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Name + price + how many are available (0 = unlimited). A ₦0 tier is a free ticket — great for members-only free entry alongside paid VIP.
              {(form.days ?? []).length > 1 ? ' Days: e.g. "2" sells a Day-2-only pass (comma-separate for several days; blank covers the whole event) — the scanner enforces it.' : ''}
            </p>
          </Field>
          {(form.ticketPrice ?? 0) > 0 || (form.ticketTiers ?? []).length > 0 ? (
            <Field label="Promo codes (optional)">
              {(form.ticketPromoCodes ?? []).length ? (
                <div className="mb-1 grid grid-cols-[1fr_110px_110px_32px] gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  <span>Code</span><span>% off</span><span>Max uses</span><span />
                </div>
              ) : null}
              {(form.ticketPromoCodes ?? []).map((promo, i) => (
                <div key={i} className="mb-2 grid grid-cols-[1fr_110px_110px_32px] items-center gap-2">
                  <input className="ev-input uppercase" placeholder="CODE (e.g. EARLY10)" value={promo.code} onChange={(e) => {
                    const codes = [...(form.ticketPromoCodes ?? [])];
                    codes[i] = { ...codes[i], code: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 20) };
                    update('ticketPromoCodes', codes);
                  }} />
                  <input className="ev-input" type="number" min={1} max={100} placeholder="% off" title="Percent off (1–100)" value={promo.percentOff} onChange={(e) => {
                    const codes = [...(form.ticketPromoCodes ?? [])];
                    codes[i] = { ...codes[i], percentOff: Math.min(100, Math.max(1, Math.round(Number(e.target.value) || 1))) };
                    update('ticketPromoCodes', codes);
                  }} />
                  <input className="ev-input" type="number" min={0} placeholder="Uses (0=∞)" title="Max uses (0 = unlimited)" value={promo.maxUses} onChange={(e) => {
                    const codes = [...(form.ticketPromoCodes ?? [])];
                    codes[i] = { ...codes[i], maxUses: Math.max(0, Math.round(Number(e.target.value) || 0)) };
                    update('ticketPromoCodes', codes);
                  }} />
                  <button type="button" title="Remove code" onClick={() => update('ticketPromoCodes', (form.ticketPromoCodes ?? []).filter((_, idx) => idx !== i))} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 hover:text-rose-600">×</button>
                </div>
              ))}
              {(form.ticketPromoCodes ?? []).length < 10 ? (
                <button type="button" onClick={() => update('ticketPromoCodes', [...(form.ticketPromoCodes ?? []), { code: '', percentOff: 10, maxUses: 0 }])} className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:border-indigo-300 hover:text-indigo-600">
                  + Add promo code
                </button>
              ) : null}
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Share codes with partner communities or early birds — a 100% code makes the ticket free for that buyer. Max uses 0 = unlimited.</p>
            </Field>
          ) : null}
          {(form.ticketPrice ?? 0) > 0 || (form.ticketTiers ?? []).length > 0 ? (
            <Field label="Group discount (optional — e.g. buy 3+, save 10%)">
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <span>Buy</span>
                <input
                  type="number"
                  min={0}
                  max={10}
                  className="ev-input w-20"
                  value={form.ticketGroupDiscount?.minQuantity ?? 0}
                  onChange={(e) => update('ticketGroupDiscount', { minQuantity: Math.max(0, Math.round(Number(e.target.value) || 0)), percentOff: form.ticketGroupDiscount?.percentOff ?? 0 })}
                />
                <span>or more tickets, each is</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className="ev-input w-20"
                  value={form.ticketGroupDiscount?.percentOff ?? 0}
                  onChange={(e) => update('ticketGroupDiscount', { minQuantity: form.ticketGroupDiscount?.minQuantity ?? 0, percentOff: Math.min(100, Math.max(0, Math.round(Number(e.target.value) || 0))) })}
                />
                <span>% off</span>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Set both to activate (minimum 2 tickets). If a buyer also has a promo code, they get whichever discount is bigger — never both.</p>
            </Field>
          ) : null}
          {(form.ticketPrice ?? 0) > 0 || (form.ticketTiers ?? []).length > 0 ? (
            <Field label="Ticket design">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => update('ticketTemplate', '')}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-semibold ${!form.ticketTemplate ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400'}`}
                >
                  GuildOS design
                </button>
                <label className={`cursor-pointer rounded-xl border px-3 py-1.5 text-xs font-semibold ${form.ticketTemplate ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400'}`}>
                  {form.ticketTemplate ? 'Your design ✓ (replace)' : 'Upload your own design'}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { void handleTicketTemplateUpload(e.target.files?.[0] ?? null); e.target.value = ''; }} />
                </label>
              </div>
              {form.ticketTemplate ? (
                <div className="mt-2">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">QR code position on your design</span>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {TICKET_QR_PLACEMENTS.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => update('ticketQrPlacement', p.value)}
                        className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium ${(form.ticketQrPlacement ?? 'BOTTOM_RIGHT') === p.value ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400'}`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Leave a clear area for the QR — it's drawn on a white card so it scans on any artwork.</p>
                </div>
              ) : (
                <>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Buyers can download a branded ticket with their personal check-in QR. Upload your own flyer-style design to replace the GuildOS look.</p>
                  <div className="mt-2">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Ticket look</span>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {TICKET_STYLES.map((s) => (
                        <button
                          key={s.value}
                          type="button"
                          title={s.desc}
                          onClick={() => update('ticketStyle', s.value)}
                          className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium ${(form.ticketStyle ?? 'MIDNIGHT') === s.value ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400'}`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="mr-1 text-xs font-medium text-slate-600 dark:text-slate-400">Accent</span>
                      {['#6366f1', '#0f766e', '#059669', '#b91c1c', '#e11d48', '#d97706', '#0369a1', '#7c3aed', '#1e293b'].map((c) => (
                        <button
                          key={c}
                          type="button"
                          aria-label={`Accent ${c}`}
                          onClick={() => update('ticketAccent', c)}
                          className={`h-6 w-6 rounded-full ring-offset-1 transition ${(form.ticketAccent ?? '#6366f1').toLowerCase() === c ? 'ring-2 ring-slate-900' : 'ring-1 ring-slate-200 dark:ring-slate-800'}`}
                          style={{ background: c }}
                        />
                      ))}
                      <input
                        type="color"
                        value={form.ticketAccent ?? '#6366f1'}
                        onChange={(e) => update('ticketAccent', e.target.value)}
                        className="h-6 w-6 cursor-pointer rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-0.5"
                        aria-label="Custom accent colour"
                      />
                    </div>
                  </div>
                </>
              )}
              <TicketPreview
                eventTitle={form.title || 'Your event'}
                communityName="Your community"
                dateLabel={form.startDate ? new Date(form.startDate).toLocaleDateString('en-NG', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) : 'Event date'}
                venueLabel={form.mode === 'VIRTUAL' ? 'Online event' : form.venue || 'Venue'}
                priceLabel={`₦${(form.ticketPrice ?? 0).toLocaleString('en-NG')}`}
                tierLabel={(form.ticketTiers ?? [])[0]?.name || 'General Admission'}
                templateImage={form.ticketTemplate || ''}
                qrPlacement={form.ticketQrPlacement ?? 'BOTTOM_RIGHT'}
                style={form.ticketStyle ?? 'MIDNIGHT'}
                accent={form.ticketAccent ?? '#6366f1'}
              />
            </Field>
          ) : null}
                  </>
                ) : null}
              </>
            );
          })()}
          <Field label="Registration Deadline"><input type="datetime-local" className="ev-input" value={toLocalInput(form.registrationDeadline)} onChange={(e) => update('registrationDeadline', e.target.value ? new Date(e.target.value).toISOString() : null)} /></Field>
          <Toggle label="Allow walk-ins" checked={Boolean(form.allowWalkIns)} onChange={(v) => update('allowWalkIns', v)} />
          <Toggle label="Enable QR attendance" checked={Boolean(form.qrEnabled)} onChange={(v) => update('qrEnabled', v)} />
          <Field label="Visibility">
            <SelectMenu
              aria-label="Visibility"
              value={form.visibility ?? 'PUBLIC'}
              onChange={(v) => update('visibility', v as EventInput['visibility'])}
              options={['PUBLIC', 'PRIVATE', 'UNLISTED'].map((v) => ({ value: v, label: v }))}
            />
          </Field>
        </Section>

        </div>

        <div className={step === 2 ? 'space-y-6' : 'hidden'}>
        <Section title="Thank-you email (after the event)">
          <div className="grid gap-3 sm:grid-cols-3">
            {([
              { value: 'AUTO' as const, title: 'Auto', desc: 'System sends a branded thank-you to attendees automatically when certificates are issued.' },
              { value: 'CUSTOM' as const, title: 'Custom', desc: 'You design the email yourself (tone, subject, message, button) from the Attendees page.' },
              { value: 'OFF' as const, title: 'Off', desc: 'No thank-you email is sent.' },
            ]).map((opt) => (
              <label key={opt.value} className={`cursor-pointer rounded-2xl border p-4 transition ${(form.appreciationMode ?? 'AUTO') === opt.value ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-300'}`}>
                <input type="radio" name="appreciationMode" className="sr-only" checked={(form.appreciationMode ?? 'AUTO') === opt.value} onChange={() => update('appreciationMode', opt.value)} />
                <p className="font-semibold text-slate-900 dark:text-slate-100">{opt.title}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{opt.desc}</p>
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
          premiumHref={communityId ? `/dashboard/premium?communityId=${communityId}` : '/dashboard/premium'}
          communityId={communityId}
          eventTitle={form.title ?? ''}
          partners={form.partners ?? []}
          onUnlockEvent={!isPremium && !eventUnlocked && paymentsEnabled ? handleUnlockEvent : undefined}
          eventUnlockTotal={eventTotal}
          eventUnlockBusy={unlockBusy}
          onPayFromWallet={!isPremium && !eventUnlocked && (eventPrice ?? 0) > 0 && walletBalance >= (eventPrice ?? 0) ? handlePayFromWallet : undefined}
          walletBalanceNgn={walletBalance}
          eventWalletPrice={eventPrice}
          onCheckPayment={!isPremium && !eventUnlocked && paymentsEnabled && eventId ? handleCheckEventPayment : undefined}
          minimumAttendanceDuration={form.minimumAttendanceDuration ?? 0}
          checkOutRequired={Boolean(form.checkOutRequired)}
          onChange={updateForm}
          onError={setError}
        />
        </div>

        <div className={step === 3 ? 'space-y-6' : 'hidden'}>
        <SpeakersSponsorsEditor
          initialEventId={eventId}
          initialSpeakers={speakers}
          initialSponsors={sponsors}
          dayCount={(form.days ?? []).length}
          sections={(form.sections ?? []).filter((s) => s.key && s.name)}
          pendingPeople={pendingPeople}
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
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {step > 0 ? (
            <Button variant="ghost" onClick={() => goToStep(step - 1)}>← {WIZARD_STEPS[step - 1].label}</Button>
          ) : null}
          {step < WIZARD_STEPS.length - 1 ? (
            <Button variant="secondary" onClick={() => goToStep(step + 1)}>Next: {WIZARD_STEPS[step + 1].label} →</Button>
          ) : null}
          <span className="ml-auto flex w-full flex-wrap gap-3 sm:w-auto">
            {isEditing && eventStatus && eventStatus !== 'DRAFT' ? (
              // Already published (or further along) — just save the edits, no publish step.
              <Button variant="primary" onClick={() => void handleSaveDraft()} disabled={!canSave || saving}>{saving ? 'Saving…' : 'Save Changes'}</Button>
            ) : (
              <>
                <Button variant="secondary" onClick={() => void handleSaveDraft()} disabled={!canSave || saving}>{saving ? 'Saving…' : 'Save Draft'}</Button>
                <Button variant="primary" onClick={() => void handlePublish()} disabled={!canSave || saving}>Publish Event</Button>
              </>
            )}
            <Button variant="ghost" onClick={() => router.push('/dashboard/events')}>Cancel</Button>
          </span>
        </div>
      </div>
    </DashboardShell>
  );
}
