'use client';

import { useEffect, useState } from 'react';

import { getCommunityPosts, type FeedPost } from '../feed-api';
import { PostCard } from './feed';
import { CommunityComposer } from './community-composer';

export function CommunityPosts({ communityId, currentUserId, canPost = false, communityName = '' }: { communityId: string; currentUserId?: string; canPost?: boolean; communityName?: string }) {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const { posts: list } = await getCommunityPosts(communityId);
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
  }, [communityId]);

  function patch(id: string, updater: (p: FeedPost) => FeedPost) {
    setPosts((list) => list.map((p) => (p.id === id ? updater(p) : p)));
  }

  return (
    <div className="space-y-4">
      {canPost ? <CommunityComposer communityId={communityId} communityName={communityName} onPosted={(post) => setPosts((list) => [post, ...list])} /> : null}

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-white" />)}</div>
      ) : posts.length ? (
        posts.map((post) => (
          <PostCard key={post.id} post={post} currentUserId={currentUserId} onPatch={patch} onDelete={(id) => setPosts((l) => l.filter((p) => p.id !== id))} />
        ))
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">No posts from this community yet.</div>
      )}
    </div>
  );
}
