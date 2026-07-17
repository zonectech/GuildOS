import { CommunityModel } from '../models/community.model';
import { MembershipModel } from '../models/membership.model';
import { config } from '../config';
import { hasCommunityPermission } from './community.service';
import { createNotification } from './notification.service';
import { authStore } from '../store/auth-store';
import { sendEmail, categoryEmail } from '../utils/email';

/**
 * Official community announcement: senior leaders (VP+) broadcast to every
 * active member as an in-app notification and (optionally) a branded email —
 * the feature that replaces "important message lost in the WhatsApp scroll".
 */
export async function sendCommunityAnnouncement(input: {
  communityId: string;
  actorId: string;
  title: string;
  body: string;
  emailToo?: boolean;
}) {
  const community = await CommunityModel.findById(input.communityId).select('name slug archivedAt').lean();
  if (!community || community.archivedAt) {
    throw new Error('Community not found');
  }

  const membership = await MembershipModel.findOne({ communityId: input.communityId, userId: input.actorId });
  if (!membership || !hasCommunityPermission(membership.role, 'VICE_PRESIDENT')) {
    throw new Error('Only senior leaders can send announcements');
  }

  const title = input.title.trim().slice(0, 120);
  const body = input.body.trim().slice(0, 2000);
  if (!title || !body) {
    throw new Error('A title and message are required');
  }

  const members = await MembershipModel.find({
    communityId: input.communityId,
    status: 'ACTIVE',
    userId: { $ne: input.actorId },
  })
    .select('userId')
    .lean();

  let notified = 0;
  let emailed = 0;

  for (const member of members) {
    await createNotification({
      userId: member.userId.toString(),
      actorId: input.actorId,
      type: 'SYSTEM',
        title: `${community.name}: ${title}`,
      body: body.slice(0, 200),
      link: `/communities/${community.slug}`,
    }).catch(() => undefined);
    notified += 1;
  }

  if (input.emailToo) {
    const sends = members.map(async (member) => {
      const user = await authStore.getPublicUserById(member.userId.toString()).catch(() => null);
      if (!user?.email) return false;
      await sendEmail(
        user.email,
        categoryEmail('INFO', {
          name: user.fullName,
          subject: `${community.name}: ${title}`,
          heading: title,
          message: body,
          ctaLabel: 'Open community',
          ctaUrl: `${config.frontendUrl}/communities/${community.slug}`,
          note: `Announcement from ${community.name} via GuildOS`,
        }),
      );
      return true;
    });
    const results = await Promise.allSettled(sends);
    emailed = results.filter((r) => r.status === 'fulfilled' && r.value === true).length;
  }

  return { recipients: members.length, notified, emailed };
}
