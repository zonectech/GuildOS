/**
 * Demo — full multi-day attendance journey for the livetest user on
 * tech-week-summit-demo, ending with a real certificate.
 *
 * Shifts the agenda so TODAY is Day 2 (Day 1 was yesterday), simulates the
 * Day-1 check-in/out, then runs today's check-in → check-out → issue
 * certificates through the real service layer (founder acts as scanner).
 *
 * Run:  npx tsx --env-file=.env demo-multiday-journey.ts
 */
import './src/config';
import mongoose from 'mongoose';
import { connectDatabase } from './src/db';
import { UserModel } from './src/models/user.model';
import { EventModel } from './src/models/event.model';
import { EventRegistrationModel } from './src/models/event-registration.model';
import { CertificateModel } from './src/models/certificate.model';
import { checkInRegistration, checkOutRegistration, issueEventCertificates } from './src/services/event.service';
import { randomUUID } from 'node:crypto';

const SLUG = 'tech-week-summit-demo';

function at(dayOffset: number, hour: number, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
}

async function main() {
  await connectDatabase();
  const user = await UserModel.findOne({ email: 'livetest@guildos.local' });
  const event = await EventModel.findOne({ slug: SLUG });
  if (!user || !event) throw new Error('Run seed-multiday-demo.ts first');

  // Make today Day 2: Day 1 yesterday, Day 3 tomorrow.
  event.days[0].date = at(-1, 9);
  event.days[1].date = at(0, 9);
  event.days[2].date = at(1, 9);
  event.startDate = at(-1, 9);
  event.endDate = at(1, 17);
  event.status = 'CHECK_IN';
  event.markModified('days');
  await event.save();
  console.log('Agenda shifted: Day 1 = yesterday, Day 2 = TODAY, Day 3 = tomorrow. Doors open (CHECK_IN).');

  // Registration with a completed Day-1 (yesterday 9:05 → 16:20).
  const day1Key = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).format(at(-1, 12));
  const registration = await EventRegistrationModel.findOneAndUpdate(
    { eventId: event._id, userId: user._id },
    {
      $set: {
        communityId: event.communityId,
        registrationType: 'OPEN',
        attendanceMode: 'PHYSICAL',
        status: 'CHECKED_OUT',
        registeredAt: at(-2, 12),
        checkInAt: at(-1, 9, 5),
        checkOutAt: at(-1, 16, 20),
        attendanceMinutes: 435,
        attendanceDays: [{ day: day1Key, checkInAt: at(-1, 9, 5), checkOutAt: at(-1, 16, 20), minutes: 435 }],
        attendanceVerified: true,
        certificateEligible: false,
        certificateIssued: false,
        plannedDays: [1, 2],
      },
      $setOnInsert: { qrToken: randomUUID() },
    },
    { upsert: true, new: true },
  );
  console.log(`Day 1 simulated (435 min). Status: ${registration!.status}`);

  // TODAY (Day 2): scan in, then scan out — founder is the scanner.
  const founderId = user._id.toString(); // livetest founded the host community
  const regId = registration!._id.toString();
  const eventId = event._id.toString();

  const checkedIn = await checkInRegistration(eventId, regId, founderId);
  console.log(`Day 2 check-in ✓  (${checkedIn.attendanceDays.length} day entries)`);

  const checkedOut = await checkOutRegistration(eventId, regId, founderId);
  console.log(`Day 2 check-out ✓  → status ${checkedOut.status}, total ${checkedOut.attendanceMinutes} min, certificateEligible=${checkedOut.certificateEligible}`);

  const issued = await issueEventCertificates(eventId, founderId);
  console.log(`Certificates issued: ${issued.issued}`);

  const cert = await CertificateModel.findOne({ eventId: event._id, userId: user._id }).lean();
  console.log(`\nCertificate: ${cert?.serial}  (attended ${cert?.daysAttended} of ${cert?.totalDays} days)`);
  console.log(`View: http://localhost:3000/certificates/${cert?.serial}`);
  await mongoose.disconnect();
}

void main();
