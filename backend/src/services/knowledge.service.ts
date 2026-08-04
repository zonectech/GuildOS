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

/**
 * Starter packs: pre-drafted, category-aware resource skeletons that fight the
 * empty-hub cold start. Every entry is a normal editable ARTICLE — the pack is
 * scaffolding, not lock-in. Only offered while the hub is empty so it can never
 * bury real content.
 */
const STARTER_PACK_BASE: { category: KnowledgeCategory; title: string; summary: string; content: string }[] = [
  {
    category: 'GETTING_STARTED',
    title: 'Welcome — how this community works',
    summary: 'Who we are, what we do, and how to get the most out of being a member.',
    content:
      '# Welcome!\n\nTell new members what this community is about and how to plug in.\n\n## What we do\n- *(Describe your regular activities — meetings, events, projects)*\n\n## How to get involved\n- Follow our posts and turn on notifications\n- Come to our next event (check the Events section on our page)\n- Introduce yourself in the feed\n\n## Who to talk to\n- *(List your excos and what each person handles — or point to the Leadership section)*',
  },
  {
    category: 'GETTING_STARTED',
    title: 'Frequently asked questions',
    summary: 'The questions every new member asks, answered once.',
    content:
      '# FAQ\n\n**How do I become a member?**\n*(Explain your join process — open join, request, or access code.)*\n\n**Are there dues or fees?**\n*(Answer honestly — and what the money is used for.)*\n\n**How often do you meet?**\n*(Weekly? Monthly? Where?)*\n\n**How do I earn a certificate?**\nAttend our events and check in/out with the QR pass — attendance is verified automatically and certificates are issued through GuildOS.',
  },
  {
    category: 'DOCUMENTATION',
    title: 'Our constitution / operating rules',
    summary: 'The official rules this community runs on — elections, roles, conduct.',
    content:
      '# Constitution\n\n*(Paste or summarise your constitution here. Suggested sections below.)*\n\n## Leadership structure\n- Roles and what each is responsible for\n\n## Elections & handover\n- When they happen and who can run\n\n## Code of conduct\n- What we expect from members\n- What happens when rules are broken',
  },
  {
    category: 'ROADMAP',
    title: 'This session\u2019s plan',
    summary: 'What we are doing this session — events, projects, and goals.',
    content:
      '# Session plan\n\n## Goals\n1. *(e.g. Run 4 events this semester)*\n2. *(e.g. Grow to 100 active members)*\n\n## Timeline\n| Month | Activity |\n|---|---|\n| — | *(Add your planned events and deadlines)* |\n\n## How members can help\n- Volunteer at events (it earns Guild Score!)\n- Share our events with classmates',
  },
];

const STARTER_PACK_BY_CATEGORY: Record<string, { category: KnowledgeCategory; title: string; summary: string; content: string }[]> = {
  TECH: [
    {
      category: 'TUTORIAL',
      title: 'Learning resources we recommend',
      summary: 'The free courses, docs and channels we point every beginner to.',
      content:
        '# Recommended learning resources\n\n## Start here\n- *(Link the beginner course/track your community recommends)*\n\n## Practice\n- *(Coding challenge sites, project ideas, hackathons)*\n\n## Community favourites\n- *(Books, YouTube channels, newsletters your members actually use)*',
    },
    {
      category: 'OPPORTUNITY',
      title: 'Student packs, internships & programs',
      summary: 'Free student benefits and programs members should apply to.',
      content:
        '# Opportunities for members\n\n## Free student benefits\n- GitHub Student Developer Pack\n- *(Cloud credits, JetBrains, Figma education, etc.)*\n\n## Programs to watch\n- *(GSoC, MLH fellowships, campus ambassador programs — add application windows)*\n\n> Keep this updated — an outdated deadline is worse than none.',
    },
  ],
  ACADEMIC: [
    {
      category: 'PAST_QUESTIONS',
      title: 'Past questions library — how it works',
      summary: 'Where our past questions live and how to contribute yours.',
      content:
        '# Past questions\n\nUpload past question files to this Knowledge Hub (use the FILE type) organised by course code.\n\n## Contributing\n1. Scan or photograph clearly\n2. Name the file like `CSC201-2025-first-semester.pdf`\n3. An exco reviews and publishes it\n\n## Available so far\n*(Keep an index here as files are added.)*',
    },
    {
      category: 'TUTORIAL',
      title: 'Study group schedule',
      summary: 'When and where we hold tutorials and reading groups.',
      content: '# Study groups\n\n| Day | Time | Course/Topic | Venue |\n|---|---|---|---|\n| — | — | *(Fill in your schedule)* | — |\n\nWant to tutor a course? Talk to any exco — tutoring earns Guild Score and looks great on your verified CV.',
    },
  ],
  RELIGIOUS: [
    {
      category: 'DOCUMENTATION',
      title: 'Weekly programs & activities',
      summary: 'Our regular programs, times and venues.',
      content: '# Weekly programs\n\n| Day | Time | Program | Venue |\n|---|---|---|---|\n| — | — | *(Fill in your regular programs)* | — |\n\n*(Note any special programs for the semester.)*',
    },
  ],
};

export async function createKnowledgeStarterPack(communityId: string, actorId: string) {
  const community = await requireKnowledgeEditor(communityId, actorId);

  const existing = await KnowledgeResourceModel.countDocuments({ communityId, deletedAt: null });
  if (existing > 0) {
    throw new Error('The starter pack is only for empty Knowledge Hubs — yours already has content');
  }

  const extras = STARTER_PACK_BY_CATEGORY[String(community.category ?? '').toUpperCase()] ?? [];
  const pack = [...STARTER_PACK_BASE, ...extras];

  const created: string[] = [];
  for (const entry of pack) {
    const resource = await KnowledgeResourceModel.create({
      communityId,
      createdBy: actorId,
      type: 'ARTICLE',
      category: entry.category,
      title: entry.title,
      summary: entry.summary,
      content: entry.content,
    });
    created.push(resource._id.toString());
  }
  // Deliberately NO reputation award — scaffolding isn't teaching.
  return { created: created.length };
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
