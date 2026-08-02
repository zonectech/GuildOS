export const MAX_SOCIAL_LINKS = 10;
export const MAX_SOCIAL_LINK_LENGTH = 300;

export class SocialLinksValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SocialLinksValidationError';
  }
}

function isValidHandle(value: string) {
  return /^@[a-z\d](?:[a-z\d._-]{0,78}[a-z\d])?$/i.test(value);
}

function isSafeWebLink(value: string) {
  if (value.startsWith('/') || value.startsWith('\\')) return false;
  if (/^[a-z][a-z\d+.-]*:/i.test(value) && !/^https?:\/\//i.test(value)) return false;

  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      !url.username &&
      !url.password &&
      Boolean(url.hostname) &&
      (url.hostname.includes('.') || url.hostname === 'localhost')
    );
  } catch {
    return false;
  }
}

/** Validates, trims, de-duplicates, and caps user-provided social links. */
export function sanitizeSocialLinks(input: unknown): string[] {
  if (!Array.isArray(input)) {
    throw new SocialLinksValidationError('Social links must be a list');
  }

  const links: string[] = [];
  const seen = new Set<string>();

  for (const item of input) {
    if (typeof item !== 'string') {
      throw new SocialLinksValidationError('Each social link must be text');
    }

    const value = item.trim();
    if (!value) continue;
    if (value.length > MAX_SOCIAL_LINK_LENGTH) {
      throw new SocialLinksValidationError(`Social links must be ${MAX_SOCIAL_LINK_LENGTH} characters or less`);
    }
    if (!isValidHandle(value) && !isSafeWebLink(value)) {
      throw new SocialLinksValidationError(`Invalid social link: ${value}`);
    }

    const key = value.toLowerCase().replace(/\/$/, '');
    if (seen.has(key)) continue;
    seen.add(key);
    links.push(value);
  }

  if (links.length > MAX_SOCIAL_LINKS) {
    throw new SocialLinksValidationError(`No more than ${MAX_SOCIAL_LINKS} social links are allowed`);
  }

  return links;
}
