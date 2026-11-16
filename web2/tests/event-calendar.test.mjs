import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eventCalendar } from '../lib/event-calendar.ts';
const event = { id: 'event', slug: 'event', title: 'Workshop, beginner; edition', summary: 'Learn together\nBring questions', mode: 'PHYSICAL', venue: 'Campus hall', whatToBring: 'Laptop and student ID', startDate: '2026-11-20T16:00:00+01:00', endDate: '2026-11-20T18:00:00+01:00' };
test('calendar exports correct UTC times and preparation instructions', () => {
  const result = eventCalendar(event, 'https://kintriva.example/events/event', 0);
  assert(result.includes('DTSTART:20261120T150000Z\r\n'));
  assert(result.includes('DTEND:20261120T170000Z\r\n'));
  assert(result.includes('SUMMARY:Workshop\\, beginner\\; edition'));
  assert(result.replace(/\r\n /g, '').includes('What to bring: Laptop and student ID'));
  assert(!result.includes('qrToken'));
});
test('text cannot inject calendar properties and Unicode lines are folded within 75 bytes', () => {
  const result = eventCalendar({ ...event, title: '你好'.repeat(80) + '\nATTENDEE:evil@example.com' }, 'https://kintriva.example/events/event', 0);
  assert(!result.includes('\r\nATTENDEE:'));
  assert(result.split('\r\n').every((line) => Buffer.byteLength(line) <= 75));
});
test('calendar handles missing or invalid dates without creating a broken file', () => {
  assert.throws(() => eventCalendar({ ...event, startDate: null }, 'https://kintriva.example/events/event'), /not available/);
  assert.throws(() => eventCalendar({ ...event, endDate: 'invalid' }, 'https://kintriva.example/events/event'), /not available/);
});
