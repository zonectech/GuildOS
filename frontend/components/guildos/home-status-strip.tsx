'use client';

import { Plus, ChevronRight } from 'lucide-react';
import { useMemo } from 'react';
import type { StatusStory } from './status/status-store';

type CurrentUserStatus = {
  id: string;
  name: string;
  avatar?: string;
  status?: StatusStory;
};

type HomeStatusStripProps = {
  currentUser: CurrentUserStatus;
  stories: StatusStory[];
};

type StatusPerson = {
  userId: string;
  name: string;
  avatar?: string;
  stories: StatusStory[];
  hasUnseen: boolean;
};

export function HomeStatusStrip({
  currentUser,
  stories,
}: HomeStatusStripProps) {
  /**
   * Group multiple Status stories belonging
   * to the same user.
   *
   * This prevents:
   *
   * User A → Story 1
   * User A → Story 2
   * User A → Story 3
   *
   * from becoming three circles.
   */
  const people = useMemo<StatusPerson[]>(() => {
  const grouped = new Map<string, StatusPerson>();

  for (const story of stories) {
    const userId =
      story.groupKey ?? story.userId ?? `story-${story.id}`;

    const existing = grouped.get(userId);

    if (existing) {
      existing.stories.push(story);

      if (!story.viewed) {
        existing.hasUnseen = true;
      }

      continue;
    }

    grouped.set(userId, {
      userId,
      name: story.name,
      avatar: story.avatar,
      stories: [story],
      hasUnseen: !story.viewed,
    });
  }

  return Array.from(grouped.values()).map((person) => {
    const sortedStories = [...person.stories].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() -
        new Date(b.createdAt).getTime(),
    );

    return {
      ...person,
      stories: sortedStories,
      hasUnseen: sortedStories.some(
        (story) => !story.viewed,
      ),
    };
  });
}, [stories]);

  const ownStatusHref =
    currentUser.status?.href ?? '/status/new';

  return (
    <section className="w-full">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Status
        </h2>

        <a
          href="/status"
          className="flex items-center gap-1 text-xs font-medium text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          See all
          <ChevronRight className="h-3.5 w-3.5" />
        </a>
      </div>

      <div
        className="
          flex
          gap-4
          overflow-x-auto
          pb-2
          scrollbar-none
        "
      >
        {/* Current user */}
        <a
          href={ownStatusHref}
          className="group flex w-[68px] shrink-0 flex-col items-center"
        >
          <div
            className={[
              'relative rounded-full p-[2px]',
              currentUser.status
                ? 'bg-gradient-to-tr from-violet-500 via-fuchsia-500 to-orange-400'
                : 'bg-slate-200 dark:bg-slate-700',
            ].join(' ')}
          >
            <div className="rounded-full bg-white p-[2px] dark:bg-slate-950">
              <div className="relative h-14 w-14 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                {currentUser.avatar ? (
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-slate-500 dark:text-slate-400">
                    {getInitials(currentUser.name)}
                  </div>
                )}
              </div>
            </div>

            <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-slate-900 text-white dark:border-slate-950 dark:bg-indigo-600">
              <Plus className="h-3 w-3" />
            </span>
          </div>

          <span className="mt-1.5 w-full truncate text-center text-[11px] font-medium text-slate-700 dark:text-slate-300">
            Your status
          </span>
        </a>

        {/* Other users */}
        {people.map((person) => {
          const firstStory = person.stories[0];

          return (
            <a
              key={person.userId}
              href={firstStory.href}
              className="group flex w-[68px] shrink-0 flex-col items-center"
            >
              <div
                className={[
                  'rounded-full p-[2px]',
                  person.hasUnseen
                    ? 'bg-gradient-to-tr from-violet-500 via-fuchsia-500 to-orange-400'
                    : 'bg-slate-300 dark:bg-slate-600',
                ].join(' ')}
              >
                <div className="rounded-full bg-white p-[2px] dark:bg-slate-950">
                  <div className="h-14 w-14 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    {person.avatar ? (
                      <img
                        src={person.avatar}
                        alt={person.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-slate-500 dark:text-slate-400">
                        {getInitials(person.name)}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <span className="mt-1.5 w-full truncate text-center text-[11px] font-medium text-slate-700 dark:text-slate-300">
                {person.name}
              </span>
            </a>
          );
        })}

        {/* Empty state */}
        {!people.length && !currentUser.status && (
          <div className="flex items-center px-2 text-xs text-slate-400">
            No active status updates yet.
          </div>
        )}
      </div>
    </section>
  );
}

function getInitials(name: string) {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!words.length) {
    return 'U';
  }

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}