import { Router } from 'express';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth';
import {
  adminListSponsorshipInquiries,
  getSponsorshipFeeSettings,
  setInquiryFeeStatus,
  updateSponsorshipFeeSettings,
} from '../services/sponsorship.service';
import { adminListSponsorshipPayments, settleSponsorshipRefundDue } from '../services/sponsorship-payment.service';

export const adminSponsorshipRouter = Router();

// Money trail for platform-paid sponsorships (PAID / REFUNDED / REFUND_DUE / FAILED).
adminSponsorshipRouter.get('/payments', requireAuth, requireRole('ADMIN'), async (_req: AuthenticatedRequest, res) => {
  try {
    const payments = await adminListSponsorshipPayments();
    return res.json({ payments });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to fetch payments' });
  }
});

// Close out a gateway-failed refund the admin settled by bank transfer.
adminSponsorshipRouter.patch('/payments/:paymentId/refund-settled', requireAuth, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const result = await settleSponsorshipRefundDue(req.params.paymentId);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to settle refund';
    return res.status(/not found/i.test(message) ? 404 : 400).json({ error: message });
  }
});

adminSponsorshipRouter.get('/inquiries', requireAuth, requireRole('ADMIN'), async (_req: AuthenticatedRequest, res) => {
  try {
    const inquiries = await adminListSponsorshipInquiries();
    return res.json({ inquiries });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to fetch inquiries' });
  }
});

adminSponsorshipRouter.get('/settings', requireAuth, requireRole('ADMIN'), async (_req: AuthenticatedRequest, res) => {
  try {
    const settings = await getSponsorshipFeeSettings();
    return res.json({ settings });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to fetch settings' });
  }
});

adminSponsorshipRouter.put('/settings', requireAuth, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const settings = await updateSponsorshipFeeSettings(req.body ?? {});
    return res.json({ settings });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update settings';
    return res.status(400).json({ error: message });
  }
});

adminSponsorshipRouter.patch('/inquiries/:inquiryId/fee', requireAuth, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const { feeStatus } = req.body as { feeStatus?: string };
    const inquiry = await setInquiryFeeStatus(req.params.inquiryId, feeStatus as never);
    return res.json({ inquiry });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update fee status';
    return res.status(/not found/i.test(message) ? 404 : 400).json({ error: message });
  }
});
