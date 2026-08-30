import { Router } from 'express';
import { requireAuth, optionalAuth, type AuthenticatedRequest } from '../middleware/auth';
import { startPremiumCheckout, verifyPremiumPayment, listPremiumPayments, getPremiumStatus, reconcileCommunityPayments } from '../services/premium.service';
import { listCommunityReports, moderateCommunityComment, moderateCommunityPost } from '../services/community-moderation.service';
import { sendCommunityAnnouncement } from '../services/community-announcement.service';
import { getCommunityFeedbackInsights } from '../services/event/event-analytics.service';
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
  canUserEndorseCommunity,
  listCommunityRoles,
  rejectCommunityJoinRequest,
  reopenCommunity,
  revokeCommunityInviteLink,
  transferCommunityOwnership,
  updateCommunity,
  updateMemberRole,
  listCommunityLeaders,
  listCommunityLeaderSessions,
  addCommunityLeader,
  updateCommunityLeader,
  removeCommunityLeader,
  dissolveCommunityLeaderSession,
  issueCertificateForLeader,
  bulkCreateCommunityLeaders,
  listLeaderSessionCertificates,
  listCommunityMembersPaged,
  listCommunityPeoplePaged,
  getCommunityMemberAnalytics,
  inviteMembersByEmail,
  handoverCommunityLeadership,
  getCommunityWallet,
  requestWalletPayout,
  payMonthlyPremiumFromWallet,
  walletBalanceForPremium,
} from '../services/community.service';
import { CommunityCreationLimitError } from '../services/community-creation-policy.service';
import { bulkInviteLimiter } from '../middleware/rate-limit';
import { recordAdminAction } from '../services/admin-audit.service';

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

// PUBLIC: the "collect your certificate" page for a dissolved leadership session —
// one shareable link for the whole outgoing executive group, no account needed.
// Registered before the '/:id/...' patterns so 'leaders-certificates' isn't captured as an id.
communitiesRouter.get('/leaders-certificates', async (req, res) => {
  try {
    const slug = typeof req.query.slug === 'string' ? req.query.slug : '';
    const session = typeof req.query.session === 'string' ? req.query.session : '';
    if (!slug) {
      return res.status(400).json({ error: 'slug is required' });
    }
    const result = await listLeaderSessionCertificates(slug, session);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to fetch session certificates';
    return res.status(message === 'Community not found' ? 404 : 500).json({ error: message });
  }
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

// Paginated + searchable member roster (COORDINATOR+). Built for large communities:
// ?limit=50&cursor=<lastMembershipId>&q=<name>&role=<ROLE>
communitiesRouter.get('/:id/members', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await listCommunityMembersPaged(req.params.id, req.userId as string, {
      limit: typeof req.query.limit === 'string' ? Number(req.query.limit) || undefined : undefined,
      cursor: typeof req.query.cursor === 'string' ? req.query.cursor : undefined,
      q: typeof req.query.q === 'string' ? req.query.q : undefined,
      role: typeof req.query.role === 'string' ? req.query.role : undefined,
    });
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to fetch members';
    return res.status(/permissions/i.test(message) ? 403 : 500).json({ error: message });
  }
});

// Public profile people list (Twitter/X-style): paged members/followers with search.
communitiesRouter.get('/:id/people', optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await listCommunityPeoplePaged(req.params.id, req.userId, {
      kind: req.query.kind === 'followers' ? 'followers' : 'members',
      limit: typeof req.query.limit === 'string' ? Number(req.query.limit) || undefined : undefined,
      cursor: typeof req.query.cursor === 'string' ? req.query.cursor : undefined,
      q: typeof req.query.q === 'string' ? req.query.q : undefined,
    });
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to fetch people';
    const status =
      message === 'Community not found'
        ? 404
        : message === 'Private community people are hidden'
          ? 403
          : 400;
    return res.status(status).json({ error: message });
  }
});

