import { Router } from 'express';
import { requireAuth, optionalAuth, type AuthenticatedRequest } from '../middleware/auth';
import { aiLimiter, uploadLimiter, viewPingLimiter } from '../middleware/rate-limit';
import { upload, persistUploads } from '../middleware/upload';
import { generateEventDraft, generateCertificateWording, parseDocumentForEvent, isAllowedDocMime } from '../services/event-ai.service';
import multer from 'multer';

const docUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!isAllowedDocMime(file.mimetype)) {
      return cb(new Error('Only PDF, DOCX, and plain-text files are allowed'));
    }
    cb(null, true);
  },
});
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
  switchRegistrationSection,
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
  recordEventView,
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
  announceEvent,
  postponeEvent,
  resumeEvent,
  registerForEvent,
  selfCheckIn,
  selfCheckOut,
  submitEventFeedback,
  rejectRegistration,
  removeEventSpeaker,
  removeEventSponsor,
  searchWalkInUsers,
  setEventStatus,
  setEventRegistrationClosed,
  cancelEventDays,
  messageEventAttendees,
  getEventInviteLink,
  createScannerPasses,
  listScannerPasses,
  revokeScannerPass,
  getDoorScannerInfo,
  doorScan,
  transferTicket,
  toggleEventBookmark,
  listMyBookmarkedEvents,
  listEventAnticipators,
  isEventBookmarked,
  updateEvent,
  walkInCheckIn,
  getTicketQuote,
  getTicketCommissionPercent,
  listMyTicketClaims,
  claimTicket,
  checkMyTicketPayment,
  startTicketCheckout,
  verifyTicketPayment,
  getTicketSales,
  organizerCancelRegistration,
  type EventInput,
} from '../services/event.service';
import { getCalendarFeedUrl, buildUserCalendar } from '../services/calendar-feed.service';
import { listRecommendedEvents } from '../services/ranking/event-ranking.service';
import {
  createSponsorshipInquiry,
  convertInquiryToSponsor,
  getSponsorReport,
  revokeInquiryConversion,
  getSponsorshipFeeSettings,
  listOpenSponsorshipEvents,
  listSponsorshipInquiries,
  setSponsorshipInquiryStatus,
} from '../services/sponsorship.service';
import { getSponsorshipReceipt, startSponsorshipCheckout, verifySponsorshipPayment } from '../services/sponsorship-payment.service';
import { getEventPremiumQuote, startEventPremiumCheckout, verifyPremiumPayment, reconcileEventPayments } from '../services/premium.service';
import { payEventPremiumFromWallet, walletBalanceForPremium } from '../services/community.service';
import { EventModel } from '../models/event.model';
import {
  inviteEventPartnership,
  respondEventPartnership,
  listEventPartnerships,
  removeEventPartnership,
} from '../services/event-partnership.service';
import { EventPolicyError } from '../services/event-abuse.service';
import { recordAdminAction } from '../services/admin-audit.service';

export const eventsRouter = Router();

function statusFor(message: string) {
  if (/not found/i.test(message)) return 404;
  if (/permission|owner|senior leaders|archived|private/i.test(message)) return 403;
  return 400;
}

function policyStatus(error: unknown, fallbackMessage: string, res: { setHeader(name: string, value: string): unknown }) {
  if (error instanceof EventPolicyError) {
    if (error.retryAfterSeconds) res.setHeader('Retry-After', String(error.retryAfterSeconds));
    return { message: error.message, status: error.statusCode, retryAfterSeconds: error.retryAfterSeconds };
  }
  if (typeof error === 'object' && error && 'code' in error && error.code === 11000) {
    return { message: 'An event with this title already exists on the same day', status: 409 };
  }
  const message = error instanceof Error ? error.message : fallbackMessage;
  return { message, status: statusFor(message) };
}

async function auditEvent(actorId: string, action: string, targetId: string, note = '') {
  await recordAdminAction({ adminId: actorId, action, targetType: 'EVENT', targetId, note });
}

