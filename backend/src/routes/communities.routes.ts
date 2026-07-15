import { Router } from 'express';
import { requireAuth, optionalAuth, type AuthenticatedRequest } from '../middleware/auth';
import { startPremiumCheckout, verifyPremiumPayment, listPremiumPayments, getPremiumStatus, reconcileCommunityPayments } from '../services/premium.service';
import { listCommunityReports, moderateCommunityComment, moderateCommunityPost } from '../services/community-moderation.service';
import { sendCommunityAnnouncement } from '../services/community-announcement.service';
import { createCommunity,
  createCommunityInviteLink,
  approveCommunityJoinRequest,
  archiveCommunity,
  createCommunityEndorsement,
  deleteCommunity,
  getCommunityContext,
  getCommunityActivity,
  getCommunityById,
  getCommunityByInviteToken,
  getCommunityBySlug,
  hasCommunityPermission,
    joinCommunity,
    joinCommunityByInvite,
  leaveCommunity,
  listCommunities,
  listManagedCommunities,
  listManagedCommunityHistory,
  listSuggestedCommunities,
  listCommunityEndorsements,
  listCommunityRoles,
  rejectCommunityJoinRequest,
  reopenCommunity,
  revokeCommunityInviteLink,
  transferCommunityOwnership,
  updateCommunity,
  updateMemberRole,
} from '../services/community.service';

export const communitiesRouter = Router();

communitiesRouter.get('/', async (_req, res) => {
  try {
    const communities = await listCommunities();
    return res.json({ communities });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to fetch communities' });
  }
});

// Only the communities the signed-in user manages (leadership role). Keeps a
// leader from receiving other people's communities in the management dashboard.
communitiesRouter.get('/managed', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const communities = await listManagedCommunities(req.userId as string);
    return res.json({ communities });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to fetch communities' });
  }
});

// Rejected or archived communities the user leads — history view only.
communitiesRouter.get('/managed/history', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const communities = await listManagedCommunityHistory(req.userId as string);
    return res.json({ communities });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to fetch community history' });
  }
});

communitiesRouter.get('/roles', (_req, res) => {
  return res.json({ roles: listCommunityRoles() });
});

communitiesRouter.get('/suggested', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const communities = await listSuggestedCommunities(req.userId as string);
    return res.json({ communities });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to fetch suggestions' });
  }
});

communitiesRouter.get('/:id/roles', (_req, res) => {
  return res.json({ roles: listCommunityRoles() });
});

// Premium status for a community (used by the event wizard to unlock premium certificate designs).
communitiesRouter.get('/:id/premium', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const community = await getCommunityById(req.params.id);
    if (!community) {
      return res.status(404).json({ error: 'Community not found' });
    }
    return res.json({ isPremium: Boolean(community.isPremium) });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to fetch premium status' });
  }
});

// Full premium status (price, expiry, whether online payment is configured).
communitiesRouter.get('/:id/premium/status', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const status = await getPremiumStatus(req.params.id);
    return res.json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to fetch premium status';
    return res.status(message === 'Community not found' ? 404 : 500).json({ error: message });
  }
});

// Start a Paystack checkout for one month of premium (community leaders only).
communitiesRouter.post('/:id/premium/checkout', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await startPremiumCheckout(req.params.id, req.userId as string);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to start payment';
    const status = message === 'Community not found' ? 404 : message.includes('leaders') ? 403 : 400;
    return res.status(status).json({ error: message });
  }
});

// Verify a payment reference after returning from Paystack.
communitiesRouter.get('/:id/premium/verify', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const reference = typeof req.query.reference === 'string' ? req.query.reference : '';
    if (!reference) {
      return res.status(400).json({ error: 'A payment reference is required' });
    }
    const result = await verifyPremiumPayment(reference);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to verify payment';
    return res.status(message.includes('not found') ? 404 : 400).json({ error: message });
  }
});

