/* One-off READ-ONLY probe #4: storage consistency + token/index hygiene.
 * Finds /uploads references in the DB and checks whether each file exists
 * locally and/or in R2 — anything local-only will 404 in production. */
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { connectDatabase } from './src/db';
import { isRemoteStorage, localUploadsDir } from './src/services/storage.service';
import { config } from './src/config';

const SOURCES: [collection: string, fields: string[]][] = [
  ['events', ['bannerImage', 'ticketTemplate', 'certificateTemplate', 'gallery']],
  ['communities', ['logo', 'coverImage', 'endorsementLetter']],
  ['users', ['profile.avatar', 'profile.coverImage']],
  ['posts', ['imageUrl']],
  ['certificates', ['templateImage']],
  ['knowledgeresources', ['file']],
  ['externalcredentials', ['fileUrl']],
  ['eventsponsors', ['logo']],
  ['eventspeakers', ['photo']],
  ['communityleaders', ['photo']],
];

function pick(doc: Record<string, unknown>, dotted: string): unknown {
  return dotted.split('.').reduce<unknown>((acc, k) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[k] : undefined), doc);
}

async function existsInR2(key: string): Promise<boolean> {
  try {
    const res = await fetch(`${config.r2.publicBaseUrl}/${key}`, { method: 'HEAD' });
    return res.ok;
  } catch {
    return false;
  }
}

async function main() {
  await connectDatabase();
  const db = mongoose.connection.db!;
  const refs = new Set<string>();

  for (const [collection, fields] of SOURCES) {
    const docs = await db.collection(collection).find({}).project(Object.fromEntries(fields.map((f) => [f, 1]))).toArray();
    for (const doc of docs) {
      for (const field of fields) {
        const value = pick(doc, field);
        const values = Array.isArray(value) ? value : [value];
        for (const v of values) {
          if (typeof v === 'string' && v.startsWith('/uploads/')) refs.add(v.slice('/uploads/'.length));
        }
      }
    }
  }

  const localFiles = new Set(fs.existsSync(localUploadsDir) ? fs.readdirSync(localUploadsDir) : []);
  let localOnly: string[] = [];
  let inR2 = 0;
  let missingEverywhere: string[] = [];
  for (const key of refs) {
    const r2 = await existsInR2(key);
    if (r2) { inR2 += 1; continue; }
    if (localFiles.has(key)) localOnly.push(key);
    else missingEverywhere.push(key);
  }

  // Token hygiene + TTL
  const authIndexes = await db.collection('authtokens').indexes().catch(() => []);
  const tokenCount = await db.collection('authtokens').countDocuments().catch(() => -1);
  const hasTtl = authIndexes.some((i) => 'expireAfterSeconds' in i);

  // Notification volume + index check
  const notifIndexes = (await db.collection('notifications').indexes().catch(() => [])).map((i) => i.name);

  console.log(JSON.stringify({
    remoteStorageActive: isRemoteStorage(),
    dbUploadRefs: refs.size,
    inR2,
    localOnlyCount: localOnly.length,
    localOnlySample: localOnly.slice(0, 12),
    missingEverywhere,
    authTokens: { count: tokenCount, hasTtlIndex: hasTtl },
    notifIndexes,
  }, null, 1));
  await mongoose.disconnect();
}
void main();