function eventInputFromBody(body: Record<string, unknown>): EventInput {
  const {
    title, type, shortDescription, description, theme, features, days, minimumAttendanceDays, sections, contacts, bannerImage, mode, venue, state, address, meetingLink, attendeeChatLink, tags, refreshments, gallery, appreciationMode,
    startDate, endDate, timezone, registrationPolicy, registrationDeadline, registrationQuestions, capacity, waitlistEnabled, ticketPrice, ticketTiers, ticketPromoCodes, ticketGroupDiscount, ticketTemplate, ticketStyle, ticketAccent, ticketQrPlacement,
    allowWalkIns, qrEnabled, certificateEnabled, certificateMode, certificateType, certificateTemplate,
    certificateNamePlacement, certificateTheme, certificateStyle, certificateContent, minimumAttendanceDuration,
    checkOutRequired, visibility, sponsorshipOpen, sponsorshipPitch, sponsorshipPackages, partners,
  } = body as EventInput & Record<string, unknown>;
  return {
    title, type, shortDescription, description, theme, features, days, minimumAttendanceDays, sections, contacts, bannerImage, mode, venue, state, address, meetingLink, attendeeChatLink, tags, refreshments, gallery, appreciationMode,
    startDate, endDate, timezone, registrationPolicy, registrationDeadline, registrationQuestions, capacity, waitlistEnabled, ticketPrice, ticketTiers, ticketPromoCodes, ticketGroupDiscount, ticketTemplate, ticketStyle, ticketAccent, ticketQrPlacement,
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

// PUBLIC sponsor receipt — the unguessable SPN- reference is the authorization.
// NOTE: must stay registered before GET /:slug.
eventsRouter.get('/sponsorship/receipt', async (req, res) => {
  try {
    const receipt = await getSponsorshipReceipt(String(req.query.reference ?? ''));
    return res.json({ receipt });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Receipt not found';
    return res.status(404).json({ error: message });
  }
});

// Ticketing terms shown in the event wizard (commission % is admin-configurable). Must stay before GET /:slug.
eventsRouter.get('/ticket-settings', async (_req, res) => {
  try {
    const commissionPercent = await getTicketCommissionPercent();
    return res.json({ commissionPercent });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to fetch ticket settings' });
  }
});

// Personal iCal subscription: mint (or regenerate with ?regenerate=1) the private feed URL.
// Must stay before GET /:slug.
eventsRouter.get('/calendar-feed', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { path } = await getCalendarFeedUrl(req.userId as string, req.query.regenerate === '1');
    return res.json({ path });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to create calendar feed' });
  }
});

// PUBLIC: the .ics feed itself — calendar apps poll this without cookies, the token IS the auth.
eventsRouter.get('/calendar/:token/guildos.ics', async (req, res) => {
  try {
    const ics = await buildUserCalendar(req.params.token);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="guildos.ics"');
    res.setHeader('Cache-Control', 'private, max-age=300');
    return res.send(ics);
  } catch {
    return res.status(404).json({ error: 'Invalid calendar link' });
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

eventsRouter.post('/ai-draft', requireAuth, aiLimiter, async (req: AuthenticatedRequest, res) => {
  try {
    const { prompt } = req.body as { prompt?: string };
    const draft = await generateEventDraft(prompt ?? '');
    return res.json({ draft });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to generate draft';
    return res.status(400).json({ error: message });
  }
});

eventsRouter.post('/parse-document', requireAuth, aiLimiter, docUpload.single('doc'), async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No document uploaded' });
    const rawMode = String(req.body?.dayMode ?? 'auto');
    const dayMode = rawMode === 'single' || rawMode === 'multi' ? rawMode : 'auto';
    const draft = await parseDocumentForEvent(req.file.buffer, req.file.mimetype, dayMode);
    return res.json({ draft });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to parse document';
    return res.status(500).json({ error: message });
  }
});

// AI-assisted certificate wording (premium communities only).
eventsRouter.post('/certificate-wording', requireAuth, aiLimiter, async (req: AuthenticatedRequest, res) => {
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
    // Wallet balance rides along so the wizard can offer "pay from wallet".
    const event = await EventModel.findById(req.params.id).select('communityId').lean();
    const wallet = event ? await walletBalanceForPremium(event.communityId.toString()).catch(() => ({ availableNgn: 0 })) : { availableNgn: 0 };
    return res.json({ ...quote, walletAvailableNgn: wallet.availableNgn });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to fetch quote';
    const status = message.includes('not found') ? 404 : message.includes('managers') ? 403 : 400;
    return res.status(status).json({ error: message });
  }
});

// Unlock this event's premium customization using the community wallet (Treasurer+; no gateway fee).
eventsRouter.post('/:id/premium/pay-from-wallet', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await payEventPremiumFromWallet(req.params.id, req.userId as string);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to pay from wallet';
    const status = message.includes('not found') ? 404 : message.includes('leaders') ? 403 : 400;
    return res.status(status).json({ error: message });
  }
});

