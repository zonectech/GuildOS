import { describe, expect, it } from 'vitest';
import { stripPrivateCommunityFields, stripPrivateEventFields, toPersonCard } from './public-shapes';
import { isPlainSvg } from '../middleware/upload';

describe('public shapes', () => {
  it('a person card never carries account fields', () => {
    const card = toPersonCard({ id: 'u1', fullName: 'Ada', email: 'ada@example.com', emailVerified: true, profile: { username: 'ada', university: 'ABU', department: 'CS', phoneNumber: '080', showEmail: true } } as never);
    expect(Object.keys(card).sort()).toEqual(['fullName', 'id', 'profile']);
    expect(JSON.stringify(card)).not.toMatch(/example\.com|080|emailVerified|showEmail/);
    expect(card.profile.university).toBe('ABU');
  });
  it('a private profile gives the name and photo only', () => {
    const card = toPersonCard({ id: 'u1', fullName: 'Ada', profile: { username: 'ada', avatar: '/a.png', university: 'ABU', department: 'CS', profileVisibility: 'PRIVATE' } });
    expect(card.profile).toMatchObject({ avatar: '/a.png', university: '', department: '' });
  });
  it('events lose join links, group chats and promo codes without touching the original', () => {
    const event = { title: 'T', meetingLink: 'https://meet', attendeeChatLink: 'https://chat', ticketPromoCodes: [{ code: 'X' }], sections: [{ key: 'a', chatLink: 'https://s' }] };
    const out = stripPrivateEventFields(event);
    expect(out).toMatchObject({ title: 'T', meetingLink: '', attendeeChatLink: '', ticketPromoCodes: [], sections: [{ key: 'a', chatLink: '' }] });
    expect(event.meetingLink).toBe('https://meet');
    expect(event.sections[0].chatLink).toBe('https://s');
  });
  it('communities lose the review paperwork', () => {
    const out = stripPrivateCommunityFields({ name: 'C', verificationNotes: 'n', endorsementLetter: '/l.pdf', infoRequest: { message: 'm' }, verificationStatus: 'VERIFIED' });
    expect(out).toEqual({ name: 'C', verificationStatus: 'VERIFIED' });
  });
});

describe('SVG uploads', () => {
  const svg = (inner: string, attrs = '') => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${inner}</svg>`);
  it('accepts a plain drawing', () => {
    expect(isPlainSvg(svg('<circle cx="5" cy="5" r="4" fill="#0A7A50"/><path d="M1 1L9 9"/>'))).toBe(true);
    expect(isPlainSvg(svg('<defs><linearGradient id="g"><stop offset="0"/></linearGradient></defs><rect fill="url(#g)" width="9" height="9"/>'))).toBe(true);
  });
  it.each([
    ['a script', svg('<script>alert(1)</script>')],
    ['an event handler', svg('<rect width="1" height="1"/>', 'onload="alert(1)"')],
    ['a javascript: link', svg('<a href="javascript:alert(1)"><rect width="1" height="1"/></a>')],
    ['embedded HTML', svg('<foreignObject><p>x</p></foreignObject>')],
    ['an external image', svg('<image href="https://evil.example/x.png"/>')],
    ['an external stylesheet reference', svg('<rect style="fill:url(https://evil.example/x)" width="1" height="1"/>')],
    ['an entity bomb', Buffer.from('<!DOCTYPE svg [<!ENTITY a "aaaa">]><svg xmlns="http://www.w3.org/2000/svg">&a;</svg>')],
    ['something that is not an SVG', Buffer.from('<html><body>hi</body></html>')],
  ])('refuses %s', (_label, buffer) => { expect(isPlainSvg(buffer)).toBe(false); });
});
