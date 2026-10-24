import { describe, expect, it } from 'vitest';
import { stripEmDashes } from './ai-provider';

describe('stripEmDashes (house style safety net)', () => {
  it('replaces em dashes, with or without spacing, by a comma', () => {
    expect(stripEmDashes('Register early — seats are limited.')).toBe('Register early, seats are limited.');
    expect(stripEmDashes('Lagos—Abuja')).toBe('Lagos, Abuja');
  });

  it('leaves en dashes and hyphens alone', () => {
    expect(stripEmDashes('Score 1–10 on a well-known scale')).toBe('Score 1–10 on a well-known scale');
  });
});