// Paid tickets: quote (public), checkout (buyer), verify (buyer return-URL), sales (organizer).
eventsRouter.get('/:id/ticket/quote', async (req, res) => {
  try {
    const quote = await getTicketQuote(req.params.id, {
      tierName: typeof req.query.tier === 'string' ? req.query.tier : undefined,
      promoCode: typeof req.query.code === 'string' ? req.query.code : undefined,
      quantity: typeof req.query.qty === 'string' ? Number(req.query.qty) : undefined,
    });
    return res.json(quote);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to fetch ticket quote';
    return res.status(message.includes('not found') ? 404 : 400).json({ error: message });
  }
});

eventsRouter.post('/:id/ticket/checkout', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const body = (req.body ?? {}) as { tierName?: string; promoCode?: string; quantity?: number; inviteToken?: string; referrer?: string; sectionKey?: string; answers?: Record<string, unknown> };
    const result = await startTicketCheckout(req.params.id, req.userId as string, {
      tierName: typeof body.tierName === 'string' ? body.tierName : undefined,
      promoCode: typeof body.promoCode === 'string' ? body.promoCode : undefined,
      quantity: body.quantity,
      inviteToken: typeof body.inviteToken === 'string' ? body.inviteToken : undefined,
      referrer: typeof body.referrer === 'string' ? body.referrer : undefined,
      sectionKey: typeof body.sectionKey === 'string' ? body.sectionKey : undefined,
      answers: body.answers && typeof body.answers === 'object' && !Array.isArray(body.answers) ? body.answers : undefined,
    });
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to start ticket payment';
    return res.status(message.includes('not found') ? 404 : 400).json({ error: message });
  }
});

// Hand a ticket to another account before check-in (registration moves, payment stays with the buyer).
eventsRouter.post('/:id/ticket/transfer', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const to = String((req.body as { to?: unknown })?.to ?? '');
    const result = await transferTicket(req.params.id, req.userId as string, to);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to transfer ticket';
    return res.status(statusFor(message)).json({ error: message });
  }
});

// Group purchases: the buyer's shareable guest-ticket links + guest redemption.
eventsRouter.get('/:id/ticket/claims', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const claims = await listMyTicketClaims(req.params.id, req.userId as string);
    return res.json({ claims });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to fetch ticket links' });
  }
});

eventsRouter.post('/ticket/claim', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const token = typeof (req.body as { token?: string })?.token === 'string' ? (req.body as { token: string }).token : '';
    if (!token) return res.status(400).json({ error: 'A ticket link token is required' });
    const claimAnswers = req.body?.answers && typeof req.body.answers === 'object' && !Array.isArray(req.body.answers) ? (req.body.answers as Record<string, unknown>) : undefined;
    const result = await claimTicket(token, req.userId as string, claimAnswers);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to claim ticket';
    return res.status(message.includes('not valid') ? 404 : 400).json({ error: message });
  }
});

eventsRouter.get('/:id/ticket/verify', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const reference = typeof req.query.reference === 'string' ? req.query.reference : '';
    if (!reference) return res.status(400).json({ error: 'A payment reference is required' });
    const result = await verifyTicketPayment(reference);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to verify ticket payment';
    return res.status(message.includes('not found') ? 404 : 400).json({ error: message });
  }
});

// Buyer-triggered: re-check my recent payment for this event (missed redirect safety net).
eventsRouter.post('/:id/ticket/check', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await checkMyTicketPayment(req.params.id, req.userId as string);
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to check payment' });
  }
});

