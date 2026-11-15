import { CommunityModel } from '../models/community.model';
import { CommunityLeaderModel } from '../models/community-leader.model';
import { NotificationModel } from '../models/notification.model';
import { createNotification } from './notification.service';
import { sendRecommendationEmails } from './recommendation-email.service';

/** The existing scheduler now sends the opt-in event/community discovery email.
 * A force request never bypasses a student's seven-day frequency limit. */
export async function sendWeeklyDigests(_options?: { force?: boolean }) {
  return sendRecommendationEmails();
}

function parseSessionEndYear(label: string): number | null {
  const match = /^(\d{4})\/(\d{4})$/.exec(label.trim());
  return match ? Number(match[2]) : null;
}

/**
 * Year-end nudge: when a leadership session label's second year is well underway
 * (Aug 1 of the end year onward — Nigerian academic years wrap up by then), remind
 * the founder to dissolve it, issue certificates, and hand over. Dedupes by exact
 * notification title per 30 days, so it nags monthly at most.
 */
export async function remindFinishedLeaderSessions() {
  const now = new Date();
  const groups = await CommunityLeaderModel.aggregate<{ _id: { communityId: string; session: string } }>([
    { $match: { status: 'ACTIVE', session: { $ne: '' } } },
    { $group: { _id: { communityId: '$communityId', session: '$session' } } },
  ]);

  let reminded = 0;
  for (const group of groups) {
    const session = group._id.session;
    const endYear = parseSessionEndYear(session);
    if (!endYear) continue;
    if (now < new Date(endYear, 7, 1)) continue; // before Aug 1 of the end year → still current

    const community = await CommunityModel.findById(group._id.communityId).select('name slug founder archivedAt deletedAt').lean();
    if (!community || community.archivedAt) continue;

    const title = `${session} looks finished. Dissolve it and issue certificates?`;
    const founderId = community.founder?.toString() ?? '';
    if (!founderId) continue;

    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const already = await NotificationModel.findOne({ userId: founderId, title, createdAt: { $gte: monthAgo } }).select('_id').lean();
    if (already) continue;

    await createNotification({
      userId: founderId,
      type: 'SYSTEM',
      title,
      body: `The ${session} leadership session of ${community.name} appears to have ended. Dissolve it to move the outgoing excos to Past Leadership, issue their end-of-term certificates, and hand management to the new session.`,
      link: `/communities/${community.slug}/leaders`,
    });
    reminded += 1;
  }

  return { reminded };
}
