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

/**
 * Server-side metadata so shared community links unfurl with the community
 * cover image, name, and description on WhatsApp/Telegram/LinkedIn/X.
 */
export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const slug = decodeURIComponent(params.slug);
  const canonical = `${SITE_URL}/communities/${encodeURIComponent(slug)}`;

  try {
    const res = await fetch(`${API_BASE_URL}/api/communities/${encodeURIComponent(slug)}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error('not found');
    const { community } = (await res.json()) as {
      community: {
        name: string;
        shortDescription?: string;
        description?: string;
        logo?: string;
        coverImage?: string;
        university?: string;
        memberCount?: number;
        verificationStatus?: string;
      };
    };

    const facts = [
      community.university,
      community.memberCount ? `${community.memberCount.toLocaleString()} member${community.memberCount === 1 ? '' : 's'}` : '',
      community.verificationStatus === 'VERIFIED' ? 'Verified community' : '',
    ]
      .filter(Boolean)
      .join(' · ');
    const blurb = (community.shortDescription || community.description || '').trim().slice(0, 200);

    const title = `${community.name} · GuildOS`;
    const description = [facts, blurb].filter(Boolean).join(' — ') || 'Join student communities and build a verified portfolio on GuildOS.';
    const image = absoluteAsset(community.coverImage || community.logo);

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
        images: image ? [{ url: image, alt: community.name }] : undefined,
      },
      twitter: {
        card: community.coverImage ? 'summary_large_image' : 'summary',
        title,
        description,
        images: image ? [image] : undefined,
      },
    };
  } catch {
    return {
      title: 'Community · GuildOS',
      description: 'Join student communities and build a verified portfolio on GuildOS.',
      alternates: { canonical },
      robots: { index: false, follow: false },
    };
  }
}

export default function CommunitySlugLayout({ children }: { children: ReactNode }) {
  return children;
}
