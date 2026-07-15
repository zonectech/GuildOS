import { Router } from 'express';
import { requireAuth, optionalAuth, type AuthenticatedRequest } from '../middleware/auth';
import { upload, persistUploads } from '../middleware/upload';
import { generateEventDraft, generateCertificateWording } from '../services/event-ai.service';
import { getCommunityById } from '../services/community.service';
import {
  addEventSpeaker,
  updateEventSpeaker,
  searchSpeakerUsers,
  listEventVolunteers,
  addEventVolunteer,
  removeEventVolunteer,
  searchVolunteerUsers,
  addEventSponsor,
  approveRegistration,
  archiveEvent,
  cancelRegistration,
  checkInByToken,
  checkInRegistration,
  checkOutRegistration,
  cloneEvent,
  createEvent,
  deleteEvent,
  finalizeEventAttendance,
  getEventAnalytics,
  getEventFeedback,
  sendEventAppreciation,
  getEventBySlug,
  getEventCheckins,
  getAttendanceReport,
  getCertificateEligible,
  getEventCompletions,
  getLiveAttendance,
  getMyRegistration,
  issueEventCertificates,
  listCommunityEventsForManager,
  listEventRegistrations,
  listEventWalkIns,
  listEvents,
  organizerRegisterWalkIn,
  publishEvent,
  registerForEvent,
  selfCheckIn,
  selfCheckOut,
  submitEventFeedback,
  rejectRegistration,
  removeEventSpeaker,
  removeEventSponsor,
  searchWalkInUsers,
  setEventStatus,
  updateEvent,
  walkInCheckIn,
  type EventInput,
} from '../services/event.service';
import { listRecommendedEvents } from '../services/ranking/event-ranking.service';
import {
  createSponsorshipInquiry,
  convertInquiryToSponsor,
  getSponsorReport,
  getSponsorshipFeeSettings,
  listOpenSponsorshipEvents,
  listSponsorshipInquiries,
  setSponsorshipInquiryStatus,
} from '../services/sponsorship.service';
import { getEventPremiumQuote, startEventPremiumCheckout, verifyPremiumPayment, reconcileEventPayments } from '../services/premium.service';
import {
  inviteEventPartnership,
  respondEventPartnership,
  listEventPartnerships,
  removeEventPartnership,
} from '../services/event-partnership.service';

export const eventsRouter = Router();

function statusFor(message: string) {
  if (/not found/i.test(message)) return 404;
  if (/permission|owner|senior leaders|archived|private/i.test(message)) return 403;
  return 400;
}

function eventInputFromBody(body: Record<string, unknown>): EventInput {
  const {
    title, type, shortDescription, description, theme, features, days, minimumAttendanceDays, contacts, bannerImage, mode, venue, address, meetingLink, tags, refreshments, gallery, appreciationMode,
    startDate, endDate, timezone, registrationPolicy, registrationDeadline, capacity, waitlistEnabled,
    allowWalkIns, qrEnabled, certificateEnabled, certificateMode, certificateType, certificateTemplate,
    certificateNamePlacement, certificateTheme, certificateStyle, certificateContent, minimumAttendanceDuration,
    checkOutRequired, visibility, sponsorshipOpen, sponsorshipPitch, sponsorshipPackages, partners,
  } = body as EventInput & Record<string, unknown>;
  return {
    title, type, shortDescription, description, theme, features, days, minimumAttendanceDays, contacts, bannerImage, mode, venue, address, meetingLink, tags, refreshments, gallery, appreciationMode,
    startDate, endDate, timezone, registrationPolicy, registrationDeadline, capacity, waitlistEnabled,
    allowWalkIns, qrEnabled, certificateEnabled, certificateMode, certificateType, certificateTemplate,
    certificateNamePlacement, certificateTheme, certificateStyle, certificateContent, minimumAttendanceDuration,
    checkOutRequired, visibility, sponsorshipOpen, sponsorshipPitch, sponsorshipPackages, partners,
  } as EventInput;
}

eventsRouter.get('/', async (req, res) => {
  try {
    const communityId = typeof req.query.communityId === 'string' ? req.query.communityId : undefined;
    const events = await listEvents({ communityId });
    return res.json({ events });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to fetch events' });
  }
});

