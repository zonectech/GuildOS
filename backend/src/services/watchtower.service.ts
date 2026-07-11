import { CommunityModel } from '../models/community.model';
import { MembershipModel } from '../models/membership.model';
import { CommunityEndorsementModel } from '../models/community-endorsement.model';
import { EventModel } from '../models/event.model';
import { CertificateModel } from '../models/certificate.model';
import { OpportunityModel } from '../models/opportunity.model';
import { WatchAlertStateModel } from '../models/watch-alert-state.model';
import { authStore } from '../store/auth-store';
import { verifyCommunity, rejectCommunity } from './community.service';
import { setOpportunityModeration } from './opportunity.service';

export type WatchSeverity = 'LOW' | 'MEDIUM' | 'HIGH';
export type WatchType = 'COMMUNITY' | 'ENDORSEMENT' | 'MEMBERSHIP' | 'CERTIFICATE' | 'OPPORTUNITY';
export type WatchEntityType = 'COMMUNITY' | 'USER' | 'OPPORTUNITY' | 'NONE';
export type WatchAction = 'VERIFY_COMMUNITY' | 'REJECT_COMMUNITY' | 'FLAG_OPPORTUNITY' | 'ARCHIVE_OPPORTUNITY';

export type WatchAlert = {
  id: string;
  type: WatchType;
  severity: WatchSeverity;
  title: string;
  detail: string;
  entityType: WatchEntityType;
  entityId: string;
  entityLabel: string;
  link: string;
  signals: string[];
  actions: WatchAction[];
  occurredAt: string;
};

const DAY = 24 * 60 * 60 * 1000;
const severityRank: Record<WatchSeverity, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };

/** Communities pending verification for 14+ days with little activity. */
async function staleCommunityAlerts(): Promise<WatchAlert[]> {
  const cutoff = new Date(Date.now() - 14 * DAY);
  const stale = await CommunityModel.find({
    verificationStatus: 'PENDING',
    archivedAt: null,
    createdAt: { $lt: cutoff },
  })
    .select('name slug createdAt')
    .lean();

  const alerts: WatchAlert[] = [];
  for (const community of stale) {
    const [events, members] = await Promise.all([
      EventModel.countDocuments({ communityId: community._id, deletedAt: null }),
      MembershipModel.countDocuments({ communityId: community._id, status: { $nin: ['REMOVED', 'LEFT'] } }),
    ]);
    const signals = ['Pending verification for 14+ days'];
    if (events === 0) signals.push('No events created');
    if (members < 3) signals.push('Fewer than 3 members');
    alerts.push({
      id: `stale:${community._id.toString()}`,
      type: 'COMMUNITY',
      severity: signals.length >= 3 ? 'MEDIUM' : 'LOW',
      title: `Stale unverified community: ${community.name}`,
      detail: 'Sitting in the verification queue with little activity — likely abandoned or low-effort.',
      entityType: 'COMMUNITY',
      entityId: community._id.toString(),
      entityLabel: community.name,
      link: '/dashboard/admin/verification',
      signals,
      actions: ['REJECT_COMMUNITY'],
      occurredAt: new Date(community.createdAt).toISOString(),
    });
  }
  return alerts;
}

/** Non-verified communities reusing the exact name of a verified one (impersonation). */
async function impersonationAlerts(): Promise<WatchAlert[]> {
  const [verified, candidates] = await Promise.all([
    CommunityModel.find({ verificationStatus: 'VERIFIED', archivedAt: null }).select('name founder').lean(),
    CommunityModel.find({ verificationStatus: { $ne: 'VERIFIED' }, archivedAt: null }).select('name slug founder createdAt').lean(),
  ]);

  const verifiedByName = new Map<string, { founder: string }>();
  for (const v of verified) {
    verifiedByName.set(v.name.trim().toLowerCase(), { founder: v.founder?.toString() ?? '' });
  }

  const alerts: WatchAlert[] = [];
  for (const c of candidates) {
    const match = verifiedByName.get(c.name.trim().toLowerCase());
    if (match && match.founder && match.founder !== c.founder?.toString()) {
      alerts.push({
        id: `impersonation:${c._id.toString()}`,
        type: 'COMMUNITY',
        severity: 'HIGH',
        title: `Possible impersonation: ${c.name}`,
        detail: 'A different owner created a community with the exact name of an already-verified one.',
        entityType: 'COMMUNITY',
        entityId: c._id.toString(),
        entityLabel: c.name,
        link: '/dashboard/admin/verification',
        signals: ['Exact name of a verified community', 'Different founder'],
        actions: ['REJECT_COMMUNITY'],
        occurredAt: new Date(c.createdAt).toISOString(),
      });
    }
  }
  return alerts;
}

