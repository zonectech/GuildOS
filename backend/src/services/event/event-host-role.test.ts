import { describe, expect, it } from 'vitest';
import { hostRoleFor } from './event-core.service';

const host = 'c-host';
const partner = 'c-partner';
const closed = { communityId: host, status: 'COMPLETED', attendanceFinalizedAt: new Date() };

describe('who gets a hosting seal', () => {
  it('gives the host community managers HOSTED once attendance is closed', () => {
    expect(hostRoleFor(closed, [{ communityId: host, role: 'PRESIDENT' }], true)).toBe('HOSTED');
  });

  it('gives managers of an accepted partner community CO_HOSTED', () => {
    expect(hostRoleFor(closed, [{ communityId: partner, role: 'COORDINATOR' }], true)).toBe('CO_HOSTED');
  });

  it('prefers HOSTED for someone who manages both communities', () => {
    expect(hostRoleFor(closed, [{ communityId: partner, role: 'PRESIDENT' }, { communityId: host, role: 'COORDINATOR' }], true)).toBe('HOSTED');
  });

  it('waits until attendance is closed', () => {
    expect(hostRoleFor({ communityId: host, status: 'CHECK_OUT', attendanceFinalizedAt: null }, [{ communityId: host, role: 'PRESIDENT' }], true)).toBeNull();
  });

  it('gives nothing to people who cannot manage the event', () => {
    expect(hostRoleFor(closed, [{ communityId: host, role: 'MEMBER' }], false)).toBeNull();
  });
});
