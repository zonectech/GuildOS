import type { PublicEventParticipation } from '../event-api';

export function EventParticipation({ participation, cancelled = false }: { participation: PublicEventParticipation; cancelled?: boolean }) {
  return <section aria-label="Event participation" className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/50">
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-600 dark:text-slate-300">
      <p><span className="font-bold tabular-nums text-slate-950 dark:text-white">{participation.registered.toLocaleString()}</span> registered</p>
      <span aria-hidden="true" className="text-slate-300">·</span>
      {participation.finalized && participation.attended !== null ? <p><span className="font-bold tabular-nums text-slate-950 dark:text-white">{participation.attended.toLocaleString()}</span> attended</p> : <p>{cancelled ? 'Attendance not recorded' : 'Attendance pending'}</p>}
    </div>
    <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{participation.evidence === 'ORGANIZER_IMPORT' ? 'Attendance source: organizer-uploaded report, matched to verified member emails. GuildOS checks attendance requirements but does not independently authenticate the report with the external platform.' : participation.evidence === 'MIXED' ? 'Attendance sources: GuildOS check-in and organizer-uploaded reports matched to verified member emails. Uploaded reports are not independently authenticated with the external platform.' : participation.evidence === 'GUILDOS' ? 'Attendance source: GuildOS check-in.' : cancelled ? 'This event was cancelled.' : 'Attendance totals will appear after the event and organizer finalization.'}</p>
  </section>;
}