eventsRouter.get('/:id/ticket/sales', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const sales = await getTicketSales(req.params.id, req.userId as string);
    return res.json(sales);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to fetch ticket sales';
    const status = message.includes('not found') ? 404 : /manager/i.test(message) ? 403 : 400;
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

eventsRouter.post('/upload', requireAuth, uploadLimiter, upload.fields([
  { name: 'banner', maxCount: 1 },
  { name: 'speakerPhoto', maxCount: 1 },
  { name: 'sponsorLogo', maxCount: 1 },
  { name: 'partnerLogo', maxCount: 1 },
  { name: 'certificateTemplate', maxCount: 1 },
  { name: 'signature', maxCount: 1 },
  { name: 'certificateLogo', maxCount: 1 },
  { name: 'ticketTemplate', maxCount: 1 },
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
      ticketTemplate: files?.ticketTemplate?.[0] ? `/uploads/${files.ticketTemplate[0].filename}` : '',
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
    await auditEvent(req.userId as string, 'EVENT_CREATED', event._id.toString(), `${event.title} · ${event.status}`);
    return res.status(201).json({ event });
  } catch (error) {
    const result = policyStatus(error, 'Unable to create event', res);
    await auditEvent(req.userId as string, 'EVENT_CREATION_BLOCKED', String(req.body?.communityId ?? ''), `${String(req.body?.title ?? '').slice(0, 120)} · ${result.message}`);
    return res.status(result.status).json({ error: result.message, ...(result.retryAfterSeconds ? { retryAfterSeconds: result.retryAfterSeconds } : {}) });
  }
});

eventsRouter.get('/:slug', optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const detail = await getEventBySlug(req.params.slug, req.userId);
    const viewerBookmarked = req.userId && detail?.event?._id
      ? await isEventBookmarked(String(detail.event._id), req.userId)
      : false;
    return res.json({ ...detail, viewerBookmarked });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to fetch event';
    return res.status(statusFor(message)).json({ error: message });
  }
});

// PUBLIC page-view ping (fire-and-forget; the page dedupes per browser session).
eventsRouter.post('/:slug/view', viewPingLimiter, async (req, res) => {
  try {
    await recordEventView(req.params.slug);
    return res.json({ ok: true });
  } catch {
    return res.json({ ok: false });
  }
});

eventsRouter.patch('/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const event = await updateEvent(req.params.id, req.userId as string, eventInputFromBody(req.body));
    const changed = ['title', 'startDate', 'endDate', 'venue', 'meetingLink', 'visibility', 'registrationPolicy']
      .filter((field) => req.body?.[field] !== undefined)
      .join(', ');
    await auditEvent(req.userId as string, 'EVENT_EDITED', event._id.toString(), changed ? `Changed: ${changed}` : 'Event settings updated');
    return res.json({ event });
  } catch (error) {
    const result = policyStatus(error, 'Unable to update event', res);
    await auditEvent(req.userId as string, 'EVENT_EDIT_BLOCKED', req.params.id, result.message);
    return res.status(result.status).json({ error: result.message });
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

// Announce mode: event goes public for anticipation; registration opens on publish.
eventsRouter.post('/:id/announce', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const event = await announceEvent(req.params.id, req.userId as string);
    await auditEvent(req.userId as string, 'EVENT_ANNOUNCED', event._id.toString(), event.title);
    return res.json({ event });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to announce event';
    return res.status(statusFor(message)).json({ error: message });
  }
});

eventsRouter.post('/:id/publish', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const event = await publishEvent(req.params.id, req.userId as string);
    await auditEvent(req.userId as string, 'EVENT_PUBLISHED', event._id.toString(), event.title);
    return res.json({ event });
  } catch (error) {
    const result = policyStatus(error, 'Unable to publish event', res);
    await auditEvent(req.userId as string, 'EVENT_PUBLISH_BLOCKED', req.params.id, result.message);
    return res.status(result.status).json({ error: result.message });
  }
});

// "Run it again" — clone a past event into a fresh draft.
eventsRouter.post('/:id/clone', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const event = await cloneEvent(req.params.id, req.userId as string);
    await auditEvent(req.userId as string, 'EVENT_CLONED', event._id.toString(), `Source: ${req.params.id}`);
    return res.status(201).json({ event });
  } catch (error) {
    const result = policyStatus(error, 'Unable to clone event', res);
    await auditEvent(req.userId as string, 'EVENT_CLONE_BLOCKED', req.params.id, result.message);
    return res.status(result.status).json({ error: result.message, ...(result.retryAfterSeconds ? { retryAfterSeconds: result.retryAfterSeconds } : {}) });
  }
});

// Postpone a live event (registrations frozen, no refunds, attendees notified).
eventsRouter.post('/:id/postpone', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { note = '' } = req.body as { note?: string };
    const event = await postponeEvent(req.params.id, req.userId as string, note);
    await auditEvent(req.userId as string, 'EVENT_POSTPONED', event._id.toString(), event.title);
    return res.json({ event });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to postpone event';
    return res.status(statusFor(message)).json({ error: message });
  }
});

// Republish a postponed event (new future date required; attendees notified).
eventsRouter.post('/:id/resume', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const event = await resumeEvent(req.params.id, req.userId as string);
    await auditEvent(req.userId as string, 'EVENT_RESUMED', event._id.toString(), event.title);
    return res.json({ event });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to republish event';
    return res.status(statusFor(message)).json({ error: message });
  }
});

