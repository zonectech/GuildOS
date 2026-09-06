import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { putUpload, isRemoteStorage, localUploadsDir, publicUrl } from './src/services/storage.service';

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.gif': 'image/gif', '.pdf': 'application/pdf',
};

async function main() {
  if (!isRemoteStorage()) { console.log('R2 not configured — aborting'); return; }
  const files = fs.readdirSync(localUploadsDir).filter((f) => fs.statSync(path.join(localUploadsDir, f)).isFile());
  console.log(`Migrating ${files.length} files to R2...`);
  let ok = 0, skipped = 0, failed = 0;
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    const contentType = MIME[ext];
    if (!contentType) { console.log('  skip (unknown type):', file); skipped++; continue; }
    try {
      // Skip if already in R2
      const head = await fetch(publicUrl(file), { method: 'HEAD' });
      if (head.status === 200) { skipped++; continue; }
      const buf = fs.readFileSync(path.join(localUploadsDir, file));
      await putUpload(file, buf, contentType);
      ok++;
      if (ok % 25 === 0) console.log(`  ...${ok} uploaded`);
    } catch (e) {
      failed++;
      console.log('  FAILED:', file, e instanceof Error ? e.message : e);
    }
  }
  console.log(`Done. uploaded=${ok} skipped=${skipped} failed=${failed}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