// Member analytics for managers (COORDINATOR+): growth trend, role mix, engagement split.
communitiesRouter.get('/:id/member-analytics', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const analytics = await getCommunityMemberAnalytics(req.params.id, req.userId as string);
    return res.json({ analytics });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to fetch member analytics';
    return res.status(/permissions/i.test(message) ? 403 : 500).json({ error: message });
  }
});

// Bulk member invites by email (COORDINATOR+, ≤50/batch) — each address gets a branded
// email carrying the community's join link.
communitiesRouter.post('/:id/invite-emails', requireAuth, bulkInviteLimiter, async (req: AuthenticatedRequest, res) => {
  try {
    const { emails } = req.body as { emails?: string[] };
    const result = await inviteMembersByEmail(req.params.id, req.userId as string, Array.isArray(emails) ? emails.map(String) : []);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to send invites';
    const status = message === 'Community not found' ? 404 : /permissions/i.test(message) ? 403 : 400;
    return res.status(status).json({ error: message });
  }
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
    // Wallet balance rides along so the premium page can offer "pay from wallet".
    const wallet = await walletBalanceForPremium(req.params.id).catch(() => ({ availableNgn: 0 }));
    return res.json({ ...status, walletAvailableNgn: wallet.availableNgn });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to fetch premium status';
    return res.status(message === 'Community not found' ? 404 : 500).json({ error: message });
  }
});

// Ticket-earnings wallet: balance, recent sales, payout history (Treasurer+).
communitiesRouter.get('/:id/wallet', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const wallet = await getCommunityWallet(req.params.id, req.userId as string);
    return res.json({ wallet });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to fetch wallet';
    const status = message === 'Community not found' ? 404 : message.includes('leaders') ? 403 : 400;
    return res.status(status).json({ error: message });
  }
});

