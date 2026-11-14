'use client';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import {
  EVENT_TYPES, createEvent, getEvent, imageUrl, managedCommunities, publishEvent, updateEvent, uploadBanner,
  type Community, type EventInput,
} from '@/lib/api';
import { DEFAULT_CERTIFICATE_CONTENT, DEFAULT_NAME_PLACEMENT } from '@/lib/certificate/types';
import { EVENT_TZ, isoToZoned, zonedToIso } from '@/lib/tz';
import { useSession } from '@/lib/session';
import { GeneratedCover } from '@/components/cover';
import { OptionRow, Panel } from '@/components/panel';
import { AgendaFields, type Day, type Track } from '@/components/event-form/agenda-panel';
import { PeopleFields } from '@/components/event-form/people-panel';
import { CertificateDesignFields, type CertificateDesign } from '@/components/event-form/certificate-design';
import { DescriptionField } from '@/components/rich-editor/description-field';

type PanelName = 'location' | 'details' | 'registration' | 'capacity' | 'agenda' | 'certificate' | 'people' | 'contacts' | null;
type LooseDay = Day & Record<string, unknown>;
type LooseTrack = Track & Record<string, unknown>;
const label = (t: string) => t.charAt(0) + t.slice(1).toLowerCase().replace(/_/g, ' ');
const text = (s: string) => s.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();

const blank: EventInput = {
  title: '', type: 'WORKSHOP', shortDescription: '', description: '', bannerImage: '', startDate: '', endDate: '', timezone: EVENT_TZ,
  mode: 'PHYSICAL', venue: '', state: '', meetingLink: '', registrationPolicy: 'OPEN', attendanceSource: 'GUILDOS', partnerRegistrationUrl: '', partnerRegistrationLabel: '',
  capacity: 0, waitlistEnabled: true, certificateEnabled: false, checkOutRequired: true, minimumAttendanceDuration: 0, contacts: [], partners: [], minimumAttendanceDays: 0,
};
const blankDesign: CertificateDesign = {
  certificateType: 'ATTENDANCE', certificateMode: 'CUSTOM', certificateStyle: 'CLASSIC', certificateTemplate: '',
  certificateContent: DEFAULT_CERTIFICATE_CONTENT, certificateNamePlacement: DEFAULT_NAME_PLACEMENT, certificateQrBox: null,
};

