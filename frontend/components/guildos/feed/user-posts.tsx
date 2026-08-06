'use client';

import { useEffect, useState } from 'react';

import { getUserPosts, type FeedPost } from '../feed-api';
import { PostCard } from './feed';

export function UserPosts({ userId, currentUserId }: { userId: string; currentUserId?: string }) {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const { posts: list } = await getUserPosts(userId);
        if (!cancelled) setPosts(list);
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  function patch(id: string, updater: (p: FeedPost) => FeedPost) {
    setPosts((list) => list.map((p) => (p.id === id ? updater(p) : p)));
  }

  if (loading) {
    return <div className="space-y-3">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-white dark:bg-slate-900" />)}</div>;
  }

  if (!posts.length) {
    return <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-sm text-slate-500 dark:text-slate-400">No posts yet.</div>;
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} currentUserId={currentUserId} onPatch={patch} onDelete={(id) => setPosts((l) => l.filter((p) => p.id !== id))} />
      ))}
    </div>
  );
}
