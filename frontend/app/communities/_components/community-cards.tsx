'use client';

import Link from 'next/link';
import { BadgeCheck, GraduationCap, Users } from 'lucide-react';
import { resolveAvatarUrl, type CommunitySummary } from '../../../components/guildos/community-list-api';

export type MembershipState = {
  userId: string;
  joined: boolean;
  following: boolean;
  busy: boolean;
  onJoin: () => void;
  onLeave: () => void;
  onFollow: () => void;
};

type CardProps = { community: CommunitySummary; membership: MembershipState; onPreview: (src: string, alt: string) => void };

function CommunityLogo({ community, size }: { community: CommunitySummary; size: 'md' | 'lg' }) {
  const cls = size === 'lg' ? 'h-14 w-14 text-xl' : 'h-11 w-11 text-base';
  if (!community.logo) {
    return <span className={`grid ${cls} shrink-0 place-items-center rounded-full bg-indigo-500 font-semibold text-white shadow-md`}>{community.name.slice(0, 1)}</span>;
  }
  return (
    <img
      src={resolveAvatarUrl(community.logo)}
      alt={community.name}
      className={`${cls} shrink-0 rounded-full object-cover shadow-md`}
      onError={(event) => {
        const fallback = document.createElement('span');
        fallback.className = `grid ${cls} shrink-0 place-items-center rounded-full bg-indigo-500 font-semibold text-white shadow-md`;
        fallback.textContent = community.name.slice(0, 1);
        event.currentTarget.replaceWith(fallback);
      }}
    />
  );
}

/** Join / Joined (hover to leave) / Owned, plus Follow. Shared by the card and the list row. */
function MembershipActions({ community, membership }: { community: CommunitySummary; membership: MembershipState }) {
  const owned = Boolean(membership.userId) && community.founder === membership.userId;
  return (
    <div className="flex items-center gap-1.5">
      {owned ? (
        /* Your own community reads "Owned", not "Joined": you didn't join it, you built it. */
        <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:ring-indigo-500/30">Owned</span>
      ) : membership.joined ? (
        <button
          onClick={membership.onLeave}
          disabled={membership.busy}
          title="Click to leave this community"
          className="group/leave rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 transition hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-rose-500/15 dark:hover:text-rose-300"
        >
          <span className="group-hover/leave:hidden">Joined</span>
          <span className="hidden group-hover/leave:inline">Leave?</span>
        </button>
      ) : (
        <button
          onClick={membership.onJoin}
          disabled={membership.busy}
          className="rounded-full bg-indigo-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
        >
          {membership.busy ? 'Joining…' : 'Join'}
        </button>
      )}
      {/* You can't follow your own community, so the button only shows for everyone else. */}
      {owned ? null : (
        <button
          onClick={membership.onFollow}
          className={`rounded-full px-3 py-1 text-xs font-medium transition ${membership.following ? 'bg-slate-100 text-slate-600 dark:bg-slate-950 dark:text-slate-400' : 'border border-indigo-200 text-indigo-600 hover:bg-indigo-50 dark:border-indigo-500/30 dark:text-indigo-300 dark:hover:bg-indigo-500/10'}`}
        >
          {membership.following ? 'Following' : 'Follow'}
        </button>
      )}
    </div>
  );
}

function memberLabel(community: CommunitySummary) {
  const members = `${community.memberCount} ${community.memberCount === 1 ? 'member' : 'members'}`;
  return community.followerCount ? `${members} · ${community.followerCount} following` : members;
}

