import { beforeEach, describe, expect, it, vi } from 'vitest';

// "My school only" events and the guest list switch.
const getUser = vi.hoisted(() => vi.fn());
vi.mock('../../store/auth-store', async (original) => {
  const actual = await original<any>();
  return { ...actual, authStore: { ...actual.authStore, getPublicUserById: getUser } };
});
vi.mock('../../models/community.model', async (original) => {
  const actual = await original<any>();
  return { ...actual, CommunityModel: { ...actual.CommunityModel, findById: vi.fn() } };
});
import { CommunityModel } from '../../models/community.model';
import { EventModel } from '../../models/event.model';
import { assertSameSchool } from './event-registration.service';
import { applyEventInput } from './event-shared';

const community = (university: string) => ({ select: () => ({ lean: async () => ({ university }) }) });
beforeEach(() => vi.clearAllMocks());

describe('my school only', () => {
  it('lets in a student from the same school (ignoring case and punctuation)', async () => {
    vi.mocked(CommunityModel.findById).mockReturnValue(community('Federal University of Technology, Minna') as never);
    getUser.mockResolvedValue({ profile: { university: 'federal university of technology minna' } });
    await expect(assertSameSchool('c1', 'u1')).resolves.toBeUndefined();
  });
  it('refuses a student from another school, naming the school', async () => {
    vi.mocked(CommunityModel.findById).mockReturnValue(community('Ahmadu Bello University') as never);
    getUser.mockResolvedValue({ profile: { university: 'University of Lagos' } });
    await expect(assertSameSchool('c1', 'u1')).rejects.toThrow(/only open to students of Ahmadu Bello University/);
  });
  it('refuses when the student has not added a school', async () => {
    vi.mocked(CommunityModel.findById).mockReturnValue(community('Ahmadu Bello University') as never);
    getUser.mockResolvedValue({ profile: {} });
    await expect(assertSameSchool('c1', 'u1')).rejects.toThrow(/Add your school/);
  });
});

describe('event settings', () => {
  it('defaults: everyone can attend and the guest list is visible', () => {
    const e = new EventModel({});
    expect(e.audience).toBe('EVERYONE');
    expect(e.guestListVisible).toBe(true);
  });
  it('saves audience and guest list choices, and refuses unknown audiences', () => {
    const e = new EventModel({});
    applyEventInput(e, { audience: 'SCHOOL', guestListVisible: false } as never);
    expect(e.audience).toBe('SCHOOL');
    expect(e.guestListVisible).toBe(false);
    expect(() => applyEventInput(e, { audience: 'FRIENDS' } as never)).toThrow(/who can attend/);
  });
  it('an "Other" event keeps what the organizer typed (trimmed, max 40)', () => {
    const e = new EventModel({});
    applyEventInput(e, { type: 'OTHER', typeLabel: '  Career fair  ' } as never);
    expect(e.typeLabel).toBe('Career fair');
    applyEventInput(e, { typeLabel: 'x'.repeat(60) } as never);
    expect(e.typeLabel).toHaveLength(40);
  });
});
