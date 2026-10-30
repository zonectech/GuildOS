'use client';
import { EventQuickSettings } from '../../../../components/guildos/events/event-quick-settings';

import { LogoSpinner } from '../../../../components/guildos/ui/loading';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { EditorModal, EditorOption } from '../../../../components/guildos/ui/editor-modal';
import { EventCoverEditor } from '../../../../components/guildos/events/event-cover-editor';

import { getCurrentUser } from '../../../../components/guildos/api/auth-api';
import { getManagedCommunities, type CommunitySummary } from '../../../../components/guildos/api/community-list-api';
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
  type EventInput,
  type RichEventDraft,
  type EventSpeaker,
  type EventSponsor,
} from '../../../../components/guildos/api/event-api';
import { DashboardShell } from '../../../../components/guildos/dashboard/dashboard-shell';
import { DashboardSidebar } from '../../../../components/guildos/dashboard/dashboard-sidebar';
import { DashboardTopbar } from '../../../../components/guildos/dashboard/dashboard-topbar';
import { navigateBack } from '../../../../components/guildos/back-navigation';
import { Button } from '../../../../components/guildos/ui/button';
import { SectionHeader } from '../../../../components/guildos/ui/section-header';
import { EventLinkImport } from '../../../../components/guildos/events/event-link-import';
import { AiEventAssistant } from '../../../../components/guildos/events/ai-event-assistant';
import { CertificateDesigner } from '../../../../components/guildos/events/certificate-designer';
import { SpeakersSponsorsEditor } from '../../../../components/guildos/events/speakers-sponsors-editor';
import { SponsorshipEditor } from '../../../../components/guildos/events/sponsorship-editor';
import { PartnershipEditor } from '../../../../components/guildos/events/partnership-editor';

