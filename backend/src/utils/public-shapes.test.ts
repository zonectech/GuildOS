import { describe, expect, it } from 'vitest';
import { stripPrivateCommunityFields, stripPrivateEventFields, toPersonCard } from './public-shapes';

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