// Personalised recommendations (docs/discovery-ranking-algorithms.md §3).
// Falls back to "upcoming by date" while ranking is disabled.
// NOTE: must stay registered before GET /:slug.
eventsRouter.get('/recommended', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit ?? 12), 1), 30);
    const events = await listRecommendedEvents(req.userId as string, limit);
    return res.json({ events });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to fetch recommendations' });
  }
});

// Public browse of events open for sponsorship. NOTE: must stay registered before GET /:slug.
eventsRouter.get('/sponsorship/open', async (_req, res) => {
  try {
    const events = await listOpenSponsorshipEvents();
    return res.json({ events });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to fetch sponsorship listings' });
  }
});

// Fee remittance details for organizers closing deals. NOTE: must stay registered before GET /:slug.
eventsRouter.get('/sponsorship/fee-settings', requireAuth, async (_req: AuthenticatedRequest, res) => {
  try {
    const settings = await getSponsorshipFeeSettings();
    return res.json({ settings });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to fetch fee settings' });
  }
});

// Public sponsor report (ATTENDANCE_REPORT perk): aggregate verified attendance, no PII.
eventsRouter.get('/:slug/sponsor-report', async (req, res) => {
  try {
    const report = await getSponsorReport(req.params.slug);
    return res.json({ report });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to build sponsor report';
    return res.status(statusFor(message)).json({ error: message });
  }
});

eventsRouter.post('/ai-draft', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { prompt } = req.body as { prompt?: string };
    const draft = await generateEventDraft(prompt ?? '');
    return res.json({ draft });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to generate draft';
    return res.status(400).json({ error: message });
  }
});

// AI-assisted certificate wording (premium communities only).
eventsRouter.post('/certificate-wording', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { communityId, eventTitle, type } = req.body as { communityId?: string; eventTitle?: string; type?: string };
    if (communityId) {
      const community = await getCommunityById(communityId);
      if (!community) return res.status(404).json({ error: 'Community not found' });
      if (!community.isPremium) return res.status(403).json({ error: 'AI wording is a premium feature' });
    }
    const wording = await generateCertificateWording({
      eventTitle: (eventTitle ?? 'this event').toString().slice(0, 120),
      type,
      communityName: undefined,
    });
    return res.json({ wording });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to generate wording';
    return res.status(400).json({ error: message });
  }
});

// Per-event premium: quote (price + gateway fee), checkout, and verify.
eventsRouter.get('/:id/premium/quote', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const quote = await getEventPremiumQuote(req.params.id, req.userId as string);
    return res.json(quote);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to fetch quote';
    const status = message.includes('not found') ? 404 : message.includes('managers') ? 403 : 400;
    return res.status(status).json({ error: message });
  }
});

eventsRouter.post('/:id/premium/checkout', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await startEventPremiumCheckout(req.params.id, req.userId as string);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to start payment';
    const status = message.includes('not found') ? 404 : message.includes('managers') ? 403 : 400;
    return res.status(status).json({ error: message });
  }
});

eventsRouter.get('/:id/premium/verify', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const reference = typeof req.query.reference === 'string' ? req.query.reference : '';
    if (!reference) return res.status(400).json({ error: 'A payment reference is required' });
    const result = await verifyPremiumPayment(reference);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to verify payment';
    return res.status(message.includes('not found') ? 404 : 400).json({ error: message });
  }
});

// Re-check any recent PENDING payments for this event (safety net if a callback was missed).
eventsRouter.post('/:id/premium/reconcile', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await reconcileEventPayments(req.params.id, req.userId as string);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to check payment';
    const status = message.includes('not found') ? 404 : message.includes('managers') ? 403 : 400;
    return res.status(status).json({ error: message });
  }
});

// --- Event partnerships (co-hosting) ---

eventsRouter.post('/:id/partnerships', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { communitySlug } = req.body as { communitySlug?: string };
    if (!communitySlug) {
      return res.status(400).json({ error: 'communitySlug is required' });
    }
    const partnership = await inviteEventPartnership(req.params.id, req.userId as string, communitySlug);
    return res.status(201).json({ partnership });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to send partnership invite';
    return res.status(statusFor(message)).json({ error: message });
  }
});

