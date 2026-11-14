import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ byQr: null as any, byCode: null as any, queries: [] as any[] }));
vi.mock('../../models/event-registration.model', async (original) => ({ ...await original<typeof import('../../models/event-registration.model')>(), EventRegistrationModel: {
  findById: vi.fn(async () => ({ _id: 'by-id' })),
  findOne: vi.fn(async (query: any) => { state.queries.push(query); return query.qrToken ? state.byQr : state.byCode; }),
} }));
import { findPass } from './event-attendance.service';

beforeEach(() => { state.byQr = null; state.byCode = { _id: 'by-code' }; state.queries = []; });

describe('finding a pass at the door', () => {
  it('uses the QR token first', async () => {
    state.byQr = { _id: 'by-qr' };
    expect(await findPass({ token: 'qr-token', eventId: 'event' })).toEqual({ _id: 'by-qr' });
  });
  it('falls back to the typed pass code, only inside the given event', async () => {
    expect(await findPass({ token: ' 7wq-4k9 ', eventId: 'event' })).toEqual({ _id: 'by-code' });
    expect(state.queries[1]).toEqual({ eventId: 'event', passCode: '7WQ4K9' });
  });
  it('never looks up a pass code without an event', async () => {
    expect(await findPass({ token: '7WQ4K9' })).toBeNull();
    expect(state.queries).toHaveLength(1);
  });
});