// Request a payout of ticket earnings to a bank account (Treasurer+).
communitiesRouter.post('/:id/wallet/payouts', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const payout = await requestWalletPayout(req.params.id, req.userId as string, req.body ?? {});
    return res.status(201).json({ payout });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to request payout';
    const status = message === 'Community not found' ? 404 : message.includes('leaders') ? 403 : 400;
    return res.status(status).json({ error: message });
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

// Pay one month of premium from the community's ticket-earnings wallet (President+; no gateway fee).
communitiesRouter.post('/:id/premium/pay-from-wallet', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await payMonthlyPremiumFromWallet(req.params.id, req.userId as string);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to pay from wallet';
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

// AI planning brief: digest of all attendee feedback across this community's events.
communitiesRouter.get('/:id/feedback-insights', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const insights = await getCommunityFeedbackInsights(req.params.id, req.userId as string);
    return res.json(insights);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to build feedback insights';
    return res.status(message === 'Insufficient permissions' ? 403 : 400).json({ error: message });
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
      chatLinks: req.body.chatLinks,
      visibility: req.body.visibility,
      autoApprove: req.body.autoApprove,
      verificationMethod: req.body.verificationMethod,
      endorsementLetter: req.body.endorsementLetter,
      creatorId: req.userId as string,
    });

    await recordAdminAction({
      adminId: req.userId as string,
      action: 'COMMUNITY_CREATED',
      targetType: 'COMMUNITY',
      targetId: community._id.toString(),
      note: `${community.name} · ${community.university} · ${community.verificationStatus}`,
    });

    return res.status(201).json({ community });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create community';
    await recordAdminAction({
      adminId: req.userId as string,
      action: 'COMMUNITY_CREATION_BLOCKED',
      targetType: 'COMMUNITY',
      targetId: String(req.body?.name ?? '').slice(0, 100),
      note: message,
    });
    if (error instanceof CommunityCreationLimitError) {
      res.setHeader('Retry-After', String(error.retryAfterSeconds));
      return res.status(429).json({ error: message, retryAfterSeconds: error.retryAfterSeconds });
    }
    if (typeof error === 'object' && error && 'code' in error && error.code === 11000) {
      return res.status(409).json({ error: 'A community with this name already exists at the selected institution' });
    }
    return res.status(400).json({ error: message });
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
      chatLinks: req.body.chatLinks,
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

// Curated leadership roster — free-text name/title/session/bio entries for a community's
// public profile (e.g. "Amirah", elected each session). Independent of `Membership`: an entry
// doesn't need to be a registered GuildOS account, though `linkedUserId` can optionally tag one.
// By default returns every entry; pass ?status=ACTIVE|ARCHIVED|PAST to narrow it, or
// ?session=<label> to browse one specific session's roster (current + archived + past).
communitiesRouter.get('/:id/leaders', async (req, res) => {
  try {
    const status = req.query.status as 'ACTIVE' | 'ARCHIVED' | 'PAST' | undefined;
    const session = typeof req.query.session === 'string' ? req.query.session : undefined;
    const leaders = await listCommunityLeaders(req.params.id, { status, session });
    return res.json({ leaders });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to fetch leaders' });
  }
});

// Lightweight session directory (label + total/active/archived/past counts) for browsing past
// leaders by session without pulling every leader's full payload up front.
communitiesRouter.get('/:id/leaders/sessions', async (req, res) => {
  try {
    const sessions = await listCommunityLeaderSessions(req.params.id);
    return res.json({ sessions });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to fetch leader sessions' });
  }
});

// Dissolve a session: every currently-ACTIVE leader tagged with it moves to PAST together
// (the normal end-of-term transition) — distinct from archiving one person who left early.
// Optional `certificate` issues verifiable LEADERSHIP certificates to the outgoing set:
// { mode: 'STANDARD' | 'CUSTOM', templateImage?, theme?, style?, content? }.
communitiesRouter.post('/:id/leaders/dissolve', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { session, certificate, demoteOutgoing } = req.body as {
      session?: string;
      demoteOutgoing?: boolean;
      certificate?: {
        mode?: string;
        templateImage?: string;
        namePlacement?: { x?: number; y?: number; fontSize?: number; color?: string; align?: 'left' | 'center' | 'right' };
        theme?: Record<string, string>;
        style?: string;
        content?: { title?: string; presentation?: string; message?: string; signatories?: { name?: string; title?: string; image?: string }[] };
        reissueExisting?: boolean;
      } | null;
    };
    if (typeof session !== 'string') {
      return res.status(400).json({ error: 'session is required' });
    }

    let certificateOptions = null;
    if (certificate && (certificate.mode === 'STANDARD' || certificate.mode === 'CUSTOM')) {
      certificateOptions = {
        mode: certificate.mode as 'STANDARD' | 'CUSTOM',
        templateImage: typeof certificate.templateImage === 'string' ? certificate.templateImage.slice(0, 300) : undefined,
        namePlacement: certificate.namePlacement && typeof certificate.namePlacement === 'object' ? certificate.namePlacement : undefined,
        theme: certificate.theme,
        style: certificate.style,
        content: certificate.content,
        reissueExisting: Boolean(certificate.reissueExisting),
      };
    }

    const result = await dissolveCommunityLeaderSession(req.params.id, session, req.userId as string, certificateOptions, {
      demoteOutgoing: Boolean(demoteOutgoing),
    });
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to dissolve session';
    const status = message === 'Community not found' ? 404 : /permissions|archived/i.test(message) ? 403 : 400;
    return res.status(status).json({ error: message });
  }
});

// "Issue anyway": per-person certificate for an ARCHIVED (left early) or skipped PAST
// leader — the explicit exception to the archived-get-nothing dissolve default. VP+.
communitiesRouter.post('/:id/leaders/:leaderId/certificate', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const certificate = await issueCertificateForLeader(req.params.id, req.params.leaderId, req.userId as string);
    return res.json({ certificate });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to issue certificate';
    const status = /not found/i.test(message) ? 404 : /permissions|archived/i.test(message) ? 403 : 400;
    return res.status(status).json({ error: message });
  }
});