/** Reciprocal endorsement pairs — two owners endorsing each other's communities. */
async function endorsementRingAlerts(): Promise<WatchAlert[]> {
  const [endorsements, communities] = await Promise.all([
    CommunityEndorsementModel.find().select('communityId endorserId createdAt').lean(),
    CommunityModel.find().select('name founder').lean(),
  ]);

  const founderOf = new Map<string, string>();
  for (const c of communities) {
    founderOf.set(c._id.toString(), c.founder?.toString() ?? '');
  }

  const edges = new Set<string>();
  const meta: Array<{ a: string; b: string; createdAt: Date }> = [];
  for (const e of endorsements) {
    const founder = founderOf.get(e.communityId.toString());
    if (!founder) continue;
    const a = e.endorserId.toString();
    edges.add(`${a}->${founder}`);
    meta.push({ a, b: founder, createdAt: new Date(e.createdAt) });
  }

  const alerts: WatchAlert[] = [];
  const seen = new Set<string>();
  for (const m of meta) {
    if (!edges.has(`${m.b}->${m.a}`)) continue;
    const pairKey = [m.a, m.b].sort().join(':');
    if (seen.has(pairKey)) continue;
    seen.add(pairKey);
    const [nameA, nameB] = await Promise.all([
      authStore.getPublicUserById(m.a).catch(() => null),
      authStore.getPublicUserById(m.b).catch(() => null),
    ]);
    alerts.push({
      id: `ring:${pairKey}`,
      type: 'ENDORSEMENT',
      severity: 'HIGH',
      title: 'Reciprocal endorsement detected',
      detail: `${nameA?.fullName ?? 'A leader'} and ${nameB?.fullName ?? 'another leader'} endorsed each other's communities — possible verification gaming.`,
      entityType: 'NONE',
      entityId: pairKey,
      entityLabel: `${nameA?.fullName ?? 'User'} ↔ ${nameB?.fullName ?? 'User'}`,
      link: '/dashboard/admin/verification',
      signals: ['Mutual endorsements between two owners'],
      actions: [],
      occurredAt: m.createdAt.toISOString(),
    });
  }
  return alerts;
}

/** Communities that gained 25+ members in the last 24h (possible bulk fake accounts). */
async function membershipBurstAlerts(): Promise<WatchAlert[]> {
  const since = new Date(Date.now() - DAY);
  const bursts = await MembershipModel.aggregate<{ _id: unknown; count: number }>([
    { $match: { joinedAt: { $gte: since }, status: { $nin: ['REMOVED', 'LEFT'] } } },
    { $group: { _id: '$communityId', count: { $sum: 1 } } },
    { $match: { count: { $gte: 25 } } },
    { $sort: { count: -1 } },
    { $limit: 25 },
  ]);

  if (!bursts.length) return [];
  const communities = await CommunityModel.find({ _id: { $in: bursts.map((b) => b._id) } }).select('name slug').lean();
  const nameOf = new Map(communities.map((c) => [c._id.toString(), c.name]));

  return bursts.map((b) => ({
    id: `burst:${String(b._id)}`,
    type: 'MEMBERSHIP' as const,
    severity: (b.count >= 100 ? 'HIGH' : 'MEDIUM') as WatchSeverity,
    title: `Membership spike: ${nameOf.get(String(b._id)) ?? 'Community'}`,
    detail: `${b.count} members joined in the last 24 hours — check for bulk or fake accounts.`,
    entityType: 'COMMUNITY' as const,
    entityId: String(b._id),
    entityLabel: nameOf.get(String(b._id)) ?? 'Community',
    link: '/dashboard/admin/verification',
    signals: [`${b.count} new members in 24h`],
    actions: [] as WatchAction[],
    occurredAt: new Date().toISOString(),
  }));
}

