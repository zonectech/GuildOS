import { Router } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import { attendanceCheckIn, attendanceCheckOut } from '../services/event.service';

export const attendanceRouter = Router();

function statusForAttendance(message: string) {
  return /invalid|not registered|not found/i.test(message)
    ? 404
    : /permission|not started|already|not checked in/i.test(message)
      ? 403
      : 400;
}

// Organizer scans a student's event pass (by registrationId or their QR token).
attendanceRouter.post('/checkin', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { registrationId, token } = req.body as { registrationId?: string; token?: string };
    if (!registrationId && !token) {
      return res.status(400).json({ error: 'registrationId or token is required' });
    }

    const result = await attendanceCheckIn(
      req.userId as string,
      { registrationId, token },
      { ip: req.ip, userAgent: req.headers['user-agent'] },
    );
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to check in';
    return res.status(statusForAttendance(message)).json({ error: message });
  }
});

// Organizer scans the same pass to verify departure and finalize participation.
attendanceRouter.post('/checkout', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { registrationId, token } = req.body as { registrationId?: string; token?: string };
    if (!registrationId && !token) {
      return res.status(400).json({ error: 'registrationId or token is required' });
    }

    const result = await attendanceCheckOut(
      req.userId as string,
      { registrationId, token },
      { ip: req.ip, userAgent: req.headers['user-agent'] },
    );
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to check out';
    return res.status(statusForAttendance(message)).json({ error: message });
  }
});
