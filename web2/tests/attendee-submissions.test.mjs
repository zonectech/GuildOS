import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attendeeExportFields, attendeeExportRows, questionStatistics, submissionProgress, submissionQuestions } from '../lib/attendee-submissions.ts';

const questions = [
  { key: 'phone', label: 'Contact phone', type: 'PHONE', required: true, options: [], platform: 'WEBSITE' },
  { key: 'level', label: 'Experience', type: 'SELECT', required: false, options: ['Beginner', 'Advanced', 'Expert'], platform: 'WEBSITE' },
  { key: 'yesno', label: 'Bringing a laptop?', type: 'YES_NO', required: false, options: [], platform: 'WEBSITE' },
];
function person(id, answers = []) {
  return { id, userId: id, name: 'Student ' + id, email: id + '@example.com', school: 'Demo school', department: 'Computing', faculty: '', code: 'PASS' + id, status: 'CONFIRMED', registeredAt: '2026-11-16T12:00:00Z', checkInAt: null, checkOutAt: null, minutes: 0, certificateEligible: false, certificateIssued: false, answers };
}
const people = [
  person('a', [{ key: 'phone', label: 'Contact phone', value: '+2348012345678' }, { key: 'level', label: 'Old experience label', value: 'Advanced' }, { key: 'yesno', label: 'Laptop', value: 'Yes' }, { key: 'old', label: 'Earlier question', value: 'Keep this' }]),
  person('b', [{ key: 'level', label: 'Experience', value: 'Beginner' }, { key: 'yesno', label: 'Laptop', value: 'No' }]),
  person('c', [{ key: 'level', label: 'Experience', value: 'Retired choice' }]),
  person('d'),
];

test('name-only export contains no hidden email, phone, or pass columns', () => {
  const fields = attendeeExportFields(people, questions);
  assert.deepEqual(attendeeExportRows(people, fields, ['name']), [['Name'], ...people.map((p) => [p.name])]);
});
test('any combination can include email, phone and an earlier question', () => {
  const fields = attendeeExportFields(people, questions);
  const rows = attendeeExportRows([people[0]], fields, ['email', 'answer:phone', 'answer:old']);
  assert.deepEqual(rows, [['Email', 'Question: Contact phone', 'Earlier question: Earlier question'], ['a@example.com', '+2348012345678', 'Keep this']]);
});
test('all-fields export includes unanswered current questions and saved historical questions', () => {
  const fields = attendeeExportFields(people, questions);
  const rows = attendeeExportRows(people, fields, fields.map((f) => f.id));
  assert.equal(rows.length, people.length + 1);
  assert(rows.every((r) => r.length === fields.length));
  assert.equal(fields.filter((f) => f.id === 'answer:level').length, 1, 'Renaming a question must not split responses into two columns');
});
test('empty selection is rejected and selected attendee scope is respected beyond 200 rows', () => {
  const fields = attendeeExportFields(people, questions);
  assert.throws(() => attendeeExportRows(people, fields, []), /Choose at least/);
  assert.equal(attendeeExportRows([people[1]], fields, ['email']).length, 2);
  assert.equal(attendeeExportRows(Array.from({ length: 250 }, (_, i) => person(String(i))), fields, ['name']).length, 251);
});
test('choice counts include zero-count options, earlier choices and the correct unanswered total', () => {
  const question = submissionQuestions(questions, people).find((q) => q.key === 'level');
  assert.deepEqual(questionStatistics(question, people), {
    answered: 3, unanswered: 1, choices: [
      { value: 'Beginner', count: 1, earlier: false }, { value: 'Advanced', count: 1, earlier: false },
      { value: 'Expert', count: 0, earlier: false }, { value: 'Retired choice', count: 1, earlier: true },
    ],
  });
});
test('yes/no counts do not combine free text or expose phone values as chart categories', () => {
  const all = submissionQuestions(questions, people);
  assert.deepEqual(questionStatistics(all.find((q) => q.key === 'yesno'), people), { answered: 2, unanswered: 2, choices: [{ value: 'Yes', count: 1, earlier: false }, { value: 'No', count: 1, earlier: false }] });
  assert.deepEqual(questionStatistics(all.find((q) => q.key === 'phone'), people), { answered: 1, unanswered: 3, choices: [] });
});
test('per-person progress separates current and earlier answers without changing registration status', () => {
  assert.deepEqual(submissionProgress(people[0], questions), { answered: 3, total: 3, missingRequired: 0, earlier: 1 });
  assert.deepEqual(submissionProgress(people[1], questions), { answered: 2, total: 3, missingRequired: 1, earlier: 0 });
  assert.equal(people[1].status, 'CONFIRMED');
});
test('zero submissions produce zero counts without division errors', () => {
  const question = submissionQuestions(questions, [])[1];
  const stats = questionStatistics(question, []);
  assert.equal(stats.answered, 0);
  assert.equal(stats.unanswered, 0);
  assert(stats.choices.every((c) => c.count === 0));
});
