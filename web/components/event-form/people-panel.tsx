'use client';
import { useEffect, useState } from 'react';
import { Plus, Trash2, Upload } from 'lucide-react';
import { getEvent, imageUrl } from '@/lib/api';
import { addSpeaker, invitePartner, listPartnerships, removePartnership, removeSpeaker, uploadEventFile, type Partnership, type Speaker, type SpeakerType } from '@/lib/account';
import { Avatar } from '@/components/ui';

type Org = { name: string; logo: string; website: string };
const TYPES: [SpeakerType, string][] = [['WORKSHOP', 'Workshop speaker'], ['TRAINER', 'Trainer'], ['PANEL', 'Panelist'], ['GUEST', 'Guest']];

/**
 * Partner organizations are part of the form. Speakers and co-host invites are saved
 * one by one against the event, so they need the draft saved first.
 */
export function PeopleFields({ eventId, eventSlug, partners, onPartners, onError, onSaveFirst }: {
  eventId: string; eventSlug: string; partners: Org[]; onPartners: (p: Org[]) => void; onError: (m: string) => void; onSaveFirst: () => void;
}) {
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [cohosts, setCohosts] = useState<Partnership[]>([]);
  const [draft, setDraft] = useState({ fullName: '', title: '', organization: '', speakerType: 'WORKSHOP' as SpeakerType, photo: '' });
  const [slug, setSlug] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    getEvent(eventSlug).then((d) => setSpeakers((d.speakers ?? []) as Speaker[])).catch(() => undefined);
    listPartnerships(eventId).then((r) => setCohosts(r.partnerships)).catch(() => undefined);
  }, [eventId, eventSlug]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try { await action(); } catch (e) { onError(e instanceof Error ? e.message : 'Something went wrong'); } finally { setBusy(false); }
  }
  const setOrg = (i: number, patch: Partial<Org>) => onPartners(partners.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  return (
    <>
      <h3>Speakers</h3>
      {eventId ? <>
        {speakers.map((s) => (
          <div key={s._id} className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
            <span className="row" style={{ gap: 10, flexWrap: 'nowrap' }}><Avatar name={s.fullName} src={imageUrl(s.photo)} size={36} /><span className="stack" style={{ gap: 0 }}><b>{s.fullName}</b><span className="small">{[s.title, s.organization].filter(Boolean).join(', ')}</span></span></span>
            <button type="button" className="btn s sm" aria-label={`Remove ${s.fullName}`} disabled={busy} onClick={() => run(async () => { await removeSpeaker(eventId, s._id); setSpeakers((l) => l.filter((x) => x._id !== s._id)); })}><Trash2 size={15} /></button>
          </div>
        ))}
        <div className="stack sub">
          <div className="two"><input className="input" aria-label="Speaker name" placeholder="Full name" value={draft.fullName} onChange={(e) => setDraft((d) => ({ ...d, fullName: e.target.value }))} /><select className="input" aria-label="Speaker role" value={draft.speakerType} onChange={(e) => setDraft((d) => ({ ...d, speakerType: e.target.value as SpeakerType }))}>{TYPES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></div>
          <div className="two"><input className="input" aria-label="Speaker title" placeholder="Title" value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} /><input className="input" aria-label="Organization" placeholder="Organization" value={draft.organization} onChange={(e) => setDraft((d) => ({ ...d, organization: e.target.value }))} /></div>
          <div className="row">
            <label className="btn s sm"><Upload size={15} />{draft.photo ? 'Photo added' : 'Photo'}<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void run(async () => { const r = await uploadEventFile('speakerPhoto', f); setDraft((d) => ({ ...d, photo: r.speakerPhoto })); }); }} /></label>
            <button type="button" className="btn p sm" disabled={busy || !draft.fullName.trim()} onClick={() => run(async () => { const r = await addSpeaker(eventId, { ...draft, fullName: draft.fullName.trim(), bio: '' }); setSpeakers((l) => [...l, r.speaker]); setDraft({ fullName: '', title: '', organization: '', speakerType: 'WORKSHOP', photo: '' }); })}><Plus size={15} />Add speaker</button>
          </div>
        </div>

        <h3>Co-host communities</h3>
        {cohosts.map((p) => (
          <div key={p._id} className="row" style={{ justifyContent: 'space-between' }}>
            <span><b>{p.community?.name ?? 'Community'}</b> <span className="small">{p.status === 'PENDING' ? 'Invited, waiting' : p.status === 'ACCEPTED' ? 'Co-hosting' : 'Declined'}</span></span>
            <button type="button" className="btn s sm" aria-label="Remove co-host" disabled={busy} onClick={() => run(async () => { await removePartnership(eventId, p._id); setCohosts((l) => l.filter((x) => x._id !== p._id)); })}><Trash2 size={15} /></button>
          </div>
        ))}
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <input className="input" aria-label="Community link name" placeholder="Community link name, for example gdg-unilag" value={slug} onChange={(e) => setSlug(e.target.value.trim())} />
          <button type="button" className="btn s sm" disabled={busy || !slug} onClick={() => run(async () => { const r = await invitePartner(eventId, slug.replace(/^.*\/communities\//, '')); setCohosts((l) => [...l, r.partnership]); setSlug(''); })}>Invite</button>
        </div>
        <p className="small">Their leaders accept the invite, then they can help run the event.</p>
      </> : (
        <div className="stack sub"><p className="small">Speakers and co-hosts are saved one at a time, so save the draft first.</p><button type="button" className="btn s sm" style={{ alignSelf: 'flex-start' }} onClick={onSaveFirst}>Save draft and continue</button></div>
      )}

      <h3>Partner organizations</h3>
      {partners.map((p, i) => (
        <div key={i} className="stack sub">
          <div className="two"><input className="input" aria-label="Partner name" placeholder="Name" value={p.name} onChange={(e) => setOrg(i, { name: e.target.value })} /><input className="input" aria-label="Partner website" placeholder="https://…" value={p.website} onChange={(e) => setOrg(i, { website: e.target.value })} /></div>
          <div className="row">
            <label className="btn s sm"><Upload size={15} />{p.logo ? 'Logo added' : 'Logo'}<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void run(async () => { const r = await uploadEventFile('partnerLogo', f); setOrg(i, { logo: r.partnerLogo }); }); }} /></label>
            <button type="button" className="btn s sm" aria-label="Remove partner" onClick={() => onPartners(partners.filter((_, j) => j !== i))}><Trash2 size={15} /></button>
          </div>
        </div>
      ))}
      {partners.length < 8 ? <button type="button" className="btn s sm" style={{ alignSelf: 'flex-start' }} onClick={() => onPartners([...partners, { name: '', logo: '', website: '' }])}><Plus size={15} />Add partner</button> : null}
    </>
  );
}
