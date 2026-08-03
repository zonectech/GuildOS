/**
 * GuildOS database backup — no mongotools required.
 *
 * Dumps every collection to gzipped EJSON-lines (ObjectIds/Dates preserved
 * exactly) under backups/guildos-<timestamp>/, writes a manifest with counts,
 * optionally snapshots the uploads folder, and prunes old backups.
 *
 *   npm run backup                 # database only
 *   npm run backup -- --uploads    # database + uploads folder copy
 *
 * Restore with: npm run restore -- backups/guildos-<timestamp> --yes
 *
 * Schedule daily on Windows (run once from backend/):
 *   schtasks /Create /SC DAILY /ST 02:00 /TN "GuildOS DB Backup" ^
 *     /TR "cmd /c cd /d %CD% && npm run backup -- --uploads"
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import mongoose from 'mongoose';
import { EJSON } from 'bson';

const KEEP_LAST = 14;

async function main() {
  const uri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/guildos';
  const includeUploads = process.argv.includes('--uploads');

  await mongoose.connect(uri);
  const db = mongoose.connection.db!;
  const dbName = db.databaseName;

  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
  const backupsRoot = path.resolve(__dirname, '..', 'backups');
  const dir = path.join(backupsRoot, `${dbName}-${stamp}`);
  fs.mkdirSync(dir, { recursive: true });

  console.log(`Backing up ${dbName} -> ${dir}`);
  const collections = (await db.listCollections().toArray()).map((c) => c.name).filter((n) => !n.startsWith('system.'));
  const manifest: { db: string; createdAt: string; collections: Record<string, number>; uploads: boolean } = {
    db: dbName,
    createdAt: new Date().toISOString(),
    collections: {},
    uploads: includeUploads,
  };

  for (const name of collections.sort()) {
    const gz = zlib.createGzip();
    const out = fs.createWriteStream(path.join(dir, `${name}.jsonl.gz`));
    gz.pipe(out);
    let count = 0;
    // EJSON (relaxed:false) round-trips ObjectId/Date/Decimal128 losslessly.
    for await (const doc of db.collection(name).find()) {
      if (!gz.write(`${EJSON.stringify(doc, { relaxed: false })}\n`)) {
        await new Promise((resolve) => gz.once('drain', resolve));
      }
      count += 1;
    }
    await new Promise((resolve, reject) => {
      out.on('finish', resolve);
      out.on('error', reject);
      gz.end();
    });
    manifest.collections[name] = count;
    console.log(`  ${name}: ${count} docs`);
  }

  if (includeUploads) {
    const uploadsSrc = path.resolve(__dirname, '..', 'uploads');
    if (fs.existsSync(uploadsSrc)) {
      const uploadsDst = path.join(dir, 'uploads');
      fs.cpSync(uploadsSrc, uploadsDst, { recursive: true });
      console.log(`  uploads/: ${fs.readdirSync(uploadsDst).length} files copied`);
    }
  }

  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  // Retention: keep the newest KEEP_LAST backups for this database.
  const siblings = fs.readdirSync(backupsRoot)
    .filter((n) => n.startsWith(`${dbName}-`) && fs.statSync(path.join(backupsRoot, n)).isDirectory())
    .sort()
    .reverse();
  for (const old of siblings.slice(KEEP_LAST)) {
    fs.rmSync(path.join(backupsRoot, old), { recursive: true, force: true });
    console.log(`  pruned old backup ${old}`);
  }

  const totalDocs = Object.values(manifest.collections).reduce((a, b) => a + b, 0);
  console.log(`\nDone: ${collections.length} collections, ${totalDocs} documents.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Backup failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
