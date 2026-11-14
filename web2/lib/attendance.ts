import type { Event } from './api/types';
import { phaseOf } from './events';
import { fmtWhen } from './format';

/**
 * The one answer to "where does this event stand for a student?". Every place that can show a
 * stamp, the word "Attended" or a certificate asks this function and nothing else.
 *
 * It rests on two facts from the API, never on the clock:
 *   - `event.finalized`: the organizer has finalized attendance;
 *   - `viewerAttended`: this student's record counted when they did.
 * The clock only separates upcoming, live and over. An event that is over but not finalized is
 * AWAITING_FINALIZE: nobody has attended it yet, as far as anyone may be told.
 */
export type AttendanceState =
  | 'CANCELLED'
  /** Listed here, run elsewhere (Luma, Eventbrite...): no scanning, no certificate from us. */
  | 'EXTERNAL'
  | 'UPCOMING'
  | 'LIVE'
  /** Over, and the organizer has not finalized yet. Records can still be corrected. */
  | 'AWAITING_FINALIZE'
  /** Finalized, and this student's attendance counted. The only state with a stamp. */
  | 'ATTENDED'
  /** Finalized, and it did not count for this student (or they never registered). */
  | 'NOT_ATTENDED';

export function attendanceState(event: Event, viewerAttended = false, now = Date.now()): AttendanceState {
  const phase = phaseOf(event, now);
  if (phase === 'CANCELLED') return 'CANCELLED';
  // A finalized, counted record is a real stamp wherever the registration happened.
  if (event.finalized && viewerAttended) return 'ATTENDED';
  if (event.external) return 'EXTERNAL';
  if (phase === 'BEFORE') return 'UPCOMING';
  if (phase === 'LIVE') return 'LIVE';
  return event.finalized ? 'NOT_ATTENDED' : 'AWAITING_FINALIZE';
}

/** Has the organizer's decision been made? (Only then may anything say "attended".) */
export const isSettled = (event: Event) => event.finalized;

/**
 * The word that goes with a head count: people are "going" until it is over, "registered" while
 * the organizer has yet to finalize, and "attended" only once they have.
 */
export function countWord(event: Event, now = Date.now()): 'going' | 'registered' | 'attended' {
  if (event.finalized) return 'attended';
  return phaseOf(event, now) === 'AFTER' ? 'registered' : 'going';
}

/** The friendly line for a student whose event is over but not finalized. */
export const WAITING_TITLE = 'Your attendance will be confirmed soon.';
export const WAITING_BODY = 'The organizer still has to finalize attendance for this event. We’ll let you know as soon as they do.';
/** "It’s finalized automatically by Sat, 14 Nov · 5:42 PM if the organizer doesn’t do it first." */
export const waitingBy = (event: Event) =>
  event.finalizesAt ? `If the organizer doesn’t do it first, it’s finalized automatically by ${fmtWhen(event.finalizesAt, event.timezone)}.` : '';
