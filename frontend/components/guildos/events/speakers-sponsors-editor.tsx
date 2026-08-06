'use client';

import { useEffect, useState } from 'react';
import { Handshake, Mic } from 'lucide-react';
import { SelectMenu } from '../ui/select-menu';
import {
  addEventSpeaker,
  addEventSponsor,
  addEventVolunteer,
  deleteEventSpeaker,
  deleteEventSponsor,
  deleteEventVolunteer,
  getEventVolunteers,
  resolveEventImageUrl,
  searchSpeakerUsers,
  searchVolunteerUsers,
  updateEventSpeaker,
  uploadEventMedia,
  type EventSpeaker,
  type EventSponsor,
  type EventVolunteer,
  type SpeakerType,
  type WalkInUser,
} from '../event-api';
import { Section } from './event-form-ui';
import { Button } from '../ui/button';

type Props = {
  initialEventId: string;
  initialSpeakers: EventSpeaker[];
  initialSponsors: EventSponsor[];
  /** Number of agenda days — when > 1, speakers can be assigned to a specific day. */
  dayCount?: number;
  ensureSaved: () => Promise<string>;
  onError: (message: string) => void;
};

const SPEAKER_TYPES: { value: SpeakerType; label: string }[] = [
  { value: 'WORKSHOP', label: 'Workshop speaker (+40)' },
  { value: 'PANEL', label: 'Panel speaker (+30)' },
  { value: 'GUEST', label: 'Guest speaker (+30)' },
];

