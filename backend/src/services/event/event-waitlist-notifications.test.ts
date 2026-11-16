import { afterEach, describe, expect, it, vi } from 'vitest';
import * as email from '../../utils/email';
import * as notifications from '../notification.service';
import { authStore } from '../../store/auth-store';
import { notifyRegistrationPending, notifyWaitlistPromoted } from '../event-notification.service';

afterEach(() => vi.restoreAllMocks());
function delivery() {
  vi.spyOn(authStore, 'getPublicUserById').mockResolvedValue({ fullName: 'Student', email: 'student@example.com' } as never);
  const mail = vi.spyOn(email, 'sendEmail').mockResolvedValue(undefined as never);
  const bell = vi.spyOn(notifications, 'createNotification').mockResolvedValue({} as never);
  return { mail, bell };
}
describe('waitlist status delivery', () => {
  it.each(['WAITLISTED', 'PENDING_APPROVAL'] as const)('sends an unconfirmed %s notice without exposing meeting or chat links', async (status) => {
    const { mail, bell } = delivery();
    notifyRegistrationPending('student', { title: 'Workshop', slug: 'workshop', meetingLink: 'https://private.example/meeting', chatLink: 'https://private.example/chat' }, status);
    await vi.waitFor(() => expect(mail).toHaveBeenCalledOnce());
    expect(bell).toHaveBeenCalledOnce();
    const message = mail.mock.calls[0][1];
    expect(message.text).toContain('not confirmed');
    expect(message.text).not.toContain('private.example');
    expect(message.text).toContain('after your place is confirmed');
  });
  it('sends confirmation by bell and email after promotion, including preparation instructions', async () => {
    const { mail, bell } = delivery();
    notifyWaitlistPromoted('student', { title: 'Workshop', slug: 'workshop', whatToBring: 'Laptop and student ID' });
    await vi.waitFor(() => expect(mail).toHaveBeenCalledOnce());
    expect(bell).toHaveBeenCalledWith(expect.objectContaining({ body: expect.stringContaining('confirmed') }));
    expect(mail.mock.calls[0][1].text).toContain('Laptop and student ID');
    expect(mail.mock.calls[0][1].text).toContain('eligible queue');
  });
});