import { DEFAULT_CONTENT, DEFAULT_PLACEMENT, DEFAULT_THEME, emptyForm, namedSections } from './_components/form-model';
import { isMultiDayDraft, mergeDraftIntoForm } from './_components/apply-draft';
import { AppreciationSection, BasicInfoSection, ScheduleSection } from './_components/basics-sections';
import { EventDaysSection, TracksSection } from './_components/agenda-sections';
import { CapacitySection, ContactsSection, LocationSection, MediaSection } from './_components/logistics-sections';
import { RegistrationSection } from './_components/registration-section';

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
  const [communityId, setCommunityId] = useState('');
  const [managedCommunities, setManagedCommunities] = useState<CommunitySummary[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState<EventInput>(emptyForm);
  // Single-day vs day-by-day agenda — hides the day editor until the organizer opts in.
  const [agendaMode, setAgendaMode] = useState<'SINGLE' | 'MULTI'>('SINGLE');
  const [eventId, setEventId] = useState('');
  const [eventStatus, setEventStatus] = useState('');
  const [speakers, setSpeakers] = useState<EventSpeaker[]>([]);
  const [sponsors, setSponsors] = useState<EventSponsor[]>([]);
  const [pendingPeople, setPendingPeople] = useState<RichEventDraft['people']>(undefined);
  const [saving, setSaving] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [eventUnlocked, setEventUnlocked] = useState(false);
  const [eventTotal, setEventTotal] = useState<number | undefined>(undefined);
  const [eventPrice, setEventPrice] = useState<number | undefined>(undefined);
  const [walletBalance, setWalletBalance] = useState(0);
  const [paymentsEnabled, setPaymentsEnabled] = useState(false);
  const [unlockBusy, setUnlockBusy] = useState(false);
  const [verifiedRef, setVerifiedRef] = useState('');
  const [ticketCommission, setTicketCommission] = useState<number | null>(null);
  const [panel, setPanel] = useState<string | null>(null);

  const isEditing = Boolean(slug);

  useEffect(() => {
    void getTicketSettings().then(({ commissionPercent }) => setTicketCommission(commissionPercent)).catch(() => undefined);
  }, []);

  // Seed the community from the URL once, then load the picker options (skipped once editing an existing event—its community is fixed).
  useEffect(() => {
    const fromUrl = params.get('communityId');
    if (fromUrl) setCommunityId(fromUrl);
  }, [params]);

  useEffect(() => {
    if (slug) return; // editing an existing event—community is fixed, no picker needed
    void getManagedCommunities()
      .then((res) => {
        setManagedCommunities(res.communities);
        // Only one community to manage? Pick it automatically—one less click.
        if (res.communities.length === 1 && !communityId) setCommunityId(res.communities[0]._id);
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
          setCommunityId(detail.event.communityId ?? '');
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
    if (!communityId) return;
    void (async () => {
      try {
        const status = await getPremiumStatus(communityId);
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

  /** Runs a save/payment action with a busy flag; errors land in the banner. */
  async function run(setBusy: (busy: boolean) => void, action: () => Promise<void>, fallbackError: string) {
    try {
      setBusy(true);
      setError('');
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : fallbackError);
    } finally {
      setBusy(false);
    }
  }

  const handleSaveDraft = () => run(setSaving, async () => {
    await ensureSaved();
    router.push('/dashboard/events');
  }, 'Unable to save event');

  const handlePublish = () => run(setSaving, async () => {
    await publishEvent(await ensureSaved());
    router.push('/dashboard/events');
  }, 'Unable to publish event');

  async function handleUnlockEvent() {
    try {
      setUnlockBusy(true);
      setError('');
      const { authorizationUrl } = await startEventPremiumCheckout(await ensureSaved());
      // Leaving for the gateway — keep the button busy until the page unloads.
      window.location.assign(authorizationUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start payment');
      setUnlockBusy(false);
    }
  }

  /** Unlock this event's premium using the community ticket wallet (no gateway needed). */
  const handlePayFromWallet = () => run(setUnlockBusy, async () => {
    await payEventPremiumFromWallet(await ensureSaved());
    setEventUnlocked(true);
    setWalletBalance((b) => Math.max(0, b - (eventPrice ?? 0)));
  }, 'Unable to pay from wallet');

  const handleCheckEventPayment = () => run(setUnlockBusy, async () => {
    if (!eventId) return;
    const result = await reconcileEventPayment(eventId);
    if (result.unlocked) {
      setEventUnlocked(true);
    } else {
      setError(result.pending > 0 ? 'Payment still pending. If you were charged, try again in a minute.' : 'No pending payment found for this event.');
    }
  }, 'Unable to check payment');

  function applyDraft(draft: RichEventDraft) {
    setForm((current) => mergeDraftIntoForm(current, draft));
    if (isMultiDayDraft(draft)) setAgendaMode('MULTI');
    // Queue extracted speakers/trainers for the SpeakersSponsorsEditor
    if (draft.people?.length) setPendingPeople(draft.people);
  }

  const canSave = useMemo(() => Boolean(communityId && (form.title ?? '').trim()), [communityId, form.title]);
  const premiumActive = isPremium || eventUnlocked;
  // Published events with a day agenda can't drop days — tickets/RSVPs reference Day N.
  const daysLocked = Boolean(eventId) && eventStatus !== '' && eventStatus !== 'DRAFT' && (form.days ?? []).length > 1;
  const sectionProps = { form, update };

  if (isLoading) {
    return (
      <DashboardShell sidebar={<DashboardSidebar />} topbar={<DashboardTopbar />}>
        <div className="flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 shadow-sm">
          <LogoSpinner />
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell sidebar={<DashboardSidebar />} topbar={<DashboardTopbar />}>
      <div className="mx-auto w-full max-w-6xl">
        <button onClick={() => navigateBack(router, '/dashboard/events')} className="mb-6 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white"><ArrowLeft className="h-4 w-4"/> Back to events</button>
        {error ? <p role="alert" className="mb-5 rounded-lg bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p> : null}
        <div className="grid items-start gap-8 lg:grid-cols-[420px_minmax(0,1fr)] lg:gap-12">
          <div className="space-y-4 lg:sticky lg:top-6"><EventCoverEditor value={form.bannerImage || ''} onChange={value => update('bannerImage', value)} onError={setError} title={form.title} type={form.type}/><button type="button" onClick={()=>setPanel('media')} className="text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white">Add gallery or change image settings →</button>{!isEditing ? <button type="button" onClick={()=>setPanel('import')} className="block w-full rounded-lg border border-slate-200 px-4 py-3 text-left text-sm dark:border-slate-800">Import an existing event or use a planning brief →</button> : null}</div>
          <div className="min-w-0 space-y-6">
      {!isEditing ? (
        <div className="mb-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Community</label>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Which community is this event for? Ticket pricing, certificates, and premium all follow this choice.</p>
          {managedCommunities.length ? (
            <div className="mt-2 max-w-sm">
              <SelectMenu
                aria-label="Community"
                disabled={Boolean(eventId)}
                value={communityId}
                onChange={setCommunityId}
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
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/50 dark:text-amber-300">Pick a community above to continue.</div>
      ) : null}


            <div><label htmlFor="event-editor-title" className="text-xs font-medium text-slate-500">{isEditing ? 'Edit event' : 'Create event'}</label><input id="event-editor-title" value={form.title || ''} onChange={e=>update('title',e.target.value)} placeholder="Event name" style={{ background: 'transparent' }} className="mt-2 w-full border-0 bg-transparent p-0 text-3xl font-semibold tracking-tight text-slate-950 outline-none placeholder:text-slate-400 dark:text-white sm:text-4xl"/></div>
            <div className="[&>section]:border-0 [&>section]:bg-transparent [&>section]:p-0 [&>section]:shadow-none [&>section>div]:grid [&>section>div]:gap-3 sm:[&>section>div]:grid-cols-2 [&>section>div>*]:!mt-0 [&>section>div>label:last-child]:col-span-full"><ScheduleSection {...sectionProps}/></div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900">
              <EditorOption label="Location & format" value={form.venue || (form.mode==='VIRTUAL'?'Online event':'Add location')} onClick={()=>setPanel('location')}/>
              <EditorOption label="Description & details" value={form.shortDescription || (form.description?'Description added':'Add description')} onClick={()=>setPanel('details')}/>
            </div>
            <EventQuickSettings {...sectionProps}/>
            <section><h2 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">Event options</h2><div className="rounded-xl border border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900">
              <EditorOption label="Tickets & registration" value={form.attendanceSource==='EXTERNAL'?'External registration':(form.ticketPrice || 0)>0?'Paid tickets':'Free'} onClick={()=>setPanel('registration')}/>
              <EditorOption label="Capacity" value={form.capacity?String(form.capacity):'Unlimited'} onClick={()=>setPanel('capacity')}/>
              <EditorOption label="Agenda & tracks" value={form.days?.length?form.days.length+(form.days.length===1?' day':' days'):'Single schedule'} onClick={()=>setPanel('agenda')}/>
              <EditorOption label="Certificates & email" value={form.certificateEnabled?'Enabled':'Off'} onClick={()=>setPanel('certificates')}/>
              <EditorOption label="Speakers, co-hosts & partners" value="Manage people" onClick={()=>setPanel('people')}/>
              <EditorOption label="Contact persons" value={form.contacts?.length?form.contacts.length+' contacts':'Add contact'} onClick={()=>setPanel('contacts')}/>
            </div></section>
            <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">Changes are saved when you choose Save draft or Publish. Invitations and uploads are saved when you add them.</p>
          </div>
        </div>
        <div className="sticky bottom-0 z-30 mt-8 flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 bg-[var(--page-surface)] py-4 pr-20 [padding-bottom:max(1rem,env(safe-area-inset-bottom))] dark:border-slate-800">
          <span className="ml-auto flex w-full flex-wrap items-center justify-end gap-3 sm:w-auto">
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
      <EditorModal open={panel==='details'} title="Description & event details" onClose={()=>setPanel(null)} error={error}><BasicInfoSection {...sectionProps}/></EditorModal>
      <EditorModal open={panel==='location'} title="Location & format" onClose={()=>setPanel(null)} error={error}><LocationSection {...sectionProps}/></EditorModal>
      <EditorModal open={panel==='registration'} title="Tickets & registration" onClose={()=>setPanel(null)} error={error}><RegistrationSection {...sectionProps} updateForm={updateForm} ticketCommission={ticketCommission} onError={setError}/></EditorModal>
      <EditorModal open={panel==='capacity'} title="Capacity & waitlist" onClose={()=>setPanel(null)} error={error}><CapacitySection {...sectionProps}/></EditorModal>
      <EditorModal open={panel==='agenda'} title="Agenda & tracks" onClose={()=>setPanel(null)} error={error}><EventDaysSection {...sectionProps} agendaMode={agendaMode} onAgendaModeChange={setAgendaMode} daysLocked={daysLocked}/><TracksSection {...sectionProps}/></EditorModal>
      <EditorModal open={panel==='certificates'} title="Certificates & thank-you email" onClose={()=>setPanel(null)} error={error}>          <AppreciationSection {...sectionProps} />
          <CertificateDesigner
            externalAttendance={form.attendanceSource === 'EXTERNAL'}
            enabled={Boolean(form.certificateEnabled)}
            mode={form.certificateMode ?? 'STANDARD'}
            certificateType={form.certificateType ?? 'ATTENDANCE'}
            template={form.certificateTemplate ?? ''}
            placement={form.certificateNamePlacement ?? DEFAULT_PLACEMENT}
            qrBox={form.certificateQrBox ?? null}
            theme={form.certificateTheme ?? DEFAULT_THEME}
            style={form.certificateStyle ?? 'CLASSIC'}
            content={form.certificateContent ?? DEFAULT_CONTENT}
            isPremium={premiumActive}
            premiumHref={communityId ? `/dashboard/premium?communityId=${communityId}` : '/dashboard/premium'}
            communityId={communityId}
            eventTitle={form.title ?? ''}
            partners={form.partners ?? []}
            onUnlockEvent={!premiumActive && paymentsEnabled ? handleUnlockEvent : undefined}
            eventUnlockTotal={eventTotal}
            eventUnlockBusy={unlockBusy}
            onPayFromWallet={!premiumActive && (eventPrice ?? 0) > 0 && walletBalance >= (eventPrice ?? 0) ? handlePayFromWallet : undefined}
            walletBalanceNgn={walletBalance}
            eventWalletPrice={eventPrice}
            onCheckPayment={!premiumActive && paymentsEnabled && eventId ? handleCheckEventPayment : undefined}
            minimumAttendanceDuration={form.minimumAttendanceDuration ?? 0}
            checkOutRequired={Boolean(form.checkOutRequired)}
            onChange={updateForm}
            onError={setError}
          />
</EditorModal>
      <EditorModal open={panel==='people'} title="Speakers, co-hosts & partners" onClose={()=>setPanel(null)} error={error}>          <SpeakersSponsorsEditor
            initialEventId={eventId}
            initialSpeakers={speakers}
            initialSponsors={sponsors}
            dayCount={(form.days ?? []).length}
            sections={namedSections(form)}
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
</EditorModal>
      <EditorModal open={panel==='contacts'} title="Contact persons" onClose={()=>setPanel(null)} error={error}><ContactsSection {...sectionProps}/></EditorModal>
      <EditorModal open={panel==='media'} title="Cover & gallery" onClose={()=>setPanel(null)} error={error}><MediaSection {...sectionProps} onError={setError}/></EditorModal>
      <EditorModal open={panel==='import'} title="Import or plan an event" onClose={()=>setPanel(null)} error={error}>{!isEditing?<EventLinkImport communityId={communityId} onApply={updateForm}/>:null}<AiEventAssistant onApply={applyDraft}/></EditorModal>
    </DashboardShell>
  );
}
