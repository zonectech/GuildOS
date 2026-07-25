/**
 * One-off demo: set a markdown-formatted description on the dawah-week-demo
 * event to verify the event page About renderer (headings/bold/lists/links).
 * Run:  npx tsx --env-file=.env seed-markdown-demo.ts
 */
import './src/config';
import mongoose from 'mongoose';
import { connectDatabase } from './src/db';
import { EventModel } from './src/models/event.model';

const DESCRIPTION = `# About The Praxis Paradox

**Da'wah Week 2026** brings together students for nine days of learning, reflection and community — bridging the gap between what we *know* and what we *practice*.

## What you'll gain

- Daily tafsir sessions and practical workshops
- Networking with **guest scholars** and student leaders
- A verifiable certificate for attending 5+ days
- Access to \`past-questions\` packs in the Knowledge Hub

## Before you come

Please read the [code of conduct](https://example.com/conduct) and check the full programme at https://mssn-futminna.example.com/dawah-week — seats for the workshop days are limited, so register early.`;

async function main() {
  await connectDatabase();
  const event = await EventModel.findOne({ slug: 'dawah-week-demo' });
  if (!event) throw new Error('dawah-week-demo not found — run seed-dawah-week-demo.ts first');
  event.description = DESCRIPTION;
  await event.save();
  console.log('Markdown description set on', event.slug);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
