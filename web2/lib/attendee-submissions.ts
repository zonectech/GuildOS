import type { AttendanceRecord } from './api/host';
import type { RegistrationQuestion } from './api/types';

export const ATTENDEE_STATUS: Record<string, string> = {
  CONFIRMED: 'Registered', PENDING_APPROVAL: 'Waiting for approval', WAITLISTED: 'Waitlisted',
  CHECKED_IN: 'Checked in', CHECKED_OUT: 'Checked out', COMPLETED: 'Finalized',
  PARTIAL_ATTENDANCE: 'Partial attendance', CANCELLED: 'Cancelled', REJECTED: 'Declined', NO_SHOW: 'No-show',
};
export interface ExportField {
  id: string; label: string; header: string; group: 'Account details' | 'Registration and attendance' | 'Registration questions' | 'Earlier questions';
  value: (person: AttendanceRecord) => string;
}
export interface SubmissionQuestion {
  key: string; label: string; type: RegistrationQuestion['type']; options: string[]; earlier: boolean;
}

export function submissionQuestions(questions: RegistrationQuestion[], people: AttendanceRecord[]): SubmissionQuestion[] {
  const result: SubmissionQuestion[] = questions.map((q) => ({ ...q, earlier: false }));
  const seen = new Set(result.map((q) => q.key));
  for (const person of people) for (const answer of person.answers) {
    if (!seen.has(answer.key)) {
      seen.add(answer.key);
      result.push({ key: answer.key, label: answer.label, type: 'TEXT', options: [], earlier: true });
    }
  }
  return result;
}

export function submissionProgress(person: AttendanceRecord, questions: RegistrationQuestion[]) {
  const answeredKeys = new Set(person.answers.filter((a) => a.value.trim()).map((a) => a.key));
  return {
    answered: questions.filter((q) => answeredKeys.has(q.key)).length,
    total: questions.length,
    missingRequired: questions.filter((q) => q.required && !answeredKeys.has(q.key)).length,
    earlier: person.answers.filter((a) => !questions.some((q) => q.key === a.key) && a.value.trim()).length,
  };
}

export function questionStatistics(question: SubmissionQuestion, people: AttendanceRecord[]) {
  const counts = new Map<string, number>();
  let answered = 0;
  for (const person of people) {
    const answer = person.answers.find((a) => a.key === question.key)?.value.trim() ?? '';
    if (!answer) continue;
    answered++;
    if (question.type === 'SELECT' || question.type === 'YES_NO') counts.set(answer, (counts.get(answer) ?? 0) + 1);
  }
  const options = question.type === 'YES_NO' ? ['Yes', 'No'] : question.options;
  const values = [...new Set([...options, ...counts.keys()])];
  return {
    answered, unanswered: people.length - answered,
    choices: question.type === 'SELECT' || question.type === 'YES_NO'
      ? values.map((value) => ({ value, count: counts.get(value) ?? 0, earlier: !options.includes(value) })) : [],
  };
}

export function attendeeExportFields(people: AttendanceRecord[], questions: RegistrationQuestion[]): ExportField[] {
  const account = (id: string, label: string, value: ExportField['value']): ExportField => ({ id, label, header: label, group: 'Account details', value });
  const record = (id: string, label: string, value: ExportField['value']): ExportField => ({ id, label, header: label, group: 'Registration and attendance', value });
  const fields: ExportField[] = [
    account('name', 'Name', (p) => p.name), account('email', 'Email', (p) => p.email),
    account('school', 'School', (p) => p.school), account('department', 'Department', (p) => p.department), account('faculty', 'Faculty', (p) => p.faculty),
    record('status', 'Registration status', (p) => ATTENDEE_STATUS[p.status] ?? p.status), record('registeredAt', 'Registration date', (p) => p.registeredAt),
    record('code', 'Pass code', (p) => p.code), record('checkInAt', 'Checked in at', (p) => p.checkInAt ?? ''), record('checkOutAt', 'Checked out at', (p) => p.checkOutAt ?? ''),
    record('minutes', 'Attendance minutes', (p) => String(p.minutes)),
    record('certificate', 'Certificate status', (p) => p.certificateIssued ? 'Issued' : p.certificateEligible ? 'Eligible' : 'Not issued'),
    record('answered', 'Current questions answered', (p) => String(submissionProgress(p, questions).answered)),
    record('missingRequired', 'Current required answers not recorded', (p) => String(submissionProgress(p, questions).missingRequired)),
  ];
  const headers = new Map<string, number>();
  for (const q of submissionQuestions(questions, people)) {
    const header = `${q.earlier ? 'Earlier question' : 'Question'}: ${q.label}`;
    const count = (headers.get(header) ?? 0) + 1;
    headers.set(header, count);
    fields.push({
      id: `answer:${q.key}`, label: q.type === 'PHONE' ? `${q.label} (phone number)` : q.label,
      header: count === 1 ? header : `${header} (${count})`, group: q.earlier ? 'Earlier questions' : 'Registration questions',
      value: (p) => p.answers.find((a) => a.key === q.key)?.value ?? '',
    });
  }
  return fields;
}

/** Only the explicitly chosen columns enter the downloaded file. No hidden name/email columns. */
export function attendeeExportRows(people: AttendanceRecord[], fields: ExportField[], selectedIds: string[]) {
  const selected = fields.filter((field) => selectedIds.includes(field.id));
  if (!selected.length) throw new Error('Choose at least one field to export');
  return [selected.map((field) => field.header), ...people.map((person) => selected.map((field) => field.value(person)))];
}
