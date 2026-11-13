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

/**
 * Cross-site request forgery guard.
 *
 * Sign-in rides on cookies, which a browser attaches to requests started by ANY site. So for every
 * request that changes something (anything but GET/HEAD/OPTIONS) and arrives with our cookies, the
 * browser-set Origin (or Referer) must be one of our own sites. SameSite=Lax cookies already stop
 * most of this; this check still holds when the cookie has to be SameSite=None (API and site on
 * different domains) and for sites that share our parent domain.
 *
 * Requests without our cookies pass: the mobile app and scripts authenticate with a Bearer token,
 * which no other site can attach, and payment webhooks carry their own signatures.
 */
export function requireSameSiteOrigin(allowedOrigins: string[]) {
  const allowed = new Set(allowedOrigins.map((o) => o.replace(/\/+$/, '').toLowerCase()));
  const originOf = (value: string | undefined) => { try { return value ? new URL(value).origin.toLowerCase() : ''; } catch { return 'invalid'; } };
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
    const cookies = (req as Request & { cookies?: Record<string, string> }).cookies ?? {};
    if (!cookies.guildos_access_token && !cookies.guildos_refresh_token) return next();
    const source = originOf(req.headers.origin as string | undefined) || originOf(req.headers.referer);
    if (source && allowed.has(source)) return next();
    return res.status(403).json({ error: 'This request did not come from OnTheRoll. Open the site and try again.', code: 'CROSS_SITE_REQUEST' });
  };
}

export function sanitizeRequest(req: Request, _res: Response, next: NextFunction) {
  stripOperatorKeys(req.body);
  stripOperatorKeys(req.query);
  stripOperatorKeys(req.params);
  next();
}