eventsRouter.get('/:id/partnerships', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const partnerships = await listEventPartnerships(req.params.id, req.userId as string);
    return res.json({ partnerships });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to list partnerships';
    return res.status(statusFor(message)).json({ error: message });
  }
});

eventsRouter.patch('/partnerships/:partnershipId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { action } = req.body as { action?: string };
    if (action !== 'ACCEPT' && action !== 'DECLINE') {
      return res.status(400).json({ error: 'action must be ACCEPT or DECLINE' });
    }
    const partnership = await respondEventPartnership(req.params.partnershipId, req.userId as string, action === 'ACCEPT');
    return res.json({ partnership });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to respond to invite';
    return res.status(statusFor(message)).json({ error: message });
  }
});

eventsRouter.delete('/:id/partnerships/:partnershipId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await removeEventPartnership(req.params.id, req.params.partnershipId, req.userId as string);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to remove partnership';
    return res.status(statusFor(message)).json({ error: message });
  }
});

eventsRouter.post('/upload', requireAuth, upload.fields([
  { name: 'banner', maxCount: 1 },
  { name: 'speakerPhoto', maxCount: 1 },
  { name: 'sponsorLogo', maxCount: 1 },
  { name: 'partnerLogo', maxCount: 1 },
  { name: 'certificateTemplate', maxCount: 1 },
  { name: 'signature', maxCount: 1 },
  { name: 'certificateLogo', maxCount: 1 },
  { name: 'gallery', maxCount: 6 },
]), persistUploads, async (req: AuthenticatedRequest, res) => {
  try {
    const files = req.files as { [field: string]: Express.Multer.File[] } | undefined;
    return res.json({
      banner: files?.banner?.[0] ? `/uploads/${files.banner[0].filename}` : '',
      speakerPhoto: files?.speakerPhoto?.[0] ? `/uploads/${files.speakerPhoto[0].filename}` : '',
      sponsorLogo: files?.sponsorLogo?.[0] ? `/uploads/${files.sponsorLogo[0].filename}` : '',
      partnerLogo: files?.partnerLogo?.[0] ? `/uploads/${files.partnerLogo[0].filename}` : '',
      certificateTemplate: files?.certificateTemplate?.[0] ? `/uploads/${files.certificateTemplate[0].filename}` : '',
      signature: files?.signature?.[0] ? `/uploads/${files.signature[0].filename}` : '',
      certificateLogo: files?.certificateLogo?.[0] ? `/uploads/${files.certificateLogo[0].filename}` : '',
      gallery: (files?.gallery ?? []).map((f) => `/uploads/${f.filename}`),
    });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to upload event media' });
  }
});

eventsRouter.get('/manage/:communityId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const events = await listCommunityEventsForManager(req.params.communityId, req.userId as string);
    return res.json({ events });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to fetch events';
    return res.status(statusFor(message)).json({ error: message });
  }
});

eventsRouter.post('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { communityId } = req.body as { communityId?: string };
    if (!communityId) {
      return res.status(400).json({ error: 'communityId is required' });
    }
    const event = await createEvent(communityId, req.userId as string, eventInputFromBody(req.body));
    return res.status(201).json({ event });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create event';
    return res.status(statusFor(message)).json({ error: message });
  }
});

eventsRouter.get('/:slug', optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const detail = await getEventBySlug(req.params.slug, req.userId);
    return res.json(detail);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to fetch event';
    return res.status(statusFor(message)).json({ error: message });
  }
});

eventsRouter.patch('/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const event = await updateEvent(req.params.id, req.userId as string, eventInputFromBody(req.body));
    return res.json({ event });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update event';
    return res.status(statusFor(message)).json({ error: message });
  }
});

eventsRouter.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await deleteEvent(req.params.id, req.userId as string);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to delete event';
    return res.status(statusFor(message)).json({ error: message });
  }
});

eventsRouter.post('/:id/publish', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const event = await publishEvent(req.params.id, req.userId as string);
    return res.json({ event });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to publish event';
    return res.status(statusFor(message)).json({ error: message });
  }
});

// "Run it again" — clone a past event into a fresh draft.
eventsRouter.post('/:id/clone', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const event = await cloneEvent(req.params.id, req.userId as string);
    return res.status(201).json({ event });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to clone event';
    return res.status(statusFor(message)).json({ error: message });
  }
});

