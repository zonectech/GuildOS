import { Router } from 'express';
import { optionalAuth, type AuthenticatedRequest } from '../middleware/auth';
import { makeRateLimit } from '../middleware/rate-limit';
import { ProductFeedbackModel } from '../models/product-feedback.model';
import { authStore } from '../store/auth-store';
import { categoryEmail, sendEmail } from '../utils/email';
import { config } from '../config';

/** "Send feedback" from the website. Anyone can send it; signed-in people are linked to their account. */
export const feedbackRouter = Router();

const feedbackLimiter = makeRateLimit({ windowMs: 60 * 60_000, max: 10, keyBy: 'ip', message: 'Thanks! You have sent a lot of feedback this hour. Please try again later.' });
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

feedbackRouter.post('/', optionalAuth, feedbackLimiter, async (req: AuthenticatedRequest, res) => {
  const body = (req.body ?? {}) as { message?: unknown; page?: unknown; email?: unknown };
  const message = String(body.message ?? '').trim().slice(0, 2000);
  const page = String(body.page ?? '').trim().slice(0, 300);
  const email = req.userId ? '' : String(body.email ?? '').trim().slice(0, 200);
  if (message.length < 3) return res.status(400).json({ error: 'Write a few words so we know what to fix.' });
  if (email && !EMAIL.test(email)) return res.status(400).json({ error: 'That email does not look right.' });

  try {
    const feedback = await ProductFeedbackModel.create({ userId: req.userId ?? null, email, message, page });
    // A copy to the team inbox when one is set, so nobody has to go looking.
    if (config.feedbackEmail) {
      const user = req.userId ? await authStore.getPublicUserById(req.userId).catch(() => null) : null;
      const from = user ? `${user.fullName} (${user.email})` : email || 'Someone not signed in, no email given';
      void sendEmail(config.feedbackEmail, categoryEmail('INFO', {
        subject: `Feedback: ${message.slice(0, 60)}${message.length > 60 ? '…' : ''}`,
        heading: 'New feedback from the website',
        message: [`From: ${from}`, page ? `Page: ${page}` : '', message].filter(Boolean).join('\n\n'),
      })).catch(() => undefined);
    }
    return res.status(201).json({ ok: true, id: String(feedback._id) });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to send feedback' });
  }
});
