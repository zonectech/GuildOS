import { afterEach, describe, expect, it, vi } from 'vitest';
import { authStore } from '../../store/auth-store';
import { applyEventInput, resolveRegistrationAnswers } from './event-shared';
import type { RegistrationQuestion } from '../../models/event.model';

const phone: RegistrationQuestion = { key: 'phone', label: 'Contact phone', type: 'PHONE', options: [], platform: 'WEBSITE', required: false };
const link: RegistrationQuestion = { key: 'github', label: 'GitHub profile', type: 'LINK', options: [], platform: 'GITHUB', required: false };
afterEach(() => vi.restoreAllMocks());
function savedProfile() {
  vi.spyOn(authStore, 'getUserById').mockResolvedValue({ profile: { phoneNumber: '+2348012345678', socialLinks: ['https://github.com/ada'] } } as never);
}

describe('event registration answers', () => {
  it('does not ask local questions when an event switches to external registration', async () => {
    expect(await resolveRegistrationAnswers({ attendanceSource: 'EXTERNAL', registrationQuestions: [{ ...phone, required: true }] }, 'student', {})).toEqual([]);
  });
  it('uses profile defaults when older clients omit phone and link answers', async () => {
    savedProfile();
    const answers = await resolveRegistrationAnswers({ registrationQuestions: [phone, link] }, 'student', undefined);
    expect(answers).toEqual([
      { key: 'phone', label: 'Contact phone', value: '+2348012345678' },
      { key: 'github', label: 'GitHub profile', value: 'https://github.com/ada' },
    ]);
  });
  it('respects an attendee clearing optional prefilled details', async () => {
    savedProfile();
    expect(await resolveRegistrationAnswers({ registrationQuestions: [phone, link] }, 'student', { phone: '', github: '' })).toEqual([]);
  });
  it('requires an answer when a prefilled required field is cleared', async () => {
    savedProfile();
    await expect(resolveRegistrationAnswers({ registrationQuestions: [{ ...phone, required: true }] }, 'student', { phone: '' })).rejects.toThrow('Please answer');
  });
  it('rejects choices outside the organizer’s options', async () => {
    await expect(resolveRegistrationAnswers({ registrationQuestions: [{ ...phone, type: 'SELECT', options: ['Beginner', 'Advanced'] }] }, 'student', { phone: 'Other' })).rejects.toThrow('not one of the choices');
  });
  it('rejects arbitrary yes/no answers instead of silently converting them to No', async () => {
    const event = { registrationQuestions: [{ ...phone, type: 'YES_NO' as const }] };
    await expect(resolveRegistrationAnswers(event, 'student', { phone: 'maybe' })).rejects.toThrow('Yes or No');
    expect(await resolveRegistrationAnswers(event, 'student', { phone: false })).toEqual([{ key: 'phone', label: 'Contact phone', value: 'No' }]);
    expect(await resolveRegistrationAnswers(event, 'student', { phone: 'YES' })).toEqual([{ key: 'phone', label: 'Contact phone', value: 'Yes' }]);
  });
  it('keeps a question’s stable identifier when its label changes', () => {
    const event: { registrationQuestions?: RegistrationQuestion[] } = {};
    applyEventInput(event, { registrationQuestions: [{ ...phone, key: 'original-phone-key', label: 'New phone label' }] } as never);
    expect(event.registrationQuestions?.[0]).toMatchObject({ key: 'original-phone-key', label: 'New phone label' });
  });
});
