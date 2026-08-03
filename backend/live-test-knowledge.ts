/**
 * Live test — Knowledge Hub (Phase 1).
 *
 * Exercises against the LIVE backend API (http://localhost:3001):
 *   publish article/link/file (coordinator+) → validation rules → member/public
 *   listing (grouped payload, light bodies) → view counting → edit → +15 Guild
 *   Score (idempotent) → private community access control → delete.
 *
 * Run:  npx tsx --env-file=.env live-test-knowledge.ts
 */
import './src/config';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { connectDatabase } from './src/db';
import { createToken } from './src/utils/token';
import { UserModel } from './src/models/user.model';
import { CommunityModel } from './src/models/community.model';
import { MembershipModel } from './src/models/membership.model';
import { KnowledgeResourceModel } from './src/models/knowledge-resource.model';
import { ReputationActivityModel } from './src/models/reputation-activity.model';
import { ReputationScoreModel } from './src/models/reputation-score.model';

const BASE = process.env.SMOKE_BASE ?? 'http://localhost:3001';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    passed += 1;
    console.log(`  \x1b[32mPASS\x1b[0m  ${name}`);
  } else {
    failed += 1;
    failures.push(name);
    console.log(`  \x1b[31mFAIL\x1b[0m  ${name}${detail !== undefined ? `  ->  ${JSON.stringify(detail)}` : ''}`);
  }
}

type ApiResult = { status: number; json: any };
async function api(method: string, path: string, token?: string, body?: unknown): Promise<ApiResult> {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* no body */
  }
  return { status: res.status, json };
}

async function makeUser(fullName: string): Promise<string> {
  const rnd = crypto.randomBytes(6).toString('hex');
  const user = await UserModel.create({
    fullName,
    email: `kh-${rnd}@khtest.local`,
    passwordHash: crypto.randomBytes(16).toString('hex'),
    passwordSalt: crypto.randomBytes(16).toString('hex'),
    role: 'STUDENT',
    status: 'ACTIVE',
    emailVerified: true,
    profile: { username: `kh_${rnd}`, university: 'KH Test University' },
  } as any);
  return user._id.toString();
}