function CreateEventForm() {
  const router = useRouter();
  const params = useSearchParams();
  const editSlug = params.get('edit');
  const { user, loading } = useSession();
  const [communities, setCommunities] = useState<Community[] | null>(null);
  const [communityId, setCommunityId] = useState(params.get('community') ?? '');
  const [form, setForm] = useState<EventInput>(blank);
  const [design, setDesign] = useState<CertificateDesign>(blankDesign);
  // Days and tracks keep every field the backend has, so editing here never wipes sessions or facilitators.
  const [days, setDays] = useState<LooseDay[]>([]);
  const [tracks, setTracks] = useState<LooseTrack[]>([]);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [editId, setEditId] = useState('');
  const [slug, setSlug] = useState('');
  const [status, setStatus] = useState('DRAFT');
  const [panel, setPanel] = useState<PanelName>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const set = <K extends keyof EventInput>(key: K, value: EventInput[K]) => setForm((f) => ({ ...f, [key]: value }));
  const tz = form.timezone || EVENT_TZ;

  useEffect(() => { if (!loading && !user) router.replace('/login?next=/events/new'); }, [loading, user, router]);
  useEffect(() => {
    if (!user) return;
    managedCommunities().then((r) => {
      const verified = r.communities.filter((c) => c.verificationStatus === 'VERIFIED');
      setCommunities(verified);
      setCommunityId((current) => current || verified[0]?._id || '');
    }).catch(() => setCommunities([]));
  }, [user]);
  useEffect(() => {
    if (!editSlug) return;
    getEvent(editSlug).then(({ event }) => {
      const e = event as unknown as EventInput & Record<string, unknown>;
      const zone = event.timezone || EVENT_TZ;
      setEditId(event._id); setSlug(event.slug); setStatus(event.status); setCommunityId(event.communityId);
      setForm({ ...blank, ...e, contacts: e.contacts ?? [], partners: e.partners ?? [] });
      setDesign({
        certificateType: (e.certificateType as string) || 'ATTENDANCE', certificateMode: e.certificateMode === 'CUSTOM' ? 'CUSTOM' : 'STANDARD',
        certificateStyle: (e.certificateStyle as string) || 'CLASSIC', certificateTemplate: (e.certificateTemplate as string) || '',
        certificateContent: e.certificateContent ?? DEFAULT_CERTIFICATE_CONTENT, certificateNamePlacement: e.certificateNamePlacement ?? DEFAULT_NAME_PLACEMENT, certificateQrBox: e.certificateQrBox ?? null,
      });
      setDays(((e.days ?? []) as unknown as LooseDay[]).map((d) => ({ ...d, date: d.date ? isoToZoned(d.date, zone).slice(0, 10) : '', theme: d.theme ?? '', venue: d.venue ?? '', startTime: d.startTime ?? '', endTime: d.endTime ?? '' })));
      setTracks(((e.sections ?? []) as unknown as LooseTrack[]).map((t) => ({ ...t, description: t.description ?? '', venue: t.venue ?? '', capacity: t.capacity ?? 0 })));
      setStart(isoToZoned(event.startDate, zone)); setEnd(isoToZoned(event.endDate, zone));
    }).catch((err: Error) => setError(err.message));
  }, [editSlug]);

  const community = (communities ?? []).find((c) => c._id === communityId);
  const locationDone = (form.mode === 'VIRTUAL' || Boolean(form.venue.trim())) && (form.mode === 'PHYSICAL' || Boolean(form.meetingLink.trim()));
  const detailsDone = Boolean(text(form.description));
  const registrationDone = form.attendanceSource !== 'EXTERNAL' || /^https:\/\/.+\..+/i.test(form.partnerRegistrationUrl ?? '');
  // A certificate is optional, but one that is switched on needs its artwork before publishing.
  const certificateDone = !form.certificateEnabled || design.certificateMode === 'STANDARD' || Boolean(design.certificateTemplate);
  const ready = Boolean(communityId && form.title.trim() && start && end && locationDone && detailsDone && registrationDone && certificateDone);
  const coverUrl = useMemo(() => imageUrl(form.bannerImage), [form.bannerImage]);
  const published = Boolean(editId) && !['DRAFT', 'ANNOUNCED'].includes(status);

  async function chooseCover(file?: File) {
    if (!file) return;
    setUploading(true); setError('');
    try { set('bannerImage', (await uploadBanner(file)).banner); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to upload the cover'); }
    finally { setUploading(false); }
  }

  async function save(publish: boolean, stay = false) {
    if (publish && !ready) { setError('Fill every row marked * before publishing.'); return; }
    if (!communityId || !form.title.trim()) { setError('Choose a community and give the event a name.'); return; }
    if (start && end && zonedToIso(end, tz) <= zonedToIso(start, tz)) { setError('The end must be after the start.'); return; }
    setBusy(true); setError('');
    try {
      const input: EventInput = {
        ...form, ...design, title: form.title.trim(), startDate: zonedToIso(start, tz), endDate: zonedToIso(end, tz), timezone: tz,
        contacts: form.contacts.filter((c) => c.name.trim()), partners: (form.partners ?? []).filter((p) => p.name.trim()),
        days: days.map((d) => ({ ...d, date: d.date ? zonedToIso(d.date, tz) : null })),
        sections: tracks.filter((t) => t.name.trim()),
      };
      const saved = editId ? (await updateEvent(editId, input)).event : (await createEvent({ ...input, communityId })).event;
      if (publish && ['DRAFT', 'ANNOUNCED'].includes(saved.status)) await publishEvent(saved._id);
      if (stay) { router.replace(`/events/new?edit=${saved.slug}`); setEditId(saved._id); setSlug(saved.slug); return; }
      router.push(`/events/${saved.slug}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save the event');
      setPanel(null);
    } finally {
      setBusy(false);
    }
  }

  if (user && communities && !communities.length && !editSlug) {
    return (
      <div className="wrap page" style={{ maxWidth: 640 }}>
        <h1>Create event</h1>
        <p className="muted">Events are run by verified communities. Create your community first. Once our team verifies it, you can run events with no more approval.</p>
        <div className="row"><a className="btn p" href="/communities/new">Create community</a><a className="btn s" href="/communities">Find your community</a></div>
      </div>
    );
  }

  const peopleCount = (form.partners ?? []).length;
  return (
    <div className="wrap page">
      <div className="form2">
        <div className="stack" style={{ gap: 10 }}>
          <label className="evcover">
            {coverUrl ? <img src={coverUrl} alt="" /> : <GeneratedCover seed={form.title || 'event'} type={form.type} />}
            <span className="up">{uploading ? 'Uploading…' : form.bannerImage ? 'Change cover' : 'Upload cover'}</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => void chooseCover(e.target.files?.[0])} />
          </label>
          <p className="small">Upload your own cover, or keep this poster. 1600 × 800 works best.</p>
        </div>
        <div className="stack" style={{ gap: 14 }}>
          <h1>{editId ? 'Edit event' : 'Create event'}</h1>
          <label className="field"><span>Community <em>*</em></span>
            <select className="input" value={communityId} disabled={Boolean(editId)} onChange={(e) => setCommunityId(e.target.value)}>
              {(communities ?? []).map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              {editId && !community ? <option value={communityId}>This event&apos;s community</option> : null}
            </select>
          </label>
          <label className="field"><span>Event name <em>*</em></span><input className="input" value={form.title} onChange={(e) => set('title', e.target.value)} /></label>
          <label className="field"><span>Type</span><select className="input" value={form.type} onChange={(e) => set('type', e.target.value)}>{EVENT_TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}</select></label>
          <div className="two">
            <label className="field"><span>Start <em>*</em></span><input className="input" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} /></label>
            <label className="field"><span>End <em>*</em></span><input className="input" type="datetime-local" value={end} min={start} onChange={(e) => setEnd(e.target.value)} /></label>
          </div>
          <p className="small">Times are in Nigeria time (WAT).</p>
          <DescriptionField label="Full description" required value={form.description} onChange={(v) => set('description', v)} placeholder="What will people do, learn or win? Who is it for? What should they bring?" />
          <div>
            <OptionRow label="Location & format" value={form.mode === 'VIRTUAL' ? 'Online' : form.venue || 'Add venue'} done={locationDone} required onClick={() => setPanel('location')} />
            <OptionRow label="Short summary" value={form.shortDescription ? form.shortDescription : 'Optional. One line for event cards'} onClick={() => setPanel('details')} />
            <OptionRow label="Registration" value={form.attendanceSource === 'EXTERNAL' ? 'On another site' : form.registrationPolicy === 'APPROVAL' ? 'Free, you approve each person' : form.registrationPolicy === 'INVITE' ? 'Free, invite only' : 'Open, free'} done={form.attendanceSource === 'EXTERNAL' ? registrationDone : undefined} required={form.attendanceSource === 'EXTERNAL'} onClick={() => setPanel('registration')} />
            <OptionRow label="Capacity" value={form.capacity ? `${form.capacity} places` : 'Unlimited'} onClick={() => setPanel('capacity')} />
            <OptionRow label="Agenda & tracks" value={days.length > 1 ? `${days.length} days` : tracks.length ? `${tracks.length} tracks` : 'One day, no tracks'} onClick={() => setPanel('agenda')} />
            <OptionRow label="Attendance & certificate" value={!form.certificateEnabled ? 'No certificate. Attendance still counts' : design.certificateMode === 'CUSTOM' ? (design.certificateTemplate ? 'Your own design' : 'Upload your design') : 'Standard design'} done={form.certificateEnabled ? certificateDone : undefined} required={form.certificateEnabled} onClick={() => setPanel('certificate')} />
            <OptionRow label="Speakers, co-hosts & partners" value={peopleCount ? `${peopleCount} partner${peopleCount === 1 ? '' : 's'}` : 'None yet'} onClick={() => setPanel('people')} />
            <OptionRow label="Contact persons" value={form.contacts.length ? `${form.contacts.length} added` : 'None yet'} onClick={() => setPanel('contacts')} />
          </div>
          {error ? <p className="error" role="alert">{error}</p> : null}
          <div className="row">
            {!published ? <button type="button" className="btn s" disabled={busy} onClick={() => save(false)}>Save draft</button> : null}
            <button type="button" className="btn p" disabled={busy} onClick={() => save(!published)}>{busy ? 'Saving…' : published ? 'Save changes' : 'Publish event'}</button>
          </div>
        </div>
      </div>

      <Panel open={panel === 'location'} title="Location & format" onClose={() => setPanel(null)}>
        {(['PHYSICAL', 'HYBRID', 'VIRTUAL'] as const).map((m) => (
          <label key={m} className={`rad${form.mode === m ? ' on' : ''}`}><input type="radio" name="mode" checked={form.mode === m} onChange={() => set('mode', m)} /><b>{m === 'PHYSICAL' ? 'In person' : m === 'HYBRID' ? 'In person and online' : 'Online'}</b></label>
        ))}
        {form.mode !== 'VIRTUAL' ? <><label className="field"><span>Venue Name <em>*</em></span><input className="input" value={form.venue} onChange={(e) => set('venue', e.target.value)} /></label><label className="field"><span>State</span><input className="input" placeholder="For example Kaduna" value={form.state} onChange={(e) => set('state', e.target.value)} /></label></> : null}
        {form.mode !== 'PHYSICAL' ? <label className="field"><span>Meeting Link <em>*</em></span><input className="input" placeholder="Zoom, Teams or Google Meet link" value={form.meetingLink} onChange={(e) => set('meetingLink', e.target.value)} /><span className="small">Only people who check in can see this link.</span></label> : null}
      </Panel>

      <Panel open={panel === 'details'} title="Short summary" onClose={() => setPanel(null)}>
        <label className="field"><span>Short summary (optional)</span><input className="input" maxLength={160} value={form.shortDescription} onChange={(e) => set('shortDescription', e.target.value)} /><span className="small">One line shown on event cards and link previews. Leave it empty to use the start of the description.</span></label>
      </Panel>

      <Panel open={panel === 'registration'} title="Registration" onClose={() => setPanel(null)}>
        <label className={`rad${form.attendanceSource !== 'EXTERNAL' ? ' on' : ''}`}><input type="radio" name="source" checked={form.attendanceSource !== 'EXTERNAL'} onChange={() => set('attendanceSource', 'GUILDOS')} /><span className="stack" style={{ gap: 2 }}><b>Register here</b><span className="small">Free registration with a QR pass. Certificates can go out at check-out.</span></span></label>
        <label className={`rad${form.attendanceSource === 'EXTERNAL' ? ' on' : ''}`}><input type="radio" name="source" checked={form.attendanceSource === 'EXTERNAL'} onChange={() => set('attendanceSource', 'EXTERNAL')} /><span className="stack" style={{ gap: 2 }}><b>Register on another site</b><span className="small">For events run elsewhere. Attendance comes from that site&apos;s report after the event.</span></span></label>
        {form.attendanceSource === 'EXTERNAL' ? <label className="field"><span>Partner site name (optional)</span><input className="input" maxLength={60} placeholder="For example Eventbrite or Google Developer Groups" value={form.partnerRegistrationLabel ?? ''} onChange={(e) => set('partnerRegistrationLabel', e.target.value)} /><span className="small">Students see “Register on …” with this name.</span></label> : null}
        {form.attendanceSource === 'EXTERNAL' ? <label className="field"><span>External registration link <em>*</em></span><input className="input" type="url" placeholder="https://…" value={form.partnerRegistrationUrl ?? ''} onChange={(e) => set('partnerRegistrationUrl', e.target.value)} /></label> : (
          <><span className="field"><span>Who can register</span></span>
            {([['OPEN', 'Anyone', 'Everyone who registers gets a place.'], ['APPROVAL', 'You approve each person', 'People ask, and you say yes or no.'], ['INVITE', 'Invite only', 'Only people with your invite link can register.']] as const).map(([v, t, d]) => (
              <label key={v} className={`rad${form.registrationPolicy === v ? ' on' : ''}`}><input type="radio" name="policy" checked={form.registrationPolicy === v} onChange={() => set('registrationPolicy', v)} /><span className="stack" style={{ gap: 2 }}><b>{t}</b><span className="small">{d}</span></span></label>
            ))}</>
        )}
      </Panel>

      <Panel open={panel === 'capacity'} title="Capacity" onClose={() => setPanel(null)}>
        <label className="field"><span>Places (0 means unlimited)</span><input className="input" type="number" min={0} value={form.capacity} onChange={(e) => set('capacity', Math.max(0, Number(e.target.value) || 0))} /></label>
        <label className="tog"><span>Waitlist when full</span><input type="checkbox" checked={form.waitlistEnabled} onChange={(e) => set('waitlistEnabled', e.target.checked)} /></label>
      </Panel>

      <Panel open={panel === 'agenda'} title="Agenda & tracks" onClose={() => setPanel(null)}>
        <AgendaFields days={days} onDays={(d) => setDays(d as LooseDay[])} minDays={form.minimumAttendanceDays ?? 0} onMinDays={(n) => set('minimumAttendanceDays', n)} tracks={tracks} onTracks={(t) => setTracks(t as LooseTrack[])} published={published} />
      </Panel>

      <Panel open={panel === 'certificate'} title="Attendance & certificate" onClose={() => setPanel(null)}>
        <p className="small">Everyone who scans in and out at the end gets an attendance stamp on their profile and points on their score. A certificate is extra and optional.</p>
        <label className="tog"><span>Require scan out at the end</span><input type="checkbox" checked={form.checkOutRequired} onChange={(e) => set('checkOutRequired', e.target.checked)} /></label>
        <label className="field"><span>Minimum minutes attended</span><input className="input" type="number" min={0} value={form.minimumAttendanceDuration} onChange={(e) => set('minimumAttendanceDuration', Math.max(0, Number(e.target.value) || 0))} /></label>
        <label className="tog"><span>Also give a certificate</span><input type="checkbox" checked={form.certificateEnabled} onChange={(e) => set('certificateEnabled', e.target.checked)} /></label>
        {form.certificateEnabled ? <>
          <p className="small">Each certificate goes out the moment the person scans out at or after the end time, with a thank-you email.</p>
          <CertificateDesignFields value={design} onChange={(patch) => setDesign((d) => ({ ...d, ...patch }))} eventTitle={form.title} communityName={community?.name ?? ''} onError={setError} />
        </> : null}
      </Panel>

      <Panel open={panel === 'people'} title="Speakers, co-hosts & partners" onClose={() => setPanel(null)}>
        <PeopleFields eventId={editId} eventSlug={slug} partners={form.partners ?? []} onPartners={(p) => set('partners', p)} onError={setError} onSaveFirst={() => { setPanel(null); void save(false, true); }} />
      </Panel>

      <Panel open={panel === 'contacts'} title="Contact persons" onClose={() => setPanel(null)}>
        {form.contacts.map((c, i) => (
          <div key={i} className="stack sub">
            <div className="two"><input className="input" aria-label="Name" placeholder="Name" value={c.name} onChange={(e) => set('contacts', form.contacts.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} /><input className="input" aria-label="Phone" placeholder="Phone" value={c.phone} onChange={(e) => set('contacts', form.contacts.map((x, j) => (j === i ? { ...x, phone: e.target.value } : x)))} /></div>
            <div className="row" style={{ flexWrap: 'nowrap' }}><input className="input" aria-label="Email" placeholder="Email" value={c.email} onChange={(e) => set('contacts', form.contacts.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))} /><button type="button" className="btn s sm" aria-label="Remove contact" onClick={() => set('contacts', form.contacts.filter((_, j) => j !== i))}><Trash2 size={15} /></button></div>
          </div>
        ))}
        {form.contacts.length < 5 ? <button type="button" className="btn s sm" style={{ alignSelf: 'flex-start' }} onClick={() => set('contacts', [...form.contacts, { name: '', phone: '', email: '' }])}><Plus size={15} />Add contact</button> : null}
      </Panel>
    </div>
  );
}

export default function CreateEventPage() {
  return <Suspense fallback={<div className="wrap page"><p className="empty">Loading…</p></div>}><CreateEventForm /></Suspense>;
}
