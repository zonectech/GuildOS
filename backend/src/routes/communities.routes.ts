import { Router } from 'express';
import { requireAuth, optionalAuth, type AuthenticatedRequest } from '../middleware/auth';
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
  listCommunityEndorsements,
  listCommunityRoles,
  rejectCommunityJoinRequest,
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

communitiesRouter.get('/roles', (_req, res) => {
  return res.json({ roles: listCommunityRoles() });
});

communitiesRouter.get('/:id/roles', (_req, res) => {
  return res.json({ roles: listCommunityRoles() });
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
