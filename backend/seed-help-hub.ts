/**
 * Seed the official "GuildOS Help" Knowledge Hub.
 *
 * Turns the capabilities manifest (guildos-capabilities.ts — the single source of
 * truth) into browsable, UI-editable help articles under a public "GuildOS Help"
 * community. Because it is PUBLIC, the in-app assistant can also retrieve these
 * articles, and non-developers can add/edit help through the normal Knowledge tab.
 *
 * Idempotent (keyed by slug "guildos-help" + article title). Safe to re-run after
 * editing the manifest — it upserts every article to match.
 *
 * Run:  npx tsx --env-file=.env seed-help-hub.ts
 * View: http://localhost:3000/communities/guildos-help?tab=knowledge
 */
import './src/config';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { connectDatabase } from './src/db';
import { UserModel } from './src/models/user.model';
import { CommunityModel } from './src/models/community.model';
import { MembershipModel } from './src/models/membership.model';
import { KnowledgeResourceModel } from './src/models/knowledge-resource.model';
import {
  STUDENT_CAPABILITIES,
  LEADER_CAPABILITIES,
  GUILDOS_MISSION,
  type Capability,
} from './src/services/guildos-capabilities';

const SLUG = 'guildos-help';
const LOGO = '/uploads/demo-org-logo.svg';

async function ensureSystemUser() {
  const email = 'help@guildos.local';
  let user = await UserModel.findOne({ email });
  if (!user) {
    // Non-loginable system account (random password) that owns the Help hub.
    user = await UserModel.create({
      fullName: 'GuildOS Team',
      email,
      passwordHash: crypto.randomBytes(24).toString('hex'),
      passwordSalt: crypto.randomBytes(16).toString('hex'),
      role: 'ADMIN',
      status: 'ACTIVE',
      emailVerified: true,
      profile: { username: 'guildos_team', university: 'GuildOS' },
    } as never);
  }
  return user;
}

async function ensureHelpCommunity(founderId: mongoose.Types.ObjectId) {
  let community = await CommunityModel.findOne({ slug: SLUG });
  if (!community) {
    community = await CommunityModel.create({
      name: 'GuildOS Help',
      normalizedName: 'guildos help',
      slug: SLUG,
      shortDescription: 'Official help & how-to guides for using GuildOS.',
      description: GUILDOS_MISSION,
      logo: LOGO,
      coverImage: '',
      category: 'GENERAL',
      university: 'GuildOS',
      visibility: 'PUBLIC',
      verificationStatus: 'VERIFIED',
      verificationMethod: 'MANUAL',
      verifiedBy: founderId,
      verifiedAt: new Date(),
      founder: founderId,
      memberCount: 1,
    } as never);
    await MembershipModel.create({ userId: founderId, communityId: community._id, role: 'FOUNDER', status: 'ACTIVE', assignedBy: founderId });
  }
  return community;
}

/** Build a help article body from a capability. */
function articleFrom(cap: Capability, audience: 'students' | 'leaders') {
  const title = audience === 'leaders' ? `${cap.area} (for leaders)` : cap.area;
  const summary = cap.detail.length > 280 ? `${cap.detail.slice(0, 277)}…` : cap.detail;
  const whereLine = cap.path ? `\n\nWhere: ${cap.path}` : '';
  const body = cap.guide ?? cap.detail;
  const content = `# ${cap.area}\n\n${body}${whereLine}`;
  const category = audience === 'leaders' ? 'DOCUMENTATION' : 'GETTING_STARTED';
  return { title, summary, content, category };
}

async function main() {
  await connectDatabase();
  const system = await ensureSystemUser();
  const community = await ensureHelpCommunity(system._id);

  const articles = [
    ...STUDENT_CAPABILITIES.map((c) => articleFrom(c, 'students')),
    ...LEADER_CAPABILITIES.map((c) => articleFrom(c, 'leaders')),
  ];

  let created = 0;
  let updated = 0;
  for (const a of articles) {
    const existing = await KnowledgeResourceModel.findOne({ communityId: community._id, title: a.title, deletedAt: null });
    if (existing) {
      existing.set({ summary: a.summary, content: a.content, category: a.category, type: 'ARTICLE', updatedBy: system._id });
      await existing.save();
      updated += 1;
    } else {
      await KnowledgeResourceModel.create({
        communityId: community._id,
        type: 'ARTICLE',
        category: a.category,
        title: a.title,
        summary: a.summary,
        content: a.content,
        createdBy: system._id,
      } as never);
      created += 1;
    }
  }

  console.log(`GuildOS Help hub ready: ${created} created, ${updated} updated (${articles.length} total).`);
  console.log(`View: http://localhost:3000/communities/${SLUG}?tab=knowledge`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
