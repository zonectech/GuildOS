/**
 * Decrypt a backup file offloaded to R2 by backup-db.ts.
 *
 *   npx tsx scripts/decrypt-backup.ts <path-to-file.enc> [more.enc...]
 *
 * Writes the decrypted file next to the input (name minus .enc). Uses
 * BACKUP_ENCRYPTION_KEY from the environment (same key that encrypted it).
 * Layout: [12-byte IV][ciphertext][16-byte GCM auth tag].
 */
import fs from 'node:fs';
import crypto from 'node:crypto';

const key = (process.env.BACKUP_ENCRYPTION_KEY ?? '').trim();
if (key.length < 16) {
  console.error('Set BACKUP_ENCRYPTION_KEY (the key used at backup time).');
  process.exit(1);
}
const aesKey = crypto.createHash('sha256').update(key).digest();

const files = process.argv.slice(2);
if (!files.length) {
  console.error('Usage: npx tsx scripts/decrypt-backup.ts <file.enc> [...]');
  process.exit(1);
}

for (const file of files) {
  const data = fs.readFileSync(file);
  const iv = data.subarray(0, 12);
  const tag = data.subarray(data.length - 16);
  const ciphertext = data.subarray(12, data.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  const out = file.endsWith('.enc') ? file.slice(0, -4) : `${file}.dec`;
  fs.writeFileSync(out, plain);
  console.log(`${file} -> ${out} (${plain.length} bytes)`);
}
