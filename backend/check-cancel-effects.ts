import 'dotenv/config';
import mongoose from 'mongoose';
import { config } from './src/config';
import { EventModel } from './src/models/event.model';
import { TicketPaymentModel } from './src/models/ticket-payment.model';
import { SponsorshipPaymentModel } from './src/models/sponsorship-payment.model';
import { EventRegistrationModel } from './src/models/event-registration.model';
import { NotificationModel } from './src/models/notification.model';
import { UserModel } from './src/models/user.model';
import { getCommunityWallet } from './src/services/community/community-wallet.service';

async function main() {
  await mongoose.connect(config.mongoUri);
  const ev = await EventModel.findOne({ slug: 'ai-robotics-career-night-2026-d0afdaae' }).select('_id communityId status cancellationReason').lean();
  console.log('event:', ev!.status, '| reason:', (ev!.cancellationReason ?? '').slice(0, 60) + '…');

  const tickets = await TicketPaymentModel.find({ eventId: ev!._id }).lean();
  for (const t of tickets) console.log('ticket:', t.reference, t.status, 'refundRef:', t.refundRef || '(none)', 'refundedAt:', t.refundedAt ?? '-');

  const spns = await SponsorshipPaymentModel.find({ eventId: ev!._id }).lean();
  for (const s of spns) console.log('sponsorship:', s.reference, s.status, 'refundRef:', s.refundRef || '(none)');

  const regs = await EventRegistrationModel.find({ eventId: ev!._id }).select('status cancellationReason cancelledBy').lean();
  for (const r of regs) console.log('registration:', r.status);

  const owner = await UserModel.findOne({ email: 'livetest@guildos.local' }).select('_id').lean();
  const w = await getCommunityWallet(String(ev!.communityId), String(owner!._id));
  console.log('wallet: available', w.availableNgn, 'held', w.heldNgn);

  const bells = await NotificationModel.find({ createdAt: { $gt: new Date(Date.now() - 10 * 60 * 1000) } }).select('title').lean();
  for (const b of bells) console.log('bell:', b.title);
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