// Premium payment history for a community (leaders only).
communitiesRouter.get('/:id/premium/history', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const payments = await listPremiumPayments(req.params.id, req.userId as string);
    return res.json({ payments });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to fetch payment history';
    return res.status(message.includes('leaders') ? 403 : 400).json({ error: message });
  }
});

// Re-check any recent PENDING payments for this community (safety net if a callback was missed).
communitiesRouter.post('/:id/premium/reconcile', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await reconcileCommunityPayments(req.params.id, req.userId as string);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to check payment';
    return res.status(message.includes('leaders') ? 403 : 400).json({ error: message });
  }
});

// ── Community mod queue (delegated moderation for leaders) ──
function moderationStatus(message: string) {
  if (/not found/i.test(message)) return 404;
  if (/managers/i.test(message)) return 403;
  return 400;
}

communitiesRouter.get('/:id/moderation/reports', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await listCommunityReports(req.params.id, req.userId as string);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load reports';
    return res.status(moderationStatus(message)).json({ error: message });
  }
});

communitiesRouter.post('/:id/moderation/posts/:postId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const action = req.body?.action === 'REMOVE' ? 'REMOVE' : req.body?.action === 'DISMISS' ? 'DISMISS' : null;
    if (!action) return res.status(400).json({ error: 'Invalid action' });
    const result = await moderateCommunityPost(req.params.id, req.userId as string, req.params.postId, action, typeof req.body?.note === 'string' ? req.body.note : '');
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to moderate post';
    return res.status(moderationStatus(message)).json({ error: message });
  }
});

communitiesRouter.post('/:id/moderation/comments/:commentId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const action = req.body?.action === 'REMOVE' ? 'REMOVE' : req.body?.action === 'DISMISS' ? 'DISMISS' : null;
    if (!action) return res.status(400).json({ error: 'Invalid action' });
    const result = await moderateCommunityComment(req.params.id, req.userId as string, req.params.commentId, action);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to moderate comment';
    return res.status(moderationStatus(message)).json({ error: message });
  }
});

communitiesRouter.get('/:slug', optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const community = await getCommunityBySlug(req.params.slug);
    if (!community) {
      return res.status(404).json({ error: 'Community not found' });
    }

    const context = await getCommunityContext(community._id.toString(), req.userId);
    return res.json(context);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to fetch community' });
  }
});

communitiesRouter.post('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const community = await createCommunity({
      name: req.body.name,
      shortDescription: req.body.shortDescription,
      description: req.body.description,
      logo: req.body.logo,
      coverImage: req.body.coverImage,
      category: req.body.category,
      university: req.body.university,
      faculty: req.body.faculty,
      department: req.body.department,
      whatsappLink: req.body.whatsappLink,
      channelLink: req.body.channelLink,
      visibility: req.body.visibility,
      autoApprove: req.body.autoApprove,
      verificationMethod: req.body.verificationMethod,
      creatorId: req.userId as string,
    });

    return res.status(201).json({ community });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to create community' });
  }
});

communitiesRouter.patch('/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const community = await updateCommunity(req.params.id, req.userId as string, {
      name: req.body.name,
      shortDescription: req.body.shortDescription,
      description: req.body.description,
      logo: req.body.logo,
      coverImage: req.body.coverImage,
      category: req.body.category,
      university: req.body.university,
      faculty: req.body.faculty,
      department: req.body.department,
      whatsappLink: req.body.whatsappLink,
      channelLink: req.body.channelLink,
      rules: req.body.rules,
      visibility: req.body.visibility,
      autoApprove: req.body.autoApprove,
    });

    return res.json({ community });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update community';
    const status = message === 'Community not found' ? 404 : message === 'Only the founder can update the community' ? 403 : 400;
    return res.status(status).json({ error: message });
  }
});

communitiesRouter.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await deleteCommunity(req.params.id, req.userId as string);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to delete community';
    const status = message === 'Community not found' ? 404 : message === 'Only the founder can delete the community' ? 403 : 400;
    return res.status(status).json({ error: message });
  }
});

