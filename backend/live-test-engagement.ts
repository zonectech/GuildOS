/**
 * Live test: 2026-08-04 engagement wave.
 *   A. Member analytics (COORDINATOR+ gate, totals, join trend, role mix)
 *   B. Bulk email invites (validation, caps, permission gate, member skipping)
 *   C. Event page views + sales funnel fields on getTicketSales
 *   D. Referral attribution (?ref= → checkout → sales referrers; self-referral dropped;
 *      unknown usernames dropped)
 *   E. Personal iCal feed (token mint, VCALENDAR contents, multi-day VEVENTs,
 *      regenerate revokes old token)
 *   F. Session-end reminder (finished session label → founder bell, deduped)
 *   G. Per-day capacity (day cap enforced at RSVP, full days reported, availability exposed)
 *   H. Knowledge starter pack (category-aware drafts, empty-hub-only, permission gate)
 */
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { connectDatabase } from './src/db';
import { UserModel } from './src/models/user.model';
import { CommunityModel } from './src/models/community.model';
import { MembershipModel } from './src/models/membership.model';
import { CommunityLeaderModel } from './src/models/community-leader.model';
import { EventModel } from './src/models/event.model';
import { EventRegistrationModel } from './src/models/event-registration.model';
import { TicketPaymentModel } from './src/models/ticket-payment.model';
import { NotificationModel } from './src/models/notification.model';
import { MembershipActivityModel } from './src/models/membership-activity.model';
import { PostModel } from './src/models/post.model';
import { getCommunityMemberAnalytics } from './src/services/community/community-core.service';
import { inviteMembersByEmail } from './src/services/community/community-membership.service';
import { recordEventView, getEventBySlug } from './src/services/event/event-core.service';
import { startTicketCheckout, getTicketSales } from './src/services/event/event-ticket.service';
import { registerForEvent } from './src/services/event/event-registration.service';
import { getCalendarFeedUrl, buildUserCalendar } from './src/services/calendar-feed.service';
import { remindFinishedLeaderSessions } from './src/services/weekly-digest.service';
import { issueLeaderCertificates } from './src/services/community/community-leader-certificate.service';
import { CertificateModel } from './src/models/certificate.model';
import { createKnowledgeStarterPack } from './src/services/knowledge.service';
import { KnowledgeResourceModel } from './src/models/knowledge-resource.model';

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
    role: 'STUDENT', status: 'ACTIVE', emailVerified: true, profile: { username: `${tag}_${rnd}`, university: 'Wave U' },
  } as any);
  const founder = await mkUser('Wave Founder', 'wvf');
  const member = await mkUser('Wave Member', 'wvm');
  const buyer = await mkUser('Wave Buyer', 'wvb');
  const referrer = await mkUser('Wave Referrer', 'wvr');
  const outsider = await mkUser('Wave Outsider', 'wvo');
  const community = await CommunityModel.create({
    name: `Wave Guild ${stamp}`, normalizedName: `wave guild ${stamp}`, slug: `wave-${stamp}`,
    shortDescription: 'x', logo: '/uploads/demo-org-logo.svg', coverImage: '/uploads/smoke-cover.png',
    category: 'TECH', university: 'Wave U', visibility: 'PUBLIC',
    verificationStatus: 'VERIFIED', verificationMethod: 'MANUAL', verifiedBy: founder._id, verifiedAt: new Date(),
    founder: founder._id, memberCount: 3,
  });
  await MembershipModel.create({ userId: founder._id, communityId: community._id, role: 'FOUNDER', status: 'ACTIVE', assignedBy: founder._id });
  await MembershipModel.create({ userId: member._id, communityId: community._id, role: 'MEMBER', status: 'ACTIVE', assignedBy: founder._id, joinedAt: new Date() });
  await MembershipModel.create({ userId: buyer._id, communityId: community._id, role: 'MEMBER', status: 'ACTIVE', assignedBy: founder._id, joinedAt: new Date() });
  // A recent post → `member` counts as engaged.
  await PostModel.create({ userId: member._id, communityId: community._id, kind: 'TEXT', content: 'wave test post' } as any);

  const paidEvent = await EventModel.create({
    communityId: community._id, createdBy: founder._id, slug: `wave-paid-${stamp}`, status: 'PUBLISHED',
    title: `Wave Paid Event ${stamp}`, shortDescription: 'x', mode: 'PHYSICAL', venue: 'Hall A',
    bannerImage: '/uploads/smoke-banner.png', registrationPolicy: 'OPEN', ticketPrice: 1000,
    startDate: new Date(Date.now() + 3 * 86400_000), endDate: new Date(Date.now() + 3 * 86400_000 + 3600_000),
  } as any);
  const paidEventId = paidEvent._id.toString();

  const multiDayEvent = await EventModel.create({
    communityId: community._id, createdBy: founder._id, slug: `wave-multi-${stamp}`, status: 'PUBLISHED',
    title: `Wave Multi Event ${stamp}`, shortDescription: 'three days of waves', mode: 'PHYSICAL', venue: 'Hall B',
    bannerImage: '/uploads/smoke-banner.png', registrationPolicy: 'OPEN',
    startDate: new Date(Date.now() + 5 * 86400_000), endDate: new Date(Date.now() + 7 * 86400_000),
    days: [
      { date: new Date(Date.now() + 5 * 86400_000), theme: 'Opening', venue: 'Hall B1', startTime: '09:00', endTime: '16:00', features: [], facilitators: [] },
      { date: new Date(Date.now() + 6 * 86400_000), theme: 'Deep dive', venue: 'Hall B2', startTime: '10:00', endTime: '15:00', features: [], facilitators: [] },
    ],
  } as any);

  try {
    // ── A. member analytics ─────────────────────────────────────────────
    const analytics = await getCommunityMemberAnalytics(community._id.toString(), founder._id.toString());
    check('analytics: totals + engagement split', analytics.totalMembers === 3 && analytics.newLast30Days === 3 && analytics.engagedLast60Days >= 2, analytics);
    check('analytics: 12-month join trend, current month = 3', analytics.joinsByMonth.length === 12 && analytics.joinsByMonth[11].count === 3, analytics.joinsByMonth.slice(-2));
    check('analytics: role mix includes FOUNDER + 2 MEMBER', analytics.roleBreakdown.some((r) => r.role === 'MEMBER' && r.count === 2) && analytics.roleBreakdown.some((r) => r.role === 'FOUNDER'), analytics.roleBreakdown);
    let denied = '';
    try { await getCommunityMemberAnalytics(community._id.toString(), outsider._id.toString()); } catch (err) { denied = err instanceof Error ? err.message : 'x'; }
    check('analytics: non-members are refused', denied.includes('permissions'), denied);

    // ── B. bulk email invites ───────────────────────────────────────────
    let badEmail = '';
    try { await inviteMembersByEmail(community._id.toString(), founder._id.toString(), ['not-an-email']); } catch (err) { badEmail = err instanceof Error ? err.message : 'x'; }
    check('invites: invalid address rejected', badEmail.includes('Invalid email'), badEmail);
    let tooMany = '';
    try { await inviteMembersByEmail(community._id.toString(), founder._id.toString(), Array.from({ length: 51 }, (_, i) => `x${i}@ex.com`)); } catch (err) { tooMany = err instanceof Error ? err.message : 'x'; }
    check('invites: batch cap of 50 enforced', tooMany.includes('50'), tooMany);
    let noPerm = '';
    try { await inviteMembersByEmail(community._id.toString(), member._id.toString(), ['a@ex.com']); } catch (err) { noPerm = err instanceof Error ? err.message : 'x'; }
    check('invites: plain members cannot invite', noPerm.includes('permissions'), noPerm);
    // Existing member's address is skipped without an email attempt.
    const inviteResult = await inviteMembersByEmail(community._id.toString(), founder._id.toString(), [member.email]);
    check('invites: existing members skipped, none sent', inviteResult.skippedMembers === 1 && inviteResult.sent === 0, inviteResult);
    const communityAfter = await CommunityModel.findById(community._id).select('inviteToken').lean();
    check('invites: invite token auto-minted', Boolean(communityAfter?.inviteToken), communityAfter?.inviteToken?.slice(0, 6));

    // ── C. views + funnel ───────────────────────────────────────────────
    await recordEventView(paidEvent.slug);
    await recordEventView(paidEvent.slug);
    await recordEventView('no-such-slug'); // silently ignored

    // ── D. referral attribution ─────────────────────────────────────────
    // Buyer arrives through the referrer's link.
    await startTicketCheckout(paidEventId, buyer._id.toString(), { referrer: referrer.profile.username });
    const buyerPayment = await TicketPaymentModel.findOne({ eventId: paidEventId, userId: buyer._id });
    check('referral: stored on the checkout payment', buyerPayment?.referrer === referrer.profile.username, buyerPayment?.referrer);
    // Self-referral and unknown usernames are dropped.
    await startTicketCheckout(paidEventId, referrer._id.toString(), { referrer: referrer.profile.username });
    const selfPayment = await TicketPaymentModel.findOne({ eventId: paidEventId, userId: referrer._id });
    check('referral: self-referral dropped', selfPayment?.referrer === '', selfPayment?.referrer);
    await startTicketCheckout(paidEventId, member._id.toString(), { referrer: 'ghost_user_who_is_not_real' });
    const ghostPayment = await TicketPaymentModel.findOne({ eventId: paidEventId, userId: member._id });
    check('referral: unknown username dropped', ghostPayment?.referrer === '', ghostPayment?.referrer);
    // Mark the referred purchase as PAID so it lands in the sales aggregation.
    await TicketPaymentModel.updateOne({ _id: buyerPayment!._id }, { $set: { status: 'PAID', paidAt: new Date() } });

    const sales = await getTicketSales(paidEventId, founder._id.toString());
    check('funnel: views counted (2, deduped ping is client-side)', sales.views === 2, sales.views);
    check('funnel: checkouts started counted (3)', sales.checkoutsStarted === 3, sales.checkoutsStarted);
    check('referral: sales card credits the referrer', sales.referrers.length === 1 && sales.referrers[0].username === referrer.profile.username && sales.referrers[0].sold === 1, sales.referrers);

    // ── E. iCal feed ────────────────────────────────────────────────────
    await registerForEvent(multiDayEvent._id.toString(), buyer._id.toString());
    const { path } = await getCalendarFeedUrl(buyer._id.toString());
    check('ical: private CAL- token minted into the feed path', /\/api\/events\/calendar\/CAL-[0-9a-f-]+\/guildos\.ics$/.test(path), path);
    const token = path.split('/calendar/')[1].split('/')[0];
    const ics = await buildUserCalendar(token);
    check('ical: valid VCALENDAR with calendar name', ics.startsWith('BEGIN:VCALENDAR') && ics.includes('X-WR-CALNAME:GuildOS'), ics.slice(0, 60));
    check('ical: multi-day event emits one VEVENT per day', ics.includes(`-day1@guildos`) && ics.includes(`-day2@guildos`) && ics.includes('Day 2: Deep dive'), undefined);
    check('ical: per-day venue used', ics.includes('Hall B2'), undefined);
    const { path: path2 } = await getCalendarFeedUrl(buyer._id.toString());
    check('ical: token is stable across calls', path2 === path);
    const { path: path3 } = await getCalendarFeedUrl(buyer._id.toString(), true);
    check('ical: regenerate mints a new token', path3 !== path, undefined);
    let dead = '';
    try { await buildUserCalendar(token); } catch (err) { dead = err instanceof Error ? err.message : 'x'; }
    check('ical: old token dead after regenerating', dead.includes('Invalid'), dead);

    // ── F. session-end reminder ─────────────────────────────────────────
    // A leadership session whose label ended last academic year.
    const endedSession = `${new Date().getFullYear() - 2}/${new Date().getFullYear() - 1}`;
    await CommunityLeaderModel.create({ communityId: community._id, name: 'Old Amirah', title: 'Amirah', session: endedSession, status: 'ACTIVE', addedBy: founder._id } as any);
    const result1 = await remindFinishedLeaderSessions();
    const bell = await NotificationModel.findOne({ userId: founder._id, title: { $regex: endedSession } }).lean();
    check('reminder: founder gets the dissolve nudge', result1.reminded >= 1 && Boolean(bell) && (bell?.link ?? '').includes('/leaders'), bell?.title);
    const result2 = await remindFinishedLeaderSessions();
    const bells = await NotificationModel.countDocuments({ userId: founder._id, title: { $regex: endedSession } });
    check('reminder: deduped — no double nag inside 30 days', bells === 1, { secondRun: result2.reminded, bells });

    // ── G. per-day capacity ─────────────────────────────────────────────
    const cappedEvent = await EventModel.create({
      communityId: community._id, createdBy: founder._id, slug: `wave-capped-${stamp}`, status: 'PUBLISHED',
      title: `Wave Capped Event ${stamp}`, shortDescription: 'x', mode: 'PHYSICAL', venue: 'Lab',
      bannerImage: '/uploads/smoke-banner.png', registrationPolicy: 'OPEN',
      startDate: new Date(Date.now() + 10 * 86400_000), endDate: new Date(Date.now() + 11 * 86400_000),
      days: [
        { date: new Date(Date.now() + 10 * 86400_000), theme: 'Lab day', venue: 'Lab', startTime: '09:00', endTime: '16:00', features: [], facilitators: [], capacity: 1 },
        { date: new Date(Date.now() + 11 * 86400_000), theme: 'Open day', venue: 'Hall', startTime: '09:00', endTime: '16:00', features: [], facilitators: [], capacity: 0 },
      ],
    } as any);
    // First registrant attends every day — occupies the single Day-1 lab seat.
    await registerForEvent(cappedEvent._id.toString(), referrer._id.toString());
    let dayFull = '';
    try { await registerForEvent(cappedEvent._id.toString(), outsider._id.toString(), { plannedDays: [1] }); } catch (err) { dayFull = err instanceof Error ? err.message : 'x'; }
    check('day-cap: full day rejected with the day number', dayFull.includes('Day 1 is full'), dayFull);
    let allDaysBlocked = '';
    try { await registerForEvent(cappedEvent._id.toString(), outsider._id.toString(), { plannedDays: [] }); } catch (err) { allDaysBlocked = err instanceof Error ? err.message : 'x'; }
    check('day-cap: "every day" RSVP also blocked while a capped day is full', allDaysBlocked.includes('Day 1 is full'), allDaysBlocked);
    const day2Reg = await registerForEvent(cappedEvent._id.toString(), outsider._id.toString(), { plannedDays: [2] });
    check('day-cap: uncapped day still open', day2Reg.status === 'CONFIRMED' && (day2Reg.plannedDays ?? []).join(',') === '2', day2Reg.plannedDays);
    const detail = await getEventBySlug(cappedEvent.slug);
    check('day-cap: availability exposed on the event detail', detail.dayAvailability.length === 1 && detail.dayAvailability[0].day === 1 && detail.dayAvailability[0].taken === 1 && detail.dayAvailability[0].capacity === 1, detail.dayAvailability);
    await EventRegistrationModel.deleteMany({ eventId: cappedEvent._id });
    await EventModel.deleteOne({ _id: cappedEvent._id });

    // ── H. knowledge starter pack ──────────────────────────────────────
    let packDenied = '';
    try { await createKnowledgeStarterPack(community._id.toString(), member._id.toString()); } catch (err) { packDenied = err instanceof Error ? err.message : 'x'; }
    check('starter pack: plain members refused', packDenied.includes('permissions'), packDenied);
    const pack = await createKnowledgeStarterPack(community._id.toString(), founder._id.toString());
    check('starter pack: TECH community gets base + tech extras (6)', pack.created === 6, pack);
    const packDocs = await KnowledgeResourceModel.find({ communityId: community._id }).select('type category title').lean();
    check('starter pack: all editable articles, Getting Started leads', packDocs.every((d) => d.type === 'ARTICLE') && packDocs.some((d) => d.category === 'GETTING_STARTED') && packDocs.some((d) => d.category === 'OPPORTUNITY'), packDocs.map((d) => d.category));
    let packAgain = '';
    try { await createKnowledgeStarterPack(community._id.toString(), founder._id.toString()); } catch (err) { packAgain = err instanceof Error ? err.message : 'x'; }
    check('starter pack: refused once the hub has content', packAgain.includes('already has content'), packAgain);

    // ── I. leader-cert custom name placement ───────────────────────
    const placedLeader = await CommunityLeaderModel.create({
      communityId: community._id, name: 'Placed Leader', title: 'PRO', session: '2025/2026', status: 'ACTIVE', addedBy: founder._id,
    } as any);
    const communityDoc = await CommunityModel.findById(community._id);
    const placedCerts = await issueLeaderCertificates(communityDoc!, [placedLeader._id.toString()], '2025/2026', founder._id.toString(), {
      mode: 'CUSTOM',
      templateImage: '/uploads/demo-org-logo.svg',
      namePlacement: { x: 30, y: 72, fontSize: 8, color: '#8b0000', align: 'left' },
    });
    const placedCert = await CertificateModel.findOne({ serial: placedCerts[0].serial }).select('namePlacement mode').lean();
    check('placement: CUSTOM leader cert stores the chosen spot', placedCert?.mode === 'CUSTOM' && placedCert?.namePlacement?.x === 30 && placedCert?.namePlacement?.y === 72 && placedCert?.namePlacement?.align === 'left' && placedCert?.namePlacement?.color === '#8b0000', placedCert?.namePlacement);
    const clampedCerts = await issueLeaderCertificates(communityDoc!, [placedLeader._id.toString()], '2025/2026', founder._id.toString(), {
      mode: 'CUSTOM',
      templateImage: '/uploads/demo-org-logo.svg',
      namePlacement: { x: 999, y: -5, fontSize: 100, color: 'javascript:alert(1)', align: 'diagonal' as never },
      reissueExisting: true,
    });
    const clamped = await CertificateModel.findOne({ serial: clampedCerts[0].serial }).select('namePlacement serial').lean();
    check('placement: hostile values clamped, serial unchanged on reissue', clampedCerts[0].serial === placedCerts[0].serial && clamped?.namePlacement?.x === 100 && clamped?.namePlacement?.y === 0 && clamped?.namePlacement?.fontSize === 20 && clamped?.namePlacement?.color === '#111111' && clamped?.namePlacement?.align === 'center', clamped?.namePlacement);
    await CertificateModel.deleteMany({ leaderId: placedLeader._id });
  } catch (err) {
    failed += 1;
    console.error('  \x1b[31mERROR\x1b[0m', err instanceof Error ? err.message : err);
  } finally {
    console.log(`\n=== ${passed} passed, ${failed} failed ===`);
    await NotificationModel.deleteMany({ userId: { $in: [founder._id, member._id, buyer._id, referrer._id, outsider._id] } });
    await MembershipActivityModel.deleteMany({ communityId: community._id });
    await TicketPaymentModel.deleteMany({ eventId: { $in: [paidEvent._id, multiDayEvent._id] } });
    await EventRegistrationModel.deleteMany({ eventId: { $in: [paidEvent._id, multiDayEvent._id] } });
    await PostModel.deleteMany({ communityId: community._id });
    await KnowledgeResourceModel.deleteMany({ communityId: community._id });
    await CommunityLeaderModel.deleteMany({ communityId: community._id });
    await EventModel.deleteMany({ _id: { $in: [paidEvent._id, multiDayEvent._id] } });
    await MembershipModel.deleteMany({ communityId: community._id });
    await CommunityModel.deleteOne({ _id: community._id });
    await UserModel.deleteMany({ _id: { $in: [founder._id, member._id, buyer._id, referrer._id, outsider._id] } });
    await mongoose.disconnect();
    process.exit(failed ? 1 : 0);
  }
}

void main();
