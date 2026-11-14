import type { MetadataRoute } from 'next';
import { BRAND } from '@/lib/brand';

/** What a phone needs to install the site as an app: name, icons, colours, where it opens. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: BRAND,
    short_name: BRAND,
    description: 'Find campus events, register free, get scanned in, and collect a stamp for every event you attend.',
    start_url: '/events',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#FAFAF7',
    theme_color: '#0A7A50',
    categories: ['education', 'events', 'social'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Your passes', short_name: 'Going', url: '/events/going', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Events', url: '/events', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
    ],
  };
}