communitiesRouter.patch('/:id/archive', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { reason = '' } = req.body as { reason?: string };
    const community = await archiveCommunity(req.params.id, req.userId as string, reason);
    return res.json({ community });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to archive community';
    const status = message === 'Community not found' ? 404 : message === 'Only the founder can archive the community' ? 403 : 400;
    return res.status(status).json({ error: message });
  }
});

communitiesRouter.patch('/:id/reopen', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const community = await reopenCommunity(req.params.id, req.userId as string);
    return res.json({ community });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to reopen community';
    const status = message === 'Community not found' ? 404 : message === 'Only the founder can reopen the community' ? 403 : 400;
    return res.status(status).json({ error: message });
  }
});

communitiesRouter.post('/:id/invite-link', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const community = await createCommunityInviteLink(req.params.id, req.userId as string);
    return res.json({ inviteLink: `/communities/join/${community.inviteToken}` });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create invite link';
    const status = message === 'Community not found' ? 404 : message === 'Only the founder can manage invite links' ? 403 : 400;
    return res.status(status).json({ error: message });
  }
});

// Official announcement to every active member (VP+ only; in-app + optional branded email).
communitiesRouter.post('/:id/announce', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { title, body, emailToo } = req.body as { title?: string; body?: string; emailToo?: boolean };
    const result = await sendCommunityAnnouncement({
      communityId: req.params.id,
      actorId: req.userId as string,
      title: title ?? '',
      body: body ?? '',
      emailToo: Boolean(emailToo),
    });
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to send announcement';
    const status = message === 'Community not found' ? 404 : /senior leaders/.test(message) ? 403 : 400;
    return res.status(status).json({ error: message });
  }
});

communitiesRouter.delete('/:id/invite-link', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    await revokeCommunityInviteLink(req.params.id, req.userId as string);
    return res.json({ message: 'Invite link revoked successfully' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to revoke invite link';
    const status = message === 'Community not found' ? 404 : message === 'Only the founder can manage invite links' ? 403 : 400;
    return res.status(status).json({ error: message });
  }
});

communitiesRouter.post('/join/:token', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const community = await getCommunityByInviteToken(req.params.token);
    if (!community) {
      return res.status(404).json({ error: 'Invalid or revoked invite link' });
    }

    const result = await joinCommunityByInvite(community._id.toString(), req.userId as string);
    return res.status(result.alreadyMember ? 200 : 201).json({
      community: result.community,
      message: result.alreadyMember ? 'Already a member' : 'Joined community successfully',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to join community';
    const status = message === 'Community not found' ? 404 : message === 'Private communities require an invitation' ? 403 : 400;
    return res.status(status).json({ error: message });
  }
});

communitiesRouter.post('/:id/join', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await joinCommunity(req.params.id, req.userId as string);
    return res.status(result.alreadyMember ? 200 : 201).json({
      community: result.community,
      message: result.alreadyMember ? 'Already a member' : result.joined ? 'Joined community successfully' : 'Join request submitted',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to join community';
    const status =
      message === 'Community not found' ? 404 : message === 'Private communities require an invitation' ? 403 : 400;
    return res.status(status).json({ error: message });
  }
});

communitiesRouter.post('/:id/leave', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    await leaveCommunity(req.params.id, req.userId as string);
    return res.json({ message: 'Left community successfully' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to leave community';
    const status =
      message === 'Community not found' ? 404 : message === 'Membership not found' ? 404 : message === 'Founder cannot leave the community' ? 403 : 400;
    return res.status(status).json({ error: message });
  }
});

communitiesRouter.get('/:id/members', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const context = await getCommunityContext(req.params.id, req.userId);
    if (!context.viewerMembership && context.community.visibility === 'PRIVATE') {
      return res.status(403).json({ error: 'Private community members are hidden' });
    }

    return res.json({ members: context.members });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to fetch members';
    const status = message === 'Community not found' ? 404 : 400;
    return res.status(status).json({ error: message });
  }
});

