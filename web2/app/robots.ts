import type { MetadataRoute } from 'next';
import { NOINDEX } from '@/lib/brand';

/**
 * Public pages are open to search engines; signed-in areas and tools are not worth crawling.
 * A test copy (NEXT_PUBLIC_NOINDEX=1) asks every crawler to stay away entirely.
 */
export default function robots(): MetadataRoute.Robots {
  if (NOINDEX) return { rules: { userAgent: '*', disallow: '/' } };
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/me', '/inbox', '/notifications', '/review', '/onboarding', '/events/new', '/events/going', '/events/saved', '/events/hosting', '/design', '/offline', '/oauth'] },
  };
}
