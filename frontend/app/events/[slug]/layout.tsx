import type { Metadata } from 'next';
import type { ReactNode } from 'react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

function absoluteAsset(path?: string) {
  if (!path) return undefined;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (path.startsWith('/')) return `${API_BASE_URL}${path}`;
  return `${API_BASE_URL}/uploads/${path}`;
}

function formatDay(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-NG', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Server-side metadata so shared event links unfurl with the event banner,
 * title, date, and host on WhatsApp/Telegram/LinkedIn/X. Anonymous fetch means
 * DRAFT and PRIVATE events fall back to generic, non-indexed metadata.
 */
export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const slug = decodeURIComponent(params.slug);
  const canonical = `${SITE_URL}/events/${encodeURIComponent(slug)}`;

  try {
    const res = await fetch(`${API_BASE_URL}/api/events/${encodeURIComponent(slug)}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error('not found');
    const { event, community } = (await res.json()) as {
      event: {
        title: string;
        shortDescription?: string;
        description?: string;
        bannerImage?: string;
        startDate?: string;
        endDate?: string;
        mode?: string;
        venue?: string;
      };
      community: { name: string } | null;
    };

    const start = formatDay(event.startDate);
    const end = formatDay(event.endDate);
    const when = start && end && end !== start ? `${start} – ${end}` : start;
    const where = event.mode === 'ONLINE' ? 'Online' : event.venue || '';
    const host = community?.name ? `Hosted by ${community.name}` : '';
    const factLine = [when, where, host].filter(Boolean).join(' · ');
    const blurb = (event.shortDescription || event.description || '').trim().slice(0, 200);

    const title = `${event.title} · GuildOS`;
    const description = [factLine, blurb].filter(Boolean).join(' — ') || 'Discover and register for campus events on GuildOS.';
    const image = absoluteAsset(event.bannerImage);

    return {
      metadataBase: new URL(SITE_URL),
      title,
      description,
      alternates: { canonical },
      openGraph: {
        type: 'website',
        url: canonical,
        title,
        description,
        siteName: 'GuildOS',
        images: image ? [{ url: image, alt: event.title }] : undefined,
      },
      twitter: {
        card: image ? 'summary_large_image' : 'summary',
        title,
        description,
        images: image ? [image] : undefined,
      },
    };
  } catch {
    return {
      title: 'Event · GuildOS',
      description: 'Discover and register for campus events on GuildOS.',
      alternates: { canonical },
      robots: { index: false, follow: false },
    };
  }
}

export default function EventSlugLayout({ children }: { children: ReactNode }) {
  return children;
}
