/**
 * One-off: generate a "Kolawole Technologies" logo mark, upload it to storage
 * (R2), and attach it to the sponsor listing on the Career Night event.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { createCanvas } from '@napi-rs/canvas';
import { config } from './src/config';
import { EventModel } from './src/models/event.model';
import { EventSponsorModel } from './src/models/event-sponsor.model';
import { putUpload } from './src/services/storage.service';

async function main() {
  // --- Draw a clean square monogram mark (works at 32px chip and 58px cert strip) ---
  const S = 400;
  const canvas = createCanvas(S, S);
  const ctx = canvas.getContext('2d');

  // Rounded-square badge with a teal->indigo gradient.
  const r = 76;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.arcTo(S, 0, S, S, r);
  ctx.arcTo(S, S, 0, S, r);
  ctx.arcTo(0, S, 0, 0, r);
  ctx.arcTo(0, 0, S, 0, r);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, 0, S, S);
  g.addColorStop(0, '#0f766e');
  g.addColorStop(1, '#4338ca');
  ctx.fillStyle = g;
  ctx.fill();

  // Subtle inner ring.
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, 150, 0, Math.PI * 2);
  ctx.stroke();

  // KT monogram.
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 150px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('KT', S / 2, S / 2 - 18);

  // Small wordmark under the monogram.
  ctx.font = '700 30px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText('KOLAWOLE', S / 2, S / 2 + 88);
  ctx.font = '500 22px sans-serif';
  ctx.fillText('TECHNOLOGIES', S / 2, S / 2 + 120);

  const buffer = canvas.toBuffer('image/png');
  const key = `${Date.now()}-kolawole-tech-logo.png`;
  await putUpload(key, buffer, 'image/png');
  const logoPath = `/uploads/${key}`;
  console.log('logo uploaded:', logoPath);

  await mongoose.connect(config.mongoUri);
  const event = await EventModel.findOne({ slug: 'ai-robotics-career-night-2026-d0afdaae' }).select('_id').lean();
  const result = await EventSponsorModel.updateOne(
    { eventId: event!._id, name: /kolawole/i },
    { $set: { logo: logoPath } },
  );
  console.log('sponsor updated:', result.modifiedCount);
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
