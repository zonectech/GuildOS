/**
 * Live test: organizer/attendee tools wave.
 *   1. Waitlist promotion notifies the promoted attendee
 *   2. messageEventAttendees reaches every active registrant (bell)
 *   3. Ticket transfer: recipient gets the seat + fresh QR, buyer loses it, coverage follows
 *   4. Transfer blocked after check-in
 *   5. INVITE policy: register blocked without token, works with the link token
 *   6. Invite token regeneration kills the old link
 *   7. Bookmarks: toggle on/off + saved list
 *
 * Run: npx tsx --env-file=.env live-test-features.ts (no HTTP server needed)
 */
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { connectDatabase } from './src/db';
import { UserModel } from './src/models/user.model';
import { CommunityModel } from './src/models/community.model';
import { MembershipModel } from './src/models/membership.model';
import { EventModel } from './src/models/event.model';
import { EventRegistrationModel } from './src/models/event-registration.model';
import { TicketPaymentModel } from './src/models/ticket-payment.model';
import { EventBookmarkModel } from './src/models/event-bookmark.model';
import { NotificationModel } from './src/models/notification.model';
import {
  registerForEvent,
  cancelRegistration,
  messageEventAttendees,
  toggleEventBookmark,
  listMyBookmarkedEvents,
} from './src/services/event/event-registration.service';
import { fulfilTicket, transferTicket } from './src/services/event/event-ticket.service';
import { getEventInviteLink } from './src/services/event/event-core.service';
import { checkInRegistration } from './src/services/event/event-attendance.service';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) { passed += 1; console.log(`  \x1b[32mPASS\x1b[0m  ${name}`); }
  else { failed += 1; console.log(`  \x1b[31mFAIL\x1b[0m  ${name}${detail !== undefined ? `  ->  ${JSON.stringify(detail)}` : ''}`); }
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  await connectDatabase();
  const stamp = Date.now();
  const rnd = crypto.randomBytes(6).toString('hex');
  const mkUser = (name: string, tag: string) => UserModel.create({
    fullName: name, email: `${tag}-${rnd}@e2etest.local`, passwordHash: rnd, passwordSalt: rnd,
    role: 'STUDENT', status: 'ACTIVE', emailVerified: true, profile: { username: `${tag}_${rnd}`, university: 'Feature U' },
  } as any);
  const founder = await mkUser('FT Founder', 'ftf');
  const attA = await mkUser('FT AttendeeA', 'fta');
  const attB = await mkUser('FT AttendeeB', 'ftb');
  const attC = await mkUser('FT AttendeeC', 'ftc');
  const users = [founder, attA, attB, attC];
  const community = await CommunityModel.create({
    name: `Feature Guild ${stamp}`, normalizedName: `feature guild ${stamp}`, slug: `feature-${stamp}`,
    shortDescription: 'x', logo: '/uploads/demo-org-logo.svg', coverImage: '/uploads/smoke-cover.png',
    category: 'TECH', university: 'Feature U', visibility: 'PUBLIC',
    verificationStatus: 'VERIFIED', verificationMethod: 'MANUAL', verifiedBy: founder._id, verifiedAt: new Date(),
    founder: founder._id, memberCount: 1,
  });
  await MembershipModel.create({ userId: founder._id, communityId: community._id, role: 'FOUNDER', status: 'ACTIVE', assignedBy: founder._id });

  const mkEvent = (extra: Record<string, unknown>) => EventModel.create({
    communityId: community._id, createdBy: founder._id, status: 'PUBLISHED',
    shortDescription: 'x', mode: 'PHYSICAL', venue: 'Hall', bannerImage: '/uploads/smoke-banner.png',
    registrationPolicy: 'OPEN', startDate: new Date(Date.now() + 3600_000), endDate: new Date(Date.now() + 2 * 3600_000),
    ...extra,
  } as any);

  const capEvent = await mkEvent({ title: `FT Capacity ${stamp}`, slug: `ft-cap-${stamp}`, capacity: 1, waitlistEnabled: true });
  const paidEvent = await mkEvent({ title: `FT Paid ${stamp}`, slug: `ft-paid-${stamp}`, ticketPrice: 1000 });
  const inviteEvent = await mkEvent({ title: `FT Invite ${stamp}`, slug: `ft-invite-${stamp}`, registrationPolicy: 'INVITE' });
  const events = [capEvent, paidEvent, inviteEvent];

  try {
    // ── 1. waitlist promotion notification ─────────────────────
    await registerForEvent(capEvent._id.toString(), attA._id.toString());
    const waitReg = await registerForEvent(capEvent._id.toString(), attB._id.toString());
    check('second registrant waitlisted (capacity 1)', waitReg.status === 'WAITLISTED', waitReg.status);
    await cancelRegistration(capEvent._id.toString(), attA._id.toString());
    const promoted = await EventRegistrationModel.findOne({ eventId: capEvent._id, userId: attB._id }).lean();
    check('waitlisted attendee promoted to CONFIRMED', promoted?.status === 'CONFIRMED', promoted?.status);
    await wait(300); // fire-and-forget bell
    const promoBell = await NotificationModel.findOne({ userId: attB._id, title: { $regex: 'spot opened up' } }).lean();
    check('promoted attendee got the bell', !!promoBell, promoBell?.title);

    // ── 2. message attendees ───────────────────────────────────
    const blast = await messageEventAttendees(capEvent._id.toString(), founder._id.toString(), {
      subject: 'Bring your laptop', message: 'Hands-on session tomorrow — come with a charged laptop.',
    });
    check('blast reaches active registrants only', blast.notified === 1, blast);
    await wait(300);
    const blastBell = await NotificationModel.findOne({ userId: attB._id, title: { $regex: 'Bring your laptop' } }).lean();
    check('registrant got the message bell', !!blastBell && String(blastBell.body).includes('charged laptop'), blastBell?.title);

    // ── 3. ticket transfer ─────────────────────────────────────
    const payment = await TicketPaymentModel.create({
      eventId: paidEvent._id, communityId: community._id, userId: attA._id, provider: 'FLUTTERWAVE',
      reference: `TKT-FT-${rnd}`, tierName: '', promoCode: '', quantity: 1,
      amount: 100000, baseAmount: 100000, feeAmount: 0, commissionAmount: 10000, organizerAmount: 90000,
      currency: 'NGN', status: 'PENDING',
    });
    const buyerReg = await fulfilTicket(payment);
    payment.status = 'PAID';
    payment.registrationId = buyerReg._id;
    payment.paidAt = new Date();
    await payment.save();
    const oldQr = buyerReg.qrToken;

    const transfer = await transferTicket(paidEvent._id.toString(), attA._id.toString(), attB.email);
    check('transfer succeeds to recipient by email', transfer.transferred && transfer.to.fullName === 'FT AttendeeB', transfer);
    const moved = await EventRegistrationModel.findById(buyerReg._id).lean();
    check('registration now belongs to recipient with a FRESH QR', String(moved?.userId) === String(attB._id) && moved?.qrToken !== oldQr, { user: String(moved?.userId), qrChanged: moved?.qrToken !== oldQr });
    const buyerHas = await EventRegistrationModel.findOne({ eventId: paidEvent._id, userId: attA._id }).lean();
    check('buyer no longer holds a registration', !buyerHas, buyerHas?.status);
    await wait(300);
    const transferBell = await NotificationModel.findOne({ userId: attB._id, title: { $regex: 'transferred you a ticket' } }).lean();
    check('recipient got the transfer bell', !!transferBell, transferBell?.title);

    // 4. transfer blocked after check-in
    await EventModel.updateOne({ _id: paidEvent._id }, { $set: { status: 'CHECK_IN', startDate: new Date() } });
    await checkInRegistration(paidEvent._id.toString(), String(moved!._id), founder._id.toString());
    let usedBlocked = '';
    try { await transferTicket(paidEvent._id.toString(), attB._id.toString(), attC.email); } catch (err) { usedBlocked = err instanceof Error ? err.message : 'x'; }
    check('transfer blocked once the ticket was used', usedBlocked.includes('already been used'), usedBlocked);

    // ── 5. invite-only flow ────────────────────────────────────
    let noToken = '';
    try { await registerForEvent(inviteEvent._id.toString(), attC._id.toString()); } catch (err) { noToken = err instanceof Error ? err.message : 'x'; }
    check('INVITE event blocks registration without a token', noToken.includes('invite'), noToken);
    const { inviteToken } = await getEventInviteLink(inviteEvent._id.toString(), founder._id.toString());
    check('organizer can mint an invite token', inviteToken.startsWith('INV-'), inviteToken.slice(0, 8));
    const invited = await registerForEvent(inviteEvent._id.toString(), attC._id.toString(), { inviteToken });
    check('registration works with the invite token', invited.status === 'CONFIRMED', invited.status);

    // 6. regeneration kills the old link
    const { inviteToken: fresh } = await getEventInviteLink(inviteEvent._id.toString(), founder._id.toString(), true);
    check('regenerated token differs', fresh !== inviteToken);
    let staleBlocked = '';
    try { await registerForEvent(inviteEvent._id.toString(), attA._id.toString(), { inviteToken }); } catch (err) { staleBlocked = err instanceof Error ? err.message : 'x'; }
    check('old token no longer works', staleBlocked.includes('invite'), staleBlocked);

    // ── 7. bookmarks ───────────────────────────────────────────
    const on = await toggleEventBookmark(capEvent._id.toString(), attC._id.toString());
    const saved = await listMyBookmarkedEvents(attC._id.toString());
    const off = await toggleEventBookmark(capEvent._id.toString(), attC._id.toString());
    const savedAfter = await listMyBookmarkedEvents(attC._id.toString());
    check('bookmark toggles on, lists, toggles off', on.bookmarked && saved.length === 1 && !off.bookmarked && savedAfter.length === 0, { on, count: saved.length, off, after: savedAfter.length });
  } catch (err) {
    failed += 1;
    console.error('  TEST ERROR:', err instanceof Error ? err.message : err);
  } finally {
    console.log(`\n=== ${passed} passed, ${failed} failed ===`);
    const eventIds = events.map((e) => e._id);
    await NotificationModel.deleteMany({ userId: { $in: users.map((u) => u._id) } });
    await TicketPaymentModel.deleteMany({ eventId: { $in: eventIds } });
    await EventRegistrationModel.deleteMany({ eventId: { $in: eventIds } });
    await EventBookmarkModel.deleteMany({ eventId: { $in: eventIds } });
    await EventModel.deleteMany({ _id: { $in: eventIds } });
    await MembershipModel.deleteMany({ communityId: community._id });
    await CommunityModel.deleteOne({ _id: community._id });
    await UserModel.deleteMany({ _id: { $in: users.map((u) => u._id) } });
    await mongoose.disconnect();
    process.exit(failed ? 1 : 0);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
