import { EventModel } from '../models/event.model';
import { CommunityModel } from '../models/community.model';
import { SponsorshipInquiryModel } from '../models/sponsorship-inquiry.model';
import { sendEmail, categoryEmail } from '../utils/email';

/**
 * Event cancelled → tell everyone in the sponsorship pipeline. Sponsorship money moves
 * OFF-platform (the sponsor pays the organizers directly; GuildOS only remits its fee),
 * so there is nothing for GuildOS to refund — but sponsors must not find out from a dead
 * event page. WON sponsors get a "settle any payments with the organizers directly"
 * warning with the organizer contacts; open inquiries (NEW/CONTACTED) get a simple
 * "no longer proceeding" note. Deduped per email; best-effort (never breaks the cancel).
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
    const template = categoryEmail('WARNING', {
      name: inquiry.contactName || inquiry.companyName,
      subject: `Event cancelled: ${event.title}`,
      heading: `${event.title} has been cancelled`,
      message: won
        ? `The event you are sponsoring${inquiry.packageWon ? ` (${inquiry.packageWon} package)` : ''} has been cancelled by the organizers.\n\nReason: ${reason}\n\nSponsorship agreements and payments are settled directly between you and the organizers — if you have already made any payment or commitment, please contact them to arrange a refund or to move your sponsorship to a future event.\n\n${contactBlock}`
        : `The event you inquired about sponsoring has been cancelled by the organizers, so your sponsorship inquiry will not be proceeding.\n\nReason: ${reason}\n\nNo payment was collected through GuildOS. If you would like to support this community's future events, keep an eye on their page.`,
      note: 'GuildOS does not hold sponsorship funds — deals are settled directly with event organizers.',
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
