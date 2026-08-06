'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Award,
  Briefcase,
  CalendarDays,
  ChevronDown,
  FileText,
  Flame,
  LayoutDashboard,
  Search,
  Sparkles,
  Users,
} from 'lucide-react';

import type { AuthUser } from './auth-api';
import type { SuggestedPerson } from './connection-api';
import type { CertificateSummary, UpcomingEventEntry } from './event-api';
import type { TrendingCommunity, TrendingEvent } from './feed-api';
import type { Opportunity } from './opportunity-api';
import type { ProfileCompletionResult } from './profile-completion';
import type { Reputation } from './reputation-api';
import type { SuggestedCommunity } from './community-list-api';
import { Card } from './ui/card';

type StudentCommandPanelProps = {
  guildScore?: number;
  level?: string;
  profileCompletion: number;
  certificatesEarned: number;
  upcomingEvents: number;
  communitiesJoined: number;
};

export function StudentCommandPanel({
  guildScore,
  level,
  profileCompletion,
  certificatesEarned,
  upcomingEvents,
  communitiesJoined,
}: StudentCommandPanelProps) {
  const stats = [
    { label: 'Score', value: guildScore?.toLocaleString('en-NG') ?? '0' },
    { label: 'Profile', value: `${profileCompletion}%` },
    { label: 'Certs', value: certificatesEarned.toLocaleString('en-NG') },
    { label: 'Events', value: upcomingEvents.toLocaleString('en-NG') },
    { label: 'Guilds', value: communitiesJoined.toLocaleString('en-NG') },
  ];

  return (
    <Card className="border-indigo-200 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-4 text-white">
      <div className="flex items-center gap-2 text-indigo-100">
        <Sparkles className="h-4 w-4" />
        <p className="text-xs font-semibold uppercase tracking-[0.16em]">Student command center</p>
      </div>
      <p className="mt-2 text-sm text-indigo-100/80">{level ?? 'Explorer Guild'} overview</p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-white/10 bg-white/10 px-3 py-2">
            <p className="text-[11px] text-indigo-100/65">{stat.label}</p>
            <p className="mt-0.5 text-base font-semibold">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-2">
        <Link href="/events" className="inline-flex items-center justify-between rounded-xl bg-white dark:bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-950 dark:text-white hover:bg-indigo-50">
          Discover events <ArrowRight className="h-4 w-4" />
        </Link>
        <Link href="/opportunities" className="inline-flex items-center justify-between rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/15">
          Find opportunities <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </Card>
  );
}

type StudentProfileRailProps = {
  user: AuthUser | null;
  reputation: Reputation | null;
  completion: ProfileCompletionResult | null;
  firstName: string;
  avatar: string;
  cover: string;
  levelTone: Record<string, string>;
  children?: ReactNode;
};

