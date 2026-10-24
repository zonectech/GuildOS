import { Router } from 'express';
import { optionalAuth, type AuthenticatedRequest } from '../middleware/auth';
import { OnboardingAnalyticsModel, type OnboardingAnalyticsEventName } from '../models/onboarding-analytics.model';

export const onboardingAnalyticsRouter = Router();

const ALLOWED_EVENTS = new Set<OnboardingAnalyticsEventName>([
  'onboarding_student_toggle_changed',
  'onboarding_step_completed',
  'onboarding_completed',
  'onboarding_completion_failed',
]);

onboardingAnalyticsRouter.post('/onboarding', optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      eventName,
      isStudent,
      university,
      courseOfStudy,
      stepIndex,
      stepTitle,
      hasLocation,
      interestsCount,
    } = req.body as {
      eventName?: string;
      isStudent?: boolean;
      university?: string;
      courseOfStudy?: string;
      stepIndex?: number;
      stepTitle?: string;
      hasLocation?: boolean;
      interestsCount?: number;
    };

    if (!eventName || !ALLOWED_EVENTS.has(eventName as OnboardingAnalyticsEventName)) {
      return res.status(400).json({ error: 'Invalid onboarding analytics event' });
    }

    if (typeof isStudent !== 'boolean') {
      return res.status(400).json({ error: 'isStudent must be a boolean' });
    }

    await OnboardingAnalyticsModel.create({
      userId: req.userId ?? null,
      eventName,
      isStudent,
      university: typeof university === 'string' ? university.trim().slice(0, 120) : '',
      courseOfStudy: typeof courseOfStudy === 'string' ? courseOfStudy.trim().slice(0, 120) : '',
      stepIndex: Number.isFinite(stepIndex) ? Number(stepIndex) : null,
      stepTitle: typeof stepTitle === 'string' ? stepTitle.slice(0, 120) : '',
      hasLocation: typeof hasLocation === 'boolean' ? hasLocation : null,
      interestsCount: Number.isFinite(interestsCount) ? Number(interestsCount) : null,
    });

    return res.json({ ok: true });
  } catch {
    // Analytics must never break onboarding flow.
    return res.status(202).json({ ok: false });
  }
});
