'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { StatusAvatar } from './status-avatar';
import { StatusViewer } from './status-viewer';
import type { StatusStory } from './status-store';
import { getStatusPeople } from '../status-store';
import type { GuildStatus } from './status-types';

/** A community the viewer leads, so they can post (and see) its status from the same row. */
export type RailCommunity = { id: string; name: string; logo?: string };

type Props = { items: StatusStory[]; currentUser: GuildStatus; managedCommunities?: RailCommunity[]; title?: string };

function AddBadge({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="absolute bottom-5 right-0 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-indigo-600 text-white dark:border-slate-900"
    >
      <Plus className="h-3 w-3" />
    </Link>
  );
}

export function StatusRail({ items, currentUser, managedCommunities = [], title = 'Status' }: Props) {
  const router = useRouter();

  // Id of the story the viewer opened from. The viewer resumes at the first unseen story.
  const [viewerStart, setViewerStart] = useState<string | null>(null);
  const [viewedIds, setViewedIds] = useState<string[]>([]);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);

  const active = useMemo(
    () =>
      items
        .filter(
          (item) =>
            !deletedIds.includes(item.id) &&
            (!item.expiresAt || new Date(item.expiresAt).getTime() > Date.now()),
        )
        .map((item) => (viewedIds.includes(item.id) ? { ...item, viewed: true } : item)),
    [items, viewedIds, deletedIds],
  );

  const people = useMemo(() => getStatusPeople(active), [active]);
  const ordered = people.filter((x) => x.viewed !== true).concat(people.filter((x) => x.viewed === true));

  // "Yours" means your personal status only. A status you posted as a community belongs to
  // that community's bubble, so it isn't swallowed by yours or hidden from the row.
  const isPersonalOwn = (story: StatusStory) => story.userId === currentUser.id && !story.community;
  const ownPerson = people.find(isPersonalOwn);
  const managedIds = new Set(managedCommunities.map((c) => c.id));
  const others = ordered.filter((story) => !isPersonalOwn(story) && !(story.community && managedIds.has(story.community.id)));

  const handleViewed = useCallback((id: string) => {
    setViewedIds((ids) => (ids.includes(id) ? ids : [...ids, id]));
  }, []);

  const handleDeleted = useCallback((id: string) => {
    setDeletedIds((ids) => (ids.includes(id) ? ids : [...ids, id]));
  }, []);

  function openOwn() {
    const own = active.find(isPersonalOwn);
    if (own) setViewerStart(own.id);
    else router.push('/status/new');
  }

  return (
    <section className="rounded-[24px] border border-slate-200 bg-white px-3 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-2 flex items-center justify-between px-1">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Quick updates from people and communities</p>
        </div>
        <Link href="/status" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">See all</Link>
      </div>

      <div className="flex gap-4 overflow-x-auto px-1 pb-1 pt-1 scrollbar-none">
        <div className="relative shrink-0">
          <StatusAvatar
            name={currentUser.name}
            label="You"
            avatar={currentUser.avatar}
            hasStatus={Boolean(ownPerson)}
            viewed={ownPerson?.viewed}
            segments={ownPerson?.segments}
            onClick={openOwn}
          />
          <AddBadge href="/status/new" label="Post a status as yourself" />
        </div>

        {/* Communities you lead sit right next to you: tap to view, + to post as them. */}
        {managedCommunities.map((community) => {
          const group = people.find((story) => story.community?.id === community.id);
          const postHref = `/status/new?as=${encodeURIComponent(community.id)}`;
          return (
            <div key={community.id} className="relative shrink-0">
              <StatusAvatar
                name={community.name}
                avatar={community.logo}
                hasStatus={Boolean(group)}
                viewed={group?.viewed}
                segments={group?.segments}
                community
                onClick={() => (group ? setViewerStart(group.id) : router.push(postHref))}
              />
              <AddBadge href={postHref} label={`Post a status as ${community.name}`} />
            </div>
          );
        })}

        {others.map((item) => (
          <StatusAvatar
            key={item.id}
            name={item.name}
            avatar={item.avatar}
            hasStatus
            viewed={item.viewed}
            segments={item.segments}
            community={Boolean(item.community)}
            onClick={() => setViewerStart(item.id)}
          />
        ))}

        {!others.length ? (
          <Link href="/status/new" className="flex min-w-[110px] items-center gap-2 rounded-2xl border border-dashed border-slate-300 px-3 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
            Share the first update
          </Link>
        ) : null}
      </div>

      {viewerStart !== null && active.length > 0 ? (
        <StatusViewer
          stories={active}
          initialStoryId={viewerStart}
          onClose={() => setViewerStart(null)}
          onViewed={handleViewed}
          onDeleted={handleDeleted}
        />
      ) : null}
    </section>
  );
}
