import { requireCommunityAuth } from '../middleware/community-access';
import { Router, type Response } from 'express';
import { optionalAuth, requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import {
  createTeam, getHackathonHub, joinTeam, leaveTeam, removeTeamMember, renameTeam, saveSubmission,
} from '../services/hackathon/hackathon-team.service';
import {
  addJudge, getHackathonManage, getJudgeView, removeJudge, scoreSubmission, updateHackathonSettings,
} from '../services/hackathon/hackathon-judging.service';
import { archiveResultsToKnowledge, publishResults } from '../services/hackathon/hackathon-results.service';
import { requireHackathonManager } from '../services/hackathon/hackathon-shared';
import { addHackathonPlaybook } from '../services/knowledge.service';

export const hackathonRouter = Router();

function statusFor(message: string) {
  if (/not found/i.test(message)) return 404;
  if (/permission|captain|private/i.test(message)) return 403;
  return 400;
}

/** Runs a handler and maps thrown errors to JSON responses (same contract as the events router). */
function handle(fallbackError: string, run: (req: AuthenticatedRequest) => Promise<unknown>) {
  return async (req: AuthenticatedRequest, res: Response) => {
    try {
      return res.json(await run(req));
    } catch (error) {
      const message = error instanceof Error ? error.message : fallbackError;
      return res.status(statusFor(message)).json({ error: message });
    }
  };
}

// ── Judges (private token link, no account needed) ────────────────────────────
hackathonRouter.get('/judge/:token', handle('Unable to load judging page', (req) => getJudgeView(req.params.token)));
hackathonRouter.put('/judge/:token/scores/:submissionId', handle('Unable to save scores', (req) =>
  scoreSubmission(req.params.token, req.params.submissionId, req.body ?? {})));

// ── Public hub + participants ─────────────────────────────────────────────────
hackathonRouter.get('/:event', optionalAuth, handle('Unable to load hackathon', (req) => getHackathonHub(req.params.event, req.userId)));
hackathonRouter.post('/:event/teams', requireAuth, handle('Unable to create team', (req) => createTeam(req.params.event, req.userId as string, req.body ?? {})));
hackathonRouter.post('/:event/teams/join', requireAuth, handle('Unable to join team', (req) => joinTeam(req.params.event, req.userId as string, req.body ?? {})));
hackathonRouter.post('/:event/teams/leave', requireAuth, handle('Unable to leave team', (req) => leaveTeam(req.params.event, req.userId as string)));
hackathonRouter.patch('/:event/teams/mine', requireAuth, handle('Unable to rename team', (req) => renameTeam(req.params.event, req.userId as string, req.body ?? {})));
hackathonRouter.post('/:event/teams/mine/remove', requireAuth, handle('Unable to remove member', (req) =>
  removeTeamMember(req.params.event, req.userId as string, String((req.body as { memberId?: string })?.memberId ?? ''))));
hackathonRouter.put('/:event/submission', requireAuth, handle('Unable to save project', (req) => saveSubmission(req.params.event, req.userId as string, req.body ?? {})));

// ── Organizers (COORDINATOR+ of the host or a co-host community) ───────────────
hackathonRouter.get('/:event/manage', requireCommunityAuth, handle('Unable to load hackathon dashboard', (req) => getHackathonManage(req.params.event, req.userId as string)));
hackathonRouter.patch('/:event/settings', requireCommunityAuth, handle('Unable to save settings', (req) => updateHackathonSettings(req.params.event, req.userId as string, req.body ?? {})));
hackathonRouter.post('/:event/judges', requireCommunityAuth, handle('Unable to add judge', (req) => addJudge(req.params.event, req.userId as string, req.body ?? {})));
hackathonRouter.delete('/:event/judges/:judgeId', requireCommunityAuth, handle('Unable to remove judge', (req) => removeJudge(req.params.event, req.userId as string, req.params.judgeId)));
hackathonRouter.post('/:event/results', requireCommunityAuth, handle('Unable to publish results', (req) => publishResults(req.params.event, req.userId as string, req.body ?? {})));
hackathonRouter.post('/:event/results/archive', requireCommunityAuth, handle('Unable to save to the Knowledge Hub', (req) => archiveResultsToKnowledge(req.params.event, req.userId as string)));
hackathonRouter.post('/:event/playbook', requireCommunityAuth, handle('Unable to add the playbook', async (req) => {
  // Must manage this hackathon; the playbook lands in the host community's hub.
  const { event } = await requireHackathonManager(req.params.event, req.userId as string);
  return addHackathonPlaybook(event.communityId.toString(), req.userId as string);
}));
