import { beforeEach, describe, expect, it, vi } from 'vitest';

// The automatic thank-you after an event: who gets it, what it says, and that it goes out once.
const state = vi.hoisted(() => ({ stamped: false, registrations: [] as { userId: string }[], certificates: [] as { userId: string; serial: string }[] }));
const mocks = vi.hoisted(() => ({ bell: vi.fn(async () => undefined), email: vi.fn(async () => undefined), registrationQuery: vi.fn() }));
const rows = (value: unknown) => ({ select() { return this; }, lean: async () => value });

vi.mock('../models/event.model', () => ({
  EventModel: {
    findOneAndUpdate: vi.fn(() => ({
      lean: async () => {
        if (state.stamped) return null;
        state.stamped = true;
        return { _id: 'event', title: 'Data Workshop', slug: 'data-workshop' };
      },
    })),
  },
}));
vi.mock('../models/event-registration.model', () => ({
  EventRegistrationModel: { find: mocks.registrationQuery.mockImplementation(() => rows(state.registrations)) },
}));
vi.mock('../models/certificate.model', () => ({ CertificateModel: { find: vi.fn(() => rows(state.certificates)) } }));
vi.mock('./notification.service', () => ({ createNotification: mocks.bell }));
vi.mock('../store/auth-store', () => ({ authStore: { getPublicUserById: vi.fn(async (id: string) => ({ email: `${id}@school.edu`, fullName: id })) } }));
vi.mock('../utils/email', () => ({
  sendEmail: mocks.email,
  categoryEmail: vi.fn((_category: string, body: Record<string, string>) => body),
}));
vi.mock('../utils/site-link', () => ({ siteLink: (path: string) => `https://site.test${path}` }));

import { notifyAttendeeThankYou } from './event-notification.service';

beforeEach(() => {
  vi.clearAllMocks();
  state.stamped = false;
  state.registrations = [{ userId: 'ada' }, { userId: 'bola' }];
  state.certificates = [{ userId: 'ada', serial: 'GLD-1' }];
});

describe('automatic thank-you after an event', () => {
  it('thanks only the people the event counts for, scanned or reported', async () => {
    await notifyAttendeeThankYou('event');
    expect(mocks.registrationQuery).toHaveBeenCalledWith({ eventId: 'event', status: 'COMPLETED' });
    expect(mocks.email).toHaveBeenCalledTimes(2);
    expect(mocks.bell).toHaveBeenCalledTimes(2);
  });

  it('links the certificate when there is one, and the event page otherwise', async () => {
    await notifyAttendeeThankYou('event');
    const bells = mocks.bell.mock.calls.map(([n]) => n as { userId: string; title: string; link: string });
    expect(bells.find((n) => n.userId === 'ada')).toMatchObject({ title: 'Thanks for attending Data Workshop', link: '/certificates/GLD-1' });
    expect(bells.find((n) => n.userId === 'bola')).toMatchObject({ link: '/events/data-workshop' });
    const emails = mocks.email.mock.calls.map(([to, body]) => ({ to, body: body as unknown as { message: string; subject: string } }));
    expect(emails.find((e) => e.to === 'ada@school.edu')?.body.message).toContain('https://site.test/certificates/GLD-1');
    expect(emails.find((e) => e.to === 'bola@school.edu')?.body.message).not.toContain('certificate');
    expect(emails.every((e) => !/rate|rating/i.test(e.body.message))).toBe(true);
  });

  it('goes out once per event, even if attendance is closed again', async () => {
    await notifyAttendeeThankYou('event');
    await notifyAttendeeThankYou('event');
    expect(mocks.email).toHaveBeenCalledTimes(2);
  });

  it('sends nothing when nobody attended', async () => {
    state.registrations = [];
    expect(await notifyAttendeeThankYou('event')).toEqual({ sent: 0 });
    expect(mocks.email).not.toHaveBeenCalled();
  });
});
