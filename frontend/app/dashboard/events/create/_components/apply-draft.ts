import type { EventInput, RichEventDraft } from '../../../../../components/guildos/event-api';

/**
 * Merges an AI-extracted draft into the current form. Fields the draft doesn't mention keep
 * their current values, and an organizer-built day agenda is never overwritten.
 */
export function mergeDraftIntoForm(current: EventInput, draft: RichEventDraft): EventInput {
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

  return {
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
  };
}

/** Multi-day documents open the day-by-day editor; single-day agendas edit inline. */
export function isMultiDayDraft(draft: RichEventDraft) {
  return (draft.days ?? []).length > 1;
}
