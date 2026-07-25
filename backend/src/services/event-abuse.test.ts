import { describe, expect, it } from 'vitest';
import { eventStartDay, validateEventContent, validateEventDates } from './event-abuse.service';

describe('event anti-abuse policy', () => {
  it.each(['Official Careers Fair', 'Verified Scholarship Event', 'Campus Admin Meetup'])(
    'blocks impersonating title %s',
    (title) => expect(() => validateEventContent({ title })).toThrow(/cannot claim/i),
  );

  it.each([
    'Verify your account to attend',
    'Share your password to register',
    'Free money giveaway',
    'Double crypto today',
  ])('blocks phishing or spam content: %s', (description) => {
    expect(() => validateEventContent({ title: 'Student Meetup', description })).toThrow(/phishing|spam/i);
  });

  it('allows ordinary educational content', () => {
    expect(() => validateEventContent({ title: 'Robotics Workshop', shortDescription: 'Build and program a small autonomous rover.' })).not.toThrow();
  });

  it('requires dates when publishing', () => {
    expect(() => validateEventDates(null, null, new Date('2026-01-01T00:00:00Z'), true)).toThrow(/required/i);
  });

  it('blocks events longer than 31 days', () => {
    expect(() => validateEventDates(new Date('2026-02-01T00:00:00Z'), new Date('2026-03-05T00:00:00Z'))).toThrow(/31 days/i);
  });

  it('blocks events scheduled more than two years ahead', () => {
    expect(() => validateEventDates(
      new Date('2029-01-02T00:00:00Z'),
      new Date('2029-01-03T00:00:00Z'),
      new Date('2026-01-01T00:00:00Z'),
    )).toThrow(/2 years/i);
  });

  it('blocks publishing an event that has already ended', () => {
    expect(() => validateEventDates(
      new Date('2025-12-01T00:00:00Z'),
      new Date('2025-12-02T00:00:00Z'),
      new Date('2026-01-01T00:00:00Z'),
      true,
    )).toThrow(/past events/i);
  });

  it('creates a stable UTC day bucket', () => {
    expect(eventStartDay(new Date('2026-07-25T23:30:00Z'))).toBe('2026-07-25');
    expect(eventStartDay(null)).toBe('unscheduled');
  });
});
