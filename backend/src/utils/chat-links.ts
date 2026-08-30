export const CHAT_PLATFORMS = ['WHATSAPP', 'DISCORD', 'TELEGRAM', 'SLACK', 'OTHER'] as const;
export type ChatPlatform = (typeof CHAT_PLATFORMS)[number];

export type ChatLink = { platform: ChatPlatform; url: string; label: string };

export const MAX_CHAT_LINKS = 5;

const PLATFORM_LABELS: Record<ChatPlatform, string> = {
  WHATSAPP: 'WhatsApp',
  DISCORD: 'Discord',
  TELEGRAM: 'Telegram',
  SLACK: 'Slack',
  OTHER: 'chat',
};

// Host allow-lists per platform — catches typos and cheap phishing lookalikes.
const PLATFORM_HOSTS: Record<Exclude<ChatPlatform, 'OTHER'>, RegExp> = {
  WHATSAPP: /^(chat\.|www\.)?whatsapp\.com$/i,
  DISCORD: /^(discord\.gg|(www\.)?discord\.com)$/i,
  TELEGRAM: /^(t\.me|telegram\.me)$/i,
  SLACK: /^([a-z0-9-]+\.)?slack\.com$/i,
};

/** Validates and normalizes a client-supplied chat-links payload. Throws on any invalid entry. */
export function normalizeChatLinks(input: unknown): ChatLink[] {
  if (input === undefined || input === null) return [];
  if (!Array.isArray(input)) throw new Error('Chat links must be a list');
  if (input.length > MAX_CHAT_LINKS) throw new Error(`At most ${MAX_CHAT_LINKS} chat links are allowed`);

  return input.map((raw) => {
    const entry = (raw ?? {}) as Record<string, unknown>;
    const platform = String(entry.platform ?? '').toUpperCase() as ChatPlatform;
    const url = String(entry.url ?? '').trim();
    const label = String(entry.label ?? '').trim().slice(0, 40);

    if (!CHAT_PLATFORMS.includes(platform)) {
      throw new Error('Unsupported chat platform — use WhatsApp, Discord, Telegram, Slack, or Other');
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error(`${PLATFORM_LABELS[platform]} link must be a full https:// URL`);
    }
    if (parsed.protocol !== 'https:') {
      throw new Error(`${PLATFORM_LABELS[platform]} link must use https://`);
    }
    if (platform !== 'OTHER' && !PLATFORM_HOSTS[platform].test(parsed.hostname)) {
      throw new Error(`That does not look like a ${PLATFORM_LABELS[platform]} link (got ${parsed.hostname})`);
    }

    return { platform, url, label };
  });
}
