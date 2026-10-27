import { describe, it, expect } from 'vitest';
import { publicEventUrl, publicIpv4, extractEventPage } from './external-event-link';
describe('public event link import', () => {
  it.each(['http://example.com/e', 'https://127.0.0.1/e', 'https://[::1]/e', 'https://example.com:8080/e', 'https://user:pass@example.com/e', 'https://foo.local/e'])('rejects unsafe URLs %s', url => expect(() => publicEventUrl(url)).toThrow());
  it.each(['127.0.0.1','10.0.0.2','172.16.0.1','192.168.0.1','169.254.169.254','100.64.0.1','0.0.0.0','224.0.0.1'])('rejects non-public DNS results %s', ip => expect(publicIpv4(ip)).toBe(false));
  it('accepts public HTTPS names and public IPv4 DNS results', () => {
    expect(publicEventUrl('https://events.example.com/a').hostname).toBe('events.example.com'); expect(publicIpv4('8.8.8.8')).toBe(true);
  });
  it('extracts a structured event within a graph with explicit timezone', () => {
    const html = '<script type="application/ld+json">' + JSON.stringify({ '@graph': [{ '@type': 'Event', name: 'Campus AI', description: '<p>Learn AI</p>', startDate: '2026-10-20T15:00:00+01:00', endDate: '2026-10-20T17:00:00+01:00', location: { '@type': 'VirtualLocation' } }] }) + '</script>';
    expect(extractEventPage(html, 'https://example.com/event').draft).toMatchObject({ title: 'Campus AI', description: 'Learn AI', startDate: '2026-10-20T14:00:00.000Z', mode: 'VIRTUAL' });
  });
  it('requires manual dates rather than guessing a timezone', () => {
    const html = '<script type="application/ld+json">{"@type":"Event","name":"Event","startDate":"2026-10-20T15:00:00"}</script>';
    expect(extractEventPage(html, 'https://example.com/e').draft.startDate).toBeNull();
  });
  it('falls back to metadata and flags incomplete details', () => {
    const result = extractEventPage('<meta content="Campus &amp; careers" property="og:title"><meta name="description" content="Learn together">', 'https://example.com/e');
    expect(result.draft.title).toBe('Campus & careers'); expect(result.warnings.length).toBeGreaterThan(1);
  });
  it('rejects pages containing multiple events', () => {
    const html = '<script type="application/ld+json">[{"@type":"Event","name":"A"},{"@type":"Event","name":"B"}]</script>';
    expect(() => extractEventPage(html, 'https://example.com/e')).toThrow(/multiple events/);
  });
});
