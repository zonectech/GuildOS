/**
 * Weekly numbers: is the site working for students and organizers? Read-only; it changes nothing.
 *
 *   npm run report            the last 7 days
 *   npm run report -- 30      the last 30 days
 *
 * Test data ("[TEST] …" events, @example.com accounts) is left out.
 */
import mongoose from 'mongoose';
import { config } from '../src/config';
import { UserModel } from '../src/models/user.model';
import { EventModel } from '../src/models/event.model';
import { EventRegistrationModel } from '../src/models/event-registration.model';
import { CertificateModel } from '../src/models/certificate.model';
import { EventFeedbackModel } from '../src/models/event-feedback.model';
import { ProductFeedbackModel } from '../src/models/product-feedback.model';

const days = Math.max(1, Number(process.argv.slice(2).find((a) => /^\d+$/.test(a))) || 7);
const since = new Date(Date.now() - days * 86_400_000);
const notTest = { title: { $not: /^\[TEST\]/ } };
const pct = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : '–');
const short = (text: string, n = 160) => (text.length > n ? `${text.slice(0, n)}…` : text).replace(/\s+/g, ' ');

async function main() {
  await mongoose.connect(config.mongoUri);
  const testUsers = (await UserModel.find({ email: /@example\.com$/i }).select('_id').lean()).map((u) => u._id);

  // ── People ──
  const newAccounts = await UserModel.countDocuments({ createdAt: { $gte: since }, _id: { $nin: testUsers } });

  // ── Events ──
  const created = await EventModel.countDocuments({ ...notTest, deletedAt: null, createdAt: { $gte: since }, status: { $ne: 'DRAFT' } });
  const cancelled = await EventModel.countDocuments({ ...notTest, status: 'ARCHIVED', cancellationReason: { $ne: '' }, updatedAt: { $gte: since } });
  const held = await EventModel.find({
    ...notTest, deletedAt: null, endDate: { $gte: since, $lte: new Date() },
    status: { $in: ['PUBLISHED', 'CHECK_IN', 'CHECK_OUT', 'COMPLETED'] },
  }).select('_id title communityId attendanceSource status').lean();
  const heldIds = held.map((e) => e._id);
  const scanned = held.filter((e) => e.attendanceSource !== 'EXTERNAL');

  // ── The door: registered → scanned in → counted ──
  const regs = await EventRegistrationModel.find({ eventId: { $in: heldIds }, status: { $nin: ['CANCELLED', 'REJECTED'] } })
    .select('eventId userId status checkInAt').lean();
  const registered = regs.length;
  const scannedIn = regs.filter((r) => r.checkInAt).length;
  const counted = regs.filter((r) => r.status === 'COMPLETED').length;
  const inNotOut = regs.filter((r) => r.checkInAt && r.status !== 'COMPLETED').length;

  const certificates = await CertificateModel.countDocuments({ issuedAt: { $gte: since }, status: 'VERIFIED', userId: { $nin: testUsers } });

  // ── Coming back: the strongest signs the stamps matter ──
  const attendedNow = [...new Set(regs.filter((r) => r.status === 'COMPLETED').map((r) => String(r.userId)))];
  const totals = attendedNow.length
    ? await EventRegistrationModel.aggregate<{ _id: mongoose.Types.ObjectId; n: number }>([
      { $match: { userId: { $in: attendedNow.map((id) => new mongoose.Types.ObjectId(id)) }, status: 'COMPLETED' } },
      { $group: { _id: '$userId', n: { $sum: 1 } } },
    ])
    : [];
  const returningStudents = totals.filter((t) => t.n >= 2).length;
  const communitiesNow = [...new Set(held.map((e) => String(e.communityId)))];
  const runs = communitiesNow.length
    ? await EventModel.aggregate<{ _id: mongoose.Types.ObjectId; n: number }>([
      { $match: { ...notTest, deletedAt: null, communityId: { $in: communitiesNow.map((id) => new mongoose.Types.ObjectId(id)) }, status: 'COMPLETED' } },
      { $group: { _id: '$communityId', n: { $sum: 1 } } },
    ])
    : [];
  const returningOrganizers = runs.filter((r) => r.n >= 2).length;

  // ── What people said ──
  const ratings = await EventFeedbackModel.find({ updatedAt: { $gte: since }, userId: { $nin: testUsers } }).select('eventId rating comment').lean();
  const average = ratings.length ? (ratings.reduce((s, r) => s + r.rating, 0) / ratings.length).toFixed(1) : '–';
  const titles = new Map((await EventModel.find({ _id: { $in: ratings.map((r) => r.eventId) } }).select('title').lean()).map((e) => [String(e._id), e.title]));
  const low = ratings.filter((r) => r.rating <= 2);
  const messages = await ProductFeedbackModel.find({ createdAt: { $gte: since }, userId: { $nin: testUsers } }).sort({ createdAt: -1 }).lean();
  const senders = new Map((await UserModel.find({ _id: { $in: messages.map((m) => m.userId).filter(Boolean) } }).select('fullName email').lean()).map((u) => [String(u._id), `${u.fullName} <${u.email}>`]));

  const out: string[] = [];
  const line = (label: string, value: string | number) => out.push(`  ${label.padEnd(38, '.')} ${value}`);
  out.push(`\nThe last ${days} day${days === 1 ? '' : 's'} (since ${since.toDateString()})\n`);
  out.push('People');
  line('New accounts', newAccounts);
  out.push('\nEvents');
  line('Published', created);
  line('Held', `${held.length} (${scanned.length} scanned at the door, ${held.length - scanned.length} on a partner site)`);
  line('Cancelled', cancelled);
  out.push('\nAt the door (events held)');
  line('Registered', registered);
  line('Scanned in', `${scannedIn} (${pct(scannedIn, registered)} of registered)`);
  line('Counted on profiles', `${counted} (${pct(counted, registered)} of registered)`);
  line('Scanned in but not out', `${inNotOut}${inNotOut ? '  ← check-out is being missed' : ''}`);
  line('Certificates issued', certificates);
  out.push('\nComing back');
  line('Attendees on their 2nd+ event', `${returningStudents} of ${attendedNow.length} (${pct(returningStudents, attendedNow.length)})`);
  line('Communities on their 2nd+ event', `${returningOrganizers} of ${communitiesNow.length} (${pct(returningOrganizers, communitiesNow.length)})`);
  out.push('\nRatings');
  line('Ratings given', `${ratings.length}, average ${average}/5`);
  for (const r of low) out.push(`    ${r.rating}★ ${titles.get(String(r.eventId)) ?? 'Event'}${r.comment ? `: "${short(r.comment)}"` : ''}`);
  out.push(`\nFeedback messages (${messages.length})`);
  for (const m of messages) {
    const who = m.userId ? senders.get(String(m.userId)) ?? 'Account' : m.email || 'Not signed in';
    out.push(`  ${m.createdAt.toDateString()} · ${who}${m.page ? ` · ${m.page}` : ''}`);
    out.push(`    "${short(m.message, 400)}"`);
  }
  console.log(out.join('\n'));
}

main()
  .catch((error) => { console.error('Report failed:', error instanceof Error ? error.message : error); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