// Post-event feedback: attendees rate 1-5 (+comment); organizers read the summary.
eventsRouter.post('/:id/feedback', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { rating, comment } = req.body as { rating?: number; comment?: string };
    const feedback = await submitEventFeedback(req.params.id, req.userId as string, { rating, comment });
    return res.json({ feedback });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to submit feedback';
    return res.status(statusFor(message)).json({ error: message });
  }
});

eventsRouter.get('/:id/feedback', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const feedback = await getEventFeedback(req.params.id, req.userId as string);
    return res.json({ feedback });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load feedback';
    return res.status(statusFor(message)).json({ error: message });
  }
});

eventsRouter.post('/:id/archive', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const event = await archiveEvent(req.params.id, req.userId as string);
    return res.json({ event });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to archive event';
    return res.status(statusFor(message)).json({ error: message });
  }
});

eventsRouter.post('/:id/finalize', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await finalizeEventAttendance(req.params.id, req.userId as string);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to finalize attendance';
    return res.status(statusFor(message)).json({ error: message });
  }
});

eventsRouter.post('/:id/status', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { status } = req.body as { status?: string };
    const allowed = ['PUBLISHED', 'CHECK_IN', 'CHECK_OUT', 'COMPLETED'];
    if (!status || !allowed.includes(status)) {
      return res.status(400).json({ error: 'A valid status is required' });
    }
    const event = await setEventStatus(req.params.id, req.userId as string, status as any);
    return res.json({ event });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update event status';
    return res.status(statusFor(message)).json({ error: message });
  }
});

eventsRouter.get('/:id/analytics', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const analytics = await getEventAnalytics(req.params.id, req.userId as string);
    return res.json({ analytics });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to fetch analytics';
    return res.status(statusFor(message)).json({ error: message });
  }
});

eventsRouter.post('/:id/appreciation', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { category, subject, heading, message, ctaLabel, ctaUrl, note } = (req.body ?? {}) as Record<string, unknown>;
    const result = await sendEventAppreciation(req.params.id, req.userId as string, {
      category: typeof category === 'string' ? category : undefined,
      subject: typeof subject === 'string' ? subject : undefined,
      heading: typeof heading === 'string' ? heading : undefined,
      message: typeof message === 'string' ? message : undefined,
      ctaLabel: typeof ctaLabel === 'string' ? ctaLabel : undefined,
      ctaUrl: typeof ctaUrl === 'string' ? ctaUrl : undefined,
      note: typeof note === 'string' ? note : undefined,
    });
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to send appreciation';
    return res.status(statusFor(message)).json({ error: message });
  }
});

eventsRouter.get('/:id/attendance/live', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const live = await getLiveAttendance(req.params.id, req.userId as string);
    return res.json({ live });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to fetch live attendance';
    return res.status(statusFor(message)).json({ error: message });
  }
});

eventsRouter.get('/:id/attendance', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const attendance = await getEventCheckins(req.params.id, req.userId as string);
    return res.json({ attendance });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to fetch attendance';
    return res.status(statusFor(message)).json({ error: message });
  }
});

eventsRouter.get('/:id/walkins', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const walkins = await listEventWalkIns(req.params.id, req.userId as string);
    return res.json({ walkins });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to fetch walk-ins';
    return res.status(statusFor(message)).json({ error: message });
  }
});

eventsRouter.get('/:id/completions', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const completions = await getEventCompletions(req.params.id, req.userId as string);
    return res.json({ completions });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to fetch completions';
    return res.status(statusFor(message)).json({ error: message });
  }
});

eventsRouter.get('/:id/certificate-eligible', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const eligible = await getCertificateEligible(req.params.id, req.userId as string);
    return res.json({ eligible });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to fetch eligible attendees';
    return res.status(statusFor(message)).json({ error: message });
  }
});

eventsRouter.get('/:id/attendance-report', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const report = await getAttendanceReport(req.params.id, req.userId as string);
    return res.json({ report });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to fetch report';
    return res.status(statusFor(message)).json({ error: message });
  }
});

eventsRouter.get('/:id/walk-in-search', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const users = await searchWalkInUsers(req.params.id, req.userId as string, q);
    return res.json({ users });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to search users';
    return res.status(statusFor(message)).json({ error: message });
  }
});

