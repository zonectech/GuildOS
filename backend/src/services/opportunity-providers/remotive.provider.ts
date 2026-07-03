import { cleanText, inferCategory, normalizeTags, type NormalizedOpportunity, type OpportunityProvider } from './types';

type RemotiveJob = {
  id: number;
  url: string;
  title: string;
  company_name: string;
  category: string;
  tags?: string[];
  candidate_required_location?: string;
  description?: string;
};

/** Remotive — free public JSON API for remote jobs. No key required. */
export const remotiveProvider: OpportunityProvider = {
  name: 'REMOTIVE',
  enabled: () => true,
  async fetch(): Promise<NormalizedOpportunity[]> {
    try {
      const res = await fetch('https://remotive.com/api/remote-jobs?limit=50', {
        headers: { Accept: 'application/json', 'User-Agent': 'GuildOS/1.0 (+opportunity-sync)' },
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { jobs?: RemotiveJob[] };
      const jobs = Array.isArray(data.jobs) ? data.jobs : [];
      return jobs.map((job) => {
        const tags = normalizeTags([...(job.tags ?? []), job.category].filter(Boolean));
        return {
          source: 'REMOTIVE',
          externalId: String(job.id),
          title: job.title,
          description: cleanText(job.description ?? ''),
          category: inferCategory(job.title, tags),
          organization: job.company_name ?? '',
          location: job.candidate_required_location || 'Remote',
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
