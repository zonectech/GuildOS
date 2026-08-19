/**
 * Live test: ticket tiers + promo codes + group buy + claim links.
 * Uses a 100%-off promo so the whole flow runs without a payment gateway.
 * Seeds throwaway users, cleans up after itself, restores the demo event.
 */
import mongoose from 'mongoose';
import { randomUUID } from 'crypto';
import { config } from './src/config';
import { EventModel } from './src/models/event.model';
import { EventRegistrationModel } from './src/models/event-registration.model';
import { TicketPaymentModel } from './src/models/ticket-payment.model';
import { TicketClaimModel } from './src/models/ticket-claim.model';
import { UserModel } from './src/models/user.model';
import { getTicketQuote, startTicketCheckout, listMyTicketClaims, claimTicket, getTicketSales } from './src/services/event/event-ticket.service';

let checks = 0;
function ok(cond: boolean, label: string) {
  checks += 1;
  if (cond) console.log(`  ✓ ${label}`);
  else {
    console.error(`  ✗ FAIL: ${label}`);
    process.exitCode = 1;
  }
}

async function main() {
  await mongoose.connect(config.mongoUri);
  const event = await EventModel.findOne({ slug: 'tech-week-summit-demo' });
  if (!event) throw new Error('demo event not found');
  const original = { tiers: event.ticketTiers, promos: event.ticketPromoCodes, price: event.ticketPrice, status: event.status, deadline: event.registrationDeadline };

  // Arrange: tiers + a 100% promo (lets us complete purchases without a gateway).
  event.status = 'PUBLISHED';
  event.registrationDeadline = null as never;
  event.ticketTiers = [
    { name: 'Early Bird', price: 1000, capacity: 5 },
    // Section-scoped tier: buying VIP IS picking the Data Science track.
    { name: 'VIP', price: 5000, capacity: 1, sectionKey: 'data-science' },
  ] as never;
  event.ticketPromoCodes = [
    { code: 'FREE100', percentOff: 100, maxUses: 2, usedCount: 0 },
    { code: 'HALF', percentOff: 50, maxUses: 0, usedCount: 0 },
  ] as never;
  event.ticketPrice = 1000; // synced min paid tier
  await event.save();
  const eventId = String(event._id);

  console.log('QUOTES');
  const q1 = await getTicketQuote(eventId);
  ok(q1.tiers.length === 2 && q1.tiers[0].name === 'Early Bird', 'quote lists both tiers');
  ok(q1.price === 1000 && q1.tierName === 'Early Bird', 'defaults to first tier');
  const q2 = await getTicketQuote(eventId, { tierName: 'VIP', promoCode: 'HALF' });
  ok(q2.price === 2500 && q2.promo?.code === 'HALF', 'HALF makes VIP ₦2,500');
  const q3 = await getTicketQuote(eventId, { tierName: 'Early Bird', quantity: 3 });
  ok(q3.base === 3000 && q3.quantity === 3, 'qty 3 order base = ₦3,000');
  const q4 = await getTicketQuote(eventId, { promoCode: 'NOPE' });
  ok(Boolean(q4.promoError), 'bad code returns promoError');
  const vipQuote = q1.tiers.find((t: any) => t.name === 'VIP') as any;
  ok(vipQuote?.sectionKey === 'data-science' && vipQuote?.sectionName === 'Data Science', 'quote exposes the tier\u2019s track');

  // Throwaway buyers.
  const mk = async (tag: string) =>
    UserModel.create({ email: `tkt-${tag}-${randomUUID().slice(0, 6)}@test.local`, fullName: `Ticket ${tag}`, username: `tkt${tag}${randomUUID().slice(0, 6)}`, role: 'STUDENT', passwordHash: 'x', passwordSalt: 'x', emailVerified: true });
  const buyer = await mk('buyer');
  const guest = await mk('guest');
  const late = await mk('late');

  console.log('GROUP BUY (free via 100% promo)');
  // Demo event carries sections — checkout requires picking a track (guests inherit it).
  const order = await startTicketCheckout(eventId, String(buyer._id), { tierName: 'Early Bird', promoCode: 'FREE100', quantity: 3, sectionKey: 'coding' });
  ok('free' in order && order.free === true, '100%-off order completes without gateway');
  const buyerReg = await EventRegistrationModel.findOne({ eventId, userId: buyer._id });
  ok(buyerReg?.status === 'CONFIRMED' && Boolean(buyerReg?.qrToken), 'buyer registration CONFIRMED with QR token');
  const claims = await listMyTicketClaims(eventId, String(buyer._id));
  ok(claims.length === 2 && claims.every((c) => !c.claimed), 'qty 3 → 2 unclaimed guest links');

  console.log('CLAIMS');
  const claimed = await claimTicket(claims[0].token, String(guest._id));
  ok('claimed' in claimed && claimed.claimed === true, 'guest claims a link');
  const guestReg = await EventRegistrationModel.findOne({ eventId, userId: guest._id });
  ok(guestReg?.status === 'CONFIRMED' && guestReg?.qrToken !== buyerReg?.qrToken, 'guest gets their OWN registration + distinct QR');
  const again = await claimTicket(claims[0].token, String(guest._id));
  ok('alreadyYours' in again && again.alreadyYours === true, 're-claiming own link is graceful');
  try {
    await claimTicket(claims[0].token, String(late._id));
    ok(false, 'claimed link blocked for others');
  } catch (err) {
    ok(/already been claimed/.test((err as Error).message), 'claimed link blocked for others');
  }

  console.log('PROMO EXHAUSTION + TIER CAPACITY');
  const paymentDoc = await TicketPaymentModel.findOne({ eventId, userId: buyer._id, status: 'PAID' });
  ok(paymentDoc?.tierName === 'Early Bird' && paymentDoc?.quantity === 3 && paymentDoc?.promoCode === 'FREE100', 'payment row stores tier/qty/promo');
  const fresh = await EventModel.findById(eventId);
  ok(fresh?.ticketPromoCodes.find((p) => p.code === 'FREE100')?.usedCount === 1, 'promo usedCount incremented once');
  // Use remaining FREE100 on VIP (cap 1) with the late user — takes VIP to sold out.
  // No sectionKey passed: the section-scoped tier must PIN the track by itself.
  const vipOrder = await startTicketCheckout(eventId, String(late._id), { tierName: 'VIP', promoCode: 'FREE100' });
  ok('free' in vipOrder && vipOrder.free === true, 'second FREE100 use works (maxUses 2)');
  const latePayment = await TicketPaymentModel.findOne({ eventId, userId: late._id, status: 'PAID' });
  const lateReg = await EventRegistrationModel.findOne({ eventId, userId: late._id });
  ok(latePayment?.sectionKey === 'data-science' && lateReg?.sectionKey === 'data-science', 'section-scoped tier pins the buyer\u2019s track');
  try {
    await startTicketCheckout(eventId, String(guest._id), { tierName: 'VIP', promoCode: 'HALF', sectionKey: 'coding' });
    ok(false, 'VIP sold out blocks next buyer');
  } catch (err) {
    ok(/sold out|already have/.test((err as Error).message), `VIP guard fires (${(err as Error).message})`);
  }
  const qSold = await getTicketQuote(eventId, { tierName: 'VIP' });
  ok(qSold.tiers.find((t) => t.name === 'VIP')?.soldOut === true, 'quote marks VIP sold out');
  const promoNow = (await EventModel.findById(eventId))!.ticketPromoCodes.find((p) => p.code === 'FREE100');
  const qExhausted = await getTicketQuote(eventId, { promoCode: 'FREE100' });
  ok(promoNow?.usedCount === 2 && Boolean(qExhausted.promoError), 'FREE100 exhausted after 2 uses');

  console.log('SALES BREAKDOWN');
  const livetest = await UserModel.findOne({ email: 'livetest@guildos.local' });
  const sales = await getTicketSales(eventId, String(livetest!._id));
  const early = sales.tiers.find((t) => t.name === 'Early Bird');
  const vip = sales.tiers.find((t) => t.name === 'VIP');
  ok(Boolean(early && vip), `per-tier rows present (${sales.tiers.map((t) => `${t.name}:${t.sold}`).join(', ')})`);
  ok((early?.sold ?? 0) >= 3 && (vip?.sold ?? 0) >= 1, 'tier sold counts include group quantity');

  // Cleanup: throwaway users + their payments/registrations/claims; restore event.
  const ids = [buyer._id, guest._id, late._id];
  await EventRegistrationModel.deleteMany({ eventId, userId: { $in: ids } });
  await TicketClaimModel.deleteMany({ createdBy: { $in: ids } });
  await TicketPaymentModel.deleteMany({ userId: { $in: ids } });
  await UserModel.deleteMany({ _id: { $in: ids } });
  event.ticketTiers = original.tiers;
  event.ticketPromoCodes = original.promos;
  event.ticketPrice = original.price;
  event.status = original.status;
  event.registrationDeadline = original.deadline;
  await event.save();
  console.log(`\n${checks} checks done; demo event restored.`);
  await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