eventsRouter.post('/:id/walk-in-register', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { userId } = req.body as { userId?: string };
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    const result = await organizerRegisterWalkIn(req.params.id, req.userId as string, userId, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return res.status(201).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to register walk-in';
    return res.status(statusFor(message)).json({ error: message });
  }
});

eventsRouter.post('/:id/issue-certificates', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await issueEventCertificates(req.params.id, req.userId as string);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to issue certificates';
    return res.status(statusFor(message)).json({ error: message });
  }
});

eventsRouter.post('/check-in/:token', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const registration = await checkInByToken(req.params.token, req.userId as string);
    return res.json({ registration });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to check in';
    return res.status(statusFor(message)).json({ error: message });
  }
});

eventsRouter.post('/:id/register', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const attendanceMode = typeof req.body?.attendanceMode === 'string' ? req.body.attendanceMode : null;
    const plannedDays = Array.isArray(req.body?.plannedDays) ? req.body.plannedDays.map(Number) : undefined;
    const registration = await registerForEvent(req.params.id, req.userId as string, { attendanceMode, plannedDays });
    return res.status(201).json({ registration });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to register';
    return res.status(statusFor(message)).json({ error: message });
  }
});

// Online attendees (virtual events / hybrid-online registrations) mark their own attendance.
eventsRouter.post('/:id/attendance/self-check-in', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const registration = await selfCheckIn(req.params.id, req.userId as string, { ip: req.ip, userAgent: req.headers['user-agent'] });
    return res.json({ registration });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to check in';
    return res.status(statusFor(message)).json({ error: message });
  }
});

eventsRouter.post('/:id/attendance/self-check-out', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const registration = await selfCheckOut(req.params.id, req.userId as string, { ip: req.ip, userAgent: req.headers['user-agent'] });
    return res.json({ registration });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to check out';
    return res.status(statusFor(message)).json({ error: message });
  }
});

eventsRouter.post('/:id/cancel', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await cancelRegistration(req.params.id, req.userId as string);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to cancel registration';
    return res.status(statusFor(message)).json({ error: message });
  }
});

eventsRouter.delete('/:id/register', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await cancelRegistration(req.params.id, req.userId as string);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to cancel registration';
    return res.status(statusFor(message)).json({ error: message });
  }
});

eventsRouter.post('/:id/walk-in', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const registration = await walkInCheckIn(req.params.id, req.userId as string);
    return res.status(201).json({ registration });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to check in';
    return res.status(statusFor(message)).json({ error: message });
  }
});

eventsRouter.get('/:id/my-registration', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const registration = await getMyRegistration(req.params.id, req.userId as string);
    return res.json({ registration });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to fetch registration' });
  }
});

eventsRouter.get('/:id/registrations', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const registrations = await listEventRegistrations(req.params.id, req.userId as string);
    return res.json({ registrations });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to fetch registrations';
    return res.status(statusFor(message)).json({ error: message });
  }
});

eventsRouter.post('/:id/registrations/:registrationId/check-in', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const registration = await checkInRegistration(req.params.id, req.params.registrationId, req.userId as string);
    return res.json({ registration });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to check in';
    return res.status(statusFor(message)).json({ error: message });
  }
});

eventsRouter.post('/:id/registrations/:registrationId/check-out', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const registration = await checkOutRegistration(req.params.id, req.params.registrationId, req.userId as string);
    return res.json({ registration });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to check out';
    return res.status(statusFor(message)).json({ error: message });
  }
});

eventsRouter.post('/:id/registrations/:registrationId/approve', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const registration = await approveRegistration(req.params.id, req.params.registrationId, req.userId as string);
    return res.json({ registration });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to approve registration';
    return res.status(statusFor(message)).json({ error: message });
  }
});

eventsRouter.post('/:id/registrations/:registrationId/reject', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const registration = await rejectRegistration(req.params.id, req.params.registrationId, req.userId as string);
    return res.json({ registration });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to reject registration';
    return res.status(statusFor(message)).json({ error: message });
  }
});

eventsRouter.post('/:id/speakers', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const speaker = await addEventSpeaker(req.params.id, req.userId as string, req.body);
    return res.status(201).json({ speaker });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to add speaker';
    return res.status(statusFor(message)).json({ error: message });
  }
});

