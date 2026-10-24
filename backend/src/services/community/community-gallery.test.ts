import { describe, expect, it } from 'vitest';
import { MAX_COMMUNITY_GALLERY, normalizeCommunityGallery } from './community-core.service';

describe('normalizeCommunityGallery', () => {
  it('keeps upload paths and https URLs, drops anything else', () => {
    expect(normalizeCommunityGallery(['/uploads/a.png', 'https://cdn.example.com/b.jpg', 'javascript:alert(1)', 'http://x.com/c.png', 42, ''])).toEqual([
      '/uploads/a.png',
      'https://cdn.example.com/b.jpg',
    ]);
  });

  it('dedupes and caps the list', () => {
    const many = Array.from({ length: 10 }, (_, i) => `/uploads/${i}.png`);
    expect(normalizeCommunityGallery([...many, '/uploads/0.png'])).toHaveLength(MAX_COMMUNITY_GALLERY);
    expect(normalizeCommunityGallery(['/uploads/a.png', ' /uploads/a.png '])).toEqual(['/uploads/a.png']);
  });

  it('rejects a non-list', () => {
    expect(() => normalizeCommunityGallery('/uploads/a.png')).toThrow(/list/);
  });
});
