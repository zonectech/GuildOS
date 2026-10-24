'use client';

import { Bell, BellOff, BookOpen, CalendarDays, Globe, Settings, ShieldCheck, UserCheck, UserPlus, Users } from 'lucide-react';

import type { CommunitySummary } from '../../../../components/guildos/community-list-api';
import { CommunityConnectLinks } from './chat-links';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function normalizeCommunityImageUrl(url?: string) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return `${API_BASE_URL}${url}`;
  return `${API_BASE_URL}/${url}`;
}

/** Cover, logo, primary actions, name/meta, stats strip and connect links. */
export function CommunityHero({
  community,
  isInsider,
  following,
  followerCount,
  eventRating,
  canJoin,
  canEdit,
  hasPendingJoinRequest,
  actionBusy,
  onFollow,
  onJoin,
  onOpenPeople,
  onPreview,
}: {
  community: CommunitySummary;
  isInsider: boolean;
  following: boolean;
  followerCount: number;
  eventRating?: { average: number; count: number };
  canJoin: boolean;
  canEdit: boolean;
  hasPendingJoinRequest: boolean;
  actionBusy: boolean;
  onFollow: () => void;
  onJoin: () => void;
  onOpenPeople: (kind: 'members' | 'followers') => void;
  onPreview: (src: string, alt: string) => void;
}) {
  const isArchived = Boolean(community.archivedAt);

  return (
    <div className="mx-auto max-w-5xl px-4 pt-4 pb-0">
      <div className="overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md">
        {/* Cover */}
        <div className="relative aspect-[40/11] w-full overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-sky-500">
          {community.coverImage ? (
            <img
              src={normalizeCommunityImageUrl(community.coverImage)}
              alt={`${community.name} cover`}
              className="h-full w-full cursor-zoom-in object-cover"
              onClick={() => onPreview(normalizeCommunityImageUrl(community.coverImage), `${community.name} cover`)}
            />
          ) : (
            <div className="h-full w-full">
              <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
            </div>
          )}
          {/* Category pill on cover — top-right, clear of the logo */}
          <div className="absolute right-4 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/30 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
            <BookOpen className="h-3.5 w-3.5" /> {community.category}
          </div>
          {isArchived && (
            <div className="absolute left-4 top-3 rounded-full bg-amber-500/90 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
              Archived
            </div>
          )}
        </div>

        {/* Identity row */}
        <div className="relative px-5 pb-5 sm:px-7">
          {/* Logo */}
          <div className="absolute -top-8 left-5 z-10 h-16 w-16 overflow-hidden rounded-full shadow-lg ring-1 ring-black/10 dark:ring-white/10 sm:-top-10 sm:left-7 sm:h-20 sm:w-20">
            {community.logo ? (
              <img
                src={normalizeCommunityImageUrl(community.logo)}
                alt={community.name}
                className="h-full w-full cursor-zoom-in object-cover"
                onClick={() => onPreview(normalizeCommunityImageUrl(community.logo), `${community.name} logo`)}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-100 to-violet-100 text-xl font-bold text-indigo-600">
                {community.name.slice(0, 1)}
              </div>
            )}
          </div>

          {/* Action buttons top-right */}
          <div className="flex flex-wrap justify-end gap-2 pt-3 pb-2">
            {/* Follow — outsiders only (founders/members already get updates) */}
            {!isInsider && (
              <button
                onClick={onFollow}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 ${
                  following
                    ? 'border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                {following ? <><BellOff className="h-4 w-4" /> Unfollow</> : <><Bell className="h-4 w-4" /> Follow</>}
              </button>
            )}
            {canJoin && (
              <button onClick={onJoin} disabled={actionBusy} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:opacity-50">
                <UserPlus className="h-4 w-4" /> Request to Join
              </button>
            )}
            {hasPendingJoinRequest && (
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-sm font-semibold text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                <UserCheck className="h-4 w-4" /> Pending
              </span>
            )}
            {canEdit && (
              <a href={`/dashboard/communities/${community.slug}/edit`} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 shadow-sm transition hover:-translate-y-0.5 hover:shadow">
                <Settings className="h-4 w-4" /> Manage
              </a>
            )}
          </div>

          {/* Name + meta */}
          <div className="mt-9 sm:mt-11">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-3xl">{community.name}</h1>
              {community.verificationStatus === 'VERIFIED' && (
                <span title="Verified community" className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30">
                  <ShieldCheck className="h-3.5 w-3.5" /> Verified
                </span>
              )}
              {community.verificationStatus === 'PENDING' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30">
                  Pending verification
                </span>
              )}
            </div>
            <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
              {[community.faculty, community.department, community.university].filter(Boolean).join(' · ')}
            </p>
            {community.shortDescription && (
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">{community.shortDescription}</p>
            )}

            {/* Stats strip */}
            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              <button
                type="button"
                onClick={() => onOpenPeople('members')}
                className="inline-flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200 transition hover:text-indigo-600"
              >
                <Users className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                <span>{community.memberCount}</span>
                <span className="font-normal text-slate-500 dark:text-slate-400">members</span>
              </button>
              <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
                <CalendarDays className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                <span>{community.eventCount}</span>
                <span className="font-normal text-slate-500 dark:text-slate-400">events</span>
              </span>
              {followerCount > 0 && (
                <button
                  type="button"
                  onClick={() => onOpenPeople('followers')}
                  className="inline-flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200 transition hover:text-indigo-600"
                >
                  <UserPlus className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                  <span>{followerCount}</span>
                  <span className="font-normal text-slate-500 dark:text-slate-400">followers</span>
                </button>
              )}
              {eventRating && eventRating.count > 0 ? (
                <span
                  className="inline-flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200"
                  title={`Average rating from ${eventRating.count} verified attendee${eventRating.count === 1 ? '' : 's'} across this community's events`}
                >
                  <span className="text-amber-500">★</span>
                  <span>{eventRating.average.toFixed(1)}</span>
                  <span className="font-normal text-slate-500 dark:text-slate-400">({eventRating.count})</span>
                </span>
              ) : null}
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${community.visibility === 'PUBLIC' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400'}`}>
                <Globe className="h-3 w-3" /> {community.visibility}
              </span>
              {community.verificationStatus === 'UNVERIFIED' && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" title="This community has not been verified — it cannot issue certificates, award points, or sell tickets.">
                  <ShieldCheck className="h-3 w-3" /> Unverified
                </span>
              )}
            </div>

            <CommunityConnectLinks community={community} isInsider={isInsider} />
          </div>
        </div>
      </div>
    </div>
  );
}
