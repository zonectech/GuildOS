import { Router } from 'express';
import { doorScanLimiter } from '../middleware/rate-limit';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import { attendanceCheckIn, attendanceCheckOut } from '../services/event.service';
import { syncDoorScans } from '../services/event/event-attendance.service';

export const attendanceRouter = Router();

function statusForAttendance(message: string) {
  return /invalid|not registered|not found/i.test(message)
    ? 404
    : /permission|not started|already|not checked in/i.test(message)
      ? 403
      : 400;
}

// Organizer scans a student's event pass (by registrationId or their QR token).
attendanceRouter.post('/checkin', requireAuth, doorScanLimiter, async (req: AuthenticatedRequest, res) => {
  try {
    const { registrationId, token, eventId } = req.body as { registrationId?: string; token?: string; eventId?: string };
    if (!registrationId && !token) {
      return res.status(400).json({ error: 'registrationId or token is required' });
    }

    const result = await attendanceCheckIn(
      req.userId as string,
      { registrationId, token, eventId: typeof eventId === 'string' ? eventId : undefined },
      { ip: req.ip, userAgent: req.headers['user-agent'] },
    );
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to check in';
    return res.status(statusForAttendance(message)).json({ error: message });
  }
});

// Organizer scans the same pass to verify departure and finalize participation.
attendanceRouter.post('/checkout', requireAuth, doorScanLimiter, async (req: AuthenticatedRequest, res) => {
  try {
    const { registrationId, token, eventId } = req.body as { registrationId?: string; token?: string; eventId?: string };
    if (!registrationId && !token) {
      return res.status(400).json({ error: 'registrationId or token is required' });
    }

    const result = await attendanceCheckOut(
      req.userId as string,
      { registrationId, token, eventId: typeof eventId === 'string' ? eventId : undefined },
      { ip: req.ip, userAgent: req.headers['user-agent'] },
    );
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to check out';
    return res.status(statusForAttendance(message)).json({ error: message });
  }
});

// Scans made while the door was offline, sent when it is back (organizers and assigned helpers).
attendanceRouter.post('/sync', requireAuth, doorScanLimiter, async (req: AuthenticatedRequest, res) => {
  try {
    const { eventId, scans } = req.body as { eventId?: string; scans?: unknown };
    if (!eventId) return res.status(400).json({ error: 'eventId is required' });
    return res.json(await syncDoorScans(String(eventId), req.userId as string, scans, { ip: req.ip, userAgent: req.headers['user-agent'] }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to sync';
    return res.status(statusForAttendance(message)).json({ error: message });
  }
});
