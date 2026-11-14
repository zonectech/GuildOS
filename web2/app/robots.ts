import type { MetadataRoute } from 'next';

/** Public pages are open to search engines; signed-in areas and tools are not worth crawling. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/me', '/inbox', '/notifications', '/review', '/onboarding', '/events/new', '/events/going', '/events/saved', '/events/hosting', '/design'] },
  };
}
