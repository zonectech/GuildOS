import { Router } from 'express';
import { requireAuth, requireRole, optionalAuth, type AuthenticatedRequest } from '../middleware/auth';
import { buildDomainActivityRecord } from '../services/domain-activity.service';
import { getCommunityById, getCommunityMembership, hasCommunityPermission } from '../services/community.service';
import { getCertificateBySerial, listUserCertificates, revokeCertificate } from '../services/event.service';
import { recordCertificateView } from '../services/profile-view.service';

export const certificatesRouter = Router();

certificatesRouter.get('/', async (_req, res) => {
  return res.json({ certificates: [] });
});

certificatesRouter.get('/mine', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const certificates = await listUserCertificates(req.userId as string);
    return res.json({ certificates });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to fetch certificates' });
  }
});

certificatesRouter.get('/verify/:serial', optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const certificate = await getCertificateBySerial(req.params.serial);
    void recordCertificateView(req.params.serial, req.userId ?? null, (req.user?.role as any) ?? 'ANON');
    return res.json({ certificate });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to verify certificate';
    return res.status(message === 'Certificate not found' ? 404 : 400).json({ error: message });
  }
});

certificatesRouter.post('/revoke', requireAuth, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const { serial, reason = '' } = req.body as { serial?: string; reason?: string };
    if (!serial) {
      return res.status(400).json({ error: 'serial is required' });
    }
    const result = await revokeCertificate(serial, req.userId as string, reason);
    return res.json({ certificate: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to revoke certificate';
    return res.status(message === 'Certificate not found' ? 404 : 400).json({ error: message });
  }
});

certificatesRouter.post('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { userId, communityId, title = 'Certificate', description = 'Certificate record' } = req.body as {
      userId?: string;
      communityId?: string;
      title?: string;
      description?: string;
    };

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    if (communityId) {
      const community = await getCommunityById(communityId);
      if (!community) {
        return res.status(404).json({ error: 'Community not found' });
      }

      if (community.verificationStatus !== 'VERIFIED') {
        return res.status(403).json({ error: 'Verified community required to issue certificates' });
      }

      const membership = await getCommunityMembership(communityId, req.userId as string);
      if (!membership || !hasCommunityPermission(membership.role, 'PRESIDENT')) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
    }

    const record = await buildDomainActivityRecord(userId, 'CERTIFICATE', title, description);
    if (!record) {
      return res.status(404).json({ error: 'Unable to build certificate record' });
    }

    return res.status(201).json({ certificate: record });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to create certificate' });
  }
});