eventsRouter.get('/:id/speaker-search', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const users = await searchSpeakerUsers(req.params.id, req.userId as string, String(req.query.q ?? ''));
    return res.json({ users });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to search users';
    return res.status(statusFor(message)).json({ error: message });
  }
});

eventsRouter.patch('/:id/speakers/:speakerId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const speaker = await updateEventSpeaker(req.params.id, req.params.speakerId, req.userId as string, req.body);
    return res.json({ speaker });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update speaker';
    return res.status(statusFor(message)).json({ error: message });
  }
});

eventsRouter.get('/:id/volunteers', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const volunteers = await listEventVolunteers(req.params.id, req.userId as string);
    return res.json({ volunteers });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load volunteers';
    return res.status(statusFor(message)).json({ error: message });
  }
});

eventsRouter.post('/:id/volunteers', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const volunteer = await addEventVolunteer(req.params.id, req.userId as string, req.body);
    return res.status(201).json({ volunteer });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to add volunteer';
    return res.status(statusFor(message)).json({ error: message });
  }
});

eventsRouter.get('/:id/volunteer-search', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const users = await searchVolunteerUsers(req.params.id, req.userId as string, String(req.query.q ?? ''));
    return res.json({ users });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to search users';
    return res.status(statusFor(message)).json({ error: message });
  }
});

eventsRouter.delete('/:id/volunteers/:volunteerId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await removeEventVolunteer(req.params.id, req.params.volunteerId, req.userId as string);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to remove volunteer';
    return res.status(statusFor(message)).json({ error: message });
  }
});

eventsRouter.post('/:id/sponsors', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const sponsor = await addEventSponsor(req.params.id, req.userId as string, req.body);
    return res.status(201).json({ sponsor });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to add sponsor';
    return res.status(statusFor(message)).json({ error: message });
  }
});

// Public: a brand submits a sponsorship inquiry for an event (no account required).
eventsRouter.post('/:id/sponsorship/inquiries', async (req, res) => {
  try {
    // Honeypot: invisible field humans never fill — silently accept bot submissions
    // without storing anything so the bot cannot tell it was filtered.
    if (typeof (req.body as Record<string, unknown>)?.hp === 'string' && (req.body as Record<string, string>).hp.trim()) {
      return res.status(201).json({ inquiry: null });
    }
    const inquiry = await createSponsorshipInquiry(req.params.id, req.body ?? {});
    return res.status(201).json({ inquiry });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to submit inquiry';
    return res.status(statusFor(message)).json({ error: message });
  }
});

eventsRouter.get('/:id/sponsorship/inquiries', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const inquiries = await listSponsorshipInquiries(req.params.id, req.userId as string);
    return res.json({ inquiries });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to fetch inquiries';
    return res.status(statusFor(message)).json({ error: message });
  }
});

eventsRouter.patch('/:id/sponsorship/inquiries/:inquiryId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { status } = req.body as { status?: string };
    const inquiry = await setSponsorshipInquiryStatus(req.params.id, req.params.inquiryId, req.userId as string, status as never);
    return res.json({ inquiry });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update inquiry';
    return res.status(statusFor(message)).json({ error: message });
  }
});

// Marks a deal as WON and publishes the company as an official event sponsor.
eventsRouter.post('/:id/sponsorship/inquiries/:inquiryId/convert', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { packageWon = '', dealAmount = 0, dealNote = '', logo = '' } = req.body as { packageWon?: string; dealAmount?: number; dealNote?: string; logo?: string };
    const result = await convertInquiryToSponsor(req.params.id, req.params.inquiryId, req.userId as string, { packageWon, dealAmount, dealNote, logo });
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to convert inquiry';
    return res.status(statusFor(message)).json({ error: message });
  }
});

eventsRouter.delete('/:id/speakers/:speakerId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await removeEventSpeaker(req.params.id, req.params.speakerId, req.userId as string);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to remove speaker';
    return res.status(statusFor(message)).json({ error: message });
  }
});

eventsRouter.delete('/:id/sponsors/:sponsorId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await removeEventSponsor(req.params.id, req.params.sponsorId, req.userId as string);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to remove sponsor';
    return res.status(statusFor(message)).json({ error: message });
  }
});
