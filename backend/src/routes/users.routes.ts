import { Router } from 'express';
import mongoose from 'mongoose';
import { requireAuth, optionalAuth, type AuthenticatedRequest } from '../middleware/auth';
import { getUserLeadershipHistory, getUserMemberships } from '../services/community.service';
import { getUserRegistrations, getUserUpcomingEvents } from '../services/event.service';
import { UserModel } from '../models/user.model';
import { authStore } from '../store/auth-store';

export const usersRouter = Router();

// People search (public profiles) for global search.
usersRouter.get('/search', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const people = await authStore.searchPublicPeople(q);
    return res.json({ people });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to search people' });
  }
});

// Private: a user's own event registrations.
usersRouter.get('/me/registrations', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const registrations = await getUserRegistrations(req.userId as string);
    return res.json({ registrations });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to fetch registrations' });
  }
});

// Private: a user's upcoming registered events.
usersRouter.get('/me/upcoming-events', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const events = await getUserUpcomingEvents(req.userId as string);
    return res.json({ events });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to fetch upcoming events' });
  }
});

// Public: recruiters can verify leadership experience from a user's profile.
// Respects the owner's privacy settings — a PRIVATE profile or showLeadership=false
// returns an empty history to everyone except the owner themselves.
usersRouter.get('/:userId/leadership-history', optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.userId)) {
      return res.status(404).json({ error: 'User not found' });
    }
    const isOwner = req.userId === req.params.userId;
    if (!isOwner) {
      const target = await UserModel.findById(req.params.userId).select('profile.profileVisibility profile.showLeadership').lean();
      if (!target) {
        return res.status(404).json({ error: 'User not found' });
      }
      const profile = target.profile ?? ({} as { profileVisibility?: string; showLeadership?: boolean });
      if (profile.profileVisibility === 'PRIVATE' || profile.showLeadership === false) {
        return res.json({ leadershipHistory: [] });
      }
    }
    const leadershipHistory = await getUserLeadershipHistory(req.params.userId);
    return res.json({ leadershipHistory });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to fetch leadership history' });
  }
});

// Private: a user can view their own community memberships.
usersRouter.get('/:userId/memberships', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (req.userId !== req.params.userId) {
      return res.status(403).json({ error: 'You can only view your own memberships' });
    }

    const memberships = await getUserMemberships(req.params.userId);
    return res.json({ memberships });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to fetch memberships' });
  }
});
