import { resolve4 } from 'node:dns/promises';
import { request } from 'node:https';
import { isIP } from 'node:net';

export function publicEventUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || isIP(url.hostname) || url.hostname.includes(':') || !url.hostname.includes('.') || /\.(localhost|local|internal|test|invalid)$/i.test(url.hostname)) throw new Error('Use a public HTTPS event page');
  return url;
}
export function publicIpv4(ip: string) {
  const n = ip.split('.').map(Number);
  return isIP(ip) === 4 && !([0, 10, 127].includes(n[0]) || n[0] >= 224 || (n[0] === 100 && n[1] >= 64 && n[1] <= 127) || (n[0] === 169 && n[1] === 254) || (n[0] === 172 && n[1] >= 16 && n[1] <= 31) || (n[0] === 192 && (n[1] === 168 || n[1] === 0 || n[1] === 2)) || (n[0] === 198 && [18,19,51].includes(n[1])) || (n[0] === 203 && n[1] === 0 && n[2] === 113));
}
async function readPublicPage(value: string, redirects = 0): Promise<{ html: string; url: string }> {
  const url = publicEventUrl(value);
  const addresses = await resolve4(url.hostname);
  if (!addresses.length || addresses.some(a => !publicIpv4(a))) throw new Error('This address is not a public event page');
  // Pin DNS for the actual connection as well as validating every redirect.
  return new Promise((resolve, reject) => {
    const req = request(url, { method: 'GET', headers: { 'User-Agent': 'GuildOS-EventImport/1.0', Accept: 'text/html' }, lookup: (_host, options, cb) => { if (options.all) cb(null, [{ address: addresses[0], family: 4 }]); else cb(null, addresses[0], 4); } }, res => {
      if ([301,302,303,307,308].includes(res.statusCode || 0) && res.headers.location) {
        res.resume(); if (redirects >= 3) { reject(new Error('Too many redirects')); return; }
        readPublicPage(new URL(res.headers.location, url).href, redirects + 1).then(resolve, reject); return;
      }
      if (res.statusCode !== 200 || !/text\/html|application\/xhtml/i.test(res.headers['content-type'] || '')) { res.resume(); reject(new Error('This page cannot be imported. Enter event details manually.')); return; }
      let size = 0; const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => { size += chunk.length; if (size > 1024 * 1024) req.destroy(new Error('Event page is too large')); else chunks.push(chunk); });
      res.on('end', () => resolve({ html: Buffer.concat(chunks).toString('utf8'), url: url.href }));
      res.on('error', reject);
    });
    const timer = setTimeout(() => req.destroy(new Error('Event page took too long to respond')), 8000);
    req.on('close', () => clearTimeout(timer)); req.on('error', reject); req.end();
  });
}
function clean(value: unknown, limit = 4000): string {
  if (typeof value !== 'string') return '';
  return value.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, limit);
}
export function extractEventPage(html: string, sourceUrl: string) {
  const events: Record<string, any>[] = [];
  function visit(value: any, depth = 0) {
    if (!value || typeof value !== 'object' || depth > 15) return;
    if (Array.isArray(value)) { value.forEach(v => visit(v, depth + 1)); return; }
    const types = Array.isArray(value['@type']) ? value['@type'] : [value['@type']];
    if (types.some((t: unknown) => typeof t === 'string' && /(^|\/)Event$/.test(t))) events.push(value);
    if (value['@graph']) visit(value['@graph'], depth + 1);
    if (value.mainEntity) visit(value.mainEntity, depth + 1);
    if (value.itemListElement) visit(value.itemListElement, depth + 1);
    if (value.item) visit(value.item, depth + 1);
  }
  for (const match of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi)) {
    try { visit(JSON.parse(match[1])); } catch { /* A malformed script doesn't invalidate the other metadata. */ }
  }
  if (events.length > 1) throw new Error('This page contains multiple events. Paste a link to one specific event.');
  const event = events[0];
  const meta = (property: string) => {
    for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
      const attrs = Object.fromEntries(Array.from(m[0].matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/g)).map(a => [a[1].toLowerCase(), a[3]]));
      if (attrs.property === property || attrs.name === property) return clean(attrs.content);
    }
    return '';
  };
  const title = clean(event?.name, 200) || meta('og:title') || clean(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1], 200);
  if (!title) throw new Error('No event details found. This page may require login; enter details manually.');
  const description = clean(event?.description) || meta('og:description') || meta('description');
  const date = (v: unknown) => {
    // Do not guess a timezone for a date or local wall-clock time.
    if (typeof v !== 'string' || !/T.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(v) || Number.isNaN(Date.parse(v))) return null;
    return new Date(v).toISOString();
  };
  const location = Array.isArray(event?.location) ? event.location[0] : event?.location;
  const online = location?.['@type'] === 'VirtualLocation' || /OnlineEventAttendanceMode/.test(event?.eventAttendanceMode || '');
  return {
    draft: { title, description, shortDescription: description.slice(0, 240), startDate: date(event?.startDate), endDate: date(event?.endDate), venue: online ? '' : clean(typeof location === 'string' ? location : location?.name, 200), mode: online ? 'VIRTUAL' as const : 'PHYSICAL' as const, partnerRegistrationUrl: publicEventUrl(sourceUrl).href, partnerRegistrationLabel: new URL(sourceUrl).hostname.replace(/^www\./, '').slice(0, 60) },
    warnings: [!event ? 'Only basic page information was found. Confirm that this is an event page.' : '', !date(event?.startDate) ? 'Set the event date, time and timezone manually.' : '', 'Registration deadlines, capacity, ticket prices and application approval are not imported. Set them from the official event page.', 'Review all imported details and confirm the registration link before saving.'].filter(Boolean),
  };
}
export async function importEventLink(value: string) {
  const page = await readPublicPage(value);
  return extractEventPage(page.html, page.url);
}
