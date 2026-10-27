import { describe, expect, it } from 'vitest';
import { CommunityModel } from './community.model';
describe('community secret projections', () => {
  it('excludes invite tokens from normal database reads', () => { expect(CommunityModel.schema.path('inviteToken').options.select).toBe(false); });
});
