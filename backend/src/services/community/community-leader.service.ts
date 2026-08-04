import { CommunityLeaderModel } from '../../models/community-leader.model';
import { CommunityModel } from '../../models/community.model';
import { MembershipModel } from '../../models/membership.model';
import { UserModel } from '../../models/user.model';
import { CertificateModel } from '../../models/certificate.model';
import { authStore } from '../../store/auth-store';
import { hasCommunityPermission, isLeadershipRole, logMembershipActivity, closeOpenLeadershipRoles } from './community-shared';
import { updateMemberRole } from './community-membership.service';
import { issueLeaderCertificates, type LeaderCertificateOptions } from './community-leader-certificate.service';
import { certificateVerificationUrl } from '../event/event-certificate.service';

const NAME_MAX = 120;
const TITLE_MAX = 80;
const SESSION_MAX = 40;
const BIO_MAX = 280;
const PHONE_MAX = 30;
const DEPARTMENT_MAX = 80;
const LEVEL_MAX = 40;

function cap(value: string | undefined, max: number) {
  return (value ?? '').trim().slice(0, max);
}

function normalizeDisplayRank(value: number | null | undefined) {
  if (value === undefined || value === null || Number.isNaN(Number(value))) return null;
  return Number(value);
}

/**
 * Sessions must be two consecutive 4-digit years, e.g. "2026/2027" (never
 * "2027/2026"), and can't start earlier than the current academic year — new
 * sessions look forward, not backward; retiring an old one is what "dissolve"
 * is for. Academic sessions that began the previous calendar year are still
 * considered current through January/February (grace window for schools that
 * keep using last year's session label into the new year).
 * Exported for unit tests.
 */
export function assertValidSessionLabel(label: string) {
  const match = /^(\d{4})\/(\d{4})$/.exec(label.trim());
  if (!match) {
    throw new Error('Session must be two consecutive years, e.g. 2026/2027');
  }

  const y1 = Number(match[1]);
  const y2 = Number(match[2]);
  if (y2 !== y1 + 1) {
    throw new Error('Session years must be consecutive and in order, e.g. 2026/2027 (not 2027/2026)');
  }

  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1; // 1-12
  const effectiveYear = currentMonth <= 2 ? currentYear - 1 : currentYear;

  if (y1 < effectiveYear) {
    throw new Error(`Session can't start before ${effectiveYear}/${effectiveYear + 1} — dissolve the old session instead of backdating a new one`);
  }
}

async function assertCanManageLeaders(communityId: string, actorId: string) {
  const community = await CommunityModel.findById(communityId);
  if (!community) {
    throw new Error('Community not found');
  }
  if (community.archivedAt) {
    throw new Error('Community is archived');
  }

  const actor = await MembershipModel.findOne({ communityId, userId: actorId });
  if (!actor || !hasCommunityPermission(actor.role, 'VICE_PRESIDENT')) {
    throw new Error('Insufficient permissions');
  }

  return community;
}

/**
 * Public: the curated leadership roster for a community's profile, ordered by
 * displayRank (nulls last, then oldest-added first). By default returns every
 * entry (current + archived + past) — pass `status` to narrow it, or `session`
 * to fetch everyone tagged with one specific session regardless of status
 * (how a dissolved session's leaders become visible again).
 */
