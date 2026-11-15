import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '../config';

export function recommendationToken(id: string): string {
  return createHmac('sha256', config.jwtSecret).update(`recommendation-unsubscribe:${id}`).digest('hex');
}
export function validRecommendationToken(id: string, token: string): boolean {
  if (!/^[a-f\d]{24}$/i.test(id) || !/^[a-f\d]{64}$/i.test(token)) return false;
  return timingSafeEqual(Buffer.from(token, 'hex'), Buffer.from(recommendationToken(id), 'hex'));
}
