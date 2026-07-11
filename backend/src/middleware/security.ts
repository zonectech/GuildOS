import type { NextFunction, Request, Response } from 'express';

/**
 * Security header(s) that helmet does not set out of the box (Permissions-Policy).
 * Applied alongside helmet.
 */
export function extraSecurityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
}

/**
 * Strips MongoDB operator keys ($-prefixed or dotted) from request payloads to
 * prevent NoSQL/operator injection when request data flows into queries.
 */
function stripOperatorKeys(value: unknown, depth = 0) {
  if (!value || typeof value !== 'object' || depth > 6) return;
  if (Array.isArray(value)) {
    for (const item of value) stripOperatorKeys(item, depth + 1);
    return;
  }
  for (const key of Object.keys(value as Record<string, unknown>)) {
    if (key.startsWith('$') || key.includes('.')) {
      delete (value as Record<string, unknown>)[key];
      continue;
    }
    stripOperatorKeys((value as Record<string, unknown>)[key], depth + 1);
  }
}

export function sanitizeRequest(req: Request, _res: Response, next: NextFunction) {
  stripOperatorKeys(req.body);
  stripOperatorKeys(req.query);
  stripOperatorKeys(req.params);
  next();
}
