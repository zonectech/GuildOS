/** Test: cancelling a claimed guest ticket releases the claim link for reuse. */
import mongoose from 'mongoose';
import { randomUUID } from 'crypto';
import { config } from './src/config';
import { EventModel } from './src/models/event.model';
import { EventRegistrationModel } from './src/models/event-registration.model';
import { TicketPaymentModel } from './src/models/ticket-payment.model';
import { TicketClaimModel } from './src/models/ticket-claim.model';
import { NotificationModel } from './src/models/notification.model';
import { UserModel } from './src/models/user.model';
import { startTicketCheckout, claimTicket, listMyTicketClaims } from './src/services/event/event-ticket.service';
import { cancelRegistration } from './src/services/event/event-registration.service';

let checks = 0;
function ok(cond: boolean, label: string) {
  checks += 1;
  if (cond) console.log(`  ✓ ${label}`);
  else { console.error(`  ✗ FAIL: ${label}`); process.exitCode = 1; }
}

async function main() {
  await mongoose.connect(config.mongoUri);
  const event = await EventModel.findOne({ slug: 'tech-week-summit-demo' });
  if (!event) throw new Error('event missing');
  const original = { promos: event.ticketPromoCodes, status: event.status, price: event.ticketPrice };
  event.status = 'PUBLISHED';
  // The test needs a PAID event (checkout path) — don't rely on demo-seed state.
  if (!event.ticketPrice) event.ticketPrice = 1500;
  event.ticketPromoCodes = [{ code: 'RECLAIM100', percentOff: 100, maxUses: 0, usedCount: 0 }] as never;
  await event.save();
  const eventId = String(event._id);

  const mk = async (tag: string) =>
    UserModel.create({ email: `rc-${tag}-${randomUUID().slice(0, 6)}@test.local`, fullName: `Reclaim ${tag}`, username: `rc${tag}${randomUUID().slice(0, 6)}`, role: 'STUDENT', passwordHash: 'x', passwordSalt: 'x', emailVerified: true });
  const buyer = await mk('buyer');
  const guestA = await mk('guestA');
  const guestB = await mk('guestB');

  // Buy 2 tickets free → 1 claim link.
  const order = await startTicketCheckout(eventId, String(buyer._id), { promoCode: 'RECLAIM100', quantity: 2 });
  ok('free' in order && order.free === true, 'group order completes');
  let claims = await listMyTicketClaims(eventId, String(buyer._id));
  ok(claims.length === 1, '1 guest link created');

  // Guest A claims, then cancels.
  await claimTicket(claims[0].token, String(guestA._id));
  claims = await listMyTicketClaims(eventId, String(buyer._id));
  ok(claims[0].claimed && claims[0].claimedByName === 'Reclaim guestA', 'guest A holds the ticket');
  await cancelRegistration(eventId, String(guestA._id));
  claims = await listMyTicketClaims(eventId, String(buyer._id));
  ok(!claims[0].claimed, 'cancel releases the claim link');
  const bell = await NotificationModel.findOne({ userId: buyer._id, title: /available again/ });
  ok(Boolean(bell), 'buyer notified the link is reusable');

  // Guest B claims the SAME link.
  const second = await claimTicket(claims[0].token, String(guestB._id));
  ok('claimed' in second && second.claimed === true, 'guest B claims the released link');
  const regB = await EventRegistrationModel.findOne({ eventId, userId: guestB._id });
  ok(regB?.status === 'CONFIRMED', 'guest B is CONFIRMED');

  // Buyer cancels + re-buys (the old unique index would have crashed this).
  await cancelRegistration(eventId, String(buyer._id));
  const rebuy = await startTicketCheckout(eventId, String(buyer._id), { promoCode: 'RECLAIM100', quantity: 1 });
  ok('free' in rebuy && rebuy.free === true, 'buyer can re-buy after cancelling (index fix)');

  // Cleanup.
  const ids = [buyer._id, guestA._id, guestB._id];
  await EventRegistrationModel.deleteMany({ userId: { $in: ids } });
  await TicketClaimModel.deleteMany({ createdBy: { $in: ids } });
  await TicketPaymentModel.deleteMany({ userId: { $in: ids } });
  await NotificationModel.deleteMany({ userId: { $in: ids } });
  await UserModel.deleteMany({ _id: { $in: ids } });
  event.ticketPromoCodes = original.promos;
  event.status = original.status;
  event.ticketPrice = original.price;
  await event.save();
  console.log(`\n${checks} checks done; demo restored.`);
  await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