// Year-end permission bridge: turn roster entries with linked GuildOS accounts into REAL
// Membership roles (creating memberships where needed), optionally transferring ownership.
// VP+ (rank guards inside prevent assigning at/above your own rank).
communitiesRouter.post('/:id/leaders/handover', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { assignments, transferOwnershipToLeaderId } = req.body as {
      assignments?: Array<{ leaderId?: string; role?: string }>;
      transferOwnershipToLeaderId?: string | null;
    };
    const cleanAssignments = (Array.isArray(assignments) ? assignments : [])
      .filter((a) => typeof a.leaderId === 'string' && typeof a.role === 'string')
      .map((a) => ({ leaderId: a.leaderId as string, role: a.role as never }));
    if (cleanAssignments.length === 0 && typeof transferOwnershipToLeaderId !== 'string') {
      return res.status(400).json({ error: 'Pick at least one role to assign or a new owner' });
    }

    const result = await handoverCommunityLeadership(
      req.params.id,
      req.userId as string,
      cleanAssignments,
      { transferOwnershipToLeaderId: typeof transferOwnershipToLeaderId === 'string' ? transferOwnershipToLeaderId : null },
    );
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to hand over leadership';
    const status = message === 'Community not found' ? 404 : /permissions|archived/i.test(message) ? 403 : 400;
    return res.status(status).json({ error: message });
  }
});

// Bulk-create leaders under one shared session — the commit step of "Import from document"
// (upload a PDF -> AI-extracted candidates reviewed/edited on the client -> committed here).
communitiesRouter.post('/:id/leaders/bulk', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { session, entries } = req.body as {
      session?: string;
      entries?: Array<{ name?: string; title?: string; department?: string; level?: string; phone?: string }>;
    };
    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ error: 'entries is required' });
    }

    const created = await bulkCreateCommunityLeaders(
      req.params.id,
      req.userId as string,
      session ?? '',
      entries.map((e) => ({ name: e.name ?? '', title: e.title, department: e.department, level: e.level, phone: e.phone })),
    );
    return res.status(201).json({ created: created.length, leaders: created });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create leaders';
    const status = message === 'Community not found' ? 404 : /permissions|archived/i.test(message) ? 403 : 400;
    return res.status(status).json({ error: message });
  }
});

communitiesRouter.post('/:id/leaders', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { name, title, session, bio, photo, phone, department, level, displayRank, linkedUserId, assignRole } = req.body as {
      name?: string; title?: string; session?: string; bio?: string; photo?: string; phone?: string; department?: string; level?: string; displayRank?: number | null; linkedUserId?: string | null; assignRole?: string;
    };
    if (!name?.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const leader = await addCommunityLeader(req.params.id, req.userId as string, { name, title, session, bio, photo, phone, department, level, displayRank, linkedUserId, assignRole });
    return res.status(201).json({ leader });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to add leader';
    const status = message === 'Community not found' ? 404 : /permissions|archived/i.test(message) ? 403 : 400;
    return res.status(status).json({ error: message });
  }
});

communitiesRouter.patch('/:id/leaders/:leaderId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { name, title, session, bio, photo, phone, department, level, displayRank, linkedUserId, status, assignRole } = req.body as {
      name?: string; title?: string; session?: string; bio?: string; photo?: string; phone?: string; department?: string; level?: string; displayRank?: number | null; linkedUserId?: string | null; status?: 'ACTIVE' | 'ARCHIVED' | 'PAST'; assignRole?: string;
    };

    const leader = await updateCommunityLeader(req.params.leaderId, req.userId as string, { name, title, session, bio, photo, phone, department, level, displayRank, linkedUserId, status, assignRole });
    return res.json({ leader });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update leader';
    const status = /not found/i.test(message) ? 404 : /permissions|archived/i.test(message) ? 403 : 400;
    return res.status(status).json({ error: message });
  }
});

communitiesRouter.delete('/:id/leaders/:leaderId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    await removeCommunityLeader(req.params.leaderId, req.userId as string);
    return res.json({ message: 'Leader removed' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to remove leader';
    const status = /not found/i.test(message) ? 404 : /permissions|archived/i.test(message) ? 403 : 400;
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

communitiesRouter.get('/:id/endorsements', optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const endorsements = await listCommunityEndorsements(req.params.id);
    const viewerCanEndorse = await canUserEndorseCommunity(req.params.id, req.userId);
    return res.json({ endorsements, viewerCanEndorse });
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
