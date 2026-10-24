import express from 'express';
import type { Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findAuthor: vi.fn(),
  createStatus: vi.fn(),
  listStatuses: vi.fn(),
  findViews: vi.fn(),
}));

vi.mock('../middleware/auth', () => ({
  requireAuth: (req: object, _res: unknown, next: () => void) => {
    Object.assign(req, { userId: 'user-1' });
    next();
  },
}));
vi.mock('../models/user.model', () => ({
  UserModel: { findById: () => ({ select: () => ({ lean: mocks.findAuthor }) }) },
}));
vi.mock('../models/status.model', () => ({
  StatusStoryModel: {
    create: mocks.createStatus,
    // populate() is chainable (author, then community).
    find: () => {
      const query = { populate: () => query, lean: mocks.listStatuses };
      return { sort: () => ({ limit: () => query }) };
    },
  },
}));
vi.mock('../models/status-view.model', () => ({
  StatusViewModel: { find: () => ({ select: () => ({ lean: mocks.findViews }) }) },
}));

import { statusRouter } from './status.routes';

describe('status profile and color integration', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/status', statusRouter);
    server = await new Promise<Server>((resolve) => {
      const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing test server address');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findAuthor.mockResolvedValue({ fullName: 'Profile Person', profile: { avatar: '/uploads/profile.png' } });
    mocks.createStatus.mockImplementation(async (input) => ({
      toObject: () => ({ ...input, _id: 'story-1', createdAt: new Date() }),
    }));
    mocks.findViews.mockResolvedValue([]);
  });

  it('uses the authenticated profile, ignores forged authors, and persists the selected color', async () => {
    const response = await fetch(`${baseUrl}/api/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Good evening', accent: 'from-rose-500 to-pink-500', authorName: 'Forged', avatar: 'forged.png' }),
    });
    expect(response.status).toBe(201);
    const { status } = await response.json();
    expect(status).toMatchObject({ userId: 'user-1', name: 'Profile Person', avatar: '/uploads/profile.png', accent: 'from-rose-500 to-pink-500' });
    expect(mocks.createStatus).toHaveBeenCalledWith(expect.objectContaining({ authorName: 'Profile Person', authorAvatar: '/uploads/profile.png' }));
  });

  it('uses current populated profile data for legacy statuses', async () => {
    mocks.listStatuses.mockResolvedValue([{
      _id: 'story-1',
      userId: { _id: 'user-1', fullName: 'Current Name', profile: { avatar: '/uploads/current.png' } },
      authorName: 'You', authorAvatar: '', content: 'Good evening', createdAt: new Date(),
    }]);
    const response = await fetch(`${baseUrl}/api/status`);
    expect(response.status).toBe(200);
    const { statuses } = await response.json();
    expect(statuses[0]).toMatchObject({ userId: 'user-1', name: 'Current Name', avatar: '/uploads/current.png' });
  });

  it('shows community posts as the community and groups them per community', async () => {
    mocks.listStatuses.mockResolvedValue([{
      _id: 'story-2',
      userId: { _id: 'user-1', fullName: 'Ada Leader', profile: { avatar: '/uploads/ada.png' } },
      communityId: { _id: 'community-1', name: 'GDG Unilag', slug: 'gdg-unilag', logo: '/uploads/gdg.png' },
      authorName: 'GDG Unilag', authorAvatar: '/uploads/gdg.png', content: 'Our hackathon is live', createdAt: new Date(),
    }]);
    const response = await fetch(`${baseUrl}/api/status`);
    const { statuses } = await response.json();
    expect(statuses[0]).toMatchObject({
      userId: 'user-1',
      name: 'GDG Unilag',
      avatar: '/uploads/gdg.png',
      groupKey: 'community:community-1',
      community: { id: 'community-1', slug: 'gdg-unilag' },
    });
  });

  it('does not create a status if the authenticated profile no longer exists', async () => {
    mocks.findAuthor.mockResolvedValue(null);
    const response = await fetch(`${baseUrl}/api/status`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: 'Test' }),
    });
    expect(response.status).toBe(401);
    expect(mocks.createStatus).not.toHaveBeenCalled();
  });
});