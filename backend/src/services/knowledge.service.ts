import {
  KnowledgeResourceModel,
  KNOWLEDGE_CATEGORIES,
  KNOWLEDGE_TYPES,
  type KnowledgeCategory,
  type KnowledgeResourceDocument,
  type KnowledgeType,
} from '../models/knowledge-resource.model';
import { CommunityModel } from '../models/community.model';
import { MembershipModel } from '../models/membership.model';
import { hasCommunityPermission } from './community.service';
import { awardReputation } from './reputation.service';
import { authStore } from '../store/auth-store';

export type KnowledgeInput = Partial<{
  type: string;
  category: string;
  title: string;
  summary: string;
  content: string;
  url: string;
  file: string;
  fileName: string;
}>;

async function requireKnowledgeEditor(communityId: string, actorId: string) {
  const community = await CommunityModel.findById(communityId);
  if (!community || community.archivedAt) {
    throw new Error('Community not found');
  }
  const membership = await MembershipModel.findOne({ communityId, userId: actorId });
  if (!membership || !hasCommunityPermission(membership.role, 'COORDINATOR')) {
    throw new Error('Insufficient permissions');
  }
  return community;
}

function isHttpUrl(value: string) {
  return /^https?:\/\/\S+$/i.test(value);
}

/** Validates and normalizes the type-specific payload of a resource. */
function applyKnowledgeInput(target: any, input: KnowledgeInput, { creating = false } = {}) {
  if (input.type !== undefined || creating) {
    const type = String(input.type ?? target.type ?? '').toUpperCase();
    if (!KNOWLEDGE_TYPES.includes(type as KnowledgeType)) throw new Error('Invalid resource type');
    target.type = type;
  }
  if (input.category !== undefined || creating) {
    const category = String(input.category ?? target.category ?? 'OTHER').toUpperCase();
    if (!KNOWLEDGE_CATEGORIES.includes(category as KnowledgeCategory)) throw new Error('Invalid category');
    target.category = category;
  }
  if (input.title !== undefined) target.title = String(input.title).trim().slice(0, 140);
  if (input.summary !== undefined) target.summary = String(input.summary).replace(/\s+/g, ' ').trim().slice(0, 300);
  if (input.content !== undefined) target.content = String(input.content).trim().slice(0, 40_000);
  if (input.url !== undefined) target.url = String(input.url).trim().slice(0, 500);
  if (input.file !== undefined) target.file = String(input.file).trim().slice(0, 300);
  if (input.fileName !== undefined) target.fileName = String(input.fileName).trim().slice(0, 140);

  if (!target.title) throw new Error('A title is required');
  if (target.type === 'ARTICLE' && !target.content) throw new Error('Articles need content');
  if (target.type === 'LINK' && !isHttpUrl(target.url)) throw new Error('Links need a valid http(s) URL');
  if (target.type === 'FILE' && !target.file) throw new Error('Attach a file first');
}

/** Members-only for private communities; otherwise public (mirrors posts visibility). */
async function assertCanView(communityId: string, viewerId?: string) {
  const community = await CommunityModel.findById(communityId).select('visibility archivedAt name slug').lean();
  if (!community || community.archivedAt) {
    throw new Error('Community not found');
  }
  if (community.visibility === 'PRIVATE') {
    const membership = viewerId ? await MembershipModel.findOne({ communityId, userId: viewerId }).lean() : null;
    if (!membership) throw new Error('This Knowledge Hub is private to community members');
  }
  return community;
}

function serialize(resource: KnowledgeResourceDocument & { _id: any }, authorName = '') {
  return {
    _id: resource._id.toString(),
    communityId: resource.communityId.toString(),
    type: resource.type,
    category: resource.category,
    title: resource.title,
    summary: resource.summary,
    content: resource.content,
    url: resource.url,
    file: resource.file,
    fileName: resource.fileName,
    viewCount: resource.viewCount ?? 0,
    downloadCount: resource.downloadCount ?? 0,
    authorName,
    createdAt: resource.createdAt,
    updatedAt: resource.updatedAt,
  };
}

