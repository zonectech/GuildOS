import { config } from '../../config';
import { cleanText, inferCategory, normalizeTags, type NormalizedOpportunity, type OpportunityProvider } from './types';

type AdzunaJob = {
  id: string;
  title: string;
  description?: string;
  company?: { display_name?: string };
  location?: { display_name?: string };
  redirect_url: string;
  created?: string;
  category?: { label?: string };
};

/**
 * Adzuna — official job aggregator API. Requires ADZUNA_APP_ID + ADZUNA_APP_KEY.
 * Disabled automatically when keys are absent. Queries entry-level/intern roles.
 */
export const adzunaProvider: OpportunityProvider = {
  name: 'ADZUNA',
  enabled: () => Boolean(config.adzunaAppId && config.adzunaAppKey),
  async fetch(): Promise<NormalizedOpportunity[]> {
    if (!config.adzunaAppId || !config.adzunaAppKey) return [];
    try {
      const country = encodeURIComponent(config.adzunaCountry || 'gb');
      const url =
        `https://api.adzuna.com/v1/api/jobs/${country}/search/1` +
        `?app_id=${encodeURIComponent(config.adzunaAppId)}&app_key=${encodeURIComponent(config.adzunaAppKey)}` +
        `&results_per_page=50&what=intern&content-type=application/json`;
      const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'GuildOS/1.0 (+opportunity-sync)' } });
      if (!res.ok) return [];
      const data = (await res.json()) as { results?: AdzunaJob[] };
      const jobs = Array.isArray(data.results) ? data.results : [];
      return jobs.map((job) => {
        const tags = normalizeTags([job.category?.label].filter(Boolean));
        return {
          source: 'ADZUNA',
          externalId: String(job.id),
          title: job.title,
          description: cleanText(job.description ?? ''),
          category: inferCategory(job.title, tags),
          organization: job.company?.display_name ?? '',
          location: job.location?.display_name ?? '',
          deadline: null,
          tags,
          applicationUrl: job.redirect_url,
        };
      });
    } catch {
      return [];
    }
  },
};
