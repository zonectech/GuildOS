import { describe, expect, it } from 'vitest';
import { MAX_CHAT_LINKS, normalizeChatLinks } from './chat-links';

describe('chat links validation', () => {
  it('accepts valid links across platforms', () => {
    const links = normalizeChatLinks([
      { platform: 'WHATSAPP', url: 'https://chat.whatsapp.com/AbCdEf123' },
      { platform: 'DISCORD', url: 'https://discord.gg/guildos' },
      { platform: 'TELEGRAM', url: 'https://t.me/guildos' },
      { platform: 'SLACK', url: 'https://join.slack.com/t/guildos/shared_invite/xyz' },
      { platform: 'OTHER', url: 'https://matrix.to/#/#guildos:matrix.org', label: 'Matrix' },
    ]);
    expect(links).toHaveLength(5);
    expect(links[0]).toEqual({ platform: 'WHATSAPP', url: 'https://chat.whatsapp.com/AbCdEf123', label: '' });
    expect(links[4].label).toBe('Matrix');
  });

  it('returns empty list for undefined/null', () => {
    expect(normalizeChatLinks(undefined)).toEqual([]);
    expect(normalizeChatLinks(null)).toEqual([]);
  });

  it('normalizes lowercase platform names and trims urls', () => {
    const [link] = normalizeChatLinks([{ platform: 'discord', url: '  https://discord.com/invite/abc  ' }]);
    expect(link.platform).toBe('DISCORD');
    expect(link.url).toBe('https://discord.com/invite/abc');
  });

  it('rejects non-https and malformed URLs', () => {
    expect(() => normalizeChatLinks([{ platform: 'WHATSAPP', url: 'http://chat.whatsapp.com/x' }])).toThrow(/https/);
    expect(() => normalizeChatLinks([{ platform: 'OTHER', url: 'not-a-url' }])).toThrow(/https/);
  });

  it('rejects host mismatches per platform (phishing lookalikes)', () => {
    expect(() => normalizeChatLinks([{ platform: 'WHATSAPP', url: 'https://chat-whatsapp.evil.com/x' }])).toThrow(/WhatsApp/);
    expect(() => normalizeChatLinks([{ platform: 'DISCORD', url: 'https://discord.gg.evil.com/x' }])).toThrow(/Discord/);
    expect(() => normalizeChatLinks([{ platform: 'TELEGRAM', url: 'https://t.me.evil.com/x' }])).toThrow(/Telegram/);
    expect(() => normalizeChatLinks([{ platform: 'SLACK', url: 'https://fakeslack.com/x' }])).toThrow(/Slack/);
  });

  it('allows any https host for OTHER', () => {
    const [link] = normalizeChatLinks([{ platform: 'OTHER', url: 'https://signal.group/#abc' }]);
    expect(link.url).toBe('https://signal.group/#abc');
  });

  it('rejects unsupported platforms, non-lists, and too many links', () => {
    expect(() => normalizeChatLinks([{ platform: 'MYSPACE', url: 'https://x.com' }])).toThrow(/Unsupported/);
    expect(() => normalizeChatLinks('nope')).toThrow(/list/);
    const tooMany = Array.from({ length: MAX_CHAT_LINKS + 1 }, () => ({ platform: 'OTHER', url: 'https://example.com' }));
    expect(() => normalizeChatLinks(tooMany)).toThrow(/At most/);
  });

  it('caps label length at 40 chars', () => {
    const [link] = normalizeChatLinks([{ platform: 'OTHER', url: 'https://example.com', label: 'x'.repeat(100) }]);
    expect(link.label).toHaveLength(40);
  });
});