export async function listCommunityKnowledge(communityId: string, viewerId?: string) {
  await assertCanView(communityId, viewerId);
  const resources = await KnowledgeResourceModel.find({ communityId, deletedAt: null }).sort({ createdAt: -1 }).lean();
  // Card lists don't need full article bodies — keep the payload light.
  return resources.map((r) => ({ ...serialize(r as any), content: '' }));
}

export async function getKnowledgeResource(resourceId: string, viewerId?: string) {
  const resource = await KnowledgeResourceModel.findOneAndUpdate(
    { _id: resourceId, deletedAt: null },
    { $inc: { viewCount: 1 } },
    { new: true },
  );
  if (!resource) {
    throw new Error('Resource not found');
  }
  await assertCanView(resource.communityId.toString(), viewerId);
  const author = await authStore.getPublicUserById(resource.createdBy.toString()).catch(() => null);
  return serialize(resource as any, author?.fullName ?? '');
}

export async function createKnowledgeResource(communityId: string, actorId: string, input: KnowledgeInput) {
  const community = await requireKnowledgeEditor(communityId, actorId);

  const resource = new KnowledgeResourceModel({ communityId, createdBy: actorId });
  applyKnowledgeInput(resource, input, { creating: true });
  await resource.save();

  // Teaching pays: publishing knowledge earns Guild Score (idempotent per resource).
  await awardReputation({
    userId: actorId,
    category: 'ORGANIZER',
    type: 'KNOWLEDGE_PUBLISHED',
    referenceId: resource._id.toString(),
    communityId,
    scoreAwarded: 15,
    description: `Published "${resource.title}" in ${community.name}'s Knowledge Hub`,
  }).catch(() => undefined);

  return serialize(resource as any);
}

export async function updateKnowledgeResource(resourceId: string, actorId: string, input: KnowledgeInput) {
  const resource = await KnowledgeResourceModel.findOne({ _id: resourceId, deletedAt: null });
  if (!resource) {
    throw new Error('Resource not found');
  }
  await requireKnowledgeEditor(resource.communityId.toString(), actorId);
  applyKnowledgeInput(resource, input);
  resource.updatedBy = actorId as any;
  await resource.save();
  return serialize(resource as any);
}

export async function deleteKnowledgeResource(resourceId: string, actorId: string) {
  const resource = await KnowledgeResourceModel.findOne({ _id: resourceId, deletedAt: null });
  if (!resource) {
    throw new Error('Resource not found');
  }
  await requireKnowledgeEditor(resource.communityId.toString(), actorId);
  resource.deletedAt = new Date();
  await resource.save();
  return { removed: true };
}

