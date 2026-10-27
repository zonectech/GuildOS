import type { EventSummary } from '../event-api';

export function ExternalEventTrust({ event }: { event: EventSummary }) {
  const externalAttendance = event.attendanceSource === 'EXTERNAL';
  if (!event.partnerRegistrationUrl && !externalAttendance) return null;
  const platform = event.partnerRegistrationLabel?.trim() || 'the external platform';
  let host = '';
  try { host = event.partnerRegistrationUrl ? new URL(event.partnerRegistrationUrl).hostname : ''; } catch { /* Legacy links may not have a valid URL. */ }
  return <section aria-label="External platform and attendance evidence" className="mt-4 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 dark:border-indigo-800 dark:bg-indigo-950/30">
    <h2 className="text-sm font-semibold text-indigo-950 dark:text-indigo-200">{event.partnerRegistrationUrl ? 'External registration · ' + platform : 'External attendance'}</h2>
    {event.partnerRegistrationUrl && <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">Registration is completed on {platform}{host ? ' (' + host + ')' : ''}. Opening the link or marking the form complete does not confirm registration; confirmation requires a match to the organizer’s registration report.</p>}
    <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{externalAttendance
      ? 'Attendance is recorded outside GuildOS. GuildOS matches the organizer’s uploaded attendance report to verified member emails and checks the event’s attendance requirements. Registration alone does not qualify you for a certificate.'
      : 'Attendance is recorded through GuildOS check-in and check-out. Completing the external registration alone does not qualify you for a certificate.'}</p>
    {externalAttendance && <p className="mt-2 text-xs font-medium leading-relaxed text-indigo-900 dark:text-indigo-300">Evidence source: organizer-uploaded report. GuildOS does not independently authenticate this report with the external platform. No additional GuildOS check-in or check-out is required.</p>}
  </section>;
}
