// Link previews (WhatsApp, X, LinkedIn, iMessage) for pages people share. Runs on the server only.
// Every fetch is public and cookie-less, so private events and profiles fall back to the plain site preview.
import type { Metadata } from 'next';
import { API_BASE_URL, imageUrl, type EventDetail, type CommunityContext } from './api';
import type { FullUser, VerifiedCertificate } from './account';
import { longDate, placeLabel } from './events';
import { BRAND_NAME } from './brand';

const TAGLINE = 'See every event and community at your school. When a certificate is offered, you get it the moment you check out.';

async function fetchPublic<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, { next: { revalidate: 300 }, headers: { Accept: 'application/json' } });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

/**
 * The final address of an uploaded image. Uploads are served through a redirect to the storage CDN,
 * and some apps will not follow a redirect for a preview, so hand them the real file. Null if it does not load.
 */
async function finalImageUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow', next: { revalidate: 3600 } });
    return res.ok && (res.headers.get('content-type') ?? '').startsWith('image/') ? res.url : null;
  } catch {
    return null;
  }
}

/** Plain text from markdown, trimmed to a preview-sized sentence. */
export function previewText(text: string | undefined | null, max = 180) {
  const plain = (text ?? '').replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_#>`~|-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return plain.length > max ? `${plain.slice(0, max - 1).trimEnd()}…` : plain;
}

function build(title: string, description: string, image: string, path: string, type: 'website' | 'article' | 'profile' = 'website'): Metadata {
  const full = `${title} | ${BRAND_NAME}`;
  return {
    title: full,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, siteName: BRAND_NAME, type, images: [{ url: image, width: 1200, height: 630, alt: title }] },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}

const fallback = (title: string, path: string): Metadata => build(title, TAGLINE, '/og/site', path);

export async function eventMetadata(slug: string): Promise<Metadata> {
  const path = `/events/${encodeURIComponent(slug)}`;
  const data = await fetchPublic<EventDetail>(`/api/events/${encodeURIComponent(slug)}`);
  if (!data?.event) return fallback('Event', path);
  const { event, community } = data;
  const when = longDate(event);
  const lead = [when.day, when.time, placeLabel(event)].filter(Boolean).join(' · ');
  const about = previewText(event.shortDescription || event.description, 140);
  const host = community?.name ? `Hosted by ${community.name}. ` : '';
  // The organizer's own cover when there is one, otherwise a card drawn from the event details.
  const cover = event.bannerImage ? await finalImageUrl(imageUrl(event.bannerImage)) : null;
  const image = cover ?? `/og/event/${encodeURIComponent(slug)}`;
  return build(event.title, `${lead}. ${host}${about}`.trim(), image, path, 'article');
}

export async function communityMetadata(slug: string): Promise<Metadata> {
  const path = `/communities/${encodeURIComponent(slug)}`;
  const data = await fetchPublic<CommunityContext>(`/api/communities/${encodeURIComponent(slug)}`);
  const c = data?.community;
  if (!c) return fallback('Community', path);
  const lead = [c.university, c.memberCount ? `${c.memberCount} members` : ''].filter(Boolean).join(' · ');
  const description = [lead, previewText(c.shortDescription || c.description, 150)].filter(Boolean).join('. ');
  return build(c.name, description, `/og/community/${encodeURIComponent(slug)}`, path);
}

export async function certificateMetadata(serial: string): Promise<Metadata> {
  const path = `/certificates/${encodeURIComponent(serial)}`;
  const data = await fetchPublic<{ certificate: VerifiedCertificate }>(`/api/certificates/verify/${encodeURIComponent(serial)}`);
  const cert = data?.certificate;
  if (!cert) return fallback('Certificate', path);
  const valid = cert.status === 'VERIFIED';
  const title = valid ? `${cert.attendeeName}: ${cert.eventTitle}` : `Certificate ${cert.serial}`;
  const description = valid
    ? `A verified certificate from ${cert.communityName}. Serial ${cert.serial}. Open the link to check it is real.`
    : `This certificate is ${cert.status.toLowerCase()}. Serial ${cert.serial}.`;
  return build(title, description, `/og/certificate/${encodeURIComponent(serial)}`, path, 'article');
}

export async function profileMetadata(username: string): Promise<Metadata> {
  const path = `/u/${encodeURIComponent(username)}`;
  const data = await fetchPublic<{ user: FullUser }>(`/api/profile/${encodeURIComponent(username)}`);
  const user = data?.user;
  if (!user) return fallback('Profile', path);
  const school = user.profile?.showUniversity === false ? '' : user.profile?.university ?? '';
  const description = [school, `Events attended and verified certificates on ${BRAND_NAME}.`].filter(Boolean).join('. ');
  return build(user.fullName, description, `/og/u/${encodeURIComponent(username)}`, path, 'profile');
}

export { fetchPublic, TAGLINE };
