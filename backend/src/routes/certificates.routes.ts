import { Router } from 'express';
import { requireAuth, requireRole, optionalAuth, type AuthenticatedRequest } from '../middleware/auth';
import { issueCommunityCertificates, listCommunityIssuedCertificates } from '../services/community/community-certificate.service';
import {
  getCertificateBySerial,
  getCertificateMetaBySerial,
  invalidateCertificate,
  listUserCertificates,
  revokeCertificate,
  setCertificateExpiry,
} from '../services/event.service';
import { recordCertificateView } from '../services/profile-view.service';
import { generateSignedCertificatePdf } from '../services/certificate-pdf.service';


export const certificatesRouter = Router();

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
    void recordCertificateView(req.params.serial, req.userId ?? null, (req.user?.role as any) ?? 'ANON', req.ip);
    return res.json({ certificate });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to verify certificate';
    return res.status(message === 'Certificate not found' ? 404 : 400).json({ error: message });
  }
});

certificatesRouter.get('/:serial/pdf', async (req, res) => {
  try {
    const result = await generateSignedCertificatePdf(req.params.serial);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    return res.send(result.pdf);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to render certificate PDF';
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

certificatesRouter.post('/invalidate', requireAuth, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const { serial, reason = '' } = req.body as { serial?: string; reason?: string };
    if (!serial) {
      return res.status(400).json({ error: 'serial is required' });
    }
    const result = await invalidateCertificate(serial, req.userId as string, reason);
    return res.json({ certificate: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to invalidate certificate';
    return res.status(message === 'Certificate not found' ? 404 : 400).json({ error: message });
  }
});

certificatesRouter.patch('/expiry', requireAuth, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const { serial, expiresAt } = req.body as { serial?: string; expiresAt?: string | null };
    if (!serial) {
      return res.status(400).json({ error: 'serial is required' });
    }
    const normalizedExpiry = expiresAt ? new Date(expiresAt) : null;
    if (expiresAt && Number.isNaN(normalizedExpiry?.getTime() ?? NaN)) {
      return res.status(400).json({ error: 'expiresAt must be a valid ISO date or null' });
    }
    const result = await setCertificateExpiry(serial, normalizedExpiry);
    return res.json({ certificate: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to set certificate expiry';
    return res.status(message === 'Certificate not found' ? 404 : 400).json({ error: message });
  }
});

function issueStatus(message: string) {
  if (message === 'Community not found') return 404;
  if (message === 'Insufficient permissions' || message.startsWith('Verified community required')) return 403;
  return 400;
}

// Single recipient: same path as bulk so the certificate is actually saved.
certificatesRouter.post('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { userId, communityId, title, description, type } = req.body as Record<string, string | undefined>;
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    if (!communityId) return res.status(400).json({ error: 'communityId is required' });
    const result = await issueCommunityCertificates({ communityId, actorId: req.userId as string, userIds: [userId], title, description, type });
    if (!result.certificates.length) return res.status(400).json({ error: result.skipped[0] ?? 'Recipient must be an active member of this community' });
    return res.status(201).json({ certificate: result.certificates[0] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create certificate';
    return res.status(issueStatus(message)).json({ error: message });
  }
});

// Bulk issuance: the same certificate to many members at once, by an explicit list of userIds
// and/or by role (e.g. all VOLUNTEERs). Every recipient must be an active member of the
// (verified) community. Certificates are persisted and verifiable.
certificatesRouter.post('/bulk', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { communityId, userIds, role, title, description, type } = req.body as {
      communityId?: string;
      userIds?: string[];
      role?: string;
      title?: string;
      description?: string;
      type?: string;
    };
    if (!communityId) return res.status(400).json({ error: 'communityId is required' });
    const result = await issueCommunityCertificates({ communityId, actorId: req.userId as string, userIds, role, title, description, type });
    return res.status(201).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to issue certificates';
    return res.status(issueStatus(message)).json({ error: message });
  }
});

// What this community has issued directly, so the Certificates page shows real history.
certificatesRouter.get('/community/:communityId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const certificates = await listCommunityIssuedCertificates(req.params.communityId, req.userId as string);
    return res.json({ certificates });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load certificates';
    return res.status(issueStatus(message)).json({ error: message });
  }
});
