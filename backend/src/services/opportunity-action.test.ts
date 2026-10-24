import { describe, expect, it } from 'vitest';
import { nextOpportunityAction } from './opportunity.service';

describe('nextOpportunityAction', () => {
  it('saving never pulls a student back from Interested or Applied', () => {
    expect(nextOpportunityAction('APPLIED', 'SAVED', true)).toBe('APPLIED');
    expect(nextOpportunityAction('INTERESTED', 'SAVED', true)).toBe('INTERESTED');
  });

  it('saving works from nothing or from Not relevant', () => {
    expect(nextOpportunityAction(null, 'SAVED', true)).toBe('SAVED');
    expect(nextOpportunityAction('NOT_RELEVANT', 'SAVED', true)).toBe('SAVED');
  });

  it('an explicit status pick always wins', () => {
    expect(nextOpportunityAction('APPLIED', 'NOT_RELEVANT')).toBe('NOT_RELEVANT');
    expect(nextOpportunityAction('APPLIED', 'SAVED')).toBe('SAVED');
    expect(nextOpportunityAction('SAVED', 'APPLIED')).toBe('APPLIED');
  });
});
