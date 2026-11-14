import type { NextConfig } from 'next';

// web2 is its own app (Next 16, React 19), separate from the current site's packages.
const dev = process.env.NODE_ENV !== 'production';

// A production build with no API address would quietly call localhost from every visitor's browser.
if (!dev && !process.env.NEXT_PUBLIC_API_URL) {
  throw new Error('NEXT_PUBLIC_API_URL is not set. Set it to the backend address (see .env.example) before building web2.');
}
const api = new URL(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001');
const apiHttp = api.origin;
const apiWs = apiHttp.replace(/^http/, 'ws');

/**
 * Hosts the image optimizer may fetch from: the backend (uploads), plus the object storage and
 * sign-in avatar hosts. Add more with NEXT_PUBLIC_IMAGE_HOSTS (comma-separated host names;
 * "*.example.com" matches one subdomain level). Anything else is refused, so the optimizer can't
 * be used to fetch arbitrary sites through our server.
 */
const imageHosts = ['*.r2.dev', 'lh3.googleusercontent.com', ...(process.env.NEXT_PUBLIC_IMAGE_HOSTS ?? '').split(',').map((h) => h.trim()).filter(Boolean)];

/**
 * What a page may load and where it may send data. Scripts and styles only from this site
 * (inline ones are allowed: Next's own bootstrapping and the no-flash theme script need them);
 * data only to this site and the API; no plugins; nobody may put the site in a frame.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:" + (api.protocol === 'http:' ? ` ${apiHttp}` : ''),
  "font-src 'self' data:",
  `connect-src 'self' ${apiHttp} ${apiWs}`,
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // The door scanner uses the camera; nothing uses the microphone or location.
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
  ...(dev ? [] : [{ key: 'Strict-Transport-Security', value: 'max-age=15552000; includeSubDomains' }]),
];

const config: NextConfig = {
  // Tests run their own dev server next to yours; a separate build folder keeps them apart.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // The dev-only Next.js badge sits bottom-right, not over the sidebar's account block.
  devIndicators: { position: 'bottom-right' },
  // web2 is its own project; do not let a workspace file further up decide the root.
  turbopack: { root: process.cwd() },
  // Event covers and avatars come from the backend (uploads) or object storage.
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: api.protocol.replace(':', '') as 'http' | 'https', hostname: api.hostname, port: api.port },
      ...imageHosts.map((hostname) => ({ protocol: 'https' as const, hostname })),
    ],
    // A local backend lives on localhost; allow that only while developing.
    dangerouslyAllowLocalIP: dev,
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default config;
