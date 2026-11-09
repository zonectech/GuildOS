import { beforeEach, describe, expect, it, vi } from 'vitest';

// "More info needed": a reviewer asks, the community stays under review, the founder answers.
const notify = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock('../notification.service', () => ({ createNotification: notify }));
vi.mock('../../models/community.model', async (original) => {
  const actual = await original<any>();
  return { ...actual, CommunityModel: { ...actual.CommunityModel, findById: vi.fn() } };
});
import { CommunityModel } from '../../models/community.model';
import { requestCommunityInfo } from './community-admin.service';
import { respondToReview } from './community-core.service';

const community = (over: Record<string, unknown> = {}) => ({
  name: 'Robotics Guild', founder: { toString: () => 'founder' }, verificationStatus: 'PENDING',
  shortDescription: 'We build robots', description: '', category: 'Technology', university: 'Test University', endorsementLetter: '',
  infoRequest: { message: '', requestedAt: null, requestedBy: null, response: '', respondedAt: null },
  save: vi.fn(async () => undefined), ...over,
});

beforeEach(() => vi.clearAllMocks());

describe('reviewer asks for more information', () => {
  it('keeps the community pending, stores the message and tells the founder', async () => {
    const c = community();
    vi.mocked(CommunityModel.findById).mockResolvedValue(c as never);
    await requestCommunityInfo('c1', 'admin', 'Please upload a letter signed by your faculty adviser.');
    expect(c.verificationStatus).toBe('PENDING');
    expect(c.infoRequest.message).toMatch(/faculty adviser/);
    expect(c.infoRequest.requestedAt).toBeInstanceOf(Date);
    expect(c.save).toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ userId: 'founder', title: 'More information needed for Robotics Guild' }));
  });
  it('needs a real message', async () => {
    vi.mocked(CommunityModel.findById).mockResolvedValue(community() as never);
    await expect(requestCommunityInfo('c1', 'admin', 'more')).rejects.toThrow(/at least a sentence/);
  });
  it('only applies to communities still under review', async () => {
    vi.mocked(CommunityModel.findById).mockResolvedValue(community({ verificationStatus: 'VERIFIED' }) as never);
    await expect(requestCommunityInfo('c1', 'admin', 'Please upload a signed letter.')).rejects.toThrow(/under review/);
  });
});

describe('founder answers', () => {
  const asked = () => community({ infoRequest: { message: 'Upload a signed letter', requestedAt: new Date(), requestedBy: 'admin', response: '', respondedAt: null } });
  it('records the answer and a new letter, and stays pending for the reviewer', async () => {
    const c = asked();
    vi.mocked(CommunityModel.findById).mockResolvedValue(c as never);
    await respondToReview('c1', 'founder', { note: 'Added the letter from our adviser, Dr. Placeholder.', endorsementLetter: '/uploads/letter.pdf' });
    expect(c.verificationStatus).toBe('PENDING');
    expect(c.endorsementLetter).toBe('/uploads/letter.pdf');
    expect(c.infoRequest.response).toMatch(/adviser/);
    expect(c.infoRequest.respondedAt).toBeInstanceOf(Date);
    expect(c.infoRequest.message).toBe('Upload a signed letter');
  });
  it('only the founder can answer', async () => {
    vi.mocked(CommunityModel.findById).mockResolvedValue(asked() as never);
    await expect(respondToReview('c1', 'someone-else', { note: 'Here is the letter you asked for.' })).rejects.toThrow(/founder/);
  });
  it('cannot answer when nothing was asked, or after a decision', async () => {
    vi.mocked(CommunityModel.findById).mockResolvedValue(community() as never);
    await expect(respondToReview('c1', 'founder', { note: 'Here is more information.' })).rejects.toThrow(/No information was requested/);
    vi.mocked(CommunityModel.findById).mockResolvedValue(community({ verificationStatus: 'REJECTED', infoRequest: { message: 'x' } }) as never);
    await expect(respondToReview('c1', 'founder', { note: 'Here is more information.' })).rejects.toThrow(/no longer under review/);
  });
  it('needs a note saying what changed', async () => {
    vi.mocked(CommunityModel.findById).mockResolvedValue(asked() as never);
    await expect(respondToReview('c1', 'founder', { note: 'ok' })).rejects.toThrow(/what you changed/);
  });
});
