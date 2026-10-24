'use client';

import { useState } from 'react';
import { Copy, ExternalLink, GraduationCap } from 'lucide-react';

import { confirmDialog } from '../../../../../components/guildos/ui/confirm-dialog';
import { WhatsAppIcon } from '../../../../../components/guildos/ui/whatsapp-icon';
import { issueLeaderCertificate, type CommunityLeader } from '../../../../../components/guildos/community-list-api';
import { waCertificateLink } from './wa-certificate-link';

/**
 * Manager-only certificate strip inside the leader bio modal: copy / WhatsApp / open an issued
 * certificate, or "Issue anyway" for archived or skipped leaders who got none at dissolve.
 */
export function LeaderCertificatePanel({
  communityId,
  communityName,
  leader,
  onIssued,
  onError,
}: {
  communityId: string;
  communityName: string;
  leader: CommunityLeader;
  onIssued: (updated: CommunityLeader) => Promise<void>;
  onError: (message: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [issueBusy, setIssueBusy] = useState(false);
  const certificate = leader.certificate;

  // End-of-term certificate reference — admins can copy the verification link any
  // time (e.g. to re-send it to a past exco) without re-running a dissolve.
  if (certificate) {
    return (
      <div className="mt-4 flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3.5 py-2.5">
        <GraduationCap className={`h-4 w-4 shrink-0 ${certificate.status === 'REVOKED' ? 'text-rose-400' : 'text-indigo-500'}`} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-slate-700 dark:text-slate-300">
            Leadership certificate
            {certificate.status === 'REVOKED' && <span className="ml-1.5 rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600 ring-1 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30">Revoked</span>}
          </p>
          <p className="truncate text-[11px] text-slate-400 dark:text-slate-500">{certificate.serial}</p>
        </div>
        <button
          onClick={() => {
            void navigator.clipboard.writeText(certificate.verificationUrl).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }).catch(() => undefined);
          }}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2 py-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <Copy className="h-3 w-3" /> {copied ? 'Copied' : 'Copy link'}
        </button>
        {leader.phone ? (
          <a
            href={waCertificateLink(leader.phone, leader.name, communityName, certificate.verificationUrl)}
            target="_blank"
            rel="noopener noreferrer"
            title="Send via WhatsApp"
            className="shrink-0 rounded-lg border border-emerald-200 bg-emerald-50 p-1.5 text-emerald-600 transition hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20"
          >
            <WhatsAppIcon className="h-3.5 w-3.5" />
          </a>
        ) : null}
        <a
          href={certificate.verificationUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Open certificate"
          className="shrink-0 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1.5 text-slate-500 dark:text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-indigo-600"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    );
  }

  if (leader.status === 'ACTIVE') return null;

  // "Issue anyway": archived (left early) or skipped PAST leaders get no certificate at
  // dissolve by default — this is the explicit per-person exception for partial service.
  async function handleIssue() {
    const confirmed = await confirmDialog({
      title: `Issue a certificate to ${leader.name}?`,
      message: 'They will receive a verified Certificate of Leadership (GuildOS standard design) with its own serial and public verification page.',
      confirmLabel: 'Issue certificate',
    });
    if (!confirmed) return;
    try {
      setIssueBusy(true);
      const { certificate: issued } = await issueLeaderCertificate(communityId, leader.id);
      await onIssued({ ...leader, certificate: { serial: issued.serial, status: 'VERIFIED', verificationUrl: issued.verificationUrl } });
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unable to issue certificate');
    } finally {
      setIssueBusy(false);
    }
  }

  return (
    <div className="mt-4 flex items-center gap-2 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-950/40 px-3.5 py-2.5">
      <GraduationCap className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
      <p className="min-w-0 flex-1 text-xs text-slate-500 dark:text-slate-400">
        {leader.status === 'ARCHIVED' ? 'Left before the session ended — no certificate was issued.' : 'No certificate was issued for this leader.'}
      </p>
      <button
        disabled={issueBusy}
        onClick={() => void handleIssue()}
        className="shrink-0 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
      >
        {issueBusy ? 'Issuing…' : 'Issue anyway'}
      </button>
    </div>
  );
}
