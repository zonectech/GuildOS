import type { NextFunction, Request, Response } from 'express';
import { config } from '../config';

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

// Periodically drop expired buckets so the map can't grow unbounded (memory-DoS).
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}, CLEANUP_INTERVAL_MS).unref();

function getKey(req: Request) {
  return `${req.ip}:${req.path}`;
}

export function rateLimit(req: Request, res: Response, next: NextFunction) {
  const key = getKey(req);
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + config.rateLimitWindowMs });
    return next();
  }

  bucket.count += 1;

  if (bucket.count > config.rateLimitMax) {
    const retryAfterSeconds = Math.ceil((bucket.resetAt - now) / 1000);
    res.setHeader('Retry-After', String(retryAfterSeconds));
    return res.status(429).json({
      error: 'Too many requests',
      retryAfterSeconds,
    });
  }

  return next();
}
