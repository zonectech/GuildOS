/**
 * Live test: custom registration questions — sanitization, required enforcement,
 * SELECT validation, PHONE profile prefill + save-back, ticket checkout answers,
 * and guest claim answers. Run with the DB up:
 *   npx tsx --env-file=.env live-test-reg-questions.ts
 */
import mongoose from 'mongoose';
import { randomUUID } from 'crypto';
import { config } from './src/config';
import { EventModel } from './src/models/event.model';
import { CommunityModel } from './src/models/community.model';
import { EventRegistrationModel } from './src/models/event-registration.model';
import { TicketPaymentModel } from './src/models/ticket-payment.model';
import { TicketClaimModel } from './src/models/ticket-claim.model';
import { NotificationModel } from './src/models/notification.model';
import { UserModel } from './src/models/user.model';
import { applyEventInput } from './src/services/event/event-shared';
import { registerForEvent, cancelRegistration } from './src/services/event/event-registration.service';
import { startTicketCheckout, claimTicket, listMyTicketClaims } from './src/services/event/event-ticket.service';

let checks = 0;
function ok(cond: boolean, label: string) {
  checks += 1;
  if (cond) console.log(`  ✓ ${label}`);
  else { console.error(`  ✗ FAIL: ${label}`); process.exitCode = 1; }
}

async function expectThrow(fn: () => Promise<unknown>, pattern: RegExp, label: string) {
  try {
    await fn();
    ok(false, `${label} (did not throw)`);
  } catch (err) {
    ok(pattern.test(err instanceof Error ? err.message : String(err)), `${label} — "${err instanceof Error ? err.message : err}"`);
  }
}

