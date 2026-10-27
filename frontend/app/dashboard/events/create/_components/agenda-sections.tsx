'use client';

import { useState } from 'react';

import { Section, Field } from '../../../../../components/guildos/events/event-form-ui';
import type { EventInput } from '../../../../../components/guildos/event-api';
import {
  DASHED_ADD_BUTTON, DASHED_ADD_BUTTON_SM, EMPTY_DAY, REMOVE_LINK, namedSections, toLocalInput,
  type EventDay, type SectionProps,
} from './form-model';

type Track = { key: string; name: string };

/** Facilitators / anchors for one day (up to 6). */
function DayFacilitatorsEditor({ day, onChange, label }: { day: EventDay; onChange: (patch: Partial<EventDay>) => void; label: string }) {
  const people = day.facilitators ?? [];
  const setPerson = (index: number, patch: Partial<(typeof people)[number]>) =>
    onChange({ facilitators: people.map((p, j) => (j === index ? { ...p, ...patch } : p)) });

  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">{label}</p>
      {people.map((person, pIndex) => (
        <div key={pIndex} className="mb-2 flex items-center gap-2">
          <input
            className="ev-input flex-1"
            placeholder="Name, e.g. Dr. Amina Bello"
            value={person.name}
            onChange={(e) => setPerson(pIndex, { name: e.target.value.slice(0, 80) })}
          />
          <input
            className="ev-input flex-1"
            placeholder="Role, e.g. Lead Facilitator, MC"
            value={person.title}
            onChange={(e) => setPerson(pIndex, { title: e.target.value.slice(0, 100) })}
          />
          <button type="button" className={`shrink-0 ${REMOVE_LINK}`} onClick={() => onChange({ facilitators: people.filter((_, j) => j !== pIndex) })}>
            Remove
          </button>
        </div>
      ))}
      {people.length < 6 ? (
        <button type="button" className={DASHED_ADD_BUTTON_SM} onClick={() => onChange({ facilitators: [...people, { name: '', title: '' }] })}>
          + Add facilitator
        </button>
      ) : null}
    </div>
  );
}

/** Timed sessions for one day (up to 8), optionally scoped to a track. */
function DaySessionsEditor({
  day, onChange, tracks, label, titlePlaceholder, addLabel,
}: {
  day: EventDay;
  onChange: (patch: Partial<EventDay>) => void;
  tracks: Track[];
  label: string;
  titlePlaceholder: string;
  addLabel: string;
}) {
  const sessions = day.sessions ?? [];
  const setSession = (index: number, patch: Partial<(typeof sessions)[number]>) =>
    onChange({ sessions: sessions.map((s, j) => (j === index ? { ...s, ...patch } : s)) });

  return (
    <div className="mt-3">
      <p className="mb-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">{label}</p>
      {sessions.map((session, sIndex) => (
        <div key={sIndex} className={`mb-2 grid gap-2 ${tracks.length ? 'sm:grid-cols-[110px_1fr_1fr_1fr_150px_auto]' : 'sm:grid-cols-[110px_1fr_1fr_1fr_auto]'}`}>
          <input type="time" className="ev-input" value={session.time} onChange={(e) => setSession(sIndex, { time: e.target.value })} />
          <input className="ev-input" placeholder={titlePlaceholder} value={session.title} onChange={(e) => setSession(sIndex, { title: e.target.value.slice(0, 120) })} />
          <input className="ev-input" placeholder="Venue (optional)" value={session.venue} onChange={(e) => setSession(sIndex, { venue: e.target.value.slice(0, 160) })} />
          <input className="ev-input" placeholder="Facilitator (optional)" value={session.facilitator} onChange={(e) => setSession(sIndex, { facilitator: e.target.value.slice(0, 80) })} />
          {tracks.length ? (
            <select className="ev-input" aria-label="Session track" value={session.sectionKey ?? ''} onChange={(e) => setSession(sIndex, { sectionKey: e.target.value })}>
              <option value="">All tracks</option>
              {tracks.map((sec) => (
                <option key={sec.key} value={sec.key}>{sec.name} only</option>
              ))}
            </select>
          ) : null}
          <button type="button" className={`shrink-0 self-center ${REMOVE_LINK}`} onClick={() => onChange({ sessions: sessions.filter((_, j) => j !== sIndex) })}>
            Remove
          </button>
        </div>
      ))}
      {sessions.length < 8 ? (
        <button type="button" className={DASHED_ADD_BUTTON_SM} onClick={() => onChange({ sessions: [...sessions, { time: '', title: '', venue: '', facilitator: '' }] })}>
          {addLabel}
        </button>
      ) : null}
    </div>
  );
}

