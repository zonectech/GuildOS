// The product name in one place (the backend's BRAND_NAME should match).
export const BRAND = 'OnTheRoll';

/**
 * A copy of the site that search engines must not index (a test deployment on the live API).
 * Set NEXT_PUBLIC_NOINDEX=1 on that deployment: robots.txt disallows everything, every page says
 * "noindex", and every response carries X-Robots-Tag.
 */
export const NOINDEX = process.env.NEXT_PUBLIC_NOINDEX === '1';
