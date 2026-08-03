/**
 * GuildOS database restore — counterpart of scripts/backup-db.ts.
 *
 *   npm run restore -- backups/guildos-2026-08-03-21-40 --yes
 *
 * Each collection in the backup is dropped and re-inserted from its
 * gzipped EJSON-lines file (ids/dates restored exactly). Collections that
 * are NOT in the backup are left untouched. Refuses to run without --yes.
 * Restores the uploads folder too when the backup contains one (existing
 * files with the same names are overwritten, extras are kept).
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import zlib from 'node:zlib';
import mongoose from 'mongoose';
import { EJSON } from 'bson';

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== '--yes');
  const confirmed = process.argv.includes('--yes');
  const target = args[0];
  if (!target) {
    console.error('Usage: npm run restore -- <backup-directory> --yes');
    process.exit(1);
  }
  const dir = path.resolve(process.cwd(), target);
  const manifestPath = path.join(dir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.error(`No manifest.json in ${dir} — is this a backup directory?`);
    process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { db: string; createdAt: string; collections: Record<string, number> };
  console.log(`Backup of ${manifest.db} taken ${manifest.createdAt} — ${Object.keys(manifest.collections).length} collections.`);
  if (!confirmed) {
    console.error('This DROPS and replaces every collection present in the backup. Re-run with --yes to proceed.');
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/guildos';
  await mongoose.connect(uri);
  const db = mongoose.connection.db!;

  for (const [name, expected] of Object.entries(manifest.collections)) {
    const file = path.join(dir, `${name}.jsonl.gz`);
    if (!fs.existsSync(file)) {
      console.warn(`  SKIP ${name} — file missing from backup`);
      continue;
    }
    await db.collection(name).drop().catch(() => undefined);
    const lines = readline.createInterface({ input: fs.createReadStream(file).pipe(zlib.createGunzip()), crlfDelay: Infinity });
    let batch: Record<string, unknown>[] = [];
    let count = 0;
    for await (const line of lines) {
      if (!line.trim()) continue;
      batch.push(EJSON.parse(line, { relaxed: false }) as Record<string, unknown>);
      if (batch.length >= 500) {
        await db.collection(name).insertMany(batch as any, { ordered: false });
        count += batch.length;
        batch = [];
      }
    }
    if (batch.length) {
      await db.collection(name).insertMany(batch as any, { ordered: false });
      count += batch.length;
    }
    console.log(`  ${name}: ${count} docs restored${count !== expected ? ` (manifest said ${expected}!)` : ''}`);
  }

  const uploadsSrc = path.join(dir, 'uploads');
  if (fs.existsSync(uploadsSrc)) {
    const uploadsDst = path.resolve(__dirname, '..', 'uploads');
    fs.cpSync(uploadsSrc, uploadsDst, { recursive: true, force: true });
    console.log('  uploads/: restored');
  }

  console.log('\nRestore complete. Restart the backend so mongoose rebuilds indexes and schedulers/caches see the restored data.');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Restore failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
