import type { NextFunction, Request, Response } from 'express';
import { config } from '../config';

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

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
