// Link-type registration answers: normalize whatever the attendee typed (a full URL,
// "linkedin.com/in/ada", "@ada" or just "ada") into one canonical https link, and make
// sure it points at the platform the organizer asked for.

export type LinkPlatform = 'LINKEDIN' | 'GITHUB' | 'X' | 'INSTAGRAM' | 'WEBSITE';
export const LINK_PLATFORMS: LinkPlatform[] = ['LINKEDIN', 'GITHUB', 'X', 'INSTAGRAM', 'WEBSITE'];

type PlatformRule = {
  label: string;
  hosts: string[];
  /** Builds a profile URL from a bare handle; absent = handles aren't accepted. */
  fromHandle?: (handle: string) => string;
  /** Path the link must have (e.g. LinkedIn profiles live under /in/ or /company/). */
  path?: RegExp;
};

const HANDLE = /^@?([a-z0-9](?:[a-z0-9._-]{0,48}[a-z0-9])?)$/i;

const RULES: Record<Exclude<LinkPlatform, 'WEBSITE'>, PlatformRule> = {
  LINKEDIN: {
    label: 'LinkedIn',
    hosts: ['linkedin.com'],
    fromHandle: (h) => `https://www.linkedin.com/in/${h}`,
    path: /^\/(in|company|pub)\/[^/]+/i,
  },
  GITHUB: { label: 'GitHub', hosts: ['github.com'], fromHandle: (h) => `https://github.com/${h}`, path: /^\/[^/]+/ },
  X: { label: 'X (Twitter)', hosts: ['x.com', 'twitter.com'], fromHandle: (h) => `https://x.com/${h}`, path: /^\/[^/]+/ },
  INSTAGRAM: { label: 'Instagram', hosts: ['instagram.com'], fromHandle: (h) => `https://www.instagram.com/${h}`, path: /^\/[^/]+/ },
};

export function linkPlatformLabel(platform: LinkPlatform) {
  return platform === 'WEBSITE' ? 'website' : RULES[platform].label;
}

function hostMatches(hostname: string, hosts: string[]) {
  const host = hostname.toLowerCase().replace(/^www\./, '');
  return hosts.some((h) => host === h || host.endsWith(`.${h}`));
}

function parseWebLink(value: string): URL | null {
  if (/^[a-z][a-z\d+.-]*:/i.test(value) && !/^https?:\/\//i.test(value)) return null; // javascript:, mailto:, …
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    if (url.username || url.password || !url.hostname.includes('.')) return null;
    return url;
  } catch {
    return null;
  }
}

/** Returns the canonical https link, or throws a message naming the question. */
export function normalizeLinkAnswer(platform: LinkPlatform, raw: string, questionLabel: string): string {
  const value = raw.trim();
  if (!value) return '';
  const rule = platform === 'WEBSITE' ? null : RULES[platform];

  if (rule?.fromHandle) {
    const handle = HANDLE.exec(value);
    if (handle && !value.includes('.')) return rule.fromHandle(handle[1]);
  }

  const url = parseWebLink(value);
  if (!url) throw new Error(`"${questionLabel}" needs a valid ${linkPlatformLabel(platform)} link`);
  if (rule) {
    if (!hostMatches(url.hostname, rule.hosts) || (rule.path && !rule.path.test(url.pathname))) {
      throw new Error(`"${questionLabel}" needs a ${rule.label} profile link, e.g. ${rule.fromHandle?.('yourname') ?? rule.hosts[0]}`);
    }
  }
  url.protocol = 'https:';
  url.hash = '';
  return url.toString().replace(/\/$/, '').slice(0, 300);
}

/** The first link in a profile's socialLinks that belongs to this platform (handles count for X/Instagram-style "@name"). */
export function profileLinkFor(platform: LinkPlatform, socialLinks: string[]): string {
  if (platform === 'WEBSITE') return '';
  for (const entry of socialLinks) {
    if (entry.startsWith('@')) continue; // ambiguous — we can't tell which platform a bare handle is for
    const url = parseWebLink(entry);
    if (url && hostMatches(url.hostname, RULES[platform].hosts)) {
      try {
        return normalizeLinkAnswer(platform, entry, '');
      } catch {
        /* not a profile-shaped link (e.g. a LinkedIn post) — keep looking */
      }
    }
  }
  return '';
}
