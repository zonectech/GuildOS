import { describe, expect, it } from 'vitest';
import {
  communityNameSimilarity,
  levenshteinDistance,
  normalizeIdentity,
  validateCommunityContent,
} from './community-identity';

describe('community identity security', () => {
  it('normalizes case, punctuation, Unicode width, and whitespace', () => {
    expect(normalizeIdentity('  Robotics—CLUB!!  ')).toBe('robotics club');
    expect(normalizeIdentity('ＲＯＢＯＴＩＣＳ')).toBe('robotics');
  });

  it('calculates edit distance', () => {
    expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
  });

  it('detects confusing names after removing generic organization words', () => {
    expect(communityNameSimilarity('The Robotics Club', 'Robotics Society')).toBe(1);
    expect(communityNameSimilarity('Robotics Club', 'Agricultural Economics Network')).toBeLessThan(0.5);
  });

  it.each(['Official Robotics Club', 'Verified Student Society', 'Campus Admin Group'])(
    'blocks impersonation claim %s',
    (name) => expect(() => validateCommunityContent(name, 'A student organization')).toThrow(/cannot claim/i),
  );

  it('blocks common promotional spam patterns', () => {
    expect(() => validateCommunityContent('Investors', 'Double crypto today')).toThrow(/spam/i);
    expect(() => validateCommunityContent('Airdrops', 'Free money giveaway')).toThrow(/spam/i);
  });

  it('allows ordinary community content', () => {
    expect(() => validateCommunityContent('Robotics Club', 'Students building autonomous machines')).not.toThrow();
  });
});