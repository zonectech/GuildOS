import { Router } from 'express';
import {
  GUILDOS_MISSION,
  STUDENT_CAPABILITIES,
  LEADER_CAPABILITIES,
} from '../services/guildos-capabilities';

/**
 * Public GuildOS product documentation, served straight from the capabilities
 * manifest (the single source of truth that also powers the assistant).
 * This is PLATFORM documentation — distinct from community Knowledge Hubs.
 */
export const docsRouter = Router();

docsRouter.get('/', (_req, res) => {
  res.json({
    mission: GUILDOS_MISSION,
    student: STUDENT_CAPABILITIES.map(({ area, path, detail, guide }) => ({
      area,
      path: path ?? null,
      detail,
      guide: guide ?? null,
    })),
    leader: LEADER_CAPABILITIES.map(({ area, path, detail, guide }) => ({
      area,
      path: path ?? null,
      detail,
      guide: guide ?? null,
    })),
  });
});
