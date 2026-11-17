import fs from 'node:fs/promises';
import path from 'node:path';
import { createCanvas } from '@napi-rs/canvas';

/** A local demo asset, independent of another community's uploads or external services. */
export async function createDemoCommunityLogo() {
  const canvas = createCanvas(512, 512);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0F766E'; ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = '#F3C768'; ctx.lineWidth = 8;
  ctx.beginPath(); ctx.arc(256, 256, 220, 0, Math.PI * 2); ctx.stroke();
  ctx.textAlign = 'center'; ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 180px Arial'; ctx.fillText('AB', 256, 300);
  ctx.fillStyle = '#F3C768'; ctx.font = 'bold 36px Arial'; ctx.fillText('FUTMINNA', 256, 370);
  const directory = path.resolve(__dirname, '../uploads');
  await fs.mkdir(directory, { recursive: true });
  const filename = 'demo-futminna-ai-club.png';
  await fs.writeFile(path.join(directory, filename), canvas.toBuffer('image/png'));
  return `/uploads/${filename}`;
}
