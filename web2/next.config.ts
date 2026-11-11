import type { NextConfig } from 'next';

// web2 is its own app (Next 16, React 19), separate from the current site's packages.
const api = new URL(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001');
const dev = process.env.NODE_ENV !== 'production';

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
      { protocol: 'https', hostname: '**' },
    ],
    // A local backend lives on localhost; allow that only while developing.
    dangerouslyAllowLocalIP: dev,
  },
};

export default config;
