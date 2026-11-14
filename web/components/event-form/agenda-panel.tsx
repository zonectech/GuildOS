'use client';
import { Plus, Trash2 } from 'lucide-react';

export type Day = { date: string; theme: string; venue: string; startTime: string; endTime: string };
export type Track = { key: string; name: string; description: string; capacity: number; venue: string };
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

/** Days for multi-day events, and tracks attendees pick one of when registering. */
export function AgendaFields({ days, onDays, minDays, onMinDays, tracks, onTracks, published }: {
  days: Day[]; onDays: (d: Day[]) => void; minDays: number; onMinDays: (n: number) => void; tracks: Track[]; onTracks: (t: Track[]) => void; published: boolean;
}) {
  const setDay = (i: number, patch: Partial<Day>) => onDays(days.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  const setTrack = (i: number, patch: Partial<Track>) => onTracks(tracks.map((t, j) => (j === i ? { ...t, ...patch, key: t.key || slug(patch.name ?? t.name) } : t)));
  return (
    <>
      <h3>Days</h3>
      <p className="small">Add days only for events that run more than one day. One-day events use the start and end times above.</p>
      {days.map((d, i) => (
        <div key={i} className="stack sub">
          <div className="row" style={{ justifyContent: 'space-between' }}><b>Day {i + 1}</b>{!published ? <button type="button" className="btn s sm" aria-label={`Remove day ${i + 1}`} onClick={() => onDays(days.filter((_, j) => j !== i))}><Trash2 size={15} /></button> : null}</div>
          <div className="two"><input className="input" type="date" aria-label="Date" value={d.date} onChange={(e) => setDay(i, { date: e.target.value })} /><input className="input" aria-label="Theme" placeholder="Theme of the day" value={d.theme} onChange={(e) => setDay(i, { theme: e.target.value })} /></div>
          <div className="two"><input className="input" type="time" aria-label="Starts" value={d.startTime} onChange={(e) => setDay(i, { startTime: e.target.value })} /><input className="input" type="time" aria-label="Ends" value={d.endTime} onChange={(e) => setDay(i, { endTime: e.target.value })} /></div>
          <input className="input" aria-label="Venue for this day" placeholder="Venue, if different" value={d.venue} onChange={(e) => setDay(i, { venue: e.target.value })} />
        </div>
      ))}
      {days.length < 14 ? <button type="button" className="btn s sm" style={{ alignSelf: 'flex-start' }} onClick={() => onDays([...days, { date: '', theme: '', venue: '', startTime: '', endTime: '' }])}><Plus size={15} />Add a day</button> : null}
      {days.length > 1 ? <label className="field"><span>Days needed for a certificate (0 means every day)</span><input className="input" type="number" min={0} max={days.length} value={minDays} onChange={(e) => onMinDays(Math.max(0, Math.min(days.length, Number(e.target.value) || 0)))} /></label> : null}
      {published ? <p className="small">Days cannot be removed after publishing. Cancel a day from the current site instead, so attendees are told.</p> : null}

      <h3>Tracks</h3>
      <p className="small">Optional. Use tracks when people choose one session, for example Data Science or Web.</p>
      {tracks.map((t, i) => (
        <div key={i} className="stack sub">
          <div className="row" style={{ justifyContent: 'space-between' }}><b>{t.name || `Track ${i + 1}`}</b>{!published ? <button type="button" className="btn s sm" aria-label="Remove track" onClick={() => onTracks(tracks.filter((_, j) => j !== i))}><Trash2 size={15} /></button> : null}</div>
          <div className="two"><input className="input" aria-label="Track name" placeholder="Name" value={t.name} onChange={(e) => setTrack(i, { name: e.target.value })} /><input className="input" type="number" min={0} aria-label="Places" placeholder="Places (0 = no limit)" value={t.capacity || ''} onChange={(e) => setTrack(i, { capacity: Math.max(0, Number(e.target.value) || 0) })} /></div>
          <input className="input" aria-label="Track description" placeholder="What happens in this track" value={t.description} onChange={(e) => setTrack(i, { description: e.target.value })} />
          <input className="input" aria-label="Track venue" placeholder="Room or venue, if different" value={t.venue} onChange={(e) => setTrack(i, { venue: e.target.value })} />
        </div>
      ))}
      {tracks.length < 8 ? <button type="button" className="btn s sm" style={{ alignSelf: 'flex-start' }} onClick={() => onTracks([...tracks, { key: '', name: '', description: '', capacity: 0, venue: '' }])}><Plus size={15} />Add a track</button> : null}
    </>
  );
}
