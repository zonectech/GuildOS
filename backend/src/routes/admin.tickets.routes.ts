import { Router } from 'express';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth';
import { adminTicketOverview, adminListPayouts, adminSetPayoutStatus, getPayoutMode, setPayoutMode } from '../services/community/community-wallet.service';
import { getTicketCommissionPercent, setTicketCommissionPercent } from '../services/event/event-ticket.service';
import { getPaymentGateway } from '../services/premium.service';
import { isGatewayConfigured } from '../services/payment-gateway.service';
import { recordAdminAction } from '../services/admin-audit.service';

/** Platform-admin oversight of paid-event ticketing: totals, per-event sales, payouts, commission %. */
export const adminTicketsRouter = Router();

adminTicketsRouter.get('/overview', requireAuth, requireRole('ADMIN'), async (_req: AuthenticatedRequest, res) => {
  try {
    const overview = await adminTicketOverview();
    return res.json(overview);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to fetch ticket overview' });
  }
});

adminTicketsRouter.get('/payouts', requireAuth, requireRole('ADMIN'), async (_req: AuthenticatedRequest, res) => {
  try {
    const payouts = await adminListPayouts();
    return res.json({ payouts });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to fetch payouts' });
  }
});

adminTicketsRouter.patch('/payouts/:payoutId', requireAuth, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const { status, note } = req.body as { status?: string; note?: string };
    const payout = await adminSetPayoutStatus(req.params.payoutId, status as 'PAID' | 'REJECTED', req.userId as string, note);
    await recordAdminAction({
      adminId: req.userId as string,
      action: 'TICKET_PAYOUT',
      targetType: 'PAYOUT',
      targetId: req.params.payoutId,
      note: `${payout.status} ₦${payout.amountNgn.toLocaleString()} → ${payout.accountName} (${payout.bankName})`,
    });
    return res.json({ payout });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update payout';
    return res.status(/not found/i.test(message) ? 404 : 400).json({ error: message });
  }
});

adminTicketsRouter.get('/settings', requireAuth, requireRole('ADMIN'), async (_req: AuthenticatedRequest, res) => {
  try {
    const [commissionPercent, payoutMode, gateway] = await Promise.all([getTicketCommissionPercent(), getPayoutMode(), getPaymentGateway()]);
    return res.json({ commissionPercent, payoutMode, gateway, gatewayConfigured: isGatewayConfigured(gateway) });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to fetch settings' });
  }
});

adminTicketsRouter.patch('/settings', requireAuth, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const body = (req.body ?? {}) as { commissionPercent?: number; payoutMode?: string };
    const updates: string[] = [];
    let commissionPercent = await getTicketCommissionPercent();
    if (body.commissionPercent !== undefined) {
      commissionPercent = await setTicketCommissionPercent(Number(body.commissionPercent));
      updates.push(`commission ${commissionPercent}%`);
    }
    let payoutMode = await getPayoutMode();
    if (body.payoutMode !== undefined) {
      payoutMode = await setPayoutMode(String(body.payoutMode));
      updates.push(`payouts ${payoutMode}`);
    }
    if (updates.length) {
      await recordAdminAction({ adminId: req.userId as string, action: 'TICKET_SETTINGS', note: updates.join(', ') });
    }
    return res.json({ commissionPercent, payoutMode });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to update settings' });
  }
});
