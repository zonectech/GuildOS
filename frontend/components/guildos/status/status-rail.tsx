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

type Props = { items: StatusStory[]; currentUser: GuildStatus; title?: string };

export function StatusRail({ items, currentUser, title = 'Status' }: Props) {
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
  const ownPerson = people.find((story) => story.userId === currentUser.id);

  const handleViewed = useCallback((id: string) => {
    setViewedIds((ids) => (ids.includes(id) ? ids : [...ids, id]));
  }, []);

  const handleDeleted = useCallback((id: string) => {
    setDeletedIds((ids) => (ids.includes(id) ? ids : [...ids, id]));
  }, []);

  function openOwn() {
    const own = active.find((story) => story.userId === currentUser.id);
    if (own) setViewerStart(own.id);
    else router.push('/status/new');
  }

  return (
    <section className="rounded-[24px] border border-slate-200 bg-white px-3 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-2 flex items-center justify-between px-1">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Quick updates from your Guild</p>
        </div>
        <Link href="/status" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">See all</Link>
      </div>

      <div className="flex gap-4 overflow-x-auto px-1 pb-1 pt-1 scrollbar-none">
        <div className="relative shrink-0">
          <StatusAvatar
            name={currentUser.name}
            avatar={currentUser.avatar}
            hasStatus={Boolean(ownPerson)}
            viewed={ownPerson?.viewed}
            segments={ownPerson?.segments}
            onClick={openOwn}
          />
          <Link
            href="/status/new"
            aria-label="Create status"
            className="absolute bottom-5 right-0 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-indigo-600 text-white dark:border-slate-900"
          >
            <Plus className="h-3 w-3" />
          </Link>
        </div>

        {ordered
          .filter((story) => story.userId !== currentUser.id)
          .map((item) => (
            <StatusAvatar
              key={item.id}
              name={item.name}
              avatar={item.avatar}
              hasStatus
              viewed={item.viewed}
              segments={item.segments}
              onClick={() => setViewerStart(item.id)}
            />
          ))}

        {!ordered.length ? (
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