async function main() {
  console.log(`\n=== GuildOS Knowledge Hub live test :: ${BASE} ===\n`);
  await connectDatabase();

  const health = await api('GET', '/api/communities');
  if (health.status !== 200) {
    console.error(`Backend not reachable at ${BASE}. Is the dev server running?`);
    process.exit(1);
  }

  const stamp = Date.now();
  const leaderId = await makeUser('KH Leader');
  const memberId = await makeUser('KH Member');
  const outsiderId = await makeUser('KH Outsider');
  const tok = (id: string, tag: string) => createToken({ sub: id, purpose: 'access', jti: `kh-${tag}-${stamp}` } as any, 3600_000);
  const leaderTok = tok(leaderId, 'lead');
  const memberTok = tok(memberId, 'member');
  const outsiderTok = tok(outsiderId, 'out');

  const community = await CommunityModel.create({
    name: `KH Guild ${stamp}`,
    normalizedName: `kh guild ${stamp}`,
    slug: `kh-guild-${stamp}`,
    shortDescription: 'Knowledge Hub test community.',
    logo: '/uploads/demo-org-logo.svg',
    coverImage: '/uploads/kh-cover.png',
    category: 'TECH',
    university: 'KH Test University',
    visibility: 'PUBLIC',
    verificationStatus: 'VERIFIED',
    verificationMethod: 'MANUAL',
    verifiedBy: leaderId,
    verifiedAt: new Date(),
    founder: leaderId,
    memberCount: 2,
  });
  const communityId = community._id.toString();
  await MembershipModel.create({ userId: leaderId, communityId, role: 'FOUNDER', status: 'ACTIVE', assignedBy: leaderId });
  await MembershipModel.create({ userId: memberId, communityId, role: 'MEMBER', status: 'ACTIVE', assignedBy: leaderId });

  const privateCommunity = await CommunityModel.create({
    name: `KH Private Guild ${stamp}`,
    normalizedName: `kh private guild ${stamp}`,
    slug: `kh-private-${stamp}`,
    shortDescription: 'Private Knowledge Hub test.',
    logo: '/uploads/demo-org-logo.svg',
    coverImage: '/uploads/kh-cover.png',
    category: 'TECH',
    university: 'KH Test University',
    visibility: 'PRIVATE',
    verificationStatus: 'VERIFIED',
    verificationMethod: 'MANUAL',
    verifiedBy: leaderId,
    verifiedAt: new Date(),
    founder: leaderId,
    memberCount: 1,
  });
  await MembershipModel.create({ userId: leaderId, communityId: privateCommunity._id, role: 'FOUNDER', status: 'ACTIVE', assignedBy: leaderId });

  const userIds = [leaderId, memberId, outsiderId].map((id) => new mongoose.Types.ObjectId(id));

  try {
    console.log('PUBLISHING');
    const article = await api('POST', `/api/knowledge/community/${communityId}`, leaderTok, {
      type: 'ARTICLE',
      category: 'GETTING_STARTED',
      title: 'How to claim the GitHub Student Pack',
      summary: 'Step-by-step guide for new members.',
      content: '# GitHub Student Pack\n\n1. Visit education.github.com\n2. Upload your student ID\n3. Wait for approval\n\n**Tip:** use your school email.',
    });
    check('leader publishes ARTICLE -> 201', article.status === 201 && article.json?.resource?._id, article.status);
    const articleId = article.json?.resource?._id ?? '';

    const link = await api('POST', `/api/knowledge/community/${communityId}`, leaderTok, {
      type: 'LINK', category: 'ROADMAP', title: 'React Roadmap', url: 'https://roadmap.sh/react',
    });
    check('leader publishes LINK -> 201', link.status === 201, link.status);

    const badLink = await api('POST', `/api/knowledge/community/${communityId}`, leaderTok, {
      type: 'LINK', category: 'ROADMAP', title: 'Bad link', url: 'not-a-url',
    });
    check('LINK without valid URL rejected', badLink.status === 400, badLink.status);

    const emptyArticle = await api('POST', `/api/knowledge/community/${communityId}`, leaderTok, {
      type: 'ARTICLE', category: 'TUTORIAL', title: 'Empty', content: '',
    });
    check('ARTICLE without content rejected', emptyArticle.status === 400, emptyArticle.status);

    const memberPublish = await api('POST', `/api/knowledge/community/${communityId}`, memberTok, {
      type: 'LINK', category: 'OTHER', title: 'Member link', url: 'https://example.com',
    });
    check('plain member cannot publish -> 403', memberPublish.status === 403, memberPublish.status);

    console.log('\nREADING');
    const list = await api('GET', `/api/knowledge/community/${communityId}`, memberTok);
    check('member lists hub -> 2 resources', list.status === 200 && list.json?.resources?.length === 2, list.json?.resources?.length);
    check('list payload keeps article bodies light', list.json?.resources?.every((r: any) => r.content === ''), undefined);

    const anonList = await api('GET', `/api/knowledge/community/${communityId}`);
    check('public community hub is readable anonymously', anonList.status === 200 && anonList.json?.resources?.length === 2, anonList.status);

    const read1 = await api('GET', `/api/knowledge/${articleId}`, memberTok);
    check('opening the article returns full content + author', read1.status === 200 && read1.json?.resource?.content?.includes('GitHub Student Pack') && read1.json?.resource?.authorName === 'KH Leader', read1.json?.resource?.authorName);
    const read2 = await api('GET', `/api/knowledge/${articleId}`, outsiderTok);
    check('views are counted', (read2.json?.resource?.viewCount ?? 0) >= 2, read2.json?.resource?.viewCount);

    console.log('\nREPUTATION');
    const awards = await ReputationActivityModel.find({ userId: leaderId, type: 'KNOWLEDGE_PUBLISHED' }).lean();
    check('leader earned +15 per published resource (2 awards)', awards.length === 2 && awards.every((a) => a.scoreAwarded === 15), awards.length);
    const score = await ReputationScoreModel.findOne({ userId: leaderId }).lean();
    check('leader Guild Score >= 30', (score?.guildScore ?? 0) >= 30, score?.guildScore);

    console.log('\nSEARCH + ANALYTICS (Phase 2)');
    const search = await api('GET', `/api/knowledge/search?q=github%20student`);
    check('global search finds the article (public community)', search.status === 200 && search.json?.results?.some((r: any) => r.title.includes('GitHub Student Pack')), search.json?.results?.length);
    const searchHit = search.json?.results?.find((r: any) => r.title.includes('GitHub Student Pack'));
    check('search result carries community name + slug for deep links', !!searchHit?.communityName && !!searchHit?.communitySlug, searchHit);

    const track = await api('POST', `/api/knowledge/${articleId}/download`);
    check('download tracking -> 200', track.status === 200 && track.json?.tracked === true, track.status);
    const afterTrack = await api('GET', `/api/knowledge/${articleId}`, leaderTok);
    check('downloadCount incremented', (afterTrack.json?.resource?.downloadCount ?? 0) >= 1, afterTrack.json?.resource?.downloadCount);

    console.log('\nAI RETRIEVAL (Phase 3)');
    const chat = await api('POST', '/api/assistant/chat', memberTok, {
      messages: [{ role: 'user', content: 'How do I get the GitHub Student Pack?' }],
    });
    check('assistant answers from the Knowledge Hub', chat.status === 200 && /knowledge hub|github student pack/i.test(chat.json?.reply ?? ''), { source: chat.json?.source, reply: (chat.json?.reply ?? '').slice(0, 120) });
    check('assistant cites the community', (chat.json?.reply ?? '').includes('KH Guild') || chat.json?.source === 'ai', chat.json?.source);

    console.log('\nEDITING');
    const update = await api('PATCH', `/api/knowledge/${articleId}`, leaderTok, { title: 'GitHub Student Pack (2026 edition)', category: 'TUTORIAL' });
    check('leader edits title + category', update.status === 200 && update.json?.resource?.title === 'GitHub Student Pack (2026 edition)' && update.json?.resource?.category === 'TUTORIAL', update.status);
    const memberEdit = await api('PATCH', `/api/knowledge/${articleId}`, memberTok, { title: 'hacked' });
    check('plain member cannot edit -> 403', memberEdit.status === 403, memberEdit.status);

    console.log('\nPRIVACY');
    const privateResource = await api('POST', `/api/knowledge/community/${privateCommunity._id}`, leaderTok, {
      type: 'LINK', category: 'OTHER', title: 'Secret link', url: 'https://secret.example',
    });
    check('leader publishes in PRIVATE community', privateResource.status === 201, privateResource.status);
    const outsiderPrivate = await api('GET', `/api/knowledge/community/${privateCommunity._id}`, outsiderTok);
    check('non-member blocked from PRIVATE hub -> 403', outsiderPrivate.status === 403, outsiderPrivate.status);
    const anonPrivate = await api('GET', `/api/knowledge/community/${privateCommunity._id}`);
    check('anonymous blocked from PRIVATE hub -> 403', anonPrivate.status === 403, anonPrivate.status);
    const privateSearch = await api('GET', `/api/knowledge/search?q=secret%20link`);
    check('global search never leaks PRIVATE hub resources', !(privateSearch.json?.results ?? []).some((r: any) => r.title === 'Secret link'), privateSearch.json?.results);

    console.log('\nDELETING');
    const memberDelete = await api('DELETE', `/api/knowledge/${articleId}`, memberTok);
    check('plain member cannot delete -> 403', memberDelete.status === 403, memberDelete.status);
    const del = await api('DELETE', `/api/knowledge/${articleId}`, leaderTok);
    check('leader deletes resource', del.status === 200 && del.json?.removed === true, del.status);
    const afterDelete = await api('GET', `/api/knowledge/community/${communityId}`, memberTok);
    check('deleted resource gone from listing', afterDelete.json?.resources?.length === 1, afterDelete.json?.resources?.length);
    const readDeleted = await api('GET', `/api/knowledge/${articleId}`, memberTok);
    check('deleted resource 404s on open', readDeleted.status === 404, readDeleted.status);
  } finally {
    console.log('\nCleaning up…');
    await KnowledgeResourceModel.deleteMany({ communityId: { $in: [community._id, privateCommunity._id] } });
    await MembershipModel.deleteMany({ communityId: { $in: [community._id, privateCommunity._id] } });
    await CommunityModel.deleteMany({ _id: { $in: [community._id, privateCommunity._id] } });
    await ReputationActivityModel.deleteMany({ userId: { $in: userIds } });
    await ReputationScoreModel.deleteMany({ userId: { $in: userIds } });
    await UserModel.deleteMany({ _id: { $in: userIds } });
    await mongoose.disconnect();
  }

  console.log(`\n=== ${passed} passed, ${failed} failed ===`);
  if (failures.length) {
    console.log('Failures:', failures.join(' | '));
    process.exit(1);
  }
}

void main();