// Post-event feedback: attendees rate 1-5 (+comment); multi-day events rate per ended day.
eventsRouter.post('/:id/feedback', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { rating, comment, day } = req.body as { rating?: number; comment?: string; day?: number };
    const feedback = await submitEventFeedback(req.params.id, req.userId as string, { rating, comment, day });
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
    const reason = typeof (req.body as { reason?: string })?.reason === 'string' ? (req.body as { reason: string }).reason : undefined;
    const event = await archiveEvent(req.params.id, req.userId as string, reason);
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

// Manual registration switch: close (or reopen) sign-ups + ticket sales while the event is live.
eventsRouter.post('/:id/registration-closed', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const closed = Boolean((req.body as { closed?: unknown })?.closed);
    const event = await setEventRegistrationClosed(req.params.id, req.userId as string, closed);
    return res.json({ event });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update registration';
    return res.status(statusFor(message)).json({ error: message });
  }
});

// Cancel specific day(s) of a multi-day event: notifies planned attendees, refunds day-scoped tickets.
eventsRouter.post('/:id/days/cancel', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const body = req.body as { days?: unknown; reason?: unknown };
    const days = Array.isArray(body?.days) ? body.days.map(Number) : [];
    const reason = typeof body?.reason === 'string' ? body.reason : '';
    const result = await cancelEventDays(req.params.id, req.userId as string, days, reason);
    return res.json({
      event: result.event,
      cancelledDays: result.cancelledDays,
      notified: result.notified,
      refunded: result.refunded,
      queued: result.queued,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to cancel event days';
    return res.status(statusFor(message)).json({ error: message });
  }
});

// Organizer blast to everyone registered for this event (bell + branded email).
// Pass sectionKey to reach just one track's cohort.
eventsRouter.post('/:id/message', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { subject, message, sectionKey } = (req.body ?? {}) as { subject?: string; message?: string; sectionKey?: string };
    const result = await messageEventAttendees(req.params.id, req.userId as string, { subject, message, sectionKey });
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to message attendees';
    return res.status(statusFor(message)).json({ error: message });
  }
});

// Invite-only events: fetch (or regenerate with {regenerate:true}) the shareable invite link secret.
eventsRouter.post('/:id/invite-link', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const regenerate = Boolean((req.body as { regenerate?: unknown })?.regenerate);
    const result = await getEventInviteLink(req.params.id, req.userId as string, regenerate);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to fetch invite link';
    return res.status(statusFor(message)).json({ error: message });
  }
});

// Door-scanner passes for gate helpers: mint several single-device links, list claim status, revoke individually.
eventsRouter.post('/:id/scanner-links', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const count = Number((req.body as { count?: unknown })?.count ?? 1);
    const passes = await createScannerPasses(req.params.id, req.userId as string, count);
    return res.json({ passes });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create scanner links';
    return res.status(statusFor(message)).json({ error: message });
  }
});

eventsRouter.get('/:id/scanner-links', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const passes = await listScannerPasses(req.params.id, req.userId as string);
    return res.json({ passes });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to list scanner links';
    return res.status(statusFor(message)).json({ error: message });
  }
});

eventsRouter.delete('/:id/scanner-links/:passId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await revokeScannerPass(req.params.id, req.params.passId, req.userId as string);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to revoke scanner link';
    return res.status(statusFor(message)).json({ error: message });
  }
});

// PUBLIC door-scanner endpoints — the SCN- token is the authorization (no account needed).
// The first device presenting a deviceId claims the pass; other devices are refused.
// NOTE: 2-segment paths, so they never clash with GET /:slug.
eventsRouter.get('/door/:scannerToken', async (req, res) => {
  try {
    const deviceId = typeof req.query.device === 'string' ? req.query.device.slice(0, 64) : undefined;
    const info = await getDoorScannerInfo(req.params.scannerToken, deviceId);
    return res.json(info);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid scanner link';
    return res.status(message.includes('another device') ? 403 : 404).json({ error: message });
  }
});

eventsRouter.post('/door/:scannerToken/scan', async (req, res) => {
  try {
    const { token, action, deviceId } = (req.body ?? {}) as { token?: string; action?: string; deviceId?: string };
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'A pass code is required' });
    }
    const result = await doorScan(
      req.params.scannerToken,
      token.trim(),
      action === 'out' ? 'out' : 'in',
      typeof deviceId === 'string' ? deviceId.slice(0, 64) : '',
      { ip: req.ip, userAgent: req.headers['user-agent'] },
    );
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Scan failed';
    return res.status(statusFor(message)).json({ error: message });
  }
});