export function SpeakersSponsorsEditor({ initialEventId, initialSpeakers, initialSponsors, dayCount = 0, ensureSaved, onError }: Props) {
  const [speakers, setSpeakers] = useState<EventSpeaker[]>(initialSpeakers);
  const [sponsors, setSponsors] = useState<EventSponsor[]>(initialSponsors);
  const [eventId, setEventId] = useState(initialEventId);
  const [speaker, setSpeaker] = useState<{ fullName: string; title: string; organization: string; photo: string; speakerType: SpeakerType; userId: string | null; day: number | null }>(
    { fullName: '', title: '', organization: '', photo: '', speakerType: 'GUEST', userId: null, day: null },
  );
  const [sponsor, setSponsor] = useState({ name: '', website: '', logo: '' });

  // Shared "tag a GuildOS user" search. Target is 'new' (the draft) or an existing speaker id.
  const [linkTarget, setLinkTarget] = useState<'new' | string | null>(null);
  const [userQuery, setUserQuery] = useState('');
  const [userResults, setUserResults] = useState<WalkInUser[]>([]);
  const [searching, setSearching] = useState(false);

  // Event volunteers (credited GuildOS users, +20 Guild Score each).
  const [volunteers, setVolunteers] = useState<EventVolunteer[]>([]);
  const [volQuery, setVolQuery] = useState('');
  const [volResults, setVolResults] = useState<WalkInUser[]>([]);
  const [volSearching, setVolSearching] = useState(false);
  const [volPicked, setVolPicked] = useState<WalkInUser | null>(null);
  const [volRole, setVolRole] = useState('');

  useEffect(() => {
    if (!initialEventId) return;
    void (async () => {
      try {
        const { volunteers: loaded } = await getEventVolunteers(initialEventId);
        setVolunteers(loaded);
      } catch {
        /* editor may open before the event is saved; ignore */
      }
    })();
  }, [initialEventId]);

  async function currentId() {
    const id = await ensureSaved();
    setEventId(id);
    return id;
  }

  async function runVolSearch(q: string) {
    setVolQuery(q);
    setVolPicked(null);
    if (q.trim().length < 2) {
      setVolResults([]);
      return;
    }
    try {
      setVolSearching(true);
      const id = await currentId();
      const { users } = await searchVolunteerUsers(id, q.trim());
      setVolResults(users);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unable to search users');
    } finally {
      setVolSearching(false);
    }
  }

  async function addVolunteer() {
    if (!volPicked) return;
    try {
      const id = await currentId();
      const { volunteer } = await addEventVolunteer(id, { userId: volPicked.id, role: volRole.trim() });
      setVolunteers((v) => [...v, volunteer]);
      setVolPicked(null);
      setVolQuery('');
      setVolResults([]);
      setVolRole('');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unable to add volunteer');
    }
  }

  async function removeVolunteer(volunteerId: string) {
    if (!eventId) return;
    try {
      await deleteEventVolunteer(eventId, volunteerId);
      setVolunteers((v) => v.filter((x) => x._id !== volunteerId));
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unable to remove volunteer');
    }
  }

  async function runUserSearch(q: string) {
    setUserQuery(q);
    if (q.trim().length < 2) {
      setUserResults([]);
      return;
    }
    try {
      setSearching(true);
      const id = await currentId();
      const { users } = await searchSpeakerUsers(id, q.trim());
      setUserResults(users);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unable to search users');
    } finally {
      setSearching(false);
    }
  }

  async function pickUser(user: WalkInUser) {
    if (linkTarget === 'new') {
      setSpeaker((s) => ({ ...s, userId: user.id, fullName: s.fullName.trim() ? s.fullName : user.fullName }));
    } else if (linkTarget) {
      try {
        const { speaker: updated } = await updateEventSpeaker(eventId, linkTarget, { userId: user.id });
        setSpeakers((list) => list.map((x) => (x._id === linkTarget ? updated : x)));
      } catch (err) {
        onError(err instanceof Error ? err.message : 'Unable to link speaker');
      }
    }
    setLinkTarget(null);
    setUserQuery('');
    setUserResults([]);
  }

  async function unlinkSpeaker(speakerId: string) {
    try {
      const { speaker: updated } = await updateEventSpeaker(eventId, speakerId, { userId: null });
      setSpeakers((list) => list.map((x) => (x._id === speakerId ? updated : x)));
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unable to unlink speaker');
    }
  }

  async function changeSpeakerType(speakerId: string, speakerType: SpeakerType) {
    try {
      const { speaker: updated } = await updateEventSpeaker(eventId, speakerId, { speakerType });
      setSpeakers((list) => list.map((x) => (x._id === speakerId ? updated : x)));
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unable to update speaker');
    }
  }

  async function changeSpeakerDay(speakerId: string, day: number | null) {
    try {
      const { speaker: updated } = await updateEventSpeaker(eventId, speakerId, { day });
      setSpeakers((list) => list.map((x) => (x._id === speakerId ? updated : x)));
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unable to update speaker');
    }
  }

  async function addSpeaker() {
    if (!speaker.fullName.trim()) return;
    try {
      const id = await currentId();
      const { speaker: created } = await addEventSpeaker(id, speaker);
      setSpeakers((s) => [...s, created]);
      setSpeaker({ fullName: '', title: '', organization: '', photo: '', speakerType: 'GUEST', userId: null, day: null });
      setLinkTarget(null);
      setUserQuery('');
      setUserResults([]);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unable to add speaker');
    }
  }

  async function removeSpeaker(speakerId: string) {
    if (!eventId) return;
    try {
      await deleteEventSpeaker(eventId, speakerId);
      setSpeakers((s) => s.filter((x) => x._id !== speakerId));
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unable to remove speaker');
    }
  }

  async function uploadSpeakerPhoto(file: File | null) {
    if (!file) return;
    try {
      const fd = new FormData();
      fd.append('speakerPhoto', file);
      const uploaded = await uploadEventMedia(fd);
      setSpeaker((s) => ({ ...s, photo: uploaded.speakerPhoto }));
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unable to upload photo');
    }
  }

  async function addSponsor() {
    if (!sponsor.name.trim()) return;
    try {
      const id = await currentId();
      const { sponsor: created } = await addEventSponsor(id, sponsor);
      setSponsors((s) => [...s, created]);
      setSponsor({ name: '', website: '', logo: '' });
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unable to add sponsor');
    }
  }

  async function removeSponsor(sponsorId: string) {
    if (!eventId) return;
    try {
      await deleteEventSponsor(eventId, sponsorId);
      setSponsors((s) => s.filter((x) => x._id !== sponsorId));
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unable to remove sponsor');
    }
  }

  async function uploadSponsorLogo(file: File | null) {
    if (!file) return;
    try {
      const fd = new FormData();
      fd.append('sponsorLogo', file);
      const uploaded = await uploadEventMedia(fd);
      setSponsor((s) => ({ ...s, logo: uploaded.sponsorLogo }));
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unable to upload logo');
    }
  }

  return (
    <Section title="Speakers & Sponsors">
      {speakers.length ? (
        <div className="space-y-2">
          {speakers.map((s) => (
            <div key={s._id} className="rounded-2xl border border-slate-200 dark:border-slate-800 px-4 py-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {s.photo ? <img src={resolveEventImageUrl(s.photo)} alt={s.fullName} className="h-9 w-9 rounded-full object-cover" /> : <div className="h-9 w-9 rounded-full bg-slate-100 dark:bg-slate-950" />}
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{s.fullName}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{[s.title, s.organization].filter(Boolean).join(' · ')}</p>
                  </div>
                </div>
                <button onClick={() => void removeSpeaker(s._id)} className="text-sm text-red-600 hover:underline">Remove</button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 pl-12">
                <SelectMenu
                  aria-label="Speaker type"
                  className="w-40"
                  size="sm"
                  value={s.speakerType}
                  onChange={(v) => void changeSpeakerType(s._id, v as SpeakerType)}
                  options={SPEAKER_TYPES.map((t) => ({ value: t.value, label: t.label }))}
                />
                {dayCount > 1 ? (
                  <SelectMenu
                    aria-label="Speaker day"
                    className="w-32"
                    size="sm"
                    value={String(s.day ?? 0)}
                    onChange={(v) => void changeSpeakerDay(s._id, Number(v) || null)}
                    options={[{ value: '0', label: 'All days' }, ...Array.from({ length: dayCount }, (_, i) => ({ value: String(i + 1), label: `Day ${i + 1}` }))]}
                  />
                ) : null}
                {s.userId ? (
                  <>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"><Mic className="h-3 w-3 shrink-0" /> On GuildOS · earns Guild Score</span>
                    <button onClick={() => void unlinkSpeaker(s._id)} className="text-xs text-slate-500 dark:text-slate-400 hover:underline">Unlink</button>
                  </>
                ) : (
                  <>
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-950 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-400">External · no Guild Score</span>
                    <button onClick={() => { setLinkTarget(s._id); setUserQuery(''); setUserResults([]); }} className="text-xs font-medium text-indigo-600 hover:underline">Tag GuildOS user</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Shared GuildOS user search (link a speaker to an account) */}
      {linkTarget !== null ? (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-700 dark:text-slate-300">Search a GuildOS user to link {linkTarget === 'new' ? 'this new speaker' : 'this speaker'}</p>
            <button onClick={() => { setLinkTarget(null); setUserQuery(''); setUserResults([]); }} className="text-xs text-slate-500 dark:text-slate-400 hover:underline">Cancel</button>
          </div>
          <input className="ev-input mt-2" placeholder="Search by name, username, or email" value={userQuery} onChange={(e) => void runUserSearch(e.target.value)} />
          {searching ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Searching…</p> : null}
          {userResults.length ? (
            <ul className="mt-2 space-y-1">
              {userResults.map((u) => (
                <li key={u.id}>
                  <button onClick={() => void pickUser(u)} className="flex w-full items-center justify-between rounded-xl bg-white dark:bg-slate-900 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
                    <span className="font-medium text-slate-900 dark:text-slate-100">{u.fullName}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{u.username ? `@${u.username}` : u.email}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : userQuery.trim().length >= 2 && !searching ? (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">No matching users. They may not be on GuildOS — leave the speaker external.</p>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <input className="ev-input" placeholder="Speaker name" value={speaker.fullName} onChange={(e) => setSpeaker({ ...speaker, fullName: e.target.value })} />
        <input className="ev-input" placeholder="Title" value={speaker.title} onChange={(e) => setSpeaker({ ...speaker, title: e.target.value })} />
        <input className="ev-input" placeholder="Organization" value={speaker.organization} onChange={(e) => setSpeaker({ ...speaker, organization: e.target.value })} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SelectMenu
          aria-label="Speaker type"
          className="w-40"
          value={speaker.speakerType}
          onChange={(v) => setSpeaker({ ...speaker, speakerType: v as SpeakerType })}
          options={SPEAKER_TYPES.map((t) => ({ value: t.value, label: t.label }))}
        />
        {dayCount > 1 ? (
          <SelectMenu
            aria-label="Speaker day"
            className="w-40"
            value={String(speaker.day ?? 0)}
            onChange={(v) => setSpeaker({ ...speaker, day: Number(v) || null })}
            options={[{ value: '0', label: 'Speaks: all days' }, ...Array.from({ length: dayCount }, (_, i) => ({ value: String(i + 1), label: `Speaks: Day ${i + 1}` }))]}
          />
        ) : null}
        {speaker.userId ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"><Mic className="h-3 w-3 shrink-0" /> Linked · earns Guild Score
            <button onClick={() => setSpeaker({ ...speaker, userId: null })} className="ml-1 text-slate-500 dark:text-slate-400 hover:underline">clear</button>
          </span>
        ) : (
          <button onClick={() => { setLinkTarget('new'); setUserQuery(''); setUserResults([]); }} className="text-xs font-medium text-indigo-600 hover:underline">Tag GuildOS user (optional)</button>
        )}
      </div>
      <div className="flex items-center gap-3">
        <input type="file" accept="image/*" onChange={(e) => void uploadSpeakerPhoto(e.target.files?.[0] ?? null)} />
        {speaker.photo ? <img src={resolveEventImageUrl(speaker.photo)} alt="Speaker" className="h-9 w-9 rounded-full object-cover" /> : null}
        <Button variant="secondary" onClick={() => void addSpeaker()}>Add Speaker</Button>
      </div>

      {/* Event volunteers — credited GuildOS users earn +20 Guild Score at finalize */}
      <div className="mt-6 border-t border-slate-100 pt-4">
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Event Volunteers</p>
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">Credit GuildOS members who helped run the event (registration desk, logistics, moderation…). Each earns +20 Guild Score when the event is finalized.</p>
        {volunteers.length ? (
          <div className="space-y-2">
            {volunteers.map((v) => (
              <div key={v._id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 px-4 py-2">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{v.fullName}</p>
                  <p className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">{v.role || 'Volunteer'} · <Handshake className="h-3 w-3 shrink-0 text-emerald-600" /> earns Guild Score</p>
                </div>
                <button onClick={() => void removeVolunteer(v._id)} className="text-sm text-red-600 hover:underline">Remove</button>
              </div>
            ))}
          </div>
        ) : null}
        <div className="mt-2 rounded-2xl border border-slate-200 dark:border-slate-800 p-3">
          {volPicked ? (
            <div className="mb-2 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"><Handshake className="h-3 w-3 shrink-0" /> {volPicked.fullName}</span>
              <button onClick={() => { setVolPicked(null); setVolQuery(''); setVolResults([]); }} className="text-xs text-slate-500 dark:text-slate-400 hover:underline">change</button>
            </div>
          ) : (
            <>
              <input className="ev-input" placeholder="Search a GuildOS user by name, username, or email" value={volQuery} onChange={(e) => void runVolSearch(e.target.value)} />
              {volSearching ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Searching…</p> : null}
              {volResults.length ? (
                <ul className="mt-2 space-y-1">
                  {volResults.map((u) => (
                    <li key={u.id}>
                      <button onClick={() => { setVolPicked(u); setVolResults([]); }} className="flex w-full items-center justify-between rounded-xl bg-white dark:bg-slate-900 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
                        <span className="font-medium text-slate-900 dark:text-slate-100">{u.fullName}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{u.username ? `@${u.username}` : u.email}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : volQuery.trim().length >= 2 && !volSearching ? (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">No matching users. Volunteers must be on GuildOS to be credited.</p>
              ) : null}
            </>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <input className="ev-input" placeholder="Role (e.g. Registration Desk)" value={volRole} onChange={(e) => setVolRole(e.target.value)} />
            <Button variant="secondary" onClick={() => void addVolunteer()}>Add Volunteer</Button>
          </div>
        </div>
      </div>

      {sponsors.length ? (
        <div className="mt-4 space-y-2">
          {sponsors.map((s) => (
            <div key={s._id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 px-4 py-2">
              <div className="flex items-center gap-3">
                {s.logo ? <img src={resolveEventImageUrl(s.logo)} alt={s.name} className="h-9 w-9 rounded-lg object-contain" /> : <div className="h-9 w-9 rounded-lg bg-slate-100 dark:bg-slate-950" />}
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{s.name}</p>
              </div>
              <button onClick={() => void removeSponsor(s._id)} className="text-sm text-red-600 hover:underline">Remove</button>
            </div>
          ))}
        </div>
      ) : null}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <input className="ev-input" placeholder="Sponsor name" value={sponsor.name} onChange={(e) => setSponsor({ ...sponsor, name: e.target.value })} />
        <input className="ev-input" placeholder="Website" value={sponsor.website} onChange={(e) => setSponsor({ ...sponsor, website: e.target.value })} />
      </div>
      <div className="flex items-center gap-3">
        <input type="file" accept="image/*" onChange={(e) => void uploadSponsorLogo(e.target.files?.[0] ?? null)} />
        {sponsor.logo ? <img src={resolveEventImageUrl(sponsor.logo)} alt="Sponsor" className="h-9 w-9 rounded-lg object-contain" /> : null}
        <Button variant="secondary" onClick={() => void addSponsor()}>Add Sponsor</Button>
      </div>
    </Section>
  );
}
