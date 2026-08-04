import { randomUUID } from 'node:crypto';
import { CertificateModel } from '../../models/certificate.model';
import { CommunityLeaderModel } from '../../models/community-leader.model';
import { CommunityModel, type CommunityDocument } from '../../models/community.model';
import { DEFAULT_CERTIFICATE_THEME, DEFAULT_CERTIFICATE_CONTENT, CERTIFICATE_BACKGROUNDS, CERTIFICATE_FONTS, CERTIFICATE_STYLES, type CertificateTheme, type CertificateStyle, type CertificateNamePlacement } from '../../models/event.model';
import { authStore } from '../../store/auth-store';
import { buildDomainActivityRecord } from '../domain-activity.service';
import { createMilestonePost } from '../feed.service';
import { createNotification } from '../notification.service';
import { awardReputation, REPUTATION_POINTS } from '../reputation.service';
import { sendEmail, certificateEarnedEmail } from '../../utils/email';
import { generateCertificateSerial, certificateVerificationUrl } from '../event/event-certificate.service';

/**
 * End-of-term certificate options chosen in the dissolve dialog:
 * - STANDARD = the GuildOS-designed certificate (optionally themed/styled/worded)
 * - CUSTOM   = the community's own uploaded template image, with the leader's
 *              name drawn on top (same mechanism as custom event certificates)
 */
export type LeaderCertificateOptions = {
  mode: 'STANDARD' | 'CUSTOM';
  templateImage?: string;
  /** CUSTOM templates: where the leader's name is drawn (x/y %, font size % of height, colour, align). */
  namePlacement?: Partial<CertificateNamePlacement>;
  theme?: Partial<CertificateTheme>;
  style?: string;
  content?: {
    title?: string;
    presentation?: string;
    message?: string;
    signatories?: { name?: string; title?: string; image?: string }[];
  };
  /**
   * When a leader already has a certificate (e.g. the session was dissolved before),
   * update its DESIGN to the newly chosen one instead of skipping — the serial and
   * verification link stay the same, so anything already shared keeps working.
   */
  reissueExisting?: boolean;
};

function sanitizeTheme(theme: Partial<CertificateTheme> | undefined): CertificateTheme {
  const accent = typeof theme?.accent === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(theme.accent) ? theme.accent : DEFAULT_CERTIFICATE_THEME.accent;
  const background = (CERTIFICATE_BACKGROUNDS as readonly string[]).includes(theme?.background ?? '') ? theme!.background! : DEFAULT_CERTIFICATE_THEME.background;
  const font = (CERTIFICATE_FONTS as readonly string[]).includes(theme?.font ?? '') ? theme!.font! : DEFAULT_CERTIFICATE_THEME.font;
  return { accent, background, font };
}

/** Same clamping as event certificates — keeps the name inside the template no matter what the client sends. */
function sanitizeNamePlacement(p: Partial<CertificateNamePlacement> | undefined): CertificateNamePlacement {
  const clamp = (v: unknown, min: number, max: number, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };
  return {
    x: clamp(p?.x, 0, 100, 50),
    y: clamp(p?.y, 0, 100, 55),
    fontSize: clamp(p?.fontSize, 2, 20, 6),
    color: typeof p?.color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(p.color) ? p.color : '#111111',
    align: p?.align === 'left' || p?.align === 'right' ? p.align : 'center',
  };
}

/**
 * Issues verifiable LEADERSHIP certificates ("certificate of service") to a set
 * of roster entries as their session is dissolved. Works for leaders WITHOUT
 * GuildOS accounts too — their certificate is reachable through the returned
 * public verification link (share it manually); linked accounts additionally
 * get the certificate in their gallery plus a bell notification and email.
 * Idempotent per roster entry (unique leaderId index).
 */
