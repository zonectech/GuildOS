/* One-off: heal /uploads/smoke-banner.png + smoke-logo.png — demo seeds reference
 * them but the files exist nowhere (lost in the disk wipes), so every demo event
 * banner 404s from R2. Generates clean placeholders and uploads under the EXACT
 * legacy keys so all references (and future seed runs) heal at once. */
import { createCanvas } from '@napi-rs/canvas';
import mongoose from 'mongoose';
import { connectDatabase } from './src/db';
import { putUpload } from './src/services/storage.service';

function makeBanner(): Buffer {
  const canvas = createCanvas(1600, 800);
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 1600, 800);
  grad.addColorStop(0, '#1e1b4b');
  grad.addColorStop(0.55, '#312e81');
  grad.addColorStop(1, '#0f172a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1600, 800);
  ctx.globalAlpha = 0.08;
  ctx.strokeStyle = '#a5b4fc';
  ctx.lineWidth = 2;
  for (let i = 0; i < 14; i += 1) {
    ctx.beginPath();
    ctx.arc(1350, 120, 60 + i * 55, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#818cf8';
  ctx.fillRect(0, 760, 1600, 40);
  ctx.fillStyle = '#eef2ff';
  ctx.font = 'bold 92px sans-serif';
  ctx.fillText('Campus Event', 90, 380);
  ctx.fillStyle = '#a5b4fc';
  ctx.font = '40px sans-serif';
  ctx.fillText('Hosted on GuildOS', 92, 452);
  return canvas.toBuffer('image/png');
}

function makeLogo(): Buffer {
  const canvas = createCanvas(400, 400);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#312e81';
  ctx.beginPath();
  ctx.arc(200, 200, 200, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#c7d2fe';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(200, 200, 168, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#eef2ff';
  ctx.font = 'bold 170px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('G', 200, 212);
  return canvas.toBuffer('image/png');
}

async function main() {
  await connectDatabase();
  const db = mongoose.connection.db!;
  // Who references them? (context before healing)
  for (const [coll, field] of [['events', 'bannerImage'], ['communities', 'logo'], ['communities', 'coverImage'], ['posts', 'imageUrl']] as const) {
    const n = await db.collection(coll).countDocuments({ [field]: { $in: ['/uploads/smoke-banner.png', '/uploads/smoke-logo.png'] } });
    if (n) console.log(`${coll}.${field}: ${n} reference(s)`);
  }
  await putUpload('smoke-banner.png', makeBanner(), 'image/png');
  await putUpload('smoke-logo.png', makeLogo(), 'image/png');
  for (const key of ['smoke-banner.png', 'smoke-logo.png']) {
    const res = await fetch(`https://pub-4395ed6f5a5a44c9b848a1be77ca01b7.r2.dev/${key}`, { method: 'HEAD' });
    console.log(key, '→', res.status);
  }
  await mongoose.disconnect();
}
void main();
