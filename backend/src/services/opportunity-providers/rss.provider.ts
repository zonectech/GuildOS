import { config } from '../../config';
import { cleanText, inferCategory, type NormalizedOpportunity, type OpportunityProvider } from './types';

function stripCdata(value: string): string {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
}

function tag(block: string, name: string): string {
  const match = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return match ? stripCdata(match[1]).trim() : '';
}

function link(block: string): string {
  // RSS: <link>URL</link>
  const rss = block.match(/<link>\s*([\s\S]*?)\s*<\/link>/i);
  if (rss && stripCdata(rss[1]).startsWith('http')) return stripCdata(rss[1]).trim();
  // Atom: <link href="URL" .../> (prefer alternate)
  const alt = block.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"/i);
  if (alt) return alt[1];
  const anyHref = block.match(/<link[^>]*href="([^"]+)"/i);
  return anyHref ? anyHref[1] : '';
}

function parseFeed(xml: string): Array<{ title: string; url: string; description: string; guid: string; organization: string }> {
  const blocks =
    xml.match(/<item[\s\S]*?<\/item>/gi) ?? xml.match(/<entry[\s\S]*?<\/entry>/gi) ?? [];
  return blocks.slice(0, 30).map((block) => {
    const title = cleanText(tag(block, 'title'), 200);
    const url = link(block);
    const description = cleanText(tag(block, 'description') || tag(block, 'summary') || tag(block, 'content'));
    const guid = tag(block, 'guid') || tag(block, 'id') || url;
    const organization = cleanText(tag(block, 'dc:creator') || tag(block, 'author'), 120);
    return { title, url, description, guid, organization };
  });
}

/**
 * Generic RSS/Atom feed provider (dependency-free). Reads feed URLs from
 * OPPORTUNITY_RSS_FEEDS (comma-separated). Use it for scholarship/fellowship/job
 * boards that publish public feeds.
 */
export const rssProvider: OpportunityProvider = {
  name: 'RSS',
  enabled: () => config.opportunityRssFeeds.length > 0,
  async fetch(): Promise<NormalizedOpportunity[]> {
    const results: NormalizedOpportunity[] = [];
    for (const feedUrl of config.opportunityRssFeeds) {
      try {
        const res = await fetch(feedUrl, { headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml', 'User-Agent': 'GuildOS/1.0 (+opportunity-sync)' } });
        if (!res.ok) continue;
        const xml = await res.text();
        for (const item of parseFeed(xml)) {
          if (!item.title || !item.url) continue;
          results.push({
            source: 'RSS',
            externalId: item.guid,
            title: item.title,
            description: item.description,
            category: inferCategory(item.title, []),
            organization: item.organization,
            location: '',
            deadline: null,
            tags: [],
            applicationUrl: item.url,
          });
        }
      } catch {
        // Skip unreachable / malformed feeds.
      }
    }
    return results;
  },
};