// Bookmarks ("interested"): save an event without registering.
eventsRouter.get('/bookmarks/mine', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const events = await listMyBookmarkedEvents(req.userId as string);
    return res.json({ events });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to fetch saved events' });
  }
});

eventsRouter.post('/:id/bookmark', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await toggleEventBookmark(req.params.id, req.userId as string);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save event';
    return res.status(statusFor(message)).json({ error: message });
  }
});

// Organizer view: who is anticipating (saved) this event, with registration state.
eventsRouter.get('/:id/anticipators', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const anticipators = await listEventAnticipators(req.params.id, req.userId as string);
    return res.json({ anticipators });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to fetch anticipators';
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
    const inviteToken = typeof req.body?.inviteToken === 'string' ? req.body.inviteToken : undefined;
    const sectionKey = typeof req.body?.sectionKey === 'string' ? req.body.sectionKey : undefined;
    const answers = req.body?.answers && typeof req.body.answers === 'object' && !Array.isArray(req.body.answers) ? (req.body.answers as Record<string, unknown>) : undefined;
    const registration = await registerForEvent(req.params.id, req.userId as string, { attendanceMode, plannedDays, inviteToken, sectionKey, answers });
    return res.status(201).json({ registration });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to register';
    return res.status(statusFor(message)).json({ error: message });
  }
});

// Self-service section/track switch — allowed until check-in opens, seats permitting.
eventsRouter.post('/:id/register/section', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const sectionKey = typeof req.body?.sectionKey === 'string' ? req.body.sectionKey : '';
    const registration = await switchRegistrationSection(req.params.id, req.userId as string, sectionKey);
    return res.json({ registration });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to switch section';
    return res.status(statusFor(message)).json({ error: message });
  }
});

// Online attendees (virtual events / hybrid-online registrations) mark their own attendance.
// Returns the meeting link too so the frontend can check in + open the call in one tap.
eventsRouter.post('/:id/attendance/self-check-in', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { registration, meetingLink } = await selfCheckIn(req.params.id, req.userId as string, { ip: req.ip, userAgent: req.headers['user-agent'] });
    return res.json({ registration, meetingLink });
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
    const reason = typeof (req.body as { reason?: unknown })?.reason === 'string' ? (req.body as { reason: string }).reason : '';
    const result = await cancelRegistration(req.params.id, req.userId as string, reason);
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

// Organizer removes an attendee (reason required — the attendee sees it; paid tickets auto-refund).
eventsRouter.post('/:id/registrations/:registrationId/cancel', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const reason = typeof (req.body as { reason?: unknown })?.reason === 'string' ? (req.body as { reason: string }).reason : '';
    const result = await organizerCancelRegistration(req.params.id, req.params.registrationId, req.userId as string, reason);
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
    // Section names ride along so the attendees page can label rows without another fetch.
    const event = await EventModel.findById(req.params.id).select('sections').lean();
    const sections = (event?.sections ?? []).map((s) => ({ key: s.key, name: s.name }));
    return res.json({ registrations, sections });
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

// Un-converts a WON deal that fell through (removes the sponsor listing).
eventsRouter.post('/:id/sponsorship/inquiries/:inquiryId/revoke', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await revokeInquiryConversion(req.params.id, req.params.inquiryId, req.userId as string);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to revoke sponsorship';
    return res.status(statusFor(message)).json({ error: message });
  }
});

// Organizer generates a hosted checkout link the sponsor pays through (fee settles at source).
eventsRouter.post('/:id/sponsorship/inquiries/:inquiryId/checkout', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await startSponsorshipCheckout(req.params.id, req.params.inquiryId, req.userId as string);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to start sponsor checkout';
    return res.status(statusFor(message)).json({ error: message });
  }
});

// Public: verify an SPN- reference after the sponsor's gateway redirect (no account needed).
eventsRouter.get('/sponsorship/payments/verify', async (req, res) => {
  try {
    const reference = typeof req.query.reference === 'string' ? req.query.reference : '';
    if (!reference.startsWith('SPN-')) return res.status(400).json({ error: 'A sponsorship payment reference is required' });
    const result = await verifySponsorshipPayment(reference);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to verify sponsorship payment';
    return res.status(message.includes('not found') ? 404 : 400).json({ error: message });
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
