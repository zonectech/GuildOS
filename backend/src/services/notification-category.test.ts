import { describe, expect, it } from 'vitest';
import { categorize } from './notification.service';

// Where each notification belongs: decides its icon, whether it toasts, and if it also shows in Inbox › Event updates.
const c = (title: string, link = '/events/ml-workshop', type = 'SYSTEM') => categorize({ type, title, link });

describe('notification categories', () => {
  it('event updates: venue, time, cancellation, organizer updates', () => {
    expect(c('Venue updated: ML Workshop')).toBe('EVENT_UPDATE');
    expect(c('New date: ML Workshop')).toBe('EVENT_UPDATE');
    expect(c('Event cancelled: ML Workshop')).toBe('EVENT_UPDATE');
    expect(c('ML Workshop: Venue moved to LT 3')).toBe('EVENT_UPDATE');
  });
  it('reminders, registration, stamps, certificates', () => {
    expect(c('ML Workshop starts soon')).toBe('REMINDER');
    expect(c('Intro starts in less than an hour')).toBe('REMINDER');
    expect(c("You're registered: ML Workshop")).toBe('REGISTRATION');
    expect(c('Thanks for attending ML Workshop')).toBe('STAMP');
    expect(c('You earned a certificate for ML Workshop', '/certificates/OTR-1', 'CERTIFICATE_EARNED')).toBe('CERTIFICATE');
  });
  it('community and organizer items', () => {
    expect(c('Your request to join AI Builders was approved', '/communities/ai', 'JOIN_APPROVED')).toBe('COMMUNITY');
    expect(c('Your request to join AI Builders was declined', '/communities/ai')).toBe('COMMUNITY');
    expect(c('New join request: AI Builders', '/communities/ai/manage?tab=members')).toBe('ORGANIZER');
    expect(c('Attendance issue: Study Jam', '/events/study-jam/manage')).toBe('ORGANIZER');
  });
});
