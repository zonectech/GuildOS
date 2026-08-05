import { PlatformSettingsModel } from '../models/platform-settings.model';
import { UserModel } from '../models/user.model';
import { MembershipModel } from '../models/membership.model';
import { EventModel } from '../models/event.model';
import { EventRegistrationModel } from '../models/event-registration.model';
import { CommunityModel } from '../models/community.model';
import { CommunityLeaderModel } from '../models/community-leader.model';
import { NotificationModel } from '../models/notification.model';
import { ReputationActivityModel } from '../models/reputation-activity.model';
import { ReputationScoreModel } from '../models/reputation-score.model';
import { createNotification } from './notification.service';
import { sendEmail, categoryEmail } from '../utils/email';
import { config } from '../config';

/**
 * Weekly digest email — "your week on GuildOS" — plus the session-end reminder
 * for community founders. Both run off schedulers in server.ts; both are safe to
 * call repeatedly (digest is gated by a persisted timestamp, reminders dedupe
 * against recent notifications).
 */

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
/** Re-send guard: a hair under 7 days so a scheduler tick never lands "just too early" forever. */
const DIGEST_MIN_GAP_MS = 6.5 * 24 * 60 * 60 * 1000;

function fmtDate(d: Date): string {
  return d.toLocaleString('en-NG', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' });
}

/**
 * One pass over all active, verified users. Each gets an email ONLY when there is
 * something real to say: events they're registered for happening in the next 7 days,
 * and/or fresh events published by communities they belong to. Silence beats spam.
 */
export async function sendWeeklyDigests(options?: { force?: boolean }) {
  // Persisted marker so restarts/multiple ticks can't double-send a week.
  const settings = await PlatformSettingsModel.findOneAndUpdate(
    { key: 'GLOBAL' },
    { $setOnInsert: { key: 'GLOBAL' } },
    { new: true, upsert: true },
  );
  const last = settings.lastWeeklyDigestAt ? new Date(settings.lastWeeklyDigestAt).getTime() : 0;
  if (!options?.force && Date.now() - last < DIGEST_MIN_GAP_MS) {
    return { sent: 0, skipped: true as const };
  }
  // Claim the window BEFORE sending — a crash mid-run means a thinner digest next week,
  // never a double-send.
  settings.lastWeeklyDigestAt = new Date();
  await settings.save();

  const now = new Date();
  const weekAhead = new Date(now.getTime() + WEEK_MS);
  const weekAgo = new Date(now.getTime() - WEEK_MS);

  const users = await UserModel.find({
    status: 'ACTIVE',
    deletedAt: null,
    emailVerified: true,
    role: { $in: ['STUDENT', 'COMMUNITY_LEADER'] },
    // Never mail test/seed fixtures — dev databases are full of @guildos.local /
    // @e2etest.local accounts, and attempting them just bounces spam back into
    // the real SMTP account's inbox.
    email: { $not: /@(.*\.local|example\.(com|org)|test\.local)$/i },
  })
    .select('_id fullName email')
    .lean();

  let sent = 0;
  for (const user of users) {
    try {
      const [registrations, memberships] = await Promise.all([
        EventRegistrationModel.find({ userId: user._id, status: { $in: ['CONFIRMED', 'CHECKED_IN'] } }).select('eventId').lean(),
        MembershipModel.find({ userId: user._id, status: 'ACTIVE' }).select('communityId').lean(),
      ]);

      const [upcoming, fresh] = await Promise.all([
        registrations.length
          ? EventModel.find({
              _id: { $in: registrations.map((r) => r.eventId) },
              deletedAt: null,
              status: { $in: ['PUBLISHED', 'CHECK_IN'] },
              startDate: { $gte: now, $lte: weekAhead },
            })
              .select('title slug startDate venue mode')
              .sort({ startDate: 1 })
              .limit(5)
              .lean()
          : [],
        memberships.length
          ? EventModel.find({
              communityId: { $in: memberships.map((m) => m.communityId) },
              deletedAt: null,
              status: 'PUBLISHED',
              createdAt: { $gte: weekAgo },
              startDate: { $gte: now },
              // Don't re-announce events they already hold a ticket for.
              _id: { $nin: registrations.map((r) => r.eventId) },
            })
              .select('title slug startDate venue mode')
              .sort({ startDate: 1 })
              .limit(5)
              .lean()
          : [],
      ]);

      if (!upcoming.length && !fresh.length) continue;

      // Guild Score movement this week — a sum of the activity ledger keeps the
      // digest honest even if the aggregate score was recomputed mid-week.
      const [weekActivities, score] = await Promise.all([
        ReputationActivityModel.find({ userId: user._id, createdAt: { $gte: weekAgo } })
          .select('scoreAwarded description')
          .sort({ createdAt: -1 })
          .limit(10)
          .lean(),
        ReputationScoreModel.findOne({ userId: user._id }).select('guildScore level').lean(),
      ]);
      const delta = weekActivities.reduce((sum, a) => sum + (a.scoreAwarded ?? 0), 0);

      const sections: string[] = [];
      if (upcoming.length) {
        sections.push(
          'Your events this week:\n' +
            upcoming.map((e) => `• ${e.title} — ${e.startDate ? fmtDate(new Date(e.startDate)) : 'TBA'}${e.venue ? ` @ ${e.venue}` : e.mode === 'VIRTUAL' ? ' (online)' : ''}`).join('\n'),
        );
      }
      if (fresh.length) {
        sections.push(
          'New from your communities:\n' +
            fresh.map((e) => `• ${e.title} — ${e.startDate ? fmtDate(new Date(e.startDate)) : 'TBA'} · ${config.frontendUrl}/events/${e.slug}`).join('\n'),
        );
      }
      if (delta > 0 && score) {
        const highlights = weekActivities
          .filter((a) => a.scoreAwarded > 0 && a.description)
          .slice(0, 3)
          .map((a) => `• +${a.scoreAwarded} — ${a.description}`);
        sections.push(
          `Guild Score: +${delta} this week → ${score.guildScore} (${score.level})` + (highlights.length ? `\n${highlights.join('\n')}` : ''),
        );
      }

      const template = categoryEmail('INFO', {
        name: user.fullName,
        subject: upcoming.length
          ? `Your week on GuildOS — ${upcoming.length} event${upcoming.length === 1 ? '' : 's'} coming up`
          : 'Your week on GuildOS — new events from your communities',
        heading: 'Your weekly GuildOS digest',
        message: sections.join('\n\n'),
        ctaLabel: 'Open my events',
        ctaUrl: `${config.frontendUrl}/my-events`,
        note: 'You get this at most once a week, and only when there is something happening.',
      });
      await sendEmail(user.email, template);
      sent += 1;
    } catch (error) {
      console.warn('[GuildOS] digest send failed for', user.email, error instanceof Error ? error.message : error);
    }
  }

  return { sent, skipped: false as const };
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

    const title = `${session} looks finished — dissolve it and issue certificates?`;
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
