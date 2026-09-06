/* One-off v2: verify attendee chat-link gating with a REAL non-manager attendee (throwaway user). */
import mongoose from 'mongoose';
import { EventModel } from './src/models/event.model';
import { EventRegistrationModel } from './src/models/event-registration.model';
import { UserModel } from './src/models/user.model';
import { getEventBySlug } from './src/services/event.service';

const SLUG = 'tech-week-summit-demo';

async function main() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  const event = await EventModel.findOne({ slug: SLUG });
  if (!event) throw new Error('demo event missing');
  // stale runs: purge leftover throwaway users + restore sections if a prior crash left the temp one
  await UserModel.deleteMany({ email: /^chatlink-test-/ });
  if ((event.sections ?? []).some((s: { key: string }) => s.key === 'test-sec')) {
    event.sections = [] as never;
    await event.save();
  }

  const user = await UserModel.create({
    email: `chatlink-test-${Date.now()}@guildos.local`,
    fullName: 'ChatLink Tester',
    passwordHash: 'x', passwordSalt: 'x', emailVerified: true, status: 'ACTIVE', role: 'STUDENT',
  });
  const uid = String(user._id);

  const prevSections = JSON.parse(JSON.stringify(event.sections ?? []));
  event.sections = [{ key: 'test-sec', name: 'Test Section', description: '', capacity: 0, venue: '', chatLink: 'https://chat.whatsapp.com/SECGROUP' }] as never;
  await event.save();

  // 1) no registration → everything stripped
  const anon = await getEventBySlug(SLUG, uid);
  const a = anon.event as { attendeeChatLink?: string; sections?: { chatLink?: string }[] };
  console.log('no reg:        event =', JSON.stringify(a.attendeeChatLink), '| section =', JSON.stringify(a.sections?.[0]?.chatLink));

  // 2) CONFIRMED, no section → event link only
  const reg = await EventRegistrationModel.create({ eventId: event._id, userId: user._id, status: 'CONFIRMED', qrToken: `chatlink-test-${Date.now()}` });
  const conf = await getEventBySlug(SLUG, uid);
  const b = conf.event as { attendeeChatLink?: string; sections?: { chatLink?: string }[] };
  console.log('confirmed:     event =', JSON.stringify(b.attendeeChatLink), '| section =', JSON.stringify(b.sections?.[0]?.chatLink));

  // 3) in the section → both
  reg.sectionKey = 'test-sec';
  await reg.save();
  const sec = await getEventBySlug(SLUG, uid);
  const c = sec.event as { attendeeChatLink?: string; sections?: { chatLink?: string }[] };
  console.log('in section:    event =', JSON.stringify(c.attendeeChatLink), '| section =', JSON.stringify(c.sections?.[0]?.chatLink));

  // cleanup
  await EventRegistrationModel.deleteOne({ _id: reg._id });
  await UserModel.deleteOne({ _id: user._id });
  const fresh = await EventModel.findOne({ slug: SLUG });
  if (fresh) { fresh.sections = prevSections; await fresh.save(); }
  console.log('cleaned');
  await mongoose.disconnect();
}
void main();
