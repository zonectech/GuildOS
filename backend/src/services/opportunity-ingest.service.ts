import { config } from '../config';
import { OpportunityModel } from '../models/opportunity.model';
import { remotiveProvider } from './opportunity-providers/remotive.provider';
import { arbeitnowProvider } from './opportunity-providers/arbeitnow.provider';
import { adzunaProvider } from './opportunity-providers/adzuna.provider';
import { joobleProvider } from './opportunity-providers/jooble.provider';
import { rssProvider } from './opportunity-providers/rss.provider';
import type { OpportunityProvider } from './opportunity-providers/types';

const PROVIDERS: OpportunityProvider[] = [remotiveProvider, arbeitnowProvider, adzunaProvider, joobleProvider, rssProvider];

export type IngestSummary = {
  provider: string;
  enabled: boolean;
  fetched: number;
  created: number;
  updated: number;
};

async function ingestProvider(provider: OpportunityProvider): Promise<IngestSummary> {
  if (!provider.enabled()) {
    return { provider: provider.name, enabled: false, fetched: 0, created: 0, updated: 0 };
  }
  const listings = (await provider.fetch()).filter((l) => l.title?.trim() && l.externalId && l.applicationUrl);
  if (!listings.length) {
    return { provider: provider.name, enabled: true, fetched: 0, created: 0, updated: 0 };
  }

  const operations = listings.map((l) => ({
    updateOne: {
      filter: { source: l.source, externalId: l.externalId },
      update: {
        $set: {
          title: l.title.trim(),
          description: l.description,
          category: l.category,
          organization: l.organization,
          location: l.location,
          deadline: l.deadline,
          tags: l.tags,
          applicationUrl: l.applicationUrl,
        },
        $setOnInsert: {
          source: l.source,
          externalId: l.externalId,
          status: 'OPEN' as const,
          postedBy: null,
          saveCount: 0,
          applyCount: 0,
          eligibility: {
            minGuildScore: 0,
            minLeadershipRoles: 0,
            minCertificates: 0,
            universities: [] as string[],
            departments: [] as string[],
            levels: [] as string[],
            graduationYears: [] as number[],
          },
        },
      },
      upsert: true,
    },
  }));

  const result = await OpportunityModel.bulkWrite(operations, { ordered: false });
  const created = result.upsertedCount ?? 0;
  return {
    provider: provider.name,
    enabled: true,
    fetched: listings.length,
    created,
    updated: (result.modifiedCount ?? 0),
  };
}

/** Fetch from all enabled providers and upsert into the opportunities collection. */
export async function syncOpportunities(): Promise<{ summaries: IngestSummary[]; created: number; updated: number }> {
  const summaries: IngestSummary[] = [];
  for (const provider of PROVIDERS) {
    try {
      summaries.push(await ingestProvider(provider));
    } catch (error) {
      console.warn('[GuildOS] opportunity sync failed for', provider.name, error instanceof Error ? error.message : error);
      summaries.push({ provider: provider.name, enabled: provider.enabled(), fetched: 0, created: 0, updated: 0 });
    }
  }
  const created = summaries.reduce((n, s) => n + s.created, 0);
  const updated = summaries.reduce((n, s) => n + s.updated, 0);
  return { summaries, created, updated };
}

let running = false;

/**
 * Periodically syncs opportunities from compliant providers. Opt-in via
 * OPPORTUNITY_SYNC_ENABLED=true so it never runs unexpectedly in dev.
 */
export function startOpportunitySyncScheduler(intervalMs = config.opportunitySyncIntervalMs) {
  if (!config.opportunitySyncEnabled) {
    console.log('[GuildOS] Opportunity sync scheduler disabled (set OPPORTUNITY_SYNC_ENABLED=true to enable)');
    return;
  }
  const run = () => {
    if (running) return;
    running = true;
    void syncOpportunities()
      .then(({ created, updated }) => console.log(`[GuildOS] Opportunity sync: +${created} new, ${updated} updated`))
      .catch((error) => console.warn('[GuildOS] Opportunity sync error', error instanceof Error ? error.message : error))
      .finally(() => {
        running = false;
      });
  };
  const timer = setTimeout(run, 30_000);
  const interval = setInterval(run, Math.max(intervalMs, 60_000));
  timer.unref?.();
  interval.unref?.();
}
