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
import mongoose from 'mongoose';
import { connectDatabase } from './src/db';
import { UserModel } from './src/models/user.model';
import { CommunityModel } from './src/models/community.model';
import { MembershipModel } from './src/models/membership.model';
import { CommunityEndorsementModel } from './src/models/community-endorsement.model';
import { InstitutionModel } from './src/models/institution.model';
import { KnowledgeResourceModel } from './src/models/knowledge-resource.model';
import {
  STUDENT_CAPABILITIES,
  LEADER_CAPABILITIES,
  GUILDOS_MISSION,
  type Capability,
} from './src/services/guildos-capabilities';

const SLUG = 'guildos-help';
const LOGO = '/uploads/guildos-logo.svg';
const BANNER = '/uploads/guildos-help-banner.svg';

/** House rules for the official hub (community.rules, max 10 × 200 chars). */
const RULES = [
  'Be respectful and courteous to everyone — students, leaders, and the GuildOS team.',
  'Keep posts and questions related to using GuildOS.',
  'Search the Knowledge tab before asking — your answer may already be documented.',
  'No spam, advertising, or self-promotion.',
  'Never share personal information — yours or anyone else\u2019s.',
  'Report bugs or security issues privately to support@guildos.app, not in public posts.',
  'Suggestions are welcome — describe what you expected and what happened instead.',
];

/** The hub is founded by the real platform ADMIN account (not a shadow user). */
async function getAdminUser() {
  const admin = await UserModel.findOne({ role: 'ADMIN' }).sort({ createdAt: 1 });
  if (!admin) throw new Error('No ADMIN account found — seed an admin first');
  return admin;
}

async function ensureHelpCommunity(founderId: mongoose.Types.ObjectId) {
  // Registry link so founder edits pass the institution guard.
  let institution = await InstitutionModel.findOne({ normalizedName: 'guildos' });
  if (!institution) {
    institution = await InstitutionModel.create({ name: 'GuildOS', normalizedName: 'guildos' });
  }

  let community = await CommunityModel.findOne({ slug: SLUG });
  if (!community) {
    community = await CommunityModel.create({
      name: 'GuildOS Help',
      normalizedName: 'guildos help',
      slug: SLUG,
      shortDescription: 'Official help & how-to guides for using GuildOS.',
      description: GUILDOS_MISSION,
      logo: LOGO,
      coverImage: BANNER,
      rules: RULES,
      category: 'GENERAL',
      university: institution.name,
      institutionId: institution._id,
      visibility: 'PUBLIC',
      verificationStatus: 'VERIFIED',
      verificationMethod: 'ENDORSEMENT',
      verifiedBy: founderId,
      verifiedAt: new Date(),
      verificationNotes: 'Endorsed by GuildOS Admin — official platform hub.',
      founder: founderId,
      memberCount: 1,
    } as never);
    await MembershipModel.create({ userId: founderId, communityId: community._id, role: 'FOUNDER', status: 'ACTIVE', assignedBy: founderId });
  }

  // Automatic endorsement record so "Endorsed by GuildOS Admin" shows everywhere.
  const existingEndorsement = await CommunityEndorsementModel.findOne({ communityId: community._id, endorserId: founderId });
  if (!existingEndorsement) {
    await CommunityEndorsementModel.create({
      communityId: community._id,
      endorserId: founderId,
      note: 'Official GuildOS platform hub — endorsed by GuildOS Admin.',
    });
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
  const system = await getAdminUser();
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