/** Counts a file download / link visit (separate from view counting). */
export async function trackKnowledgeDownload(resourceId: string) {
  await KnowledgeResourceModel.updateOne({ _id: resourceId, deletedAt: null }, { $inc: { downloadCount: 1 } });
  return { tracked: true };
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Question words, articles, pronouns, aux verbs, and app-name filler — these carry no
// topical signal, so they must never be the reason a Knowledge resource "matches".
const ASSISTANT_STOPWORDS = new Set([
  'how', 'can', 'could', 'would', 'should', 'will', 'shall', 'may', 'might', 'must',
  'the', 'and', 'for', 'are', 'was', 'were', 'been', 'being', 'have', 'has', 'had',
  'any', 'all', 'you', 'your', 'yours', 'our', 'ours', 'their', 'them', 'they',
  'what', 'why', 'when', 'where', 'who', 'whom', 'which', 'whose',
  'this', 'that', 'these', 'those', 'with', 'without', 'about', 'into', 'from',
  'need', 'needed', 'please', 'help', 'get', 'got', 'tell', 'say', 'said', 'know',
  'want', 'like', 'give', 'show', 'thanks', 'thank', 'hello', 'hey', 'yes',
  'guildos', 'guild', 'app', 'platform', 'question', 'anything', 'something',
]);

/**
 * Global knowledge search across PUBLIC communities (title/summary match).
 * Returns light results with the owning community attached for deep links.
 */
export async function searchKnowledge(query: string, limit = 8) {
  const q = query.trim();
  if (q.length < 2) return [];
  const rx = new RegExp(escapeRegex(q).split(/\s+/).join('|'), 'i');

  const publicCommunities = await CommunityModel.find({ visibility: 'PUBLIC', archivedAt: null })
    .select('name slug')
    .lean();
  const byId = new Map(publicCommunities.map((c) => [c._id.toString(), c]));

  const resources = await KnowledgeResourceModel.find({
    deletedAt: null,
    communityId: { $in: publicCommunities.map((c) => c._id) },
    $or: [{ title: rx }, { summary: rx }],
  })
    .sort({ viewCount: -1, updatedAt: -1 })
    .limit(limit)
    .select('communityId type category title summary viewCount updatedAt')
    .lean();

  return resources.map((r) => {
    const community = byId.get(r.communityId.toString());
    return {
      _id: r._id.toString(),
      type: r.type,
      category: r.category,
      title: r.title,
      summary: r.summary,
      viewCount: r.viewCount ?? 0,
      updatedAt: r.updatedAt,
      communityName: community?.name ?? '',
      communitySlug: community?.slug ?? '',
    };
  });
}

/**
 * Retrieval for the AI assistant: the most relevant knowledge from the
 * communities the user belongs to (their hubs answer first), then public hubs.
 */
export async function findKnowledgeForAssistant(query: string, userId?: string, limit = 3) {
  const q = query.trim();
  if (q.length < 4) return [];
  const allTerms = q
    .toLowerCase()
    .split(/[^a-z0-9+#]+/i)
    .filter((t) => t.length >= 3);
  // Drop stopwords / question words so a query like "how can i create community" doesn't
  // match "How to claim the GitHub Student Pack" purely on the word "how".
  const terms = allTerms.filter((t) => !ASSISTANT_STOPWORDS.has(t));
  if (!terms.length) return [];
  const rx = new RegExp(terms.map(escapeRegex).join('|'), 'i');

  const memberCommunityIds = userId
    ? (await MembershipModel.find({ userId, status: 'ACTIVE' }).select('communityId').lean()).map((m) => m.communityId)
    : [];

  const candidates = await KnowledgeResourceModel.find({
    deletedAt: null,
    $or: [{ title: rx }, { summary: rx }],
  })
    .sort({ viewCount: -1, updatedAt: -1 })
    .limit(40)
    .lean();
  if (!candidates.length) return [];

  const communities = await CommunityModel.find({ _id: { $in: candidates.map((c) => c.communityId) } })
    .select('name slug visibility archivedAt')
    .lean();
  const communityById = new Map(communities.map((c) => [c._id.toString(), c]));
  const memberSet = new Set(memberCommunityIds.map((id) => id.toString()));

  const meaningfulHits = (r: (typeof candidates)[number]) => {
    const hay = `${r.title} ${r.summary ?? ''}`.toLowerCase();
    return terms.filter((t) => hay.includes(t)).length;
  };

  const visible = candidates.filter((r) => {
    const c = communityById.get(r.communityId.toString());
    if (!c || c.archivedAt) return false;
    if (c.visibility === 'PRIVATE' && !memberSet.has(r.communityId.toString())) return false;
    // Require a real (non-stopword) term hit — a single loose regex match isn't enough.
    return meaningfulHits(r) > 0;
  });
  if (!visible.length) return [];

  // Rank: own communities first, then by term hits in the title, then popularity.
  const score = (r: (typeof visible)[number]) => {
    const own = memberSet.has(r.communityId.toString()) ? 1000 : 0;
    const titleHits = terms.filter((t) => r.title.toLowerCase().includes(t)).length * 10;
    return own + titleHits + Math.min(r.viewCount ?? 0, 9);
  };
  visible.sort((a, b) => score(b) - score(a));

  return visible.slice(0, limit).map((r) => {
    const c = communityById.get(r.communityId.toString());
    return {
      title: r.title,
      summary: r.summary,
      content: (r.content ?? '').slice(0, 900),
      url: r.url,
      type: r.type,
      communityName: c?.name ?? '',
      communitySlug: c?.slug ?? '',
    };
  });
}