async function main() {
  await mongoose.connect(config.mongoUri);

  // --- A. applyEventInput sanitization ------------------------------------
  console.log('A. Question sanitization');
  const target: Record<string, unknown> = {};
  applyEventInput(target, {
    registrationQuestions: [
      { label: 'Matric number', type: 'TEXT', required: true },
      { label: 'Phone', type: 'PHONE', required: true },
      { label: 'T-shirt size', type: 'SELECT', options: ['S', ' M ', 'L', 'L', ''], required: false },
      { label: 'Lunch?', type: 'YES_NO', required: false },
      { label: 'Broken select', type: 'SELECT', options: ['only-one'], required: false }, // dropped (<2 options)
      { label: '', type: 'TEXT', required: false }, // dropped (no label)
      { label: 'Weird type', type: 'HACK' as never, required: false }, // type coerced to TEXT
    ],
  });
  const qs = target.registrationQuestions as { key: string; label: string; type: string; options: string[]; required: boolean }[];
  ok(qs.length === 5, `5 valid questions kept (got ${qs.length})`);
  ok(qs[0].key === 'matric-number' && qs[0].required, 'label slugged into a stable key');
  ok(qs[2].options.join(',') === 'S,M,L', 'SELECT options trimmed + deduped');
  ok(qs[4].type === 'TEXT', 'unknown type coerced to TEXT');

  // --- Fixture event -------------------------------------------------------
  const community = await CommunityModel.findOne({ slug: 'robotics-guild-demo' });
  if (!community) throw new Error('robotics-guild-demo missing — run seed-partnership-demo.ts');
  const suffix = randomUUID().slice(0, 8);
  const event = await EventModel.create({
    title: `RegQ Test ${suffix}`,
    slug: `regq-test-${suffix}`,
    type: 'WORKSHOP',
    status: 'PUBLISHED',
    communityId: community._id,
    createdBy: community.founder,
    startDate: new Date(Date.now() + 86_400_000),
    endDate: new Date(Date.now() + 90_000_000),
    shortDescription: 'throwaway',
    registrationQuestions: [
      { key: 'matric-number', label: 'Matric number', type: 'TEXT', options: [], required: true },
      { key: 'phone', label: 'Phone', type: 'PHONE', options: [], required: true },
      { key: 't-shirt-size', label: 'T-shirt size', type: 'SELECT', options: ['S', 'M', 'L'], required: false },
    ],
  });
  const eventId = String(event._id);

  const mk = async (tag: string, phone = '') =>
    UserModel.create({
      email: `rq-${tag}-${suffix}@test.local`, fullName: `RegQ ${tag}`, username: `rq${tag}${suffix}`,
      role: 'STUDENT', passwordHash: 'x', passwordSalt: 'x', emailVerified: true,
      ...(phone ? { profile: { phoneNumber: phone } } : {}),
    });
  const noPhone = await mk('nophone');
  const hasPhone = await mk('hasphone', '08031234567');

  // --- B. Free registration ------------------------------------------------
  console.log('B. Free registration');
  await expectThrow(
    () => registerForEvent(eventId, String(noPhone._id), { answers: { 'matric-number': 'U19/123' } }),
    /Phone/, 'required PHONE missing → rejected',
  );
  await expectThrow(
    () => registerForEvent(eventId, String(noPhone._id), { answers: { 'matric-number': 'U19/123', phone: 'not-a-phone!!', 't-shirt-size': 'M' } }),
    /valid phone/, 'garbage phone → rejected',
  );
  await expectThrow(
    () => registerForEvent(eventId, String(noPhone._id), { answers: { 'matric-number': 'U19/123', phone: '08099887766', 't-shirt-size': 'XXL' } }),
    /not one of the choices/, 'invalid SELECT choice → rejected',
  );

  const reg1 = await registerForEvent(eventId, String(noPhone._id), { answers: { 'matric-number': 'U19/123', phone: '0809 988 7766', 't-shirt-size': 'M' } });
  ok(reg1.status === 'CONFIRMED', 'valid answers → CONFIRMED');
  ok(reg1.answers.length === 3 && reg1.answers[0].label === 'Matric number', 'answers snapshotted with labels');
  await new Promise((r) => setTimeout(r, 300)); // profile save is fire-and-forget
  const noPhoneAfter = await UserModel.findById(noPhone._id).lean();
  ok(noPhoneAfter?.profile?.phoneNumber === '0809 988 7766', 'typed phone saved back to empty profile');

  // Profile-holder skips typing the phone entirely.
  const reg2 = await registerForEvent(eventId, String(hasPhone._id), { answers: { 'matric-number': 'U20/456' } });
  ok(reg2.answers.find((a) => a.key === 'phone')?.value === '08031234567', 'PHONE auto-filled from profile');

  // --- C. Paid checkout + guest claim --------------------------------------
  console.log('C. Ticket checkout + guest claim');
  event.ticketPrice = 1000;
  event.ticketPromoCodes = [{ code: 'REGQ100', percentOff: 100, maxUses: 0, usedCount: 0 }] as never;
  await event.save();
  const buyer = await mk('buyer', '07011112222');
  const guest = await mk('guest');

  await expectThrow(
    () => startTicketCheckout(eventId, String(buyer._id), { promoCode: 'REGQ100', quantity: 2, answers: {} }),
    /Matric number/, 'checkout without required answer → rejected before payment',
  );
  const order = await startTicketCheckout(eventId, String(buyer._id), { promoCode: 'REGQ100', quantity: 2, answers: { 'matric-number': 'U21/789' } });
  ok('free' in order && order.free === true, '100%-promo order completes');
  const buyerReg = await EventRegistrationModel.findOne({ eventId, userId: buyer._id });
  ok(buyerReg?.answers.find((a) => a.key === 'phone')?.value === '07011112222', "buyer's answers (incl. profile phone) on the registration");

  const claims = await listMyTicketClaims(eventId, String(buyer._id));
  ok(claims.length === 1, 'guest claim link minted');
  await expectThrow(
    () => claimTicket(claims[0].token, String(guest._id), {}),
    /Matric number|Phone/, 'guest claim without answers → rejected',
  );
  const claimed = await claimTicket(claims[0].token, String(guest._id), { 'matric-number': 'U22/000', phone: '08155556666' });
  ok('claimed' in claimed && claimed.claimed === true, 'guest claims with own answers');
  const guestReg = await EventRegistrationModel.findOne({ eventId, userId: guest._id });
  ok(guestReg?.answers.find((a) => a.key === 'matric-number')?.value === 'U22/000', "guest's OWN answers stored (not the buyer's)");

  // --- Cleanup --------------------------------------------------------------
  const ids = [noPhone._id, hasPhone._id, buyer._id, guest._id];
  await cancelRegistration(eventId, String(noPhone._id)).catch(() => undefined);
  await EventRegistrationModel.deleteMany({ eventId });
  await TicketClaimModel.deleteMany({ eventId });
  await TicketPaymentModel.deleteMany({ eventId });
  await NotificationModel.deleteMany({ userId: { $in: ids } });
  await UserModel.deleteMany({ _id: { $in: ids } });
  await EventModel.deleteOne({ _id: event._id });

  console.log(`\n${process.exitCode ? 'FAILED' : 'ALL PASS'} — ${checks} checks`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('Test crashed:', err);
  process.exitCode = 1;
  await mongoose.disconnect().catch(() => undefined);
});