/** A single issuer minting 30+ event certificates in the last 24h. */
async function certificateBurstAlerts(): Promise<WatchAlert[]> {
  const since = new Date(Date.now() - DAY);
  const bursts = await CertificateModel.aggregate<{ _id: { issuedBy: unknown; communityName: string }; count: number }>([
    { $match: { issuedAt: { $gte: since }, status: 'VERIFIED', issuedBy: { $ne: null } } },
    { $group: { _id: { issuedBy: '$issuedBy', communityName: '$communityName' }, count: { $sum: 1 } } },
    { $match: { count: { $gte: 30 } } },
    { $sort: { count: -1 } },
    { $limit: 25 },
  ]);

  if (!bursts.length) return [];
  return Promise.all(
    bursts.map(async (b) => {
      const issuer = await authStore.getPublicUserById(String(b._id.issuedBy)).catch(() => null);
      return {
        id: `certburst:${String(b._id.issuedBy)}:${b._id.communityName}`,
        type: 'CERTIFICATE' as const,
        severity: (b.count >= 100 ? 'HIGH' : 'MEDIUM') as WatchSeverity,
        title: `Certificate burst by ${issuer?.fullName ?? 'a leader'}`,
        detail: `${b.count} certificates issued in 24h${b._id.communityName ? ` for ${b._id.communityName}` : ''} — verify these are legitimate.`,
        entityType: 'USER' as const,
        entityId: String(b._id.issuedBy),
        entityLabel: issuer?.fullName ?? 'Issuer',
        link: '/dashboard/admin/reports',
        signals: [`${b.count} certificates in 24h`],
        actions: [] as WatchAction[],
        occurredAt: new Date().toISOString(),
      };
    }),
  );
}

// Heuristic scam signals for opportunity listings. Rule-based so it works without
// an LLM; structured so a model-based classifier can be swapped in later.
const SCAM_PATTERNS: Array<{ re: RegExp; label: string; weight: number }> = [
  { re: /\b(registration|processing|application|training)\s+fee\b/i, label: 'Mentions an upfront fee', weight: 3 },
  { re: /\bpay\b.{0,20}\b(upfront|first|before)\b/i, label: 'Asks to pay upfront', weight: 3 },
  { re: /\b(gift\s*card|western union|moneygram|bitcoin|crypto|usdt|wire transfer)\b/i, label: 'Untraceable payment method', weight: 3 },
  { re: /\b(bank|account|routing|bvn|ssn)\s*(details|number|info)\b/i, label: 'Requests bank/ID details', weight: 3 },
  { re: /\b(guaranteed|guarantee)\b.{0,20}\b(income|job|money|profit)\b/i, label: 'Guaranteed income claim', weight: 2 },
  { re: /\bearn\b.{0,20}\$?\d{3,}.{0,20}\b(per|a)\s*(day|week)\b/i, label: 'Unrealistic earnings', weight: 2 },
  { re: /\b(whatsapp|telegram|text)\b.{0,20}(\+?\d[\d\s-]{7,})/i, label: 'Off-platform personal contact', weight: 2 },
  { re: /@(gmail|yahoo|hotmail|outlook)\.com/i, label: 'Personal email as contact', weight: 1 },
  { re: /\bno\s+(experience|interview|cv)\s+(needed|required)\b/i, label: 'No experience/interview needed', weight: 1 },
  { re: /\b(urgent|immediate)\s+(start|hiring|payment)\b/i, label: 'Urgency pressure', weight: 1 },
];

/** Heuristic scam classifier over live opportunities awaiting or passing moderation. */
async function scamOpportunityAlerts(): Promise<WatchAlert[]> {
  const opps = await OpportunityModel.find({
    status: { $ne: 'CLOSED' },
    moderationStatus: { $in: ['PENDING_REVIEW', 'VERIFIED'] },
  })
    .select('title description organization applicationUrl createdAt moderationStatus')
    .sort({ createdAt: -1 })
    .limit(500)
    .lean();

  const alerts: WatchAlert[] = [];
  for (const opp of opps) {
    const text = `${opp.title} ${opp.description} ${opp.organization} ${opp.applicationUrl}`;
    let score = 0;
    const signals: string[] = [];
    for (const p of SCAM_PATTERNS) {
      if (p.re.test(text)) {
        score += p.weight;
        signals.push(p.label);
      }
    }
    if (score < 3) continue;
    alerts.push({
      id: `scam:${opp._id.toString()}`,
      type: 'OPPORTUNITY',
      severity: score >= 5 ? 'HIGH' : 'MEDIUM',
      title: `Possible scam listing: ${opp.title}`,
      detail: `Automated scan found ${signals.length} scam indicator${signals.length === 1 ? '' : 's'} in this opportunity.`,
      entityType: 'OPPORTUNITY',
      entityId: opp._id.toString(),
      entityLabel: opp.title,
      link: '/dashboard/admin/moderation',
      signals,
      actions: ['FLAG_OPPORTUNITY', 'ARCHIVE_OPPORTUNITY'],
      occurredAt: new Date(opp.createdAt).toISOString(),
    });
  }
  return alerts;
}