/** Single-day programme vs day-by-day agenda for summits and bootcamps. */
export function EventDaysSection({
  form,
  update,
  agendaMode,
  onAgendaModeChange,
  daysLocked,
}: SectionProps & {
  agendaMode: 'SINGLE' | 'MULTI';
  onAgendaModeChange: (mode: 'SINGLE' | 'MULTI') => void;
  /** Published events with a day agenda can't drop days — tickets/RSVPs reference Day N. */
  daysLocked: boolean;
}) {
  // Raw per-day "activities" text while typing, keyed by day index.
  const [dayFeaturesText, setDayFeaturesText] = useState<Record<number, string>>({});
  const days = form.days ?? [];
  const tracks = namedSections(form);
  const patchDay = (index: number, patch: Partial<EventDay>) => update('days', days.map((d, i) => (i === index ? { ...d, ...patch } : d)));

  return (
    <Section title="Event days">
      <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-800 p-1 text-sm">
        <button
          type="button"
          disabled={daysLocked}
          title={daysLocked ? 'Published events keep their day agenda. Cancel a day instead' : undefined}
          onClick={() => {
            onAgendaModeChange('SINGLE');
            // Keep Day 1's agenda — it becomes the single-day agenda below.
            update('days', days.slice(0, 1));
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
            onAgendaModeChange('MULTI');
            if (!days.length) update('days', [{ ...EMPTY_DAY }]);
          }}
          className={`rounded-lg px-3 py-1.5 font-medium transition ${agendaMode === 'MULTI' ? 'bg-slate-900 text-white' : 'text-slate-600 dark:text-slate-400'}`}
        >
          Day-by-day (multi-day)
        </button>
      </div>

      {agendaMode === 'SINGLE' ? (
        <>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            One-session event: the Schedule above sets the time. Optionally build the programme below
            (it shows as the agenda on the event page). Switch to <strong>Day-by-day</strong> for summits,
            bootcamps and workshops that run across several days.
          </p>
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            {(() => {
              const day0 = days[0] ?? EMPTY_DAY;
              const patchDay0 = (patch: Partial<EventDay>) => update('days', [{ ...day0, ...patch }]);
              return (
                <>
                  <DayFacilitatorsEditor day={day0} onChange={patchDay0} label="Facilitators / anchors (up to 6)" />
                  <DaySessionsEditor
                    day={day0}
                    onChange={patchDay0}
                    tracks={tracks}
                    label="Timed programme (optional, up to 8 items, shown as the agenda on the event page)"
                    titlePlaceholder="Session, e.g. Opening keynote"
                    addLabel="+ Add agenda item"
                  />
                </>
              );
            })()}
          </div>
        </>
      ) : (
        <>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Running a summit or bootcamp across several days? Give each day its own sub-theme, venue and activities. The
            “Theme / Topic” above stays the grand theme for the whole event. Attendees scan the same QR pass each day.
          </p>
          {days.map((day, index) => (
            <div key={index} className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Day {index + 1}</span>
                <button
                  type="button"
                  className={REMOVE_LINK}
                  onClick={() => {
                    update('days', days.filter((_, i) => i !== index));
                    setDayFeaturesText((prev) => { const next = { ...prev }; delete next[index]; return next; });
                  }}
                >
                  Remove
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Date">
                  <input
                    type="date"
                    className="ev-input"
                    value={toLocalInput(day.date).slice(0, 10)}
                    onChange={(e) => patchDay(index, { date: e.target.value ? new Date(`${e.target.value}T00:00`).toISOString() : null })}
                  />
                </Field>
                <Field label="Starts">
                  <input type="time" className="ev-input" value={day.startTime ?? ''} onChange={(e) => patchDay(index, { startTime: e.target.value })} />
                </Field>
                <Field label="Ends">
                  <input type="time" className="ev-input" value={day.endTime ?? ''} onChange={(e) => patchDay(index, { endTime: e.target.value })} />
                </Field>
                <Field label="Day theme">
                  <input className="ev-input" placeholder="e.g. Day 1: Foundations" value={day.theme} onChange={(e) => patchDay(index, { theme: e.target.value.slice(0, 120) })} />
                </Field>
                <Field label="Venue (if different)">
                  <input className="ev-input" placeholder="Defaults to the event venue" value={day.venue} onChange={(e) => patchDay(index, { venue: e.target.value.slice(0, 160) })} />
                </Field>
                <Field label="Day seat cap (optional)">
                  <input
                    type="number"
                    min={0}
                    className="ev-input"
                    placeholder="0 = no day-specific cap"
                    value={day.capacity || ''}
                    onChange={(e) => patchDay(index, { capacity: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
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
                      patchDay(index, { features: e.target.value.split('\n').map((f) => f.trim().slice(0, 80)).filter(Boolean).slice(0, 8) });
                    }}
                  />
                </Field>
              </div>
              <div className="mt-3">
                <DayFacilitatorsEditor day={day} onChange={(patch) => patchDay(index, patch)} label="Facilitators / anchors for this day (up to 6)" />
              </div>
              <DaySessionsEditor
                day={day}
                onChange={(patch) => patchDay(index, patch)}
                tracks={tracks}
                label="Timed sessions (optional, for days with several programmes at different times or venues, up to 8)"
                titlePlaceholder="Session, e.g. Amir's Cup Final"
                addLabel="+ Add session"
              />
            </div>
          ))}
          {days.length < 14 ? (
            <button type="button" className={DASHED_ADD_BUTTON} onClick={() => update('days', [...days, { ...EMPTY_DAY }])}>
              + Add day
            </button>
          ) : null}
          {days.length > 1 ? (
            <Field label="Days required for a certificate (0 = attend every day)">
              <input
                type="number"
                min={0}
                max={days.length}
                className="ev-input"
                value={form.minimumAttendanceDays ?? 0}
                onChange={(e) => update('minimumAttendanceDays', Math.max(0, Math.min(days.length, Math.round(Number(e.target.value) || 0))))}
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Attendees check in each day with the same QR pass; certificates go to those who attend at least this many days.</p>
            </Field>
          ) : null}
        </>
      )}
    </Section>
  );
}

/** Parallel cohorts — attendees pick exactly one section at registration. */
export function TracksSection({ form, update }: SectionProps) {
  const sections = form.sections ?? [];
  const patchSection = (index: number, patch: Partial<NonNullable<EventInput['sections']>[number]>) =>
    update('sections', sections.map((s, i) => (i === index ? { ...s, ...patch } : s)));

  return (
    <Section title="Sections / tracks (parallel cohorts)">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Running parallel tracks in one event, like a Data Science track and a Coding track in the same 7-day workshop?
        Add them here. Attendees pick exactly <strong>one</strong> section when they register and follow it for the whole
        event; each section can have its own trainers (assign them in the Speakers step), venue and seat cap.
      </p>
      <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
        Use sections only when attendees must <strong>choose one</strong>. If everyone attends everything (e.g. a morning
        Data Science block and an afternoon Coding block with different trainers), skip sections. Build those blocks as
        timed sessions in the day agenda above and add the trainers in the Speakers step.
      </p>
      {sections.map((section, index) => (
        <div key={section.key || `new-${index}`} className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Section {index + 1}</span>
            <button type="button" className={REMOVE_LINK} onClick={() => update('sections', sections.filter((_, i) => i !== index))}>Remove</button>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Section name">
              <input className="ev-input" placeholder="e.g. Data Science" value={section.name} onChange={(e) => patchSection(index, { name: e.target.value.slice(0, 80) })} />
            </Field>
            <Field label="Venue (if different)">
              <input className="ev-input" placeholder="Defaults to the event venue" value={section.venue} onChange={(e) => patchSection(index, { venue: e.target.value.slice(0, 160) })} />
            </Field>
            <Field label="Seat cap (optional)">
              <input
                type="number"
                min={0}
                className="ev-input"
                placeholder="0 = unlimited"
                value={section.capacity || ''}
                onChange={(e) => patchSection(index, { capacity: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
              />
            </Field>
          </div>
          <div className="mt-3">
            <Field label="What this section covers (shown on the section picker)">
              <textarea
                className="ev-input min-h-16"
                placeholder="e.g. Python, pandas, and machine learning fundamentals. No prior experience needed"
                value={section.description}
                onChange={(e) => patchSection(index, { description: e.target.value.slice(0, 300) })}
              />
            </Field>
          </div>
          <div className="mt-3">
            <Field label="Section group chat (optional)">
              <input
                className="ev-input"
                placeholder="https://chat.whatsapp.com/… (shown only to this section's registered attendees)"
                value={section.chatLink ?? ''}
                onChange={(e) => patchSection(index, { chatLink: e.target.value.slice(0, 300) })}
              />
            </Field>
          </div>
        </div>
      ))}
      {sections.length < 10 ? (
        <button type="button" className={DASHED_ADD_BUTTON} onClick={() => update('sections', [...sections, { key: '', name: '', description: '', capacity: 0, venue: '' }])}>
          + Add section
        </button>
      ) : null}
      {sections.length > 0 ? (
        <p className="text-xs text-amber-600 dark:text-amber-400">Sections can be renamed but not removed after publishing, because attendees register into them.</p>
      ) : null}
    </Section>
  );
}