export async function issueLeaderCertificates(
  community: CommunityDocument & { _id: unknown },
  leaderIds: string[],
  session: string,
  actorId: string,
  options: LeaderCertificateOptions,
) {
  if (community.verificationStatus !== 'VERIFIED') {
    throw new Error('Only verified communities can issue certificates');
  }
  if (options.mode === 'CUSTOM' && !options.templateImage) {
    throw new Error('Upload a certificate template before issuing');
  }

  const theme = sanitizeTheme(options.theme);
  const namePlacement = sanitizeNamePlacement(options.namePlacement);
  const style: CertificateStyle = (CERTIFICATE_STYLES as readonly string[]).includes(options.style ?? '')
    ? (options.style as CertificateStyle)
    : 'CLASSIC';
  // Same gating as event certificates: everyone gets ONE signature; premium
  // unlocks up to three (and the whole signing block stays optional).
  const signatories = (Array.isArray(options.content?.signatories) ? options.content!.signatories! : [])
    .map((s) => ({
      name: (s?.name ?? '').trim().slice(0, 60),
      title: (s?.title ?? '').trim().slice(0, 80),
      image: typeof s?.image === 'string' ? s.image.trim().slice(0, 300) : '',
    }))
    .filter((s) => s.name)
    .slice(0, community.isPremium ? 3 : 1);

  const content = {
    ...DEFAULT_CERTIFICATE_CONTENT,
    title: (options.content?.title ?? '').trim().slice(0, 60) || 'Certificate of Leadership',
    presentation: (options.content?.presentation ?? '').trim().slice(0, 90) || 'for serving as',
    message: (options.content?.message ?? '').trim().slice(0, 260),
    signatories,
  };

  // Same gating as event certificates (Model B): all DESIGNS are free, but the
  // customization tools (colours/fonts/wording) are premium — non-premium
  // communities fall back to the polished defaults while keeping their style
  // pick and single signature.
  if (!community.isPremium) {
    theme.accent = DEFAULT_CERTIFICATE_THEME.accent;
    theme.background = DEFAULT_CERTIFICATE_THEME.background;
    theme.font = DEFAULT_CERTIFICATE_THEME.font;
    content.title = 'Certificate of Leadership';
    content.presentation = 'for serving as';
    content.message = '';
  }

  // STRICT scope: only roster entries that belong to THIS community and THIS session can
  // receive a certificate here — the ids come from the dissolve snapshot, but re-checking
  // means a bad id can never mint a certificate for another community or session.
  const leaders = await CommunityLeaderModel.find({
    _id: { $in: leaderIds },
    communityId: community._id,
    session: session.trim(),
  });
  const sessionLabel = session.trim();
  const certificates: { leaderId: string; name: string; phone: string; serial: string; verificationUrl: string; hasAccount: boolean }[] = [];

  for (const leader of leaders) {
    const existing = await CertificateModel.findOne({ leaderId: leader._id }).select('serial').lean();
    if (existing) {
      if (options.reissueExisting) {
        // Same certificate (same serial + verification link), refreshed design — so
        // everyone in the session ends up with the design chosen in THIS dissolve.
        await CertificateModel.updateOne(
          { leaderId: leader._id },
          {
            $set: {
              mode: options.mode,
              templateImage: options.mode === 'CUSTOM' ? options.templateImage : '',
              namePlacement,
              theme,
              content,
              style,
            },
          },
        );
      }
      certificates.push({
        leaderId: leader._id.toString(),
        name: leader.name,
        phone: leader.phone ?? '',
        serial: existing.serial,
        verificationUrl: certificateVerificationUrl(existing.serial),
        hasAccount: Boolean(leader.linkedUserId),
      });
      continue;
    }

    const linkedUser = leader.linkedUserId ? await authStore.getPublicUserById(leader.linkedUserId.toString()) : null;
    // The achievement line on the certificate, e.g. "Amirah — 2026/2027 Session".
    const achievement = [leader.title || 'Executive', sessionLabel ? `${sessionLabel} Session` : ''].filter(Boolean).join(' — ');

    const created = await CertificateModel.create({
      serial: await generateCertificateSerial(),
      verificationToken: randomUUID(),
      eventId: null,
      communityId: community._id,
      userId: leader.linkedUserId ?? null,
      registrationId: null,
      leaderId: leader._id,
      attendeeName: leader.name,
      eventTitle: achievement,
      communityName: community.name,
      university: linkedUser?.profile?.university ?? '',
      type: 'LEADERSHIP',
      mode: options.mode,
      templateImage: options.mode === 'CUSTOM' ? options.templateImage : '',
      namePlacement,
      theme,
      content,
      style,
      eventDate: null,
      issuedBy: actorId,
    });

    certificates.push({
      leaderId: leader._id.toString(),
      name: leader.name,
      phone: leader.phone ?? '',
      serial: created.serial,
      verificationUrl: certificateVerificationUrl(created.serial),
      hasAccount: Boolean(leader.linkedUserId),
    });

    if (linkedUser) {
      await createNotification({
        userId: linkedUser.id,
        type: 'CERTIFICATE_EARNED',
        title: `You earned a leadership certificate from ${community.name}`,
        body: achievement,
        link: `/certificates/${created.serial}`,
      });
      // Same flywheel as event certificates: verification-centre record, a milestone
      // post on their profile feed, and Guild Score points for completing the term.
      await buildDomainActivityRecord(linkedUser.id, 'CERTIFICATE', achievement, `Leadership certificate — ${community.name}`);
      await createMilestonePost(linkedUser.id, {
        type: 'CERTIFICATE',
        label: `Completed a leadership term as ${leader.title || 'an executive'} · @${community.name}`,
        refId: created._id.toString(),
        communityId: String(community._id),
        tags: [{ type: 'COMMUNITY', refId: String(community._id), label: community.name, handle: community.slug }],
      }).catch(() => undefined);
      await awardReputation({
        userId: linkedUser.id,
        category: 'LEADERSHIP',
        type: 'LEADERSHIP_SERVED',
        scoreAwarded: REPUTATION_POINTS.LEADERSHIP_SERVED,
        description: `Served as ${leader.title || 'an executive'} of ${community.name}${sessionLabel ? ` (${sessionLabel})` : ''}`,
        referenceId: leader._id.toString(),
        communityId: String(community._id),
      }).catch(() => undefined);
      if (linkedUser.email) {
        void sendEmail(
          linkedUser.email,
          certificateEarnedEmail(linkedUser.fullName, achievement, community.name, certificateVerificationUrl(created.serial)),
        ).catch(() => undefined);
      }
    }
  }

  return certificates;
}

/**
 * PUBLIC: every certificate issued for one community session — powers the shareable
 * "collect your certificate" page. One link goes to the whole outgoing executive
 * group; each person finds their name and opens/downloads their own certificate.
 * No account needed (certificates and their verification pages are public anyway).
 */
export async function listLeaderSessionCertificates(slug: string, session: string) {
  const community = await CommunityModel.findOne({ slug }).select('name slug logo').lean();
  if (!community) {
    throw new Error('Community not found');
  }

  const leaders = await CommunityLeaderModel.find({ communityId: community._id, session: session.trim() })
    .select('_id title')
    .lean();
  const titleByLeader = new Map(leaders.map((l) => [l._id.toString(), l.title]));

  const certs = await CertificateModel.find({ leaderId: { $in: leaders.map((l) => l._id) }, status: 'VERIFIED' })
    .select('leaderId attendeeName serial')
    .lean();

  return {
    community: { name: community.name, slug: community.slug, logo: community.logo ?? '' },
    session: session.trim(),
    certificates: certs
      .map((c) => ({
        name: c.attendeeName,
        title: c.leaderId ? titleByLeader.get(c.leaderId.toString()) ?? '' : '',
        serial: c.serial,
        verificationUrl: certificateVerificationUrl(c.serial),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}
