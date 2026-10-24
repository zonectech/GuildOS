'use client';

// Save as: app/status/page.tsx
import Link from 'next/link';
import { ArrowLeft, Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getStatusPeople, readStatusStories, type StatusStory } from '../../components/guildos/status-store';
import { StatusAvatar } from '../../components/guildos/status/status-avatar';
import { StatusViewer } from '../../components/guildos/status/status-viewer';

export default function StatusPage() {
  const [stories, setStories] = useState<StatusStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewerStart, setViewerStart] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void readStatusStories()
      .then((items) => { if (alive) { setStories(items); setLoading(false); } })
      .catch(() => { if (alive) { setStories([]); setLoading(false); } });
    return () => { alive = false; };
  }, []);

  const handleViewed = useCallback((id: string) => {
    setStories((list) => list.map((story) => (story.id === id ? { ...story, viewed: true } : story)));
  }, []);

  const handleDeleted = useCallback((id: string) => {
    setStories((list) => list.filter((story) => story.id !== id));
  }, []);

  const active = useMemo(
    () => stories.filter((story) => !story.expiresAt || new Date(story.expiresAt).getTime() > Date.now()),
    [stories],
  );

  // Your own status first, then unseen, then seen.
  const people = useMemo(() => {
    const rank = (story: StatusStory) => (story.isOwner && !story.community ? 0 : story.viewed ? 2 : 1);
    return [...getStatusPeople(active)].sort((a, b) => rank(a) - rank(b));
  }, [active]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-4xl px-4 py-6">
        <header className="mb-7 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/home" className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"><ArrowLeft className="h-4 w-4" /></Link>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">GuildOS</p>
              <h1 className="text-xl font-semibold text-slate-950 dark:text-white">Status</h1>
            </div>
          </div>
          <Link href="/status/new" className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"><Plus className="h-4 w-4" /> Post status</Link>
        </header>

        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-5">
            <h2 className="text-base font-semibold text-slate-950 dark:text-white">Recent updates</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Tap a profile to open the story viewer. Open your own status to see who viewed it.</p>
          </div>

          {loading ? (
            <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">Loading statuses…</div>
          ) : people.length ? (
            <div className="flex flex-wrap gap-5">
              {people.map((item) => (
                <StatusAvatar
                  key={item.id}
                  name={item.isOwner && !item.community ? 'Your status' : item.name}
                  avatar={item.avatar}
                  hasStatus
                  viewed={item.viewed}
                  segments={item.segments}
                  size="lg"
                  onClick={() => setViewerStart(item.id)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 px-5 py-10 text-center dark:border-slate-700">
              <p className="font-medium text-slate-900 dark:text-white">No active statuses yet.</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Be the first person to share an update.</p>
              <Link href="/status/new" className="mt-4 inline-flex rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Create status</Link>
            </div>
          )}
        </section>
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
    </div>
  );
}