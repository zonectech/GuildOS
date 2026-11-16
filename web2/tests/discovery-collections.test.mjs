import { test } from 'node:test';
import assert from 'node:assert/strict';
import { beginnerFriendly, discoveryCollections, schoolKey } from '../lib/discovery-collections.ts';

const now = Date.parse('2026-11-16T12:00:00Z');
function event(id, patch = {}) {
  return { id, status: 'PUBLISHED', title: 'Python for beginners', summary: '', description: '', tags: [], free: true, external: false, mode: 'PHYSICAL', startDate: new Date(now + 86400000).toISOString(), endDate: new Date(now + 90000000).toISOString(), community: { school: 'Ahmadu Bello University' }, ...patch };
}

test('school collection matches the school precisely across case, spaces and punctuation', () => {
  assert.equal(schoolKey(' Ahmadu  Bello University. '), 'ahmadu bello university');
  const picks = discoveryCollections([event('same'), event('other', { community: { school: 'Other University' } })], 'AHMADU BELLO UNIVERSITY.', now);
  assert.deepEqual(picks.school.map((e) => e.id), ['same']);
});
test('school picks use the next seven days, include live events and exclude later dates', () => {
  const picks = discoveryCollections([
    event('live', { status: 'CHECK_IN', startDate: new Date(now - 3600000).toISOString() }),
    event('soon'), event('later', { startDate: new Date(now + 8 * 86400000).toISOString(), endDate: new Date(now + 9 * 86400000).toISOString() }),
  ], 'Ahmadu Bello University', now);
  assert.deepEqual(picks.school.map((e) => e.id), ['live', 'soon']);
});
test('unknown prices, paid events and external events cannot be labelled free beginner picks', () => {
  const picks = discoveryCollections([event('free'), event('paid', { free: false }), event('unknown', { free: undefined }), event('partner', { external: true })], '', now);
  assert.deepEqual(picks.beginners.map((e) => e.id), ['free']);
});
test('beginner picks require organizer evidence and respect explicit exclusions', () => {
  assert(beginnerFriendly(event('tag', { title: 'Build day', tags: ['beginner-friendly'] })));
  assert(beginnerFriendly(event('no-experience', { title: 'Build day', description: 'No prior experience required.' })));
  assert(!beginnerFriendly(event('no-evidence', { title: 'Community meetup' })));
  assert(!beginnerFriendly(event('excluded', { description: 'This is not for beginners.' })));
  assert(!beginnerFriendly(event('experienced', { title: 'Introduction to Kubernetes', description: 'Prior coding experience is required.' })));
});
test('online picks include virtual and hybrid opportunities', () => {
  const picks = discoveryCollections([event('physical'), event('virtual', { mode: 'VIRTUAL', external: true }), event('hybrid', { mode: 'HYBRID' })], '', now);
  assert.deepEqual(picks.online.map((e) => e.id), ['virtual', 'hybrid']);
});
test('ended, cancelled, draft, postponed and undated events stay out of time-sensitive collections', () => {
  const records = [event('ended', { endDate: new Date(now - 1).toISOString() }), ...['ARCHIVED', 'DRAFT', 'POSTPONED', 'COMPLETED'].map((status) => event(status, { status, mode: 'VIRTUAL' })), event('no-date', { startDate: null })];
  const picks = discoveryCollections(records, 'Ahmadu Bello University', now);
  assert.equal(picks.school.length, 0);
  assert.equal(picks.beginners.length, 0);
  assert.equal(picks.online.length, 0);
  assert.equal(picks.all.length, records.length, 'The ordinary list retains its own ended/cancelled filters');
});
test('no school produces an empty school collection and selection does not mutate catalog order', () => {
  const records = [event('later', { startDate: new Date(now + 2 * 86400000).toISOString(), endDate: new Date(now + 3 * 86400000).toISOString() }), event('sooner')];
  assert.equal(discoveryCollections(records, '', now).school.length, 0);
  assert.deepEqual(records.map((e) => e.id), ['later', 'sooner']);
});