export function StudentProfileRail({ user, reputation, completion, firstName, avatar, cover, levelTone, children }: StudentProfileRailProps) {
  return (
    <aside className="guild-scrollbar hidden space-y-4 lg:block lg:sticky lg:top-16 lg:self-start lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto">
      <Card className="overflow-hidden">
        <div className={`relative h-16 bg-gradient-to-br ${levelTone[reputation?.level ?? 'Explorer Guild'] ?? 'from-slate-500 to-slate-700'}`}>
          {cover ? <img src={cover} alt="" className="h-full w-full object-cover" /> : null}
        </div>
        <div className="relative z-10 px-4 pb-4">
          <div className="-mt-8 flex justify-center">
            {avatar ? (
              <img src={avatar} alt="You" className="h-16 w-16 rounded-full border-4 border-white object-cover" />
            ) : (
              <span className="grid h-16 w-16 place-items-center rounded-full border-4 border-white bg-slate-200 text-lg font-semibold text-slate-600 dark:text-slate-400">{firstName.slice(0, 1)}</span>
            )}
          </div>
          <p className="mt-2 text-center text-base font-semibold text-slate-900 dark:text-slate-100">{user?.fullName}</p>
          <p className="text-center text-xs text-slate-500 dark:text-slate-400">{[user?.profile?.department, user?.profile?.university].filter(Boolean).join(' · ') || 'Student'}</p>
          {reputation ? (
            <div className="mt-3 rounded-xl bg-slate-50 dark:bg-slate-900 px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400">Guild Score</span>
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{reputation.guildScore.toLocaleString('en-NG')}</span>
              </div>
              <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{reputation.level}</p>
            </div>
          ) : null}
          <Link href={user?.profile?.username ? `/u/${encodeURIComponent(user.profile.username)}` : '/profile'} className="mt-3 block rounded-xl border border-slate-200 dark:border-slate-800 py-2 text-center text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
            View profile
          </Link>
        </div>
      </Card>

      {children}

      {completion && completion.completion < 100 ? (
        <Card className="p-4">
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Complete your profile</p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-950">
            <div className="h-full rounded-full bg-indigo-500" style={{ width: `${completion.completion}%` }} />
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{completion.completion}% complete</p>
          <Link href="/account" className="mt-2 inline-block text-xs font-medium text-indigo-600 hover:underline">Finish setup →</Link>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-2">
        <QuickLink href="/cv" icon={<FileText className="h-4 w-4" />} label="Build my CV" />
        <QuickLink href="/reputation" icon={<Award className="h-4 w-4" />} label="My Guild Score" />
      </div>
    </aside>
  );
}

type StudentDiscoveryRailProps = {
  trendingEvents: TrendingEvent[];
  trendingCommunities: TrendingCommunity[];
  communities: SuggestedCommunity[];
  people: SuggestedPerson[];
  events: UpcomingEventEntry[];
  opportunities: Opportunity[];
  certificates: CertificateSummary[];
  reputation: Reputation | null;
  joining: string | null;
  onJoinCommunity: (id: string) => void;
  onConnectPerson: (id: string) => void;
  resolveAvatarUrl: (avatar?: string) => string;
  resolvePersonAvatar: (avatar?: string) => string;
  eventDate: (value: string | null) => string;
};

export function StudentDiscoveryRail({
  trendingEvents,
  trendingCommunities,
  communities,
  people,
  events,
  opportunities,
  certificates,
  reputation,
  joining,
  onJoinCommunity,
  onConnectPerson,
  resolveAvatarUrl,
  resolvePersonAvatar,
  eventDate,
}: StudentDiscoveryRailProps) {
  return (
    <aside className="guild-scrollbar hidden space-y-4 lg:block lg:sticky lg:top-16 lg:self-start lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto">
      <TrendingPanel
        events={trendingEvents}
        communities={trendingCommunities}
        resolveAvatarUrl={resolveAvatarUrl}
        eventDate={eventDate}
      />

      <SuggestedCommunitiesPanel
        communities={communities}
        joining={joining}
        onJoinCommunity={onJoinCommunity}
        resolveAvatarUrl={resolveAvatarUrl}
      />

      <PeoplePanel people={people} onConnectPerson={onConnectPerson} resolvePersonAvatar={resolvePersonAvatar} />

      <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-5">
        <div className="flex items-center gap-2 text-indigo-700">
          <LayoutDashboard className="h-5 w-5" />
          <p className="text-sm font-semibold">Run a community?</p>
        </div>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Switch to Community Mode to manage members, host events, verify attendance, and issue certificates.</p>
        <Link href="/dashboard" className="mt-3 inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white">
          Enter Community Mode <ArrowRight className="h-4 w-4" />
        </Link>
      </Card>

      <CertificatesPanel certificates={certificates} />
      <EventsPanel events={events} eventDate={eventDate} />
      <OpportunitiesPanel opportunities={opportunities} />
      <BadgesPanel reputation={reputation} />
    </aside>
  );
}

export function MobileSearchForm({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className="relative sm:hidden"
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search people, communities, events..."
        className="w-full rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-2.5 pl-10 pr-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
      />
    </form>
  );
}

export function MobileStudentSnapshot({
  guildScore,
  level,
  profileCompletion,
  certificatesEarned,
  upcomingEvents,
  communitiesJoined,
}: StudentCommandPanelProps) {
  const [open, setOpen] = useState(false);
  const panelId = 'mobile-student-snapshot-panel';

  return (
    <div className="overflow-hidden rounded-2xl border border-indigo-100 bg-white dark:bg-slate-900 shadow-sm lg:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-indigo-50/50"
      >
        <span>
          <span className="block text-sm font-semibold text-slate-950 dark:text-white">Student snapshot</span>
          <span className="block text-xs text-slate-500 dark:text-slate-400">{level ?? 'Explorer Guild'} · {guildScore?.toLocaleString('en-NG') ?? '0'} points</span>
        </span>
        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${open ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-700'}`}>
          {open ? 'Hide details' : 'View details'}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {open ? (
        <div id={panelId} className="grid grid-cols-2 gap-2 border-t border-slate-100 p-3">
          {[
            { label: 'Profile', value: `${profileCompletion}%` },
            { label: 'Communities', value: communitiesJoined.toLocaleString('en-NG') },
            { label: 'Events', value: upcomingEvents.toLocaleString('en-NG') },
            { label: 'Certificates', value: certificatesEarned.toLocaleString('en-NG') },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl bg-slate-50 dark:bg-slate-900 px-3 py-2">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{stat.label}</p>
              <p className="text-sm font-semibold text-slate-950 dark:text-white">{stat.value}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TrendingPanel({
  events,
  communities,
  resolveAvatarUrl,
  eventDate,
}: {
  events: TrendingEvent[];
  communities: TrendingCommunity[];
  resolveAvatarUrl: (avatar?: string) => string;
  eventDate: (value: string | null) => string;
}) {
  if (!events.length && !communities.length) return null;

  return (
    <Card className="border-orange-200 bg-gradient-to-br from-orange-50/70 to-white p-5">
      <div className="flex items-center gap-2 text-orange-700">
        <Flame className="h-4 w-4" />
        <p className="text-sm font-semibold">Trending this week</p>
      </div>
      {events.length ? (
        <div className="mt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Events</p>
          <ul className="mt-1.5 space-y-1.5">
            {events.map((event) => (
              <li key={event.id}>
                <Link href={`/events/${encodeURIComponent(event.slug)}`} className="flex items-center justify-between gap-2 rounded-xl px-2 py-1.5 hover:bg-white dark:hover:bg-slate-800">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-900 dark:text-slate-100">{event.title}</span>
                    <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{eventDate(event.startDate)}{event.venue ? ` · ${event.venue}` : event.mode ? ` · ${event.mode}` : ''}</span>
                  </span>
                  <span className="shrink-0 rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-700">{event.registrationCount} going</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {communities.length ? (
        <div className="mt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Communities</p>
          <ul className="mt-1.5 space-y-1.5">
            {communities.map((community) => {
              const src = resolveAvatarUrl(community.logo);
              return (
                <li key={community.id}>
                  <Link href={`/communities/${encodeURIComponent(community.slug)}`} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-white dark:hover:bg-slate-800">
                    {src ? <img src={src} alt="" className="h-8 w-8 shrink-0 rounded-lg object-cover" /> : <FallbackMark label={community.name} rounded="rounded-lg" />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-900 dark:text-slate-100">{community.name}</span>
                      <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{community.memberCount} members</span>
                    </span>
                    <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">+{community.newMembers} this week</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}

function SuggestedCommunitiesPanel({
  communities,
  joining,
  onJoinCommunity,
  resolveAvatarUrl,
}: {
  communities: SuggestedCommunity[];
  joining: string | null;
  onJoinCommunity: (id: string) => void;
  resolveAvatarUrl: (avatar?: string) => string;
}) {
  if (!communities.length) return null;

  return (
    <FeedCard title="Suggested communities" icon={<Users className="h-4 w-4" />} href="/communities" hrefLabel="See all">
      <ul className="space-y-2">
        {communities.slice(0, 4).map((community) => {
          const src = resolveAvatarUrl(community.logo);
          return (
            <li key={community._id} className="flex items-center gap-2.5">
              {src ? <img src={src} alt="" className="h-9 w-9 shrink-0 rounded-xl object-cover" /> : <FallbackMark label={community.name} rounded="rounded-xl" />}
              <div className="min-w-0 flex-1">
                <Link href={`/communities/${encodeURIComponent(community.slug)}`} className="block truncate text-sm font-medium text-slate-900 dark:text-slate-100 hover:underline">{community.name}</Link>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">{community.reason}</p>
              </div>
              <button
                onClick={() => onJoinCommunity(community._id)}
                disabled={joining === community._id}
                className="shrink-0 rounded-full border border-indigo-200 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-60"
                type="button"
              >
                {joining === community._id ? '...' : 'Join'}
              </button>
            </li>
          );
        })}
      </ul>
    </FeedCard>
  );
}

function PeoplePanel({
  people,
  onConnectPerson,
  resolvePersonAvatar,
}: {
  people: SuggestedPerson[];
  onConnectPerson: (id: string) => void;
  resolvePersonAvatar: (avatar?: string) => string;
}) {
  if (!people.length) return null;

  return (
    <FeedCard title="People you may know" icon={<Users className="h-4 w-4" />} href="/connections" hrefLabel="See all">
      <ul className="space-y-2">
        {people.slice(0, 4).map((person) => {
          const src = resolvePersonAvatar(person.avatar);
          return (
            <li key={person.id} className="flex items-center gap-2.5">
              {src ? <img src={src} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" /> : <FallbackMark label={person.fullName} rounded="rounded-full" />}
              <div className="min-w-0 flex-1">
                <Link href={`/profile/${encodeURIComponent(person.username)}`} className="block truncate text-sm font-medium text-slate-900 dark:text-slate-100 hover:underline">{person.fullName}</Link>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">{person.reason}</p>
              </div>
              <button
                onClick={() => onConnectPerson(person.id)}
                className="shrink-0 rounded-full border border-indigo-200 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                type="button"
              >
                Connect
              </button>
            </li>
          );
        })}
      </ul>
    </FeedCard>
  );
}

function CertificatesPanel({ certificates }: { certificates: CertificateSummary[] }) {
  return (
    <FeedCard title="Certificates" icon={<Award className="h-4 w-4" />} href="/events" hrefLabel="Earn more">
      {certificates.length ? (
        <ul className="space-y-1.5">
          {certificates.slice(0, 3).map((certificate) => (
            <li key={certificate.serial}>
              <Link href={`/certificates/${certificate.serial}`} className="block truncate text-sm text-slate-700 dark:text-slate-300 hover:text-indigo-600">{certificate.eventTitle}</Link>
            </li>
          ))}
        </ul>
      ) : <p className="text-xs text-slate-500 dark:text-slate-400">Attend and complete events to earn verifiable certificates.</p>}
    </FeedCard>
  );
}

function EventsPanel({ events, eventDate }: { events: UpcomingEventEntry[]; eventDate: (value: string | null) => string }) {
  return (
    <FeedCard title="Your upcoming events" icon={<CalendarDays className="h-4 w-4" />} href="/my-events" hrefLabel="See all">
      {events.length ? (
        <ul className="space-y-2">
          {events.slice(0, 3).map((event) => (
            <li key={event.id}>
              <Link href={`/events/${event.slug}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2 hover:border-indigo-200">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-900 dark:text-slate-100">{event.title}</span>
                  <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{[event.venue, event.mode].filter(Boolean).join(' · ')}</span>
                </span>
                <span className="shrink-0 text-xs font-medium text-slate-500 dark:text-slate-400">{eventDate(event.startDate)}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500 dark:text-slate-400">No upcoming events. <Link href="/events" className="text-indigo-600 hover:underline">Discover →</Link></p>
      )}
    </FeedCard>
  );
}

function OpportunitiesPanel({ opportunities }: { opportunities: Opportunity[] }) {
  return (
    <FeedCard title="Recommended for you" icon={<Briefcase className="h-4 w-4" />} href="/opportunities" hrefLabel="See all">
      {opportunities.length ? (
        <ul className="space-y-2">
          {opportunities.slice(0, 3).map((opportunity) => (
            <li key={opportunity.id}>
              <Link href={`/opportunities/${opportunity.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2 hover:border-indigo-200">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-900 dark:text-slate-100">{opportunity.title}</span>
                  <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{[opportunity.organization, opportunity.location].filter(Boolean).join(' · ')}</span>
                </span>
                {opportunity.matchScore !== null ? <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">{opportunity.matchScore}%</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500 dark:text-slate-400">Earn certificates to unlock matches.</p>
      )}
    </FeedCard>
  );
}

function BadgesPanel({ reputation }: { reputation: Reputation | null }) {
  if (!reputation?.badges.length) return null;

  return (
    <FeedCard title="Your badges" icon={<Award className="h-4 w-4" />} href="/reputation" hrefLabel="Details">
      <div className="flex flex-wrap gap-1.5">
        {reputation.badges.map((badge) => <span key={badge.code} className="rounded-full bg-slate-100 dark:bg-slate-950 px-2 py-0.5 text-xs text-slate-700 dark:text-slate-300">{badge.icon} {badge.label}</span>)}
      </div>
    </FeedCard>
  );
}

function QuickLink({ href, icon, label }: { href: string; icon: ReactNode; label: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 shadow-sm hover:border-indigo-200">
      <span className="text-indigo-600">{icon}</span>{label}
    </Link>
  );
}

function FeedCard({ title, icon, href, hrefLabel, children }: { title: string; icon: ReactNode; href: string; hrefLabel: string; children: ReactNode }) {
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200"><span className="text-indigo-600">{icon}</span><h2 className="text-sm font-semibold">{title}</h2></div>
        <Link href={href} className="text-xs font-medium text-indigo-600 hover:underline">{hrefLabel}</Link>
      </div>
      {children}
    </Card>
  );
}

function FallbackMark({ label, rounded }: { label: string; rounded: string }) {
  return <span className={`grid h-9 w-9 shrink-0 place-items-center ${rounded} bg-slate-200 text-xs font-semibold text-slate-600 dark:text-slate-400`}>{label.slice(0, 1)}</span>;
}
