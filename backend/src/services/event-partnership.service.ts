import { EventPartnershipModel } from '../models/event-partnership.model';
import { EventModel } from '../models/event.model';
import { CommunityModel } from '../models/community.model';
import { MembershipModel } from '../models/membership.model';
import { hasCommunityPermission } from './community.service';
import { createNotification } from './notification.service';

function eventUrl(slug: string) {
  return `/events/${encodeURIComponent(slug)}`;
}

async function requireManager(eventId: string, actorId: string) {
  const event = await EventModel.findOne({ _id: eventId, deletedAt: null });
  if (!event) {
    throw new Error('Event not found');
  }
  const partnerships = await EventPartnershipModel.find({ eventId: event._id, status: 'ACCEPTED' }).select('communityId').lean();
  const communityIds = [event.communityId, ...partnerships.map((p) => p.communityId)];
  const memberships = await MembershipModel.find({ communityId: { $in: communityIds }, userId: actorId }).lean();
  if (!memberships.some((m) => hasCommunityPermission(m.role, 'COORDINATOR'))) {
    throw new Error('Insufficient permissions');
  }
  return event;
}

/** Notify the invited community's senior leaders (VP and above) about a co-host invite. */
async function notifyCommunityLeaders(communityId: string, input: { actorId: string; title: string; body: string; link: string }) {
  const leaders = await MembershipModel.find({
    communityId,
    role: { $in: ['VICE_PRESIDENT', 'PRESIDENT', 'FOUNDER'] },
  })
    .select('userId')
    .lean();
  await Promise.all(
    leaders.map((l) =>
      createNotification({
        userId: l.userId.toString(),
        actorId: input.actorId,
        type: 'SYSTEM',
        title: input.title,
        body: input.body,
        link: input.link,
      }),
    ),
  );
}

/** Invite another community to co-host an event. Re-inviting after a decline resets the invite. */
export async function inviteEventPartnership(eventId: string, actorId: string, communitySlug: string) {
  const event = await requireManager(eventId, actorId);

  const community = await CommunityModel.findOne({ slug: String(communitySlug ?? '').trim().toLowerCase() });
  if (!community) {
    throw new Error('Community not found');
  }
  if (community.archivedAt) {
    throw new Error('That community is archived');
  }
  if (community.verificationStatus !== 'VERIFIED') {
    throw new Error('Only verified communities can co-host events');
  }
  if (community._id.toString() === event.communityId.toString()) {
    throw new Error('That community is already the host');
  }

  const existing = await EventPartnershipModel.findOne({ eventId: event._id, communityId: community._id });
  if (existing) {
    if (existing.status === 'ACCEPTED') {
      throw new Error('That community is already a co-host');
    }
    if (existing.status === 'PENDING') {
      throw new Error('An invite to that community is already pending');
    }
    existing.status = 'PENDING';
    existing.invitedBy = actorId as any;
    existing.respondedBy = null;
    existing.respondedAt = null;
    await existing.save();
    await notifyCommunityLeaders(community._id.toString(), {
      actorId,
      title: `Partnership invite: co-host "${event.title}"`,
      body: 'Your community has been invited to co-host this event. A senior leader can accept or decline on the event page.',
      link: eventUrl(event.slug),
    });
    return existing;
  }

  const partnership = await EventPartnershipModel.create({
    eventId: event._id,
    communityId: community._id,
    invitedBy: actorId,
    status: 'PENDING',
  });

  await notifyCommunityLeaders(community._id.toString(), {
    actorId,
    title: `Partnership invite: co-host "${event.title}"`,
    body: 'Your community has been invited to co-host this event. A senior leader can accept or decline on the event page.',
    link: eventUrl(event.slug),
  });

  return partnership;
}

/** Accept or decline a co-host invite. Requires VP+ of the invited community. */
export async function respondEventPartnership(partnershipId: string, actorId: string, accept: boolean) {
  const partnership = await EventPartnershipModel.findById(partnershipId);
  if (!partnership) {
    throw new Error('Partnership invite not found');
  }
  if (partnership.status !== 'PENDING') {
    throw new Error('This invite has already been answered');
  }

  const membership = await MembershipModel.findOne({ communityId: partnership.communityId, userId: actorId });
  if (!membership || !hasCommunityPermission(membership.role, 'VICE_PRESIDENT')) {
    throw new Error('Only senior leaders of the invited community can respond');
  }

  partnership.status = accept ? 'ACCEPTED' : 'DECLINED';
  partnership.respondedBy = actorId as any;
  partnership.respondedAt = new Date();
  await partnership.save();

  const [event, community] = await Promise.all([
    EventModel.findById(partnership.eventId).select('title slug createdBy').lean(),
    CommunityModel.findById(partnership.communityId).select('name').lean(),
  ]);
  if (event) {
    await createNotification({
      userId: event.createdBy.toString(),
      actorId,
      type: 'SYSTEM',
      title: accept
        ? `${community?.name ?? 'A community'} accepted your co-host invite for "${event.title}"`
        : `${community?.name ?? 'A community'} declined the co-host invite for "${event.title}"`,
      link: eventUrl(event.slug),
    });
  }

  return partnership;
}

/** List all partnerships for an event (managers only — includes pending/declined). */
export async function listEventPartnerships(eventId: string, actorId: string) {
  await requireManager(eventId, actorId);
  const partnerships = await EventPartnershipModel.find({ eventId }).sort({ createdAt: 1 }).lean();
  const communities = partnerships.length
    ? await CommunityModel.find({ _id: { $in: partnerships.map((p) => p.communityId) } }).select('name slug logo').lean()
    : [];
  const byId = new Map(communities.map((c) => [c._id.toString(), c]));
  return partnerships.map((p) => {
    const c = byId.get(p.communityId.toString());
    return {
      _id: p._id.toString(),
      status: p.status,
      createdAt: p.createdAt,
      respondedAt: p.respondedAt,
      community: c ? { name: c.name, slug: c.slug, logo: c.logo } : null,
    };
  });
}

/** Remove a partnership (host managers) or withdraw from it (partner community VP+). */
export async function removeEventPartnership(eventId: string, partnershipId: string, actorId: string) {
  const partnership = await EventPartnershipModel.findOne({ _id: partnershipId, eventId });
  if (!partnership) {
    throw new Error('Partnership not found');
  }

  const event = await EventModel.findOne({ _id: eventId, deletedAt: null });
  if (!event) {
    throw new Error('Event not found');
  }

  const hostMembership = await MembershipModel.findOne({ communityId: event.communityId, userId: actorId }).lean();
  const isHostManager = Boolean(hostMembership && hasCommunityPermission(hostMembership.role, 'COORDINATOR'));
  const partnerMembership = await MembershipModel.findOne({ communityId: partnership.communityId, userId: actorId }).lean();
  const isPartnerLeader = Boolean(partnerMembership && hasCommunityPermission(partnerMembership.role, 'VICE_PRESIDENT'));

  if (!isHostManager && !isPartnerLeader) {
    throw new Error('Insufficient permissions');
  }

  await partnership.deleteOne();
  return { removed: true };
}
