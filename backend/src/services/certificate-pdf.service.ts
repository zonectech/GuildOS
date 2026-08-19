import { createHmac } from 'node:crypto';
import { config } from '../config';
import { CertificateModel } from '../models/certificate.model';
import { buildSimpleTextPdf } from './pdf/simple-pdf';

function effectiveStatus(input: { status?: string | null; expiresAt?: Date | null }) {
  if (input.status === 'REVOKED') return 'REVOKED';
  if (input.status === 'INVALID') return 'INVALID';
  if (input.status === 'EXPIRED') return 'EXPIRED';
  if (input.expiresAt && input.expiresAt.getTime() <= Date.now()) return 'EXPIRED';
  return 'VERIFIED';
}

function certificateTypeLabel(type: string) {
  switch (type) {
    case 'COMPLETION': return 'Certificate of Completion';
    case 'LEADERSHIP': return 'Certificate of Leadership';
    case 'VOLUNTEER': return 'Certificate of Volunteering';
    default: return 'Certificate of Attendance';
  }
}

function buildSignature(payload: string) {
  const key = config.jwtSecret || 'guildos-dev-signing-key';
  return createHmac('sha256', key).update(payload).digest('hex');
}

export async function generateSignedCertificatePdf(serial: string) {
  const certificate = await CertificateModel.findOne({ serial }).lean();
  if (!certificate) {
    throw new Error('Certificate not found');
  }
  const status = effectiveStatus(certificate);
  const issuedAtIso = certificate.issuedAt ? new Date(certificate.issuedAt).toISOString() : '';
  const payload = [
    certificate.serial,
    certificate.attendeeName,
    certificate.eventTitle,
    certificate.communityName,
    certificate.type,
    status,
    issuedAtIso,
  ].join('|');
  const signature = buildSignature(payload);

  const lines = [
    `Recipient: ${certificate.attendeeName}`,
    `Award: ${certificateTypeLabel(certificate.type ?? 'ATTENDANCE')}`,
    `Event: ${certificate.eventTitle}`,
    certificate.sectionName ? `Section: ${certificate.sectionName}` : '',
    `Issuer: ${certificate.communityName}`,
    `Status: ${status}`,
    `Serial: ${certificate.serial}`,
    certificate.university ? `University: ${certificate.university}` : '',
    issuedAtIso ? `Issued: ${new Date(issuedAtIso).toLocaleString('en-NG')}` : '',
    certificate.expiresAt ? `Expires: ${new Date(certificate.expiresAt).toLocaleString('en-NG')}` : '',
    certificate.revokeReason ? `Revoke reason: ${certificate.revokeReason}` : '',
    certificate.invalidationReason ? `Invalidation reason: ${certificate.invalidationReason}` : '',
    '',
    'Cryptographic attestation',
    `Signature algorithm: HMAC-SHA256`,
    `Signature payload: ${payload}`,
    `Signature: ${signature}`,
    '',
    `Verify online: ${config.frontendUrl}/certificates/${encodeURIComponent(certificate.serial)}`,
  ].filter(Boolean);

  const pdf = buildSimpleTextPdf({
    title: `GuildOS Signed Certificate Record`,
    lines,
    footer: `GuildOS · ${certificate.serial}`,
  });

  return {
    filename: `certificate-${certificate.serial}.signed.pdf`,
    pdf,
    status,
    signature,
  };
}
