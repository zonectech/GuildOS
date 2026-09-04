import { EventModel } from '../models/event.model';
import { CommunityModel } from '../models/community.model';
import { SponsorshipInquiryModel } from '../models/sponsorship-inquiry.model';
import { SponsorshipPaymentModel } from '../models/sponsorship-payment.model';
import { PostModel } from '../models/post.model';
import { sendEmail, categoryEmail } from '../utils/email';

/**
 * Event cancelled → the auto-published sponsor thank-you posts stop being true
 * (the deals were unwound/refunded), so hide them from the feed. Announcements
 * are identified by their "View event" CTA link; hiding (not deleting) keeps an
 * audit trail and automatically drops them from sponsor-report reach stats.
 */
export async function hideSponsorAnnouncementPosts(eventId: string) {
  const event = await EventModel.findById(eventId).select('slug communityId').lean();
  if (!event) return { hidden: 0 };
  const result = await PostModel.updateMany(
    { communityId: event.communityId, authorType: 'COMMUNITY', 'cta.url': `/events/${event.slug}`, hiddenAt: null },
    { hiddenAt: new Date(), hiddenReason: 'Event cancelled — sponsorship announcement withdrawn' },
  );
  return { hidden: result.modifiedCount ?? 0 };
}

/**
 * One deal fell through (revoked) → hide only THAT sponsor's thank-you post,
 * identified by the "Sponsored by <company>" CTA title. Other sponsors' posts stay.
 */
export async function hideSponsorAnnouncementPostsForSponsor(eventId: string, companyName: string) {
  const event = await EventModel.findById(eventId).select('slug communityId').lean();
  if (!event) return { hidden: 0 };
  const result = await PostModel.updateMany(
    {
      communityId: event.communityId,
      authorType: 'COMMUNITY',
      'cta.url': `/events/${event.slug}`,
      'cta.title': `Sponsored by ${companyName}`,
      hiddenAt: null,
    },
    { hiddenAt: new Date(), hiddenReason: 'Sponsorship deal revoked — announcement withdrawn' },
  );
  return { hidden: result.modifiedCount ?? 0 };
}

/**
 * Event cancelled → tell everyone in the sponsorship pipeline. Deals paid THROUGH
 * GuildOS (SPN- payments) are refunded automatically, so those sponsors get a
 * "your payment is being refunded" message; off-platform WON deals get a "settle
 * any payments with the organizers directly" warning with the organizer contacts;
 * open inquiries (NEW/CONTACTED) get a simple "no longer proceeding" note.
 * Deduped per email; best-effort (never breaks the cancel).
 *
 * Lives in its own module (models + email only) so the event cancel flows can import it
 * without creating a service-import cycle with the sponsorship service.
 */
export async function notifySponsorshipEventCancelled(eventId: string, reason: string) {
  const event = await EventModel.findById(eventId).select('title contacts communityId').lean();
  if (!event) return { notified: 0 };

  const inquiries = await SponsorshipInquiryModel.find({ eventId, status: { $in: ['NEW', 'CONTACTED', 'WON'] } })
    .select('email contactName companyName status packageWon')
    .lean();
  if (!inquiries.length) return { notified: 0 };

  // Deals paid through the platform are auto-refunded by the cancel flow — their
  // message must say so instead of pointing the sponsor at the organizers.
  const platformPayments = await SponsorshipPaymentModel.find({ eventId, status: { $in: ['PAID', 'REFUNDED', 'REFUND_DUE'] } })
    .select('inquiryId')
    .lean();
  const paidInquiryIds = new Set(platformPayments.map((p) => p.inquiryId.toString()));

  const community = await CommunityModel.findById(event.communityId).select('name').lean();
  const organizerLines = (event.contacts ?? [])
    .filter((c) => c.name && (c.phone || c.email))
    .map((c) => `${c.name}${c.phone ? ` — ${c.phone}` : ''}${c.email ? ` — ${c.email}` : ''}`);
  const contactBlock = organizerLines.length
    ? `Organizer contacts:\n${organizerLines.join('\n')}`
    : `The organizers (${community?.name ?? 'the host community'}) can be reached through their community page on GuildOS.`;

  // One email per address; WON status wins when the same sponsor has several inquiries.
  const byEmail = new Map<string, (typeof inquiries)[number]>();
  for (const inquiry of inquiries) {
    const existing = byEmail.get(inquiry.email);
    if (!existing || (inquiry.status === 'WON' && existing.status !== 'WON')) byEmail.set(inquiry.email, inquiry);
  }

  let notified = 0;
  for (const inquiry of byEmail.values()) {
    const won = inquiry.status === 'WON';
    const paidViaPlatform = paidInquiryIds.has(inquiry._id.toString());
    const template = categoryEmail('WARNING', {
      name: inquiry.contactName || inquiry.companyName,
      subject: `Event cancelled: ${event.title}`,
      heading: `${event.title} has been cancelled`,
      message: paidViaPlatform
        ? `The event you are sponsoring${inquiry.packageWon ? ` (${inquiry.packageWon} package)` : ''} has been cancelled by the organizers.\n\nReason: ${reason}\n\nYou paid through GuildOS, so your sponsorship payment is refunded automatically to your original payment method — you will receive a separate refund confirmation, and depending on your bank it may take a few days to reflect. No action is needed from you.`
        : won
          ? `The event you are sponsoring${inquiry.packageWon ? ` (${inquiry.packageWon} package)` : ''} has been cancelled by the organizers.\n\nReason: ${reason}\n\nSponsorship agreements and payments are settled directly between you and the organizers — if you have already made any payment or commitment, please contact them to arrange a refund or to move your sponsorship to a future event.\n\n${contactBlock}`
          : `The event you inquired about sponsoring has been cancelled by the organizers, so your sponsorship inquiry will not be proceeding.\n\nReason: ${reason}\n\nNo payment was collected through GuildOS. If you would like to support this community's future events, keep an eye on their page.`,
      note: paidViaPlatform
        ? 'Payments made through GuildOS are refund-protected — cancellations are refunded automatically.'
        : 'GuildOS does not hold off-platform sponsorship funds — those deals are settled directly with event organizers.',
    });
    try {
      await sendEmail(inquiry.email, template);
      notified += 1;
    } catch {
      /* best-effort — a bad address must not break the cancel flow */
    }
  }
  return { notified };
}
