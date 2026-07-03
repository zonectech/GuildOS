import { cleanText, inferCategory, normalizeTags, type NormalizedOpportunity, type OpportunityProvider } from './types';

type ArbeitnowJob = {
  slug: string;
  company_name: string;
  title: string;
  description?: string;
  remote?: boolean;
  url: string;
  tags?: string[];
  job_types?: string[];
  location?: string;
  created_at?: number;
};

/** Arbeitnow — free public job-board JSON API. No key required. */
export const arbeitnowProvider: OpportunityProvider = {
  name: 'ARBEITNOW',
  enabled: () => true,
  async fetch(): Promise<NormalizedOpportunity[]> {
    try {
      const res = await fetch('https://www.arbeitnow.com/api/job-board-api', {
        headers: { Accept: 'application/json', 'User-Agent': 'GuildOS/1.0 (+opportunity-sync)' },
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { data?: ArbeitnowJob[] };
      const jobs = Array.isArray(data.data) ? data.data.slice(0, 50) : [];
      return jobs.map((job) => {
        const tags = normalizeTags([...(job.tags ?? []), ...(job.job_types ?? [])].filter(Boolean));
        return {
          source: 'ARBEITNOW',
          externalId: job.slug,
          title: job.title,
          description: cleanText(job.description ?? ''),
          category: inferCategory(job.title, tags),
          organization: job.company_name ?? '',
          location: job.location || (job.remote ? 'Remote' : ''),
          deadline: null,
          tags,
          applicationUrl: job.url,
        };
      });
    } catch {
      return [];
    }
  },
};
