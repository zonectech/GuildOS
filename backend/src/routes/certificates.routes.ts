import { Router } from 'express';
import { requireAuth, requireRole, optionalAuth, type AuthenticatedRequest } from '../middleware/auth';
import { buildDomainActivityRecord } from '../services/domain-activity.service';
import { getCommunityById, getCommunityMembers, getCommunityMembership, hasCommunityPermission } from '../services/community.service';
import { getCertificateBySerial, getCertificateMetaBySerial, listUserCertificates, revokeCertificate } from '../services/event.service';
import { recordCertificateView } from '../services/profile-view.service';

const INACTIVE_MEMBER_STATUSES = ['REMOVED', 'LEFT', 'SUSPENDED'];

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

// Light lookup for link previews (OG tags). Never increments verification counters.
certificatesRouter.get('/meta/:serial', async (req, res) => {
  try {
    const certificate = await getCertificateMetaBySerial(req.params.serial);
    return res.json({ certificate });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load certificate';
    return res.status(message === 'Certificate not found' ? 404 : 400).json({ error: message });
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

      const recipientMembership = await getCommunityMembership(communityId, userId);
      if (!recipientMembership || INACTIVE_MEMBER_STATUSES.includes(recipientMembership.status as string)) {
        return res.status(400).json({ error: 'Recipient must be an active member of this community' });
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

// Bulk issuance: issue the same certificate to many members at once — by an
// explicit list of userIds and/or by role (e.g. all VOLUNTEERs). Every recipient
// must be an active member of the (verified) community.
certificatesRouter.post('/bulk', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      communityId,
      userIds = [],
      role,
      title = 'Certificate',
      description = 'Certificate record',
    } = req.body as {
      communityId?: string;
      userIds?: string[];
      role?: string;
      title?: string;
      description?: string;
    };

    if (!communityId) {
      return res.status(400).json({ error: 'communityId is required' });
    }

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

    const members = (await getCommunityMembers(communityId)) as Array<{
      membership: { role: string; status?: string };
      user: { id: string; fullName: string };
    }>;

    const activeMembers = members.filter((m) => !INACTIVE_MEMBER_STATUSES.includes((m.membership.status as string) ?? ''));

    let targets = activeMembers;
    if (role) {
      targets = targets.filter((m) => m.membership.role === role);
    }
    if (Array.isArray(userIds) && userIds.length) {
      const idSet = new Set(userIds.map(String));
      targets = targets.filter((m) => idSet.has(m.user.id));
    }

    if (!targets.length) {
      return res.status(400).json({ error: 'No eligible members to issue certificates to' });
    }

    const certificates: unknown[] = [];
    const skipped: string[] = [];
    for (const target of targets) {
      const record = await buildDomainActivityRecord(target.user.id, 'CERTIFICATE', title, description);
      if (record) {
        certificates.push(record);
      } else {
        skipped.push(target.user.fullName || target.user.id);
      }
    }

    return res.status(201).json({ certificates, skipped, issued: certificates.length });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to issue certificates' });
  }
});
