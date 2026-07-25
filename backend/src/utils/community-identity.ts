const GENERIC_WORDS = new Set(['the', 'community', 'club', 'society', 'association', 'guild', 'group']);

export function normalizeIdentity(value: string) {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function comparisonTokens(value: string) {
  const tokens = normalizeIdentity(value).split(' ').filter(Boolean);
  const meaningful = tokens.filter((token) => !GENERIC_WORDS.has(token));
  return meaningful.length ? meaningful : tokens;
}

export function levenshteinDistance(left: string, right: string) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const above = previous[j];
      previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + (left[i - 1] === right[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return previous[right.length];
}

export function communityNameSimilarity(left: string, right: string) {
  const a = comparisonTokens(left).join(' ');
  const b = comparisonTokens(right).join(' ');
  const longest = Math.max(a.length, b.length);
  if (!longest) return 1;
  return 1 - levenshteinDistance(a, b) / longest;
}

const IMPERSONATION_WORDS = /\b(official|verified|authori[sz]ed|administrator|admin|authentic|genuine)\b/i;
const SPAM_PATTERNS = [
  /\b(buy|sell|double)\s+(crypto|bitcoin|money)\b/i,
  /\bfree\s+(money|airdrop|giveaway)\b/i,
  /\b(whatsapp|telegram)\b.*\b\+?\d{7,}\b/i,
  /(https?:\/\/|www\.)/i,
  /(.)\1{7,}/i,
];

export function validateCommunityContent(name: string, shortDescription: string, description = '') {
  if (IMPERSONATION_WORDS.test(name)) {
    throw new Error('Community names cannot claim official, verified, authorized, or administrator status');
  }
  const content = `${name}\n${shortDescription}\n${description}`;
  if (SPAM_PATTERNS.some((pattern) => pattern.test(content))) {
    throw new Error('Community details contain spam or promotional content that is not allowed');
  }
}