communitiesRouter.patch('/:id/members/:memberId/role', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { role } = req.body as { role?: string };
    if (!role) {
      return res.status(400).json({ error: 'role is required' });
    }

    const community = await getCommunityById(req.params.id);
    if (!community) {
      return res.status(404).json({ error: 'Community not found' });
    }

    const updaterMembership = await getCommunityContext(req.params.id, req.userId);
    if (!updaterMembership.viewerMembership) {
      return res.status(403).json({ error: 'Membership required' });
    }

    if (!hasCommunityPermission(updaterMembership.viewerMembership.role, 'VICE_PRESIDENT')) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const membership = await updateMemberRole(req.params.id, req.params.memberId, role as any, req.userId as string);
    return res.json({ membership });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update member role';
    const status = message === 'Membership not found' ? 404 : /rank|manage a member|assign a role|founder role|ownership transfer/i.test(message) ? 403 : 400;
    return res.status(status).json({ error: message });
  }
});

communitiesRouter.patch('/:id/ownership', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { memberId } = req.body as { memberId?: string };
    if (!memberId) {
      return res.status(400).json({ error: 'memberId is required' });
    }

    const community = await transferCommunityOwnership(req.params.id, req.userId as string, memberId);
    return res.json({ community });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to transfer ownership';
    const status = message === 'Community not found' ? 404 : message === 'Membership not found' ? 404 : message === 'Only the founder can transfer ownership' ? 403 : 400;
    return res.status(status).json({ error: message });
  }
});

communitiesRouter.get('/:id/join-requests', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const context = await getCommunityContext(req.params.id, req.userId);
    if (!context.viewerMembership || !hasCommunityPermission(context.viewerMembership.role, 'PRESIDENT')) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    return res.json({ joinRequests: context.joinRequests ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to fetch join requests';
    const status = message === 'Community not found' ? 404 : 400;
    return res.status(status).json({ error: message });
  }
});

communitiesRouter.get('/:id/activity', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const activity = await getCommunityActivity(req.params.id, req.userId as string);
    return res.json({ activity });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to fetch activity';
    const status = message === 'Community not found' ? 404 : message === 'Insufficient permissions' ? 403 : 400;
    return res.status(status).json({ error: message });
  }
});

communitiesRouter.get('/:id/endorsements', async (req: AuthenticatedRequest, res) => {
  try {
    const endorsements = await listCommunityEndorsements(req.params.id);
    return res.json({ endorsements });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to fetch endorsements';
    const status = message === 'Community not found' ? 404 : 400;
    return res.status(status).json({ error: message });
  }
});

communitiesRouter.post('/:id/endorsements', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { note = '' } = req.body as { note?: string };
    const endorsement = await createCommunityEndorsement(req.params.id, req.userId as string, note);
    return res.status(201).json({ endorsement });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create endorsement';
    const status = message === 'Community not found' ? 404 : message === 'Community is not pending verification' ? 400 : message === 'Only verified community leaders can endorse communities' ? 403 : 400;
    return res.status(status).json({ error: message });
  }
});

communitiesRouter.patch('/:id/join-requests/:requestId/approve', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const request = await approveCommunityJoinRequest(req.params.id, req.params.requestId, req.userId as string);
    return res.json({ request });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to approve join request';
    const status = message === 'Community not found' ? 404 : message === 'Join request not found' ? 404 : message === 'Insufficient permissions' ? 403 : 400;
    return res.status(status).json({ error: message });
  }
});

communitiesRouter.patch('/:id/join-requests/:requestId/reject', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const request = await rejectCommunityJoinRequest(req.params.id, req.params.requestId, req.userId as string);
    return res.json({ request });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to reject join request';
    const status = message === 'Community not found' ? 404 : message === 'Join request not found' ? 404 : message === 'Insufficient permissions' ? 403 : 400;
    return res.status(status).json({ error: message });
  }
});
