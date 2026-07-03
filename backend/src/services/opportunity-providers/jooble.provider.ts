import { config } from '../../config';
import { cleanText, inferCategory, type NormalizedOpportunity, type OpportunityProvider } from './types';

type JoobleJob = {
  id?: number | string;
  title: string;
  location?: string;
  snippet?: string;
  company?: string;
  link: string;
  updated?: string;
};

/**
 * Jooble — official aggregator API (POST with an API key in the path).
 * Disabled automatically when JOOBLE_API_KEY is absent.
 */
export const joobleProvider: OpportunityProvider = {
  name: 'JOOBLE',
  enabled: () => Boolean(config.joobleApiKey),
  async fetch(): Promise<NormalizedOpportunity[]> {
    if (!config.joobleApiKey) return [];
    try {
      const res = await fetch(`https://jooble.org/api/${encodeURIComponent(config.joobleApiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': 'GuildOS/1.0 (+opportunity-sync)' },
        body: JSON.stringify({ keywords: config.joobleKeywords, location: config.joobleLocation }),
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { jobs?: JoobleJob[] };
      const jobs = Array.isArray(data.jobs) ? data.jobs.slice(0, 50) : [];
      return jobs
        .filter((job) => job.title && job.link)
        .map((job) => {
          const externalId = String(job.id ?? job.link);
          return {
            source: 'JOOBLE',
            externalId,
            title: job.title,
            description: cleanText(job.snippet ?? ''),
            category: inferCategory(job.title, []),
            organization: job.company ?? '',
            location: job.location ?? '',
            deadline: null,
            tags: [],
            applicationUrl: job.link,
          };
        });
    } catch {
      return [];
    }
  },
};
