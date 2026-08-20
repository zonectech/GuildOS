import { CommunityModel } from '../models/community.model';
import { EventModel } from '../models/event.model';
import { authStore } from '../store/auth-store';
import { searchKnowledge } from './knowledge.service';
import { listOpportunities } from './opportunity.service';

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const SECTION_LIMIT = 6;

/**
 * One-round-trip global search across people, communities, events,
 * opportunities and knowledge. All matching is server-side and every
 * section respects its domain's visibility rules (public profiles only,
 * public non-archived communities, public published events, open
 * opportunities, public-community knowledge).
 */
export async function unifiedSearch(query: string, viewerId: string | null) {
  const q = query.trim();
  if (q.length < 2) {
    return { people: [], communities: [], events: [], opportunities: [], knowledge: [] };
  }
  const rx = new RegExp(escapeRegex(q), 'i');

  const [people, communities, events, opportunities, knowledge] = await Promise.all([
    authStore.searchPublicPeople(q, SECTION_LIMIT),
    CommunityModel.find({
      visibility: 'PUBLIC',
      archivedAt: null,
      $or: [{ name: rx }, { shortDescription: rx }, { description: rx }],
    })
      .sort({ memberCount: -1, updatedAt: -1 })
      .limit(SECTION_LIMIT)
      .select('name slug logo shortDescription description')
      .lean(),
    EventModel.find({
      visibility: 'PUBLIC',
      status: { $in: ['PUBLISHED', 'CHECK_IN', 'CHECK_OUT', 'COMPLETED'] },
      $or: [{ title: rx }, { shortDescription: rx }],
    })
      .sort({ startDate: -1 })
      .limit(SECTION_LIMIT)
      .select('title slug shortDescription startDate status mode')
      .lean(),
    listOpportunities(viewerId, { search: q }),
    searchKnowledge(q, SECTION_LIMIT),
  ]);

  return {
    people,
    communities: communities.map((c) => ({
      _id: c._id.toString(),
      slug: c.slug,
      name: c.name,
      logo: c.logo ?? '',
      description: c.shortDescription || c.description || '',
    })),
    events: events.map((e) => ({
      _id: e._id.toString(),
      slug: e.slug,
      title: e.title,
      shortDescription: e.shortDescription ?? '',
      startDate: e.startDate,
      status: e.status,
      mode: e.mode,
    })),
    opportunities: (opportunities as Array<{ id: string; title: string; organization?: string; location?: string }>).slice(0, SECTION_LIMIT),
    knowledge,
  };
}