export async function listCommunityLeaders(communityId: string, options?: { status?: 'ACTIVE' | 'ARCHIVED' | 'PAST'; session?: string }) {
  const query: Record<string, unknown> = { communityId };
  if (options?.status) query.status = options.status;
  if (options?.session !== undefined) query.session = options.session;

  const leaders = await CommunityLeaderModel.find(query).lean();

  const sorted = leaders.sort((a, b) => {
    const ra = a.displayRank;
    const rb = b.displayRank;
    if (ra !== null && ra !== undefined && rb !== null && rb !== undefined) return ra - rb;
    if (ra !== null && ra !== undefined) return -1;
    if (rb !== null && rb !== undefined) return 1;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  // Attach each entry's end-of-term certificate (if one was issued) so admins can
  // copy/re-send a past exco's verification link later without re-dissolving anything.
  const certs = await CertificateModel.find({ leaderId: { $in: sorted.map((l) => l._id) } })
    .select('leaderId serial status')
    .lean();
  const certByLeader = new Map(certs.filter((c) => c.leaderId).map((c) => [c.leaderId!.toString(), c]));

  return Promise.all(
    sorted.map(async (leader) => {
      const linkedUser = leader.linkedUserId ? await authStore.getPublicUserById(leader.linkedUserId.toString()) : null;
      const cert = certByLeader.get(leader._id.toString());
      return {
        id: leader._id.toString(),
        name: leader.name,
        title: leader.title,
        session: leader.session,
        bio: leader.bio,
        photo: leader.photo,
        phone: leader.phone,
        department: leader.department,
        level: leader.level,
        displayRank: leader.displayRank,
        status: leader.status,
        createdAt: leader.createdAt,
        updatedAt: leader.updatedAt,
        certificate: cert
          ? { serial: cert.serial, status: cert.status ?? 'VERIFIED', verificationUrl: certificateVerificationUrl(cert.serial) }
          : null,
        linkedUser: linkedUser
          ? {
              id: linkedUser.id,
              fullName: linkedUser.fullName,
              username: linkedUser.profile?.username ?? '',
              avatar: linkedUser.profile?.avatar ?? '',
            }
          : null,
      };
    }),
  );
}

/**
 * Lightweight session directory for a community — one row per distinct
 * session label with total/active/archived/past counts, sorted most-recently-
 * active first. Used to render session chips without pulling every leader's
 * full payload (bio/photo/linked-account lookups) up front.
 */
export async function listCommunityLeaderSessions(communityId: string) {
  const leaders = await CommunityLeaderModel.find({ communityId }).select('session status createdAt updatedAt').lean();

  const buckets = new Map<
    string,
    { session: string; total: number; activeCount: number; archivedCount: number; pastCount: number; latest: number }
  >();
  for (const leader of leaders) {
    const key = leader.session ?? '';
    const t = new Date(leader.updatedAt ?? leader.createdAt).getTime();
    const existing = buckets.get(key) ?? { session: key, total: 0, activeCount: 0, archivedCount: 0, pastCount: 0, latest: 0 };
    existing.total += 1;
    if (leader.status === 'ARCHIVED') existing.archivedCount += 1;
    else if (leader.status === 'PAST') existing.pastCount += 1;
    else existing.activeCount += 1;
    existing.latest = Math.max(existing.latest, t);
    buckets.set(key, existing);
  }

  return Array.from(buckets.values()).sort((a, b) => b.latest - a.latest);
}

/**
 * Dissolves a session: every currently-ACTIVE leader tagged with it moves to
 * PAST together (the normal end-of-term transition — distinct from archiving
 * one person who left early). Once nothing is ACTIVE in that session anymore,
 * the next session with active leaders (or a freshly-added one) takes over as
 * "Current". Optionally issues verifiable LEADERSHIP certificates ("thank you
 * for your service") to everyone being dissolved — GuildOS standard design or
 * the community's own uploaded template.
 */
export async function dissolveCommunityLeaderSession(
  communityId: string,
  session: string,
  actorId: string,
  certificate?: LeaderCertificateOptions | null,
  options?: { demoteOutgoing?: boolean },
) {
  const community = await assertCanManageLeaders(communityId, actorId);

  // Snapshot who's being dissolved BEFORE flipping statuses so certificates go
  // to exactly this outgoing set.
  const outgoing = await CommunityLeaderModel.find({ communityId, session, status: 'ACTIVE' }).select('_id linkedUserId').lean();
  const outgoingIds = outgoing.map((l) => l._id.toString());

  const result = await CommunityLeaderModel.updateMany(
    { communityId, session, status: 'ACTIVE' },
    { $set: { status: 'PAST' } },
  );

  let certificates: Awaited<ReturnType<typeof issueLeaderCertificates>> = [];
  if (certificate && outgoingIds.length > 0) {
    certificates = await issueLeaderCertificates(community, outgoingIds, session, actorId, certificate);
  }

  // Handover bridge, outgoing half: their term is over, so their management
  // PERMISSIONS should end with it. Steps every outgoing leader's linked account
  // down to MEMBER. Deliberately bypasses the rank guard (a VP dissolving the
  // session must be able to step the outgoing President down — this is a bulk
  // end-of-term action, not a coup), but never touches the FOUNDER or the actor
  // themselves (so they can't lock themselves out mid-handover).
  let demoted = 0;
  if (options?.demoteOutgoing) {
    const linkedUserIds = [...new Set(outgoing.map((l) => l.linkedUserId?.toString()).filter((id): id is string => Boolean(id) && id !== actorId))];
    if (linkedUserIds.length) {
      const memberships = await MembershipModel.find({ communityId, userId: { $in: linkedUserIds } });
      for (const membership of memberships) {
        if (membership.role === 'FOUNDER' || !isLeadershipRole(membership.role)) continue;
        const previousRole = membership.role;
        membership.role = 'MEMBER';
        membership.assignedBy = actorId as any;
        await membership.save();
        await closeOpenLeadershipRoles(membership._id);
        await logMembershipActivity(membership._id, community._id, 'ROLE_REMOVED', actorId, { role: previousRole, via: 'session-dissolve' });
        demoted += 1;
      }
    }
  }

  return { dissolved: result.modifiedCount ?? 0, certificates, demoted };
}

/**
 * "Issue anyway" for archived excos: leaders archived (left early) get NO certificate
 * at dissolve by default — this is the explicit per-person exception a society uses to
 * honour partial service. Also works for a PAST leader who was skipped (e.g. added to
 * the roster after their session was already dissolved). Idempotent: if the leader
 * already has a certificate, the existing serial/link is returned untouched.
 */
export async function issueCertificateForLeader(communityId: string, leaderId: string, actorId: string) {
  const community = await assertCanManageLeaders(communityId, actorId);
  const leader = await CommunityLeaderModel.findOne({ _id: leaderId, communityId });
  if (!leader) throw new Error('Leader not found');
  if (leader.status === 'ACTIVE') {
    throw new Error('This leader is still serving — dissolve the session to issue end-of-term certificates');
  }
  const certificates = await issueLeaderCertificates(community, [leader._id.toString()], leader.session, actorId, { mode: 'STANDARD' });
  if (!certificates.length) throw new Error('Unable to issue the certificate');
  return certificates[0];
}

export type CommunityLeaderInput = {
  name: string;
  title?: string;
  session?: string;
  bio?: string;
  photo?: string;
  phone?: string;
  department?: string;
  level?: string;
  displayRank?: number | null;
  linkedUserId?: string | null;
  status?: 'ACTIVE' | 'ARCHIVED' | 'PAST';
  /**
   * Handover bridge: when the leader is linked to a GuildOS account, optionally give
   * that account a real Membership role at the same time (so the incoming Amirah is
   * not just LISTED as VP — she can actually manage). Runs through updateMemberRole,
   * so all the usual rank guards, leadership-history records and audit logs apply.
   * Requires the linked user to already be a community member.
   */
  assignRole?: string;
};

/** Applies `assignRole` for a linked account — shared by add/update. Throws with a friendly message when the user isn't a member yet. */
async function applyRoleAssignment(communityId: string, linkedUserId: string, role: string, actorId: string) {
  const membership = await MembershipModel.findOne({ communityId, userId: linkedUserId });
  if (!membership) {
    throw new Error('They need to join the community before a role can be assigned — the leader entry itself works without it');
  }
  if (membership.role === role) return;
  await updateMemberRole(communityId, membership._id.toString(), role, actorId);
}

export async function addCommunityLeader(communityId: string, actorId: string, input: CommunityLeaderInput) {
  await assertCanManageLeaders(communityId, actorId);

  const name = cap(input.name, NAME_MAX);
  if (!name) {
    throw new Error('Name is required');
  }

  let linkedUserId: string | null = null;
  if (input.linkedUserId) {
    const linked = await UserModel.findById(input.linkedUserId).select('_id').lean();
    if (!linked) {
      throw new Error('Linked GuildOS account not found');
    }
    linkedUserId = input.linkedUserId;
  }

  const session = cap(input.session, SESSION_MAX);
  if (session) {
    assertValidSessionLabel(session);
  }

  // Role assignment runs FIRST so a failure (not a member, rank guard) aborts cleanly
  // before the roster entry exists.
  if (input.assignRole && linkedUserId) {
    await applyRoleAssignment(communityId, linkedUserId, input.assignRole, actorId);
  }

  const leader = await CommunityLeaderModel.create({
    communityId,
    name,
    title: cap(input.title, TITLE_MAX),
    session,
    bio: cap(input.bio, BIO_MAX),
    photo: (input.photo ?? '').trim(),
    phone: cap(input.phone, PHONE_MAX),
    department: cap(input.department, DEPARTMENT_MAX),
    level: cap(input.level, LEVEL_MAX),
    displayRank: normalizeDisplayRank(input.displayRank),
    linkedUserId,
    addedBy: actorId,
  });

  return leader;
}

export async function updateCommunityLeader(leaderId: string, actorId: string, input: Partial<CommunityLeaderInput>) {
  const leader = await CommunityLeaderModel.findById(leaderId);
  if (!leader) {
    throw new Error('Leader not found');
  }

  await assertCanManageLeaders(leader.communityId.toString(), actorId);

  if (input.name !== undefined) {
    const name = cap(input.name, NAME_MAX);
    if (!name) {
      throw new Error('Name is required');
    }
    leader.name = name;
  }
  if (input.title !== undefined) leader.title = cap(input.title, TITLE_MAX);
  if (input.session !== undefined) {
    const nextSession = cap(input.session, SESSION_MAX);
    // Only re-validate when the session is actually changing — editing an
    // unrelated field (e.g. fixing a typo in the bio) shouldn't suddenly
    // reject a leader's untouched, legitimately-historical session label.
    if (nextSession && nextSession !== leader.session) {
      assertValidSessionLabel(nextSession);
    }
    leader.session = nextSession;
  }
  if (input.bio !== undefined) leader.bio = cap(input.bio, BIO_MAX);
  if (input.photo !== undefined) leader.photo = input.photo.trim();
  if (input.phone !== undefined) leader.phone = cap(input.phone, PHONE_MAX);
  if (input.department !== undefined) leader.department = cap(input.department, DEPARTMENT_MAX);
  if (input.level !== undefined) leader.level = cap(input.level, LEVEL_MAX);
  if (input.displayRank !== undefined) leader.displayRank = normalizeDisplayRank(input.displayRank);
  if (input.status !== undefined) {
    if (input.status !== 'ACTIVE' && input.status !== 'ARCHIVED' && input.status !== 'PAST') {
      throw new Error('Invalid status');
    }
    leader.status = input.status;
  }

  if (input.linkedUserId !== undefined) {
    if (input.linkedUserId) {
      const linked = await UserModel.findById(input.linkedUserId).select('_id').lean();
      if (!linked) {
        throw new Error('Linked GuildOS account not found');
      }
      leader.linkedUserId = input.linkedUserId as any;
    } else {
      leader.linkedUserId = null;
    }
  }

  if (input.assignRole && leader.linkedUserId) {
    await applyRoleAssignment(leader.communityId.toString(), leader.linkedUserId.toString(), input.assignRole, actorId);
  }

  await leader.save();
  return leader;
}

export async function removeCommunityLeader(leaderId: string, actorId: string) {
  const leader = await CommunityLeaderModel.findById(leaderId);
  if (!leader) {
    throw new Error('Leader not found');
  }

  await assertCanManageLeaders(leader.communityId.toString(), actorId);

  await leader.deleteOne();
  return { removed: true };
}

/**
 * Move a current leader into "Past Leadership" (status ARCHIVED) instead of
 * deleting them — this is the normal end-of-session action so past executives
 * stay on record. `removeCommunityLeader` (hard delete) remains for correcting
 * a mistaken entry, typically used from the Past Leadership list.
 */
export async function archiveCommunityLeader(leaderId: string, actorId: string) {
  return updateCommunityLeader(leaderId, actorId, { status: 'ARCHIVED' });
}

export async function restoreCommunityLeader(leaderId: string, actorId: string) {
  return updateCommunityLeader(leaderId, actorId, { status: 'ACTIVE' });
}

export type CommunityLeaderBulkEntry = {
  name: string;
  title?: string;
  department?: string;
  level?: string;
  phone?: string;
};

/**
 * Bulk-create leaders under one shared session — e.g. from an "Import from document" flow
 * where an admin uploaded a nomination letter, an AI extracted candidate rows, and they
 * reviewed/edited them before committing. The session is validated once and applied to every
 * row (all-or-nothing on the session check); rows with no name are silently skipped. Every
 * created entry starts ACTIVE and can be edited individually afterwards like any other leader.
 */
export async function bulkCreateCommunityLeaders(
  communityId: string,
  actorId: string,
  session: string,
  entries: CommunityLeaderBulkEntry[],
) {
  await assertCanManageLeaders(communityId, actorId);

  const trimmedSession = cap(session, SESSION_MAX);
  if (trimmedSession) {
    assertValidSessionLabel(trimmedSession);
  }

  const created = [];
  for (const entry of entries) {
    const name = cap(entry.name, NAME_MAX);
    if (!name) continue;

    const leader = await CommunityLeaderModel.create({
      communityId,
      name,
      title: cap(entry.title, TITLE_MAX),
      session: trimmedSession,
      bio: '',
      photo: '',
      phone: cap(entry.phone, PHONE_MAX),
      department: cap(entry.department, DEPARTMENT_MAX),
      level: cap(entry.level, LEVEL_MAX),
      displayRank: null,
      linkedUserId: null,
      addedBy: actorId,
    });
    created.push(leader);
  }

  return created;
}
