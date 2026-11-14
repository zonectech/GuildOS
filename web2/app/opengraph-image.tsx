import { brandCard, OG_SIZE, OG_TYPE } from '@/lib/og';
import { BRAND } from '@/lib/brand';

export const alt = `${BRAND}: every event you attend counts`;
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default function Image() {
  return brandCard();
}
