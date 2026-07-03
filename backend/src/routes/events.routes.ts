import { Router } from 'express';
import { requireAuth, optionalAuth, type AuthenticatedRequest } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { generateEventDraft } from '../services/event-ai.service';
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
  createEvent,
  deleteEvent,
  finalizeEventAttendance,
  getEventAnalytics,
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
  rejectRegistration,
  removeEventSpeaker,
  removeEventSponsor,
  searchWalkInUsers,
  setEventStatus,
  updateEvent,
  walkInCheckIn,
  type EventInput,
} from '../services/event.service';

export const eventsRouter = Router();

function statusFor(message: string) {
  if (/not found/i.test(message)) return 404;
  if (/permission|owner|senior leaders|archived|private/i.test(message)) return 403;
  return 400;
}

function eventInputFromBody(body: Record<string, unknown>): EventInput {
  const {
    title, type, shortDescription, description, bannerImage, mode, venue, address, meetingLink,
    startDate, endDate, timezone, registrationPolicy, registrationDeadline, capacity, waitlistEnabled,
    allowWalkIns, qrEnabled, certificateEnabled, certificateTemplate, minimumAttendanceDuration,
    checkOutRequired, visibility,
  } = body as EventInput & Record<string, unknown>;
  return {
    title, type, shortDescription, description, bannerImage, mode, venue, address, meetingLink,
    startDate, endDate, timezone, registrationPolicy, registrationDeadline, capacity, waitlistEnabled,
    allowWalkIns, qrEnabled, certificateEnabled, certificateTemplate, minimumAttendanceDuration,
    checkOutRequired, visibility,
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

eventsRouter.post('/upload', requireAuth, upload.fields([
  { name: 'banner', maxCount: 1 },
  { name: 'speakerPhoto', maxCount: 1 },
  { name: 'sponsorLogo', maxCount: 1 },
  { name: 'certificateTemplate', maxCount: 1 },
]), async (req: AuthenticatedRequest, res) => {
  try {
    const files = req.files as { [field: string]: Express.Multer.File[] } | undefined;
    return res.json({
      banner: files?.banner?.[0] ? `/uploads/${files.banner[0].filename}` : '',
      speakerPhoto: files?.speakerPhoto?.[0] ? `/uploads/${files.speakerPhoto[0].filename}` : '',
      sponsorLogo: files?.sponsorLogo?.[0] ? `/uploads/${files.sponsorLogo[0].filename}` : '',
      certificateTemplate: files?.certificateTemplate?.[0] ? `/uploads/${files.certificateTemplate[0].filename}` : '',
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
    const registration = await registerForEvent(req.params.id, req.userId as string);
    return res.status(201).json({ registration });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to register';
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
