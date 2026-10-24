'use client';

import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Flag,
  Trash2,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  deleteStatusStory,
  getStatusViewers,
  markStatusViewed,
  reportStatus,
  type StatusStory,
  type StatusViewerEntry,
} from './status-store';
import { StatusAttachmentCard } from './status-attachment-card';

type StatusViewerProps = {
  stories: StatusStory[];
  initialStoryId: string;
  onClose: () => void;
  /**
   * When true (default), opening a person's status starts at their first
   * unseen story (or their first story if everything is seen).
   * Pass false to open exactly `initialStoryId` (deep links).
   */
  resume?: boolean;
  /** Called when the server counted a view, so the parent can update rings. */
  onViewed?: (storyId: string) => void;
  /** Called after the owner deleted a story. */
  onDeleted?: (storyId: string) => void;
};

type StoryGroup = {
  userId: string;
  name: string;
  avatar?: string;
  stories: StatusStory[];
};

type Panel = null | 'viewers' | 'delete' | 'report';

const STORY_DURATION = 5000;

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export function StatusViewer({
  stories,
  initialStoryId,
  onClose,
  resume = true,
  onViewed,
  onDeleted,
}: StatusViewerProps) {
  const router = useRouter();
  const [removedIds, setRemovedIds] = useState<string[]>([]);

  const visibleStories = useMemo(
    () => stories.filter((story) => !removedIds.includes(story.id)),
    [stories, removedIds],
  );

  const groups = useMemo(() => groupStories(visibleStories), [visibleStories]);

  // Computed once, on mount.
  const [initialPosition] = useState(() =>
    findInitialPosition(groups, initialStoryId, resume),
  );

  const [groupIndex, setGroupIndex] = useState(initialPosition.groupIndex);
  const [storyIndex, setStoryIndex] = useState(initialPosition.storyIndex);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [panel, setPanel] = useState<Panel>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [reportReason, setReportReason] = useState('');
  const [reportState, setReportState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [reportError, setReportError] = useState('');
  const [viewerInfo, setViewerInfo] = useState<{
    storyId: string;
    count: number;
    viewers: StatusViewerEntry[];
  } | null>(null);

  // Source of truth for the timer. Avoids reading stale state.
  const progressRef = useRef(0);
  // Always points at the latest goNext, so the rAF loop never uses a stale closure.
  const goNextRef = useRef<() => void>(() => {});
  const onViewedRef = useRef(onViewed);
  onViewedRef.current = onViewed;
  // Bumped to force the timer effect to restart (e.g. restarting the first story).
  const [restartKey, setRestartKey] = useState(0);

  const currentGroup = groups[groupIndex];
  const currentStory = currentGroup?.stories[storyIndex];

  const isPaused = paused || panel !== null;

  /**
   * Lock background scrolling.
   */
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  /**
   * Reset progress when the story changes.
   * Must stay ABOVE the timer effect so the ref is zeroed before the timer reads it.
   */
  useEffect(() => {
    progressRef.current = 0;
    setProgress(0);
    setPanel(null);
    setDeleteError('');
    setReportReason('');
    setReportState('idle');
    setReportError('');
  }, [currentStory?.id]);

  /**
   * Mark the current story as viewed (not needed for your own stories).
   */
  useEffect(() => {
    if (!currentStory || currentStory.isOwner) {
      return;
    }

    const id = currentStory.id;

    void markStatusViewed(id)
      .then((counted) => {
        if (counted) {
          onViewedRef.current?.(id);
        }
      })
      .catch(() => {
        // Viewing should never break the viewer.
      });
  }, [currentStory?.id, currentStory?.isOwner]);

  /**
   * Owner: load the view count / viewers for the current story.
   */
  const refreshViewers = useCallback(async (storyId: string) => {
    try {
      const info = await getStatusViewers(storyId);
      setViewerInfo({ storyId, ...info });
    } catch {
      // Keep the previous numbers; the sheet just shows what it has.
    }
  }, []);

  useEffect(() => {
    if (!currentStory?.isOwner) {
      return;
    }

    void refreshViewers(currentStory.id);
  }, [currentStory?.id, currentStory?.isOwner, refreshViewers]);

  const activeViewerInfo =
    viewerInfo && viewerInfo.storyId === currentStory?.id ? viewerInfo : null;

  /**
   * Story timer.
   */
  useEffect(() => {
    if (isPaused || !currentStory) {
      return;
    }

    const startedAt = performance.now();
    const startingProgress = progressRef.current; // resumes correctly after pause
    let animationFrame = 0;

    const tick = (now: number) => {
      const elapsed = Math.max(0, now - startedAt);
      const next = Math.min(1, startingProgress + elapsed / STORY_DURATION);

      progressRef.current = next;
      setProgress(next);

      if (next >= 1) {
        goNextRef.current();
        return;
      }

      animationFrame = requestAnimationFrame(tick);
    };

    animationFrame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, [isPaused, currentStory?.id, restartKey]);

  const goNext = useCallback(() => {
    if (!currentGroup) {
      onClose();
      return;
    }

    /**
     * Next story from same person.
     */
    if (storyIndex < currentGroup.stories.length - 1) {
      setStoryIndex((index) => index + 1);
      return;
    }

    /**
     * Move to next person.
     */
    if (groupIndex < groups.length - 1) {
      setGroupIndex((index) => index + 1);
      setStoryIndex(0);
      return;
    }

    /**
     * End of all stories.
     */
    onClose();
  }, [currentGroup, storyIndex, groupIndex, groups.length, onClose]);

  // Keep the ref in sync with the latest goNext.
  goNextRef.current = goNext;

  const goPrevious = useCallback(() => {
    /**
     * Previous story from same person.
     */
    if (storyIndex > 0) {
      setStoryIndex((index) => index - 1);
      return;
    }

    /**
     * Previous person.
     */
    if (groupIndex > 0) {
      const previousGroup = groups[groupIndex - 1];

      setGroupIndex((index) => index - 1);
      setStoryIndex(Math.max(0, previousGroup.stories.length - 1));
      return;
    }

    /**
     * At the beginning: restart the current story.
     */
    progressRef.current = 0;
    setProgress(0);
    setRestartKey((key) => key + 1);
  }, [storyIndex, groupIndex, groups]);

  /**
   * Owner: delete the current story and land on the next one.
   */
  const handleDelete = useCallback(async () => {
    if (!currentStory || !currentGroup || deleting) {
      return;
    }

    const id = currentStory.id;

    setDeleting(true);
    setDeleteError('');

    try {
      await deleteStatusStory(id);
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : 'Unable to delete status',
      );
      setDeleting(false);
      return;
    }

    setDeleting(false);
    setPanel(null);
    onDeleted?.(id);

    const remainingInGroup = currentGroup.stories.length - 1;
    const hasNextGroup = groupIndex < groups.length - 1;

    if (remainingInGroup === 0) {
      if (!hasNextGroup) {
        onClose();
        return;
      }

      // The next group slides into this index once the story is removed.
      setStoryIndex(0);
    } else if (storyIndex >= remainingInGroup) {
      // Deleted the last story of this person: go to the next person.
      if (!hasNextGroup) {
        onClose();
        return;
      }

      setGroupIndex(groupIndex + 1);
      setStoryIndex(0);
    }

    setRemovedIds((ids) => [...ids, id]);
  }, [
    currentStory,
    currentGroup,
    deleting,
    groupIndex,
    storyIndex,
    groups.length,
    onClose,
    onDeleted,
  ]);

  /**
   * Report someone else's story.
   */
  const handleReport = useCallback(async () => {
    if (!currentStory || reportState === 'sending') {
      return;
    }

    setReportState('sending');
    setReportError('');

    try {
      await reportStatus(currentStory.id, reportReason);
      setReportState('sent');
    } catch (error) {
      setReportError(
        error instanceof Error ? error.message : 'Unable to send report',
      );
      setReportState('idle');
    }
  }, [currentStory, reportReason, reportState]);

  /**
   * Keyboard navigation.
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (panel) {
          setPanel(null);
        } else {
          onClose();
        }
        return;
      }

      if (panel) {
        return;
      }

      if (event.key === 'ArrowRight') {
        goNext();
      }

      if (event.key === 'ArrowLeft') {
        goPrevious();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [goNext, goPrevious, onClose, panel]);

  if (!currentStory || !currentGroup) {
    return null;
  }

  const avatarSrc = resolveAvatar(currentGroup.avatar);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black"
      role="dialog"
      aria-modal="true"
      aria-label="Status viewer"
    >
      {/* Desktop backdrop */}
      <button
        type="button"
        aria-label="Close status viewer"
        onClick={onClose}
        className="absolute inset-0 hidden bg-black/70 lg:block"
      />

      {/* Viewer */}
      <div
        className="
          relative
          z-10
          h-full
          w-full
          overflow-hidden
          bg-slate-950
          lg:h-[min(860px,92vh)]
          lg:w-[480px]
          lg:rounded-2xl
          lg:shadow-2xl
        "
        onClick={(event) => event.stopPropagation()}
        onPointerDown={() => setPaused(true)}
        onPointerUp={() => setPaused(false)}
        onPointerCancel={() => setPaused(false)}
      >
        {/* Progress bars */}
        <div className="absolute left-3 right-3 top-3 z-30 flex gap-1">
          {currentGroup.stories.map((story, index) => {
            const width =
              index < storyIndex
                ? 100
                : index === storyIndex
                  ? progress * 100
                  : 0;

            return (
              <div
                key={story.id}
                className="h-1 flex-1 overflow-hidden rounded-full bg-white/30"
              >
                <div
                  className="h-full rounded-full bg-white"
                  style={{ width: `${width}%` }}
                />
              </div>
            );
          })}
        </div>

        {/* Header */}
        <div
          className="
            absolute
            left-0
            right-0
            top-0
            z-20
            flex
            items-center
            justify-between
            px-4
            pb-5
            pt-7
            bg-gradient-to-b
            from-black/60
            to-transparent
          "
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-white/10">
              {avatarSrc ? (
                <img
                  src={avatarSrc}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-white">
                  {getInitials(currentGroup.name)}
                </div>
              )}
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">
                {currentStory.isOwner && !currentStory.community ? 'Your status' : currentGroup.name}
              </p>

              <p className="text-xs text-white/60">
                {currentStory.community ? 'Community · ' : ''}
                {formatTimeAgo(currentStory.createdAt)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-white transition hover:bg-white/10"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Story content */}
        <div
          className={[
            'flex h-full w-full items-center justify-center px-8 text-center',
            'bg-gradient-to-br',
            currentStory.accent,
          ].join(' ')}
        >
          {currentStory.attachment ? (
            // z-30: sits above the previous/next tap zones so the card is tappable.
            <div className="relative z-30 w-full max-w-sm space-y-4">
              <StatusAttachmentCard
                attachment={currentStory.attachment}
                onOpen={currentStory.attachment.href ? () => router.push(currentStory.attachment!.href) : undefined}
              />

              {currentStory.description.trim() ? (
                <p className="pointer-events-none break-words text-base leading-7 text-white">
                  {currentStory.description}
                </p>
              ) : null}
            </div>
          ) : (
          <div className="max-w-sm">
            <span className="mb-4 inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-medium uppercase tracking-wide text-white backdrop-blur">
              {currentStory.kind}
            </span>

            <h2 className="break-words text-2xl font-bold text-white">
              {currentStory.label}
            </h2>

            {currentStory.description.trim() !==
              currentStory.label.trim() && (
              <p className="mt-4 break-words text-base leading-7 text-white/90">
                {currentStory.description}
              </p>
            )}
          </div>
          )}
        </div>

        {/* Previous zone */}
        <button
          type="button"
          aria-label="Previous status"
          onClick={goPrevious}
          className="absolute bottom-0 left-0 top-20 z-20 w-1/3 cursor-pointer"
        >
          <span className="sr-only">Previous</span>
        </button>

        {/* Next zone */}
        <button
          type="button"
          aria-label="Next status"
          onClick={goNext}
          className="absolute bottom-0 right-0 top-20 z-20 w-2/3 cursor-pointer"
        >
          <span className="sr-only">Next</span>
        </button>

        {/* Bottom bar: event / certificate link, owner tools */}
        {(
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 bg-gradient-to-t from-black/50 to-transparent px-4 pb-5 pt-10">
            <span />

            {!currentStory.isOwner && (
              <button
                type="button"
                onClick={() => {
                  setReportError('');
                  setReportState('idle');
                  setPanel('report');
                }}
                className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25"
                aria-label="Report this status"
              >
                <Flag className="h-4 w-4" />
              </button>
            )}

            {currentStory.isOwner && (
              <div className="pointer-events-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPanel('viewers');
                    void refreshViewers(currentStory.id);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-2 text-sm font-medium text-white backdrop-blur transition hover:bg-white/25"
                  aria-label="See who viewed this status"
                >
                  <Eye className="h-4 w-4" />
                  {activeViewerInfo?.count ?? 0}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDeleteError('');
                    setPanel('delete');
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25"
                  aria-label="Delete this status"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Sheets (scrim stops taps from reaching the previous/next zones) */}
        {panel && (
          <button
            type="button"
            aria-label="Close panel"
            onClick={() => setPanel(null)}
            className="absolute inset-0 z-[35] bg-black/40"
          />
        )}

        {panel === 'viewers' && (
          <div
            role="dialog"
            aria-label="Viewed by"
            className="absolute inset-x-0 bottom-0 z-40 max-h-[65%] overflow-y-auto rounded-t-2xl bg-slate-900 p-4 text-white shadow-2xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold">
                Viewed by {activeViewerInfo?.count ?? 0}
              </p>

              <button
                type="button"
                onClick={() => setPanel(null)}
                aria-label="Close viewers"
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {activeViewerInfo?.viewers.length ? (
              <ul className="space-y-3">
                {activeViewerInfo.viewers.map((viewer) => {
                  const src = resolveAvatar(viewer.avatar);

                  return (
                    <li key={viewer.id} className="flex items-center gap-3">
                      <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-white/10">
                        {src ? (
                          <img
                            src={src}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs font-semibold">
                            {getInitials(viewer.name)}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {viewer.name}
                        </p>
                        <p className="text-xs text-white/60">
                          {formatTimeAgo(viewer.viewedAt)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="py-6 text-center text-sm text-white/60">
                No views yet.
              </p>
            )}
          </div>
        )}

        {panel === 'delete' && (
          <div
            role="alertdialog"
            aria-label="Delete status"
            className="absolute inset-x-4 bottom-6 z-40 rounded-2xl bg-slate-900 p-4 text-white shadow-2xl"
          >
            <p className="text-sm font-semibold">Delete this status?</p>
            <p className="mt-1 text-xs text-white/60">
              It will be removed for everyone who can see it.
            </p>

            {deleteError && (
              <p role="alert" className="mt-2 text-xs text-red-400">
                {deleteError}
              </p>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPanel(null)}
                className="rounded-full px-4 py-2 text-sm font-medium text-white/80 hover:bg-white/10"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={deleting}
                className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        )}

        {panel === 'report' && (
          <div
            role="dialog"
            aria-label="Report status"
            className="absolute inset-x-4 bottom-6 z-40 rounded-2xl bg-slate-900 p-4 text-white shadow-2xl"
          >
            {reportState === 'sent' ? (
              <>
                <p className="text-sm font-semibold">Thanks for letting us know</p>
                <p className="mt-1 text-xs text-white/60">
                  We&apos;ll review this status.
                </p>

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setPanel(null)}
                    className="rounded-full bg-white/15 px-4 py-2 text-sm font-medium hover:bg-white/25"
                  >
                    Close
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold">Report this status?</p>
                <p className="mt-1 text-xs text-white/60">
                  Tell us what is wrong (optional).
                </p>

                <textarea
                  value={reportReason}
                  onChange={(event) => setReportReason(event.target.value)}
                  maxLength={300}
                  rows={3}
                  aria-label="Reason for report"
                  className="mt-3 w-full resize-none rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm text-white outline-none placeholder:text-white/40 focus:border-white/40"
                  placeholder="Spam, harassment, misleading…"
                />

                {reportError && (
                  <p role="alert" className="mt-2 text-xs text-red-400">
                    {reportError}
                  </p>
                )}

                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setPanel(null)}
                    className="rounded-full px-4 py-2 text-sm font-medium text-white/80 hover:bg-white/10"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleReport()}
                    disabled={reportState === 'sending'}
                    className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    {reportState === 'sending' ? 'Sending…' : 'Report'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Desktop navigation hints */}
        <div className="pointer-events-none absolute inset-y-0 left-[-64px] hidden items-center lg:flex">
          <ChevronLeft className="h-8 w-8 text-white/60" />
        </div>

        <div className="pointer-events-none absolute inset-y-0 right-[-64px] hidden items-center lg:flex">
          <ChevronRight className="h-8 w-8 text-white/60" />
        </div>
      </div>
    </div>
  );
}

function resolveAvatar(avatar?: string) {
  if (!avatar) {
    return '';
  }

  return avatar.startsWith('/') ? `${API_BASE}${avatar}` : avatar;
}

function groupStories(stories: StatusStory[]): StoryGroup[] {
  const groups = new Map<string, StoryGroup>();

  for (const story of stories) {
    const userId = story.groupKey ?? story.userId ?? `story-${story.id}`;

    const existing = groups.get(userId);

    if (existing) {
      existing.stories.push(story);
      continue;
    }

    groups.set(userId, {
      userId,
      name: story.name,
      avatar: story.avatar,
      stories: [story],
    });
  }

  return Array.from(groups.values()).map((group) => ({
    ...group,
    stories: [...group.stories].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    ),
  }));
}

function findInitialPosition(
  groups: StoryGroup[],
  storyId: string,
  resume: boolean,
) {
  for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
    const stories = groups[groupIndex].stories;
    const storyIndex = stories.findIndex((story) => story.id === storyId);

    if (storyIndex < 0) {
      continue;
    }

    if (!resume) {
      return { groupIndex, storyIndex };
    }

    // Start at the first unseen story, or the beginning if all are seen.
    const firstUnseen = stories.findIndex((story) => !story.viewed);

    return {
      groupIndex,
      storyIndex: firstUnseen >= 0 ? firstUnseen : 0,
    };
  }

  return {
    groupIndex: 0,
    storyIndex: 0,
  };
}

function getInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);

  if (!words.length) {
    return 'U';
  }

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

function formatTimeAgo(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);

  if (minutes < 1) {
    return 'Just now';
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours}h ago`;
  }

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}