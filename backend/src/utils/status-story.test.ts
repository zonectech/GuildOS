import { describe, expect, it } from 'vitest';
import { StatusStoryModel } from '../models/status.model';
import { normalizeStatusStoryInput, sortStatusesByNewest } from './status-story';

describe('status story expiration', () => {
  it('supports an optional attachment without requiring one for text statuses', () => {
    const story = new StatusStoryModel();
    expect(story.attachment).toBeNull();
    expect(story.hiddenAt).toBeNull();
  });

  it('declares only one expiresAt index and preserves TTL expiration', () => {
    const expirationIndexes = StatusStoryModel.schema.indexes().filter(
      ([fields]) => fields.expiresAt === 1,
    );

    expect(expirationIndexes).toHaveLength(1);
    expect(expirationIndexes[0][1].expireAfterSeconds).toBe(0);
  });
});

describe('status story normalization', () => {
  it('normalizes status input and preserves valid kind values', () => {
    const status = normalizeStatusStoryInput({
      content: '  Team sprint is live today  ',
      kind: 'event',
      title: '  Demo Day  ',
      accent: 'from-violet-500 to-purple-500',
    });

    expect(status.content).toBe('Team sprint is live today');
    expect(status.kind).toBe('event');
    expect(status.title).toBe('Demo Day');
    expect(status.accent).toBe('from-violet-500 to-purple-500');
  });

  it('falls back to safe defaults for invalid input', () => {
    const status = normalizeStatusStoryInput({
      content: '   ',
      kind: 'unknown' as any,
      title: '',
    });

    expect(status.content).toBe('Campus update');
    expect(status.kind).toBe('update');
    expect(status.title).toBe('Campus update');
  });

  it('preserves a selected color and rejects unsupported accents', () => {
    expect(normalizeStatusStoryInput({
      content: 'An update',
      accent: 'from-rose-500 to-pink-500',
    }).accent).toBe('from-rose-500 to-pink-500');
    expect(normalizeStatusStoryInput({
      content: 'An update',
      accent: 'unsupported-color',
    }).accent).toBe('from-emerald-500 to-teal-500');
  });

  it('sorts newest stories first', () => {
    const items = sortStatusesByNewest([
      { createdAt: '2024-01-01T00:00:00.000Z' },
      { createdAt: '2024-01-03T00:00:00.000Z' },
      { createdAt: '2024-01-02T00:00:00.000Z' },
    ] as any[]);

    expect(items.map((item) => item.createdAt)).toEqual([
      '2024-01-03T00:00:00.000Z',
      '2024-01-02T00:00:00.000Z',
      '2024-01-01T00:00:00.000Z',
    ]);
  });
});
