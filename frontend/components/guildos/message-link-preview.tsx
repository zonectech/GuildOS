'use client';

/**
 * Rich link previews inside chat messages. GuildOS links (communities, events,
 * profiles) render as a native card — banner/cover image, name, meta — fetched
 * from our own API; external links stay as plain clickable anchors.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, Globe, GraduationCap, MessageSquare, UserRound, Users } from 'lucide-react';

import { getCommunity, resolveAvatarUrl } from './community-list-api';
import { getEvent, resolveEventImageUrl } from './event-api';
import { getPublicProfile } from './auth-api';
import { getPost, resolveFeedAvatar } from './feed-api';
import { fetchExternalLinkPreview } from './message-api';

const URL_PATTERN = /https?:\/\/[^\s<>"')\]]+/g;

type PreviewData = {
  kind: 'community' | 'event' | 'profile' | 'post' | 'external';
  href: string;
  title: string;
  image: string;
  logo: string;
  meta: string;
  description?: string;
};

/** First URL in a message we can preview: GuildOS pages natively, anything else via the backend OG fetcher. */
export function firstPreviewableLink(content: string): { url: string; path: string } | null {
  const urls = content.match(URL_PATTERN);
  if (!urls) return null;
  const origins = new Set(
    [typeof window !== 'undefined' ? window.location.origin : '', process.env.NEXT_PUBLIC_SITE_URL ?? ''].filter(Boolean),
  );
  for (const raw of urls) {
    try {
      const parsed = new URL(raw);
      if (origins.has(parsed.origin)) {
        if (/^\/(communities|events|u|posts)\/[^/]+\/?$/.test(parsed.pathname)) {
          return { url: raw, path: parsed.pathname };
        }
        continue; // other internal pages: plain link, no card
      }
      // External site — the backend resolves its OpenGraph card.
      return { url: raw, path: `ext:${raw}` };
    } catch {
      /* not a URL after all */
    }
  }
  return null;
}

/** Message text with URLs turned into real anchors (safe — React nodes, no HTML injection). */
export function LinkifiedText({ content, mine }: { content: string; mine: boolean }) {
  const parts = content.split(URL_PATTERN);
  const urls = content.match(URL_PATTERN) ?? [];
  const nodes: React.ReactNode[] = [];
  parts.forEach((part, i) => {
    if (part) nodes.push(<span key={`t-${i}`}>{part}</span>);
    if (urls[i]) {
      nodes.push(
        <a
          key={`u-${i}`}
          href={urls[i]}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={`break-all underline underline-offset-2 ${mine ? 'text-indigo-100 hover:text-white' : 'text-indigo-600 hover:text-indigo-500'}`}
        >
          {urls[i]}
        </a>,
      );
    }
  });
  return <p className="whitespace-pre-line break-words">{nodes}</p>;
}

// One fetch per path per page-load — threads repeat the same links constantly.
const previewCache = new Map<string, Promise<PreviewData | null>>();

async function loadPreview(path: string): Promise<PreviewData | null> {
  if (path.startsWith('ext:')) {
    const target = path.slice(4);
    try {
      const { preview } = await fetchExternalLinkPreview(target);
      if (!preview) return null;
      return {
        kind: 'external',
        href: preview.url,
        title: preview.title,
        image: preview.image,
        logo: '',
        meta: preview.siteName,
        description: preview.description,
      };
    } catch {
      return null;
    }
  }
  const [, kind, slug] = path.replace(/\/$/, '').split('/');
  try {
    if (kind === 'communities') {
      const { community } = await getCommunity(slug);
      return {
        kind: 'community',
        href: `/communities/${community.slug}`,
        title: community.name,
        image: community.coverImage ? resolveAvatarUrl(community.coverImage) : '',
        logo: community.logo ? resolveAvatarUrl(community.logo) : '',
        meta: [community.university, `${community.memberCount} member${community.memberCount === 1 ? '' : 's'}`].filter(Boolean).join(' · '),
      };
    }
    if (kind === 'events') {
      const { event } = await getEvent(slug);
      const when = event.startDate
        ? new Date(event.startDate).toLocaleDateString('en-NG', { weekday: 'short', month: 'short', day: 'numeric' })
        : '';
      return {
        kind: 'event',
        href: `/events/${event.slug}`,
        title: event.title,
        image: event.bannerImage ? resolveEventImageUrl(event.bannerImage) : '',
        logo: '',
        meta: [when, event.mode === 'VIRTUAL' ? 'Online' : event.venue].filter(Boolean).join(' · '),
      };
    }
    if (kind === 'u') {
      const { user } = await getPublicProfile(decodeURIComponent(slug));
      return {
        kind: 'profile',
        href: `/u/${encodeURIComponent(user.profile?.username ?? slug)}`,
        title: user.fullName,
        image: '',
        logo: user.profile?.avatar ? resolveFeedAvatar(user.profile.avatar) : '',
        meta: [user.profile?.university, user.profile?.department].filter(Boolean).join(' · ') || `@${user.profile?.username ?? slug}`,
      };
    }
    if (kind === 'posts') {
      const { post } = await getPost(slug);
      return {
        kind: 'post',
        href: `/posts/${slug}`,
        title: post.author?.fullName ? `Post by ${post.author.fullName}` : 'GuildOS post',
        image: post.imageUrl ? resolveFeedAvatar(post.imageUrl) : '',
        logo: post.author?.avatar ? resolveFeedAvatar(post.author.avatar) : '',
        meta: (post.content ?? '').replace(/\s+/g, ' ').slice(0, 90) || `${post.likeCount} likes · ${post.commentCount} comments`,
      };
    }
  } catch {
    /* private/deleted/draft — no preview, the plain link still works */
  }
  return null;
}

export function MessageLinkPreview({ path }: { path: string }) {
  const router = useRouter();
  const [data, setData] = useState<PreviewData | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!previewCache.has(path)) previewCache.set(path, loadPreview(path));
    void previewCache.get(path)!.then((d) => {
      if (!cancelled) setData(d);
    });
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (!data) return null;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (data.kind === 'external') window.open(data.href, '_blank', 'noopener,noreferrer');
        else router.push(data.href);
      }}
      className="mt-1.5 block w-full overflow-hidden rounded-xl border border-black/10 bg-white text-left shadow-sm transition hover:shadow-md dark:border-white/10 dark:bg-slate-950"
      title={data.title}
    >
      {data.image ? (
        <div className="relative aspect-[40/13] w-full bg-gradient-to-br from-indigo-500/30 to-sky-400/30">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={data.image} alt="" className="h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        </div>
      ) : null}
      <div className="flex items-center gap-2 px-2.5 py-2">
        {data.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.logo} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        ) : (
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300">
            {data.kind === 'event' ? <CalendarDays className="h-4 w-4" /> : data.kind === 'profile' ? <UserRound className="h-4 w-4" /> : data.kind === 'post' ? <MessageSquare className="h-4 w-4" /> : data.kind === 'external' ? <Globe className="h-4 w-4" /> : <Users className="h-4 w-4" />}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">{data.title}</p>
          {data.kind === 'external' && data.description ? (
            <p className="line-clamp-1 text-[11px] text-slate-500 dark:text-slate-400">{data.description}</p>
          ) : null}
          {data.meta ? (
            <p className="flex items-center gap-1 truncate text-[11px] text-slate-500 dark:text-slate-400">
              {data.kind === 'community' ? <GraduationCap className="h-3 w-3 shrink-0" /> : null}
              <span className="truncate">{data.meta}</span>
            </p>
          ) : null}
        </div>
      </div>
    </button>
  );
}
