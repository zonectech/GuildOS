/* One-off: verify post-event follow-ups — rate-this-event nudge + organizer wrap-up.
 * Fixture: throwaway organizer + 3 attendees (completed / already-rated / no-show),
 * one PAID ticket payment, one feedback row. Runs the two notifiers, checks bells +
 * one-time stamps, re-runs to prove dedupe, cleans up everything. */
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { connectDatabase } from './src/db';
import { UserModel } from './src/models/user.model';
import { EventModel } from './src/models/event.model';
import { EventRegistrationModel } from './src/models/event-registration.model';
import { EventFeedbackModel } from './src/models/event-feedback.model';
import { TicketPaymentModel } from './src/models/ticket-payment.model';
import { NotificationModel } from './src/models/notification.model';
import { notifyRateEventRequest, notifyOrganizerWrapUp } from './src/services/event-notification.service';

let passed = 0; let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) { passed += 1; console.log(`  \x1b[32mPASS\x1b[0m  ${name}`); }
  else { failed += 1; console.log(`  \x1b[31mFAIL\x1b[0m  ${name}${detail !== undefined ? `  ->  ${JSON.stringify(detail)}` : ''}`); }
}

async function main() {
  await connectDatabase();
  // stale runs: purge leftovers from prior crashes
  const stale = await EventModel.find({ slug: /^wrapup-/ }).select('_id').lean();
  if (stale.length) {
    const staleIds = stale.map((e) => e._id);
    await Promise.all([
      TicketPaymentModel.deleteMany({ eventId: { $in: staleIds } }),
      EventFeedbackModel.deleteMany({ eventId: { $in: staleIds } }),
      EventRegistrationModel.deleteMany({ eventId: { $in: staleIds } }),
      EventModel.deleteMany({ _id: { $in: staleIds } }),
      UserModel.deleteMany({ email: /^(wro|wrc|wrr|wrn)-.*@e2etest\.local$/ }),
    ]);
    console.log(`purged ${stale.length} stale fixture event(s)`);
  }
  const stamp = Date.now();
  const rnd = crypto.randomBytes(6).toString('hex');
  const mkUser = (name: string, tag: string) => UserModel.create({
    fullName: name, email: `${tag}-${rnd}@e2etest.local`, passwordHash: rnd, passwordSalt: rnd,
    emailVerified: true, status: 'ACTIVE', role: 'STUDENT',
  } as any);
  const organizer = await mkUser('Wrap Organizer', 'wro');
  const completed = await mkUser('Wrap Completed', 'wrc');
  const rated = await mkUser('Wrap Rated', 'wrr');
  const noShow = await mkUser('Wrap NoShow', 'wrn');

  const event = await EventModel.create({
    communityId: new mongoose.Types.ObjectId(), // throwaway — notifiers never dereference it
    createdBy: organizer._id, slug: `wrapup-${stamp}`, status: 'COMPLETED',
    title: `Wrapup Test Event ${stamp}`, shortDescription: 'x', mode: 'PHYSICAL', venue: 'Hall W',
    bannerImage: '/uploads/smoke-banner.png', registrationPolicy: 'OPEN', ticketPrice: 1000,
    startDate: new Date(stamp - 2 * 86400_000), endDate: new Date(stamp - 86400_000),
  } as any);
  const eventId = event._id.toString();

  const mkReg = (userId: unknown, status: string, checkInAt: Date | null) => EventRegistrationModel.create({
    eventId: event._id, userId, status, checkInAt, qrToken: crypto.randomUUID(),
  } as any);
  await mkReg(completed._id, 'COMPLETED', new Date(stamp - 86400_000));
  await mkReg(rated._id, 'COMPLETED', new Date(stamp - 86400_000));
  await mkReg(noShow._id, 'NO_SHOW', null);
  await EventFeedbackModel.create({ eventId: event._id, userId: rated._id, rating: 4, comment: 'good' } as any);
  await TicketPaymentModel.create({
    eventId: event._id, communityId: event.communityId, userId: completed._id, reference: `TKT-wrap-${rnd}`, provider: 'FLUTTERWAVE',
    status: 'PAID', paidAt: new Date(), quantity: 2, amount: 210_000, baseAmount: 200_000,
    feeAmount: 10_000, commissionAmount: 10_000, organizerAmount: 190_000, currency: 'NGN',
  } as any);

  try {
    // ── first run: nudge + wrap-up fire ──────────────────────────────
    const nudge = await notifyRateEventRequest(eventId);
    check('rate nudge sent to exactly the un-rated attendee', nudge.nudged === 1, nudge);
    const wrap = await notifyOrganizerWrapUp(eventId);
    check('organizer wrap-up sent', wrap.sent === true, wrap);

    const nudgeBell = await NotificationModel.findOne({ userId: completed._id, title: /How was/ }).lean();
    check('attendee got the rate bell', Boolean(nudgeBell), nudgeBell?.title);
    const ratedBell = await NotificationModel.findOne({ userId: rated._id, title: /How was/ }).lean();
    check('already-rated attendee NOT nudged', !ratedBell);
    const noShowBell = await NotificationModel.findOne({ userId: noShow._id, title: /How was/ }).lean();
    check('no-show NOT nudged', !noShowBell);

    const wrapBell = await NotificationModel.findOne({ userId: organizer._id, title: /Wrap-up/ }).lean();
    check('organizer got the wrap-up bell', Boolean(wrapBell), wrapBell?.title);
    check('wrap-up bell shows attendance', Boolean(wrapBell?.title.includes('2 attended (67%)')), wrapBell?.title);
    check('wrap-up bell shows earnings ₦1,900', Boolean(wrapBell?.body?.includes('1,900')), wrapBell?.body);
    check('wrap-up links to attendees page', Boolean(wrapBell?.link?.includes(`eventId=${eventId}`)), wrapBell?.link);

    const stamped = await EventModel.findById(eventId).select('ratingNudgeSentAt organizerSummarySentAt').lean();
    check('both one-time stamps set', Boolean(stamped?.ratingNudgeSentAt && stamped?.organizerSummarySentAt), stamped);

    // ── second run: both must dedupe ─────────────────────────────────
    const nudge2 = await notifyRateEventRequest(eventId);
    const wrap2 = await notifyOrganizerWrapUp(eventId);
    check('re-run nudges nobody', nudge2.nudged === 0, nudge2);
    check('re-run sends no wrap-up', wrap2.sent === false, wrap2);
    const bells = await NotificationModel.countDocuments({ userId: organizer._id, title: /Wrap-up/ });
    check('still exactly one wrap-up bell', bells === 1, bells);
  } finally {
    // cleanup
    const userIds = [organizer._id, completed._id, rated._id, noShow._id];
    await NotificationModel.deleteMany({ userId: { $in: userIds } });
    await TicketPaymentModel.deleteMany({ eventId: event._id });
    await EventFeedbackModel.deleteMany({ eventId: event._id });
    await EventRegistrationModel.deleteMany({ eventId: event._id });
    await EventModel.deleteOne({ _id: event._id });
    await UserModel.deleteMany({ _id: { $in: userIds } });
    console.log('cleaned');
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  await mongoose.disconnect();
  process.exit(failed ? 1 : 0);
}
void main();
