import dns from 'node:dns/promises';
import net from 'node:net';

/**
 * Link previews for EXTERNAL urls shared in chats/posts. Fetches the page and
 * extracts OpenGraph/title metadata server-side (browsers can't cross-origin).
 *
 * Security: this is a classic SSRF surface, so every hop is validated —
 * http(s) only, public IPs only (DNS-resolved before connecting), redirects
 * followed manually with re-validation, small size cap, short timeout.
 */

export type LinkPreview = {
  url: string;
  title: string;
  description: string;
  image: string;
  siteName: string;
};

const CACHE_TTL_MS = 60 * 60 * 1000; // 1h — link cards don't need to be fresher
const CACHE_MAX = 500;
const MAX_BODY_BYTES = 512 * 1024;
const FETCH_TIMEOUT_MS = 6000;
const MAX_REDIRECTS = 3;

const cache = new Map<string, { value: LinkPreview | null; expires: number }>();

function isPrivateIp(ip: string): boolean {
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    return (
      lower === '::1' ||
      lower.startsWith('fe80') || // link-local
      lower.startsWith('fc') || lower.startsWith('fd') || // unique local
      lower.startsWith('::ffff:') // v4-mapped — validate the embedded v4
        ? isPrivateIp(lower.replace('::ffff:', ''))
        : false
    );
  }
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true; // be safe
  const [a, b] = parts;
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // link-local / cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224 // multicast/reserved
  );
}

/** Throws unless the URL is http(s) on a publicly-routable host. */
async function assertSafeUrl(raw: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('Invalid link');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('Invalid link');
  const host = parsed.hostname.toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) throw new Error('Invalid link');
  // Literal IPs get checked directly; hostnames get resolved first.
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new Error('Invalid link');
    return parsed;
  }
  const records = await dns.lookup(host, { all: true }).catch(() => []);
  if (!records.length || records.some((r) => isPrivateIp(r.address))) throw new Error('Invalid link');
  return parsed;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

function metaContent(html: string, patterns: string[]): string {
  for (const name of patterns) {
    // property/name in either attribute order
    const rx1 = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i');
    const rx2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${name}["']`, 'i');
    const m = html.match(rx1) ?? html.match(rx2);
    if (m?.[1]) return decodeEntities(m[1].trim());
  }
  return '';
}

async function fetchWithLimits(url: URL): Promise<string | null> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(current.toString(), {
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          // Some sites only serve OG tags to crawlers with a UA.
          'User-Agent': 'Mozilla/5.0 (compatible; GuildOSLinkPreview/1.0)',
          Accept: 'text/html,application/xhtml+xml',
        },
      });
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location');
        if (!location) return null;
        // Every redirect target gets the same SSRF validation as the original.
        current = await assertSafeUrl(new URL(location, current).toString());
        continue;
      }
      if (!res.ok) return null;
      const type = res.headers.get('content-type') ?? '';
      if (!type.includes('text/html') && !type.includes('xhtml')) return null;
      // Stream with a hard byte cap — OG tags live in <head>, we never need much.
      const reader = res.body?.getReader();
      if (!reader) return null;
      const chunks: Uint8Array[] = [];
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        chunks.push(value);
        if (total >= MAX_BODY_BYTES) {
          void reader.cancel().catch(() => undefined);
          break;
        }
      }
      return Buffer.concat(chunks).toString('utf8');
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

export async function getLinkPreview(rawUrl: string): Promise<LinkPreview | null> {
  const key = rawUrl.trim().slice(0, 2000);
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;

  let value: LinkPreview | null = null;
  try {
    const url = await assertSafeUrl(key);
    const html = await fetchWithLimits(url);
    if (html) {
      const title =
        metaContent(html, ['og:title', 'twitter:title']) ||
        decodeEntities((html.match(/<title[^>]*>([^<]{1,300})<\/title>/i)?.[1] ?? '').trim());
      const image = metaContent(html, ['og:image', 'og:image:url', 'twitter:image', 'twitter:image:src']);
      let resolvedImage = '';
      if (image) {
        try {
          const abs = new URL(image, url);
          if (abs.protocol === 'http:' || abs.protocol === 'https:') resolvedImage = abs.toString();
        } catch {
          /* ignore bad image URLs */
        }
      }
      if (title) {
        value = {
          url: url.toString(),
          title: title.slice(0, 200),
          description: metaContent(html, ['og:description', 'twitter:description', 'description']).slice(0, 300),
          image: resolvedImage,
          siteName: metaContent(html, ['og:site_name']).slice(0, 80) || url.hostname.replace(/^www\./, ''),
        };
      }
    }
  } catch {
    value = null;
  }

  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
  return value;
}
