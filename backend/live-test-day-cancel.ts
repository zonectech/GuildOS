/**
 * Live test: per-day cancellation + day-scoped tickets.
 *
 *   1. Day-2-only ticket refunded (or queued) when Day 2 is cancelled
 *   2. Whole-event ticket untouched by a day cancellation
 *   3. Planned attendees notified with the reason
 *   4. Agenda day flagged cancelled + note stored
 *   5. Cancelling every remaining day is blocked
 *   6. Quote marks the dead tier unavailable; checkout refuses it
 *   7. Scanner blocks a Day-3-only pass on Day 1
 *   8. Full pass checks in fine on Day 1; check-in blocked on a cancelled day
 *
 * Run: npx tsx --env-file=.env live-test-day-cancel.ts   (backend server NOT required)
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
import { NotificationModel } from './src/models/notification.model';
import { cancelEventDays } from './src/services/event/event-core.service';
import { fulfilTicket, getTicketQuote, startTicketCheckout } from './src/services/event/event-ticket.service';
import { checkInRegistration } from './src/services/event/event-attendance.service';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) { passed += 1; console.log(`  \x1b[32mPASS\x1b[0m  ${name}`); }
  else { failed += 1; console.log(`  \x1b[31mFAIL\x1b[0m  ${name}${detail !== undefined ? `  ->  ${JSON.stringify(detail)}` : ''}`); }
}

async function main() {
  await connectDatabase();
  const stamp = Date.now();
  const rnd = crypto.randomBytes(6).toString('hex');
  const mkUser = (name: string, tag: string) => UserModel.create({
    fullName: name, email: `${tag}-${rnd}@e2etest.local`, passwordHash: rnd, passwordSalt: rnd,
    role: 'STUDENT', status: 'ACTIVE', emailVerified: true, profile: { username: `${tag}_${rnd}`, university: 'DayCancel U' },
  } as any);
  const founder = await mkUser('DC Founder', 'dcf');
  const fullBuyer = await mkUser('DC FullPass', 'dca');
  const day2Buyer = await mkUser('DC DayTwo', 'dcb');
  const day3Buyer = await mkUser('DC DayThree', 'dcd');
  const freeGuest = await mkUser('DC FreeGuest', 'dcc');
  const community = await CommunityModel.create({
    name: `DayCancel Guild ${stamp}`, normalizedName: `daycancel guild ${stamp}`, slug: `daycancel-${stamp}`,
    shortDescription: 'x', logo: '/uploads/demo-org-logo.svg', coverImage: '/uploads/smoke-cover.png',
    category: 'TECH', university: 'DayCancel U', visibility: 'PUBLIC',
    verificationStatus: 'VERIFIED', verificationMethod: 'MANUAL', verifiedBy: founder._id, verifiedAt: new Date(),
    founder: founder._id, memberCount: 1,
  });
  await MembershipModel.create({ userId: founder._id, communityId: community._id, role: 'FOUNDER', status: 'ACTIVE', assignedBy: founder._id });

  const midnightToday = new Date(new Date().toISOString().slice(0, 10));
  const dayAt = (offset: number) => new Date(midnightToday.getTime() + offset * 86400000);
  const event = await EventModel.create({
    communityId: community._id, createdBy: founder._id, slug: `daycancel-ev-${stamp}`, status: 'PUBLISHED',
    title: `DayCancel Fest ${stamp}`, shortDescription: 'x', mode: 'PHYSICAL', venue: 'Main Hall',
    bannerImage: '/uploads/smoke-banner.png', registrationPolicy: 'OPEN', timezone: 'UTC',
    startDate: new Date(), endDate: dayAt(2.9),
    days: [
      { date: dayAt(0), theme: 'Opening' },
      { date: dayAt(1), theme: 'Deep dive' },
      { date: dayAt(2), theme: 'Finale' },
    ],
    ticketPrice: 1000,
    ticketTiers: [
      { name: 'Full pass', price: 1000, capacity: 0, days: [] },
      { name: 'Day 2 only', price: 500, capacity: 0, days: [2] },
      { name: 'Day 3 only', price: 500, capacity: 0, days: [3] },
    ],
  } as any);
  const eventId = event._id.toString();

  // Synthetic PAID purchases (stand-in for the gateway, mirrors simulate-ticket-payment.ts).
  async function buy(userId: mongoose.Types.ObjectId, tierName: string) {
    const payment = await TicketPaymentModel.create({
      eventId: event._id, communityId: community._id, userId, provider: 'FLUTTERWAVE',
      reference: `TKT-TEST-${crypto.randomBytes(6).toString('hex')}`, tierName, promoCode: '', quantity: 1,
      amount: 50000, baseAmount: 50000, feeAmount: 0, commissionAmount: 5000, organizerAmount: 45000,
      currency: 'NGN', status: 'PENDING',
    });
    const registration = await fulfilTicket(payment);
    payment.status = 'PAID';
    payment.paidAt = new Date();
    payment.registrationId = registration._id;
    await payment.save();
    return { payment, registration };
  }

  try {
    const full = await buy(fullBuyer._id, 'Full pass');
    const d2 = await buy(day2Buyer._id, 'Day 2 only');
    const d3 = await buy(day3Buyer._id, 'Day 3 only');
    // A fourth attendee with a full pass who told the organizers they're only coming Day 2.
    const guest = await buy(freeGuest._id, 'Full pass');
    await EventRegistrationModel.updateOne({ _id: guest.registration._id }, { $set: { plannedDays: [2] } });

    // ── cancel Day 2 ─────────────────────────────────────────────
    const result = await cancelEventDays(eventId, founder._id.toString(), [2], 'The guest speaker had to withdraw.');
    check('day 2 flagged cancelled + note stored', result.event.days[1].cancelled === true && result.event.days[1].cancellationNote.includes('withdraw'));

    const d2After = await TicketPaymentModel.findById(d2.payment._id).lean();
    check('Day-2-only ticket refunded or queued', ['REFUNDED', 'REFUND_DUE'].includes(d2After?.status ?? ''), d2After?.status);
    const d2Reg = await EventRegistrationModel.findById(d2.registration._id).lean();
    check('Day-2-only registration cancelled', d2Reg?.status === 'CANCELLED', d2Reg?.status);

    const fullAfter = await TicketPaymentModel.findById(full.payment._id).lean();
    const fullReg = await EventRegistrationModel.findById(full.registration._id).lean();
    check('Full pass NOT refunded, registration intact', fullAfter?.status === 'PAID' && fullReg?.status === 'CONFIRMED', { pay: fullAfter?.status, reg: fullReg?.status });
    const d3After = await TicketPaymentModel.findById(d3.payment._id).lean();
    check('Day-3-only ticket untouched', d3After?.status === 'PAID', d3After?.status);

    const bell = await NotificationModel.findOne({ userId: freeGuest._id, title: { $regex: '^Day 2 of DayCancel Fest' } }).lean();
    check('planned attendee got the day-cancel bell with reason', !!bell && String(bell.body).includes('withdraw'), bell?.title);
    check('notified count covers planners + default-all attendees', result.notified >= 2, result.notified);

    // ── availability guards ──────────────────────────────────────
    const quote = await getTicketQuote(eventId, {});
    const deadTier = quote.tiers.find((t) => t.name === 'Day 2 only');
    check('quote marks Day-2 tier unavailable', deadTier?.soldOut === true && (deadTier as any)?.dayCancelled === true, deadTier);
    let checkoutBlocked = '';
    // day2Buyer's registration was cancelled by the refund — they can attempt a re-buy.
    try { await startTicketCheckout(eventId, day2Buyer._id.toString(), { tierName: 'Day 2 only' }); } catch (err) { checkoutBlocked = err instanceof Error ? err.message : 'x'; }
    check('checkout refuses the dead tier', checkoutBlocked.includes('cancelled'), checkoutBlocked);

    let allBlocked = '';
    try { await cancelEventDays(eventId, founder._id.toString(), [1, 3], 'everything is off'); } catch (err) { allBlocked = err instanceof Error ? err.message : 'x'; }
    check('cancelling every remaining day is blocked', allBlocked.includes('whole event'), allBlocked);

    // ── check-in enforcement (today = Day 1) ─────────────────────
    await EventModel.updateOne({ _id: event._id }, { $set: { status: 'CHECK_IN' } });
    let coverageBlocked = '';
    try { await checkInRegistration(eventId, d3.registration._id.toString(), founder._id.toString()); } catch (err) { coverageBlocked = err instanceof Error ? err.message : 'x'; }
    check('Day-3-only pass rejected on Day 1', coverageBlocked.includes('only valid on day 3'), coverageBlocked);
    const fullCheckin = await checkInRegistration(eventId, full.registration._id.toString(), founder._id.toString());
    check('Full pass checks in fine on Day 1', ['CHECKED_IN'].includes(fullCheckin.status), fullCheckin.status);

    // Cancelled-day gate: flip Day 1 to cancelled and try the Day-3 holder again.
    await EventModel.updateOne({ _id: event._id }, { $set: { 'days.0.cancelled': true } });
    let dayBlocked = '';
    try { await checkInRegistration(eventId, d3.registration._id.toString(), founder._id.toString()); } catch (err) { dayBlocked = err instanceof Error ? err.message : 'x'; }
    check('check-in blocked on a cancelled day', dayBlocked.includes('cancelled'), dayBlocked);
  } catch (err) {
    failed += 1;
    console.error('  TEST ERROR:', err instanceof Error ? err.message : err);
  } finally {
    console.log(`\n=== ${passed} passed, ${failed} failed ===`);
    await NotificationModel.deleteMany({ userId: { $in: [fullBuyer._id, day2Buyer._id, day3Buyer._id, freeGuest._id, founder._id] } });
    await TicketPaymentModel.deleteMany({ eventId: event._id });
    await EventRegistrationModel.deleteMany({ eventId: event._id });
    await EventModel.deleteOne({ _id: event._id });
    await MembershipModel.deleteMany({ communityId: community._id });
    await CommunityModel.deleteOne({ _id: community._id });
    await UserModel.deleteMany({ _id: { $in: [founder._id, fullBuyer._id, day2Buyer._id, day3Buyer._id, freeGuest._id] } });
    await mongoose.disconnect();
    process.exit(failed ? 1 : 0);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
