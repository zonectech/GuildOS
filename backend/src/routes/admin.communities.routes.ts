import { Router } from 'express';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth';
import { rejectCommunity, listPendingCommunities, verifyCommunity, adminSetCommunityArchived, listCommunitiesForAdmin, setCommunityPremium } from '../services/community.service';
import { getPremiumMonthlyPrice, setPremiumMonthlyPrice, getPremiumEventPrice, setPremiumEventPrice, getGatewayFeeConfig, setGatewayFeeConfig, getPaymentGateway, setPaymentGateway } from '../services/premium.service';
import { isGatewayConfigured } from '../services/payment-gateway.service';
import { recordAdminAction } from '../services/admin-audit.service';

export const adminCommunitiesRouter = Router();

adminCommunitiesRouter.get('/premium/price', requireAuth, requireRole('ADMIN'), async (_req, res) => {
  try {
    const price = await getPremiumMonthlyPrice();
    const eventPrice = await getPremiumEventPrice();
    const gatewayFee = await getGatewayFeeConfig();
    const gateway = await getPaymentGateway();
    return res.json({
      price,
      eventPrice,
      gatewayFee,
      gateway,
      gatewayConfigured: { PAYSTACK: isGatewayConfigured('PAYSTACK'), FLUTTERWAVE: isGatewayConfigured('FLUTTERWAVE') },
    });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to fetch price' });
  }
});

adminCommunitiesRouter.patch('/premium/price', requireAuth, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const { price, eventPrice, gatewayFee, gateway } = req.body as { price?: number; eventPrice?: number; gatewayFee?: Partial<{ percent: number; flat: number; cap: number; waiver: number }>; gateway?: string };
    const notes: string[] = [];
    let value = await getPremiumMonthlyPrice();
    if (price !== undefined) { value = await setPremiumMonthlyPrice(Number(price)); notes.push(`₦${value}/mo`); }
    let eventValue = await getPremiumEventPrice();
    if (eventPrice !== undefined) { eventValue = await setPremiumEventPrice(Number(eventPrice)); notes.push(`₦${eventValue}/event`); }
    let fee = await getGatewayFeeConfig();
    if (gatewayFee && typeof gatewayFee === 'object') { fee = await setGatewayFeeConfig(gatewayFee); notes.push(`fee ${fee.percent}%+₦${fee.flat} cap ₦${fee.cap}`); }
    let activeGateway = await getPaymentGateway();
    if (gateway !== undefined) { activeGateway = await setPaymentGateway(String(gateway)); notes.push(`gateway ${activeGateway}`); }
    await recordAdminAction({ adminId: req.userId as string, action: 'PREMIUM_PRICE', targetType: 'PLATFORM', targetId: 'GLOBAL', note: notes.join(' · ') || 'no change' });
    return res.json({ price: value, eventPrice: eventValue, gatewayFee: fee, gateway: activeGateway });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to update price' });
  }
});

adminCommunitiesRouter.get('/pending', requireAuth, requireRole('ADMIN'), async (_req, res) => {
  try {
    const communities = await listPendingCommunities();
    return res.json({ communities });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to fetch pending communities' });
  }
});

adminCommunitiesRouter.get('/all', requireAuth, requireRole('ADMIN'), async (_req, res) => {
  try {
    const communities = await listCommunitiesForAdmin();
    return res.json({ communities });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to fetch communities' });
  }
});

adminCommunitiesRouter.patch('/:id/suspend', requireAuth, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const { reason } = req.body as { reason?: string };
    const community = await adminSetCommunityArchived(req.params.id, true, reason ?? '');
    await recordAdminAction({ adminId: req.userId as string, action: 'COMMUNITY_SUSPEND', targetType: 'COMMUNITY', targetId: req.params.id, note: reason ?? '' });
    return res.json({ community: { id: community._id.toString(), suspended: true } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to suspend community';
    return res.status(message === 'Community not found' ? 404 : 400).json({ error: message });
  }
});

adminCommunitiesRouter.patch('/:id/restore', requireAuth, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const community = await adminSetCommunityArchived(req.params.id, false);
    await recordAdminAction({ adminId: req.userId as string, action: 'COMMUNITY_RESTORE', targetType: 'COMMUNITY', targetId: req.params.id });
    return res.json({ community: { id: community._id.toString(), suspended: false } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to restore community';
    return res.status(message === 'Community not found' ? 404 : 400).json({ error: message });
  }
});

adminCommunitiesRouter.patch('/:id/premium', requireAuth, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const { isPremium } = req.body as { isPremium?: boolean };
    const community = await setCommunityPremium(req.params.id, Boolean(isPremium));
    await recordAdminAction({ adminId: req.userId as string, action: 'COMMUNITY_PREMIUM', targetType: 'COMMUNITY', targetId: req.params.id, note: isPremium ? 'granted' : 'revoked' });
    return res.json({ community: { id: community._id.toString(), isPremium: community.isPremium } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update premium status';
    return res.status(message === 'Community not found' ? 404 : 400).json({ error: message });
  }
});

adminCommunitiesRouter.patch('/:id/verify', requireAuth, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const { notes } = req.body as { notes?: string };
    const community = await verifyCommunity(req.params.id, req.userId as string, notes ?? '');
    await recordAdminAction({ adminId: req.userId as string, action: 'COMMUNITY_VERIFY', targetType: 'COMMUNITY', targetId: req.params.id, note: notes ?? '' });
    return res.json({ community });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to verify community';
    const status = message === 'Community not found' ? 404 : 400;
    return res.status(status).json({ error: message });
  }
});

adminCommunitiesRouter.patch('/:id/reject', requireAuth, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const { notes } = req.body as { notes?: string };
    const community = await rejectCommunity(req.params.id, req.userId as string, notes ?? '');
    await recordAdminAction({ adminId: req.userId as string, action: 'COMMUNITY_REJECT', targetType: 'COMMUNITY', targetId: req.params.id, note: notes ?? '' });
    return res.json({ community });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to reject community';
    const status = message === 'Community not found' ? 404 : 400;
    return res.status(status).json({ error: message });
  }
});