import type { EventInput } from '../event-api';
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
export async function externalRequest<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(API + '/api/events/' + path, { method: body === undefined ? 'GET' : 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Unable to complete request');
  return result as T;
}
export type EventLinkDraft = { draft: EventInput; warnings: string[] };
export type ExternalReportPreview = {
  reportId: string; filename: string; kind: 'REGISTRATION' | 'ATTENDANCE'; appliedAt: string | null; evidence: string; matched: number; needsReview: number;
  rows: { row: number; email: string; day: string; minutes: number | null; matched: boolean; reason: string; registrationId: string }[];
};
export type ExternalReportHistory = { _id: string; kind: string; filename: string; appliedAt: string | null; createdAt: string };
