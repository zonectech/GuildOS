import type { OpportunityCategory } from '../../models/opportunity.model';

export type NormalizedOpportunity = {
  source: string;
  externalId: string;
  title: string;
  description: string;
  category: OpportunityCategory;
  organization: string;
  location: string;
  deadline: Date | null;
  tags: string[];
  applicationUrl: string;
};

export type OpportunityProvider = {
  name: string;
  /** Whether this provider is usable (e.g. required API keys are configured). */
  enabled(): boolean;
  /** Fetch and normalize a bounded batch of listings. Must never throw fatally. */
  fetch(): Promise<NormalizedOpportunity[]>;
};

/** Strip HTML tags/entities and collapse whitespace from provider descriptions. */
export function cleanText(html: string, max = 1500): string {
  const text = String(html ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/** Infer a GuildOS opportunity category from a title + tags (job boards return mixed roles). */
export function inferCategory(title: string, tags: string[]): OpportunityCategory {
  const hay = `${title} ${tags.join(' ')}`.toLowerCase();
  if (/scholarship|bursary|grant/.test(hay)) return 'SCHOLARSHIP';
  if (/fellowship/.test(hay)) return 'FELLOWSHIP';
  if (/hackathon|challenge|competition/.test(hay)) return 'COMPETITION';
  if (/conference|summit|symposium/.test(hay)) return 'CONFERENCE';
  if (/open[- ]?source|oss|mentorship program/.test(hay)) return 'OPEN_SOURCE';
  if (/ambassador|campus rep|representative/.test(hay)) return 'CAMPUS_ROLE';
  return 'INTERNSHIP';
}

export function normalizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return Array.from(
    new Set(
      tags
        .map((t) => String(t).toLowerCase().trim())
        .filter((t) => t.length > 1 && t.length < 30),
    ),
  ).slice(0, 12);
}
