import { config } from '../config';
import { finalizeDueEvents } from './event.service';
import { notifyOrganizersToReviewAttendance } from './event-notification.service';

let running = false;

export function startEventFinalizeScheduler(intervalMs = config.eventFinalizeIntervalMs) {
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const reminded = await notifyOrganizersToReviewAttendance().catch((error) => { console.warn('[GuildOS] finalize reminders failed:', error instanceof Error ? error.message : error); return 0; });
      if (reminded) console.log(`[GuildOS] Asked organizers to review attendance for ${reminded} event(s)`);
      const count = await finalizeDueEvents();
      if (count) {
        console.log(`[GuildOS] Finalized attendance for ${count} event(s)`);
      }
    } catch (error) {
      console.warn('[GuildOS] finalize sweep failed:', error instanceof Error ? error.message : error);
    } finally {
      running = false;
    }
  };

  setTimeout(() => void tick(), 20_000);
  const handle = setInterval(() => void tick(), intervalMs);
  if (typeof handle.unref === 'function') handle.unref();
  console.log(`[GuildOS] Event finalize scheduler started (every ${Math.round(intervalMs / 60000)} min)`);
  return handle;
}
