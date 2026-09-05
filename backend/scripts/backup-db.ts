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
  // --skip=name1,name2 — leave out collections whose on-disk files are damaged
  // (reading them can fassert-crash mongod).
  const skipArg = process.argv.find((a) => a.startsWith('--skip='));
  const skipped = new Set(skipArg ? skipArg.slice('--skip='.length).split(',').filter(Boolean) : []);

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
    if (skipped.has(name)) {
      console.log(`  ${name}: SKIPPED (--skip)`);
      continue;
    }
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

  // Off-machine copy: encrypt each backup file (AES-256-GCM) and push it to R2 under
  // backups/<dir>/ — the bucket is PUBLIC (r2.dev), so plaintext dumps would expose
  // user data; encryption makes the public bucket safe. Requires BACKUP_ENCRYPTION_KEY
  // (any long secret) in .env. Decrypt after download with: npx tsx scripts/decrypt-backup.ts <file.enc>
  const backupKey = (process.env.BACKUP_ENCRYPTION_KEY ?? '').trim();
  const { isRemoteStorage, putUpload } = await import('../src/services/storage.service');
  if (isRemoteStorage() && backupKey.length >= 16) {
    const crypto = await import('node:crypto');
    const aesKey = crypto.createHash('sha256').update(backupKey).digest();
    let uploaded = 0;
    for (const file of fs.readdirSync(dir).filter((f) => f !== 'uploads')) {
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv);
      const plain = fs.readFileSync(path.join(dir, file));
      const encrypted = Buffer.concat([iv, cipher.update(plain), cipher.final(), cipher.getAuthTag()]);
      await putUpload(`backups/${path.basename(dir)}/${file}.enc`, encrypted, 'application/octet-stream');
      uploaded += 1;
    }
    console.log(`  offloaded ${uploaded} encrypted files to R2 (backups/${path.basename(dir)}/)`);
  } else if (isRemoteStorage()) {
    console.warn('  R2 offload SKIPPED — set BACKUP_ENCRYPTION_KEY (16+ chars) in .env to enable encrypted off-machine backups.');
  }

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
