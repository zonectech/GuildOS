import { config } from '../config';

/**
 * Pages the new website has. Everything else (admin, sponsors, premium, hackathon judging,
 * opportunities, CV, messages, posts, leader rosters) still lives on the current site.
 */
const NEW_SITE_PAGES: RegExp[] = [
  /^\/events(\/[^/?#]+)?(\/(attendees|scan))?([?#]|$)/,
  /^\/events\/saved([?#]|$)/,
  /^\/communities(\/(join\/)?[^/?#]+)?([?#]|$)/,
  /^\/certificates\/[^/?#]+([?#]|$)/,
  /^\/u\/[^/?#]+([?#]|$)/,
  /^\/(me|my-events|home|notifications|onboarding|profile-setup|verify-email|reset-password|forgot-password|login|signup)([/?#]|$)/,
  /^\/dashboard\/events\/create([?#]|$)/,
  /^\/(terms|privacy|support)([?#]|$)/,
];

const trim = (url: string) => url.replace(/\/+$/, '');

export function isNewSitePage(path: string) {
  return NEW_SITE_PAGES.some((pattern) => pattern.test(path));
}

/** Full link to a page, on whichever site has it. Paths must start with "/". */
export function siteLink(path: string) {
  const clean = `/${path.replace(/^\/+/, '')}`;
  return `${trim(isNewSitePage(clean) ? config.frontendUrl : config.legacyFrontendUrl)}${clean}`;
}