export async function getWatchtower(options: { includeResolved?: boolean } = {}) {
  const [stale, impersonation, rings, memberBursts, certBursts, scams, states] = await Promise.all([
    staleCommunityAlerts().catch(() => []),
    impersonationAlerts().catch(() => []),
    endorsementRingAlerts().catch(() => []),
    membershipBurstAlerts().catch(() => []),
    certificateBurstAlerts().catch(() => []),
    scamOpportunityAlerts().catch(() => []),
    WatchAlertStateModel.find().lean(),
  ]);

  const stateByKey = new Map(states.map((s) => [s.alertKey, s]));
  const now = Date.now();

  const raw = [...impersonation, ...scams, ...rings, ...memberBursts, ...certBursts, ...stale];

  let dismissedCount = 0;
  const visible: Array<WatchAlert & { status: 'OPEN' | 'SNOOZED' }> = [];
  for (const alert of raw) {
    const state = stateByKey.get(alert.id);
    if (state) {
      if (state.status === 'DISMISSED') {
        dismissedCount += 1;
        if (!options.includeResolved) continue;
        visible.push({ ...alert, status: 'OPEN' });
        continue;
      }
      if (state.status === 'SNOOZED' && state.snoozedUntil && new Date(state.snoozedUntil).getTime() > now) {
        if (!options.includeResolved) continue;
        visible.push({ ...alert, status: 'SNOOZED' });
        continue;
      }
    }
    visible.push({ ...alert, status: 'OPEN' });
  }

  visible.sort((a, b) => severityRank[b.severity] - severityRank[a.severity] || b.occurredAt.localeCompare(a.occurredAt));

  const summary = {
    total: visible.length,
    high: visible.filter((a) => a.severity === 'HIGH').length,
    medium: visible.filter((a) => a.severity === 'MEDIUM').length,
    low: visible.filter((a) => a.severity === 'LOW').length,
    dismissed: dismissedCount,
    byType: {
      COMMUNITY: visible.filter((a) => a.type === 'COMMUNITY').length,
      ENDORSEMENT: visible.filter((a) => a.type === 'ENDORSEMENT').length,
      MEMBERSHIP: visible.filter((a) => a.type === 'MEMBERSHIP').length,
      CERTIFICATE: visible.filter((a) => a.type === 'CERTIFICATE').length,
      OPPORTUNITY: visible.filter((a) => a.type === 'OPPORTUNITY').length,
    },
  };

  return { alerts: visible, summary };
}

export async function getWatchtowerSummary() {
  const { summary } = await getWatchtower();
  return summary;
}

export async function dismissWatchAlert(alertKey: string, actorId: string, note = '') {
  await WatchAlertStateModel.findOneAndUpdate(
    { alertKey },
    { status: 'DISMISSED', snoozedUntil: null, actorId, note: note.slice(0, 300) },
    { upsert: true },
  );
  return { alertKey, status: 'DISMISSED' as const };
}

export async function snoozeWatchAlert(alertKey: string, actorId: string, days = 7) {
  const snoozedUntil = new Date(Date.now() + Math.min(Math.max(days, 1), 90) * DAY);
  await WatchAlertStateModel.findOneAndUpdate(
    { alertKey },
    { status: 'SNOOZED', snoozedUntil, actorId },
    { upsert: true },
  );
  return { alertKey, status: 'SNOOZED' as const, snoozedUntil: snoozedUntil.toISOString() };
}

export async function reopenWatchAlert(alertKey: string) {
  await WatchAlertStateModel.deleteOne({ alertKey });
  return { alertKey, status: 'OPEN' as const };
}

const ACTIONS: WatchAction[] = ['VERIFY_COMMUNITY', 'REJECT_COMMUNITY', 'FLAG_OPPORTUNITY', 'ARCHIVE_OPPORTUNITY'];

export async function runWatchAction(input: {
  actorId: string;
  action: WatchAction;
  entityId: string;
  alertKey?: string;
  notes?: string;
}) {
  if (!ACTIONS.includes(input.action)) {
    throw new Error('Unknown action');
  }
  switch (input.action) {
    case 'VERIFY_COMMUNITY':
      await verifyCommunity(input.entityId, input.actorId, input.notes ?? 'Verified from Watchtower');
      break;
    case 'REJECT_COMMUNITY':
      await rejectCommunity(input.entityId, input.actorId, input.notes ?? 'Rejected from Watchtower');
      break;
    case 'FLAG_OPPORTUNITY':
      await setOpportunityModeration(input.entityId, 'FLAGGED');
      break;
    case 'ARCHIVE_OPPORTUNITY':
      await setOpportunityModeration(input.entityId, 'ARCHIVED');
      break;
  }
  // Once actioned, dismiss the alert so it leaves the board.
  if (input.alertKey) {
    await dismissWatchAlert(input.alertKey, input.actorId, `Action: ${input.action}`);
  }
  return { ok: true };
}