export function CommunityGridCard({ community: c, membership, onPreview }: CardProps) {
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <Link href={`/communities/${c.slug}`} className="block">
        {/* Cover keeps the banner's wide aspect ratio so the artwork is never cut. */}
        <div className="relative aspect-[40/11] min-h-24 bg-gradient-to-br from-indigo-500/20 via-indigo-100 to-slate-100 dark:from-indigo-500/10 dark:via-slate-800 dark:to-slate-900">
          {c.coverImage ? (
            <img
              src={resolveAvatarUrl(c.coverImage)}
              alt={`${c.name} cover`}
              className="h-full w-full cursor-zoom-in object-cover"
              onError={(event) => {
                event.currentTarget.style.display = 'none';
              }}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onPreview(resolveAvatarUrl(c.coverImage), `${c.name} cover`);
              }}
            />
          ) : null}
          {c.category ? <span className="absolute right-2 top-2 rounded-full bg-white/90 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 shadow-sm backdrop-blur dark:bg-slate-900/90 dark:text-slate-200">{c.category}</span> : null}
        </div>
      </Link>
      <div className="relative z-20 -mt-7 pl-4">
        <CommunityLogo community={c} size="lg" />
      </div>
      <div className="flex flex-1 flex-col px-4 pb-4 pt-2">
        <div className="flex items-start gap-1.5">
          <Link href={`/communities/${c.slug}`} className="text-sm font-semibold text-slate-900 hover:underline dark:text-slate-100">{c.name}</Link>
          {c.verificationStatus === 'VERIFIED' ? <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" /> : null}
        </div>
        {c.university ? (
          <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400"><GraduationCap className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{c.university}</span></p>
        ) : null}
        <p className="mt-1.5 line-clamp-2 flex-1 text-xs text-slate-500 dark:text-slate-400">{c.shortDescription || c.description}</p>
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400"><Users className="h-3.5 w-3.5" /> {c.memberCount}{c.followerCount ? ` · ${c.followerCount}` : ''}</span>
          <MembershipActions community={c} membership={membership} />
        </div>
      </div>
    </article>
  );
}

/** Compact list row: scan a whole campus of communities without scrolling. */
export function CommunityListRow({ community: c, membership, myUniversity }: Omit<CardProps, 'onPreview'> & { myUniversity: string }) {
  const mine = Boolean(myUniversity) && (c.university ?? '').trim().toLowerCase() === myUniversity.toLowerCase();
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 transition hover:border-indigo-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <Link href={`/communities/${c.slug}`} className="shrink-0">
        <CommunityLogo community={c} size="md" />
      </Link>
      <Link href={`/communities/${c.slug}`} className="group min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <h3 className="truncate font-semibold text-slate-950 group-hover:text-indigo-700 dark:text-white dark:group-hover:text-indigo-300">{c.name}</h3>
          {c.verificationStatus === 'VERIFIED' ? <BadgeCheck className="h-4 w-4 shrink-0 text-sky-500" /> : null}
        </div>
        <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
          {[c.category, memberLabel(c)].filter(Boolean).join(' · ')}
          {c.university ? <span className={mine ? 'font-medium text-indigo-600 dark:text-indigo-400' : ''}> · {c.university}</span> : null}
        </p>
      </Link>
      <div className="shrink-0">
        <MembershipActions community={c} membership={membership} />
      </div>
    </div>
  );
}

/** Big showcase card for the Popular row: the cover does the talking. */
export function FeaturedCommunityCard({ community: c }: { community: CommunitySummary }) {
  return (
    <Link
      href={`/communities/${c.slug}`}
      className="group relative block aspect-[2/1] w-[85%] shrink-0 snap-start overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 to-sky-500 shadow-sm sm:w-auto"
    >
      {c.coverImage ? (
        <img src={resolveAvatarUrl(c.coverImage)} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" onError={(event) => { event.currentTarget.style.display = 'none'; }} />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" aria-hidden />
      {c.category ? <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 shadow-sm">{c.category}</span> : null}
      <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 p-4">
        <CommunityLogo community={c} size="md" />
        <div className="min-w-0">
          <h3 className="flex items-center gap-1.5 text-lg font-bold leading-tight text-white">
            <span className="truncate">{c.name}</span>
            {c.verificationStatus === 'VERIFIED' ? <BadgeCheck className="h-4 w-4 shrink-0 text-sky-300" /> : null}
          </h3>
          <p className="mt-0.5 truncate text-xs text-white/80">{[memberLabel(c), c.university].filter(Boolean).join(' · ')}</p>
        </div>
      </div>
    </Link>
  );
}

/**
 * Up to three communities worth a first look: verified ones with real members,
 * your own university first. Ranked purely on activity, never paid placement.
 */
export function pickPopularCommunities(communities: CommunitySummary[], myUniversity: string) {
  const uni = myUniversity.toLowerCase();
  return communities
    .filter((c) => c.verificationStatus === 'VERIFIED' && c.memberCount >= 5)
    .sort((a, b) => {
      const ma = uni && (a.university ?? '').trim().toLowerCase() === uni ? 0 : 1;
      const mb = uni && (b.university ?? '').trim().toLowerCase() === uni ? 0 : 1;
      return ma - mb || b.memberCount - a.memberCount;
    })
    .slice(0, 3);
}
