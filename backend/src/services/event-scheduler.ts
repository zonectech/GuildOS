import { config } from '../config';
import { finalizeDueEvents } from './event.service';

let running = false;

export function startEventFinalizeScheduler(intervalMs = config.eventFinalizeIntervalMs) {
  const tick = async () => {
    if (running) return;
    running = true;
    try {
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
