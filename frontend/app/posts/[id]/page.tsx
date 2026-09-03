'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { getCurrentUser, type AuthUser } from '../../../components/guildos/auth-api';
import { navigateBack } from '../../../components/guildos/back-navigation';
import { getPost, type FeedPost } from '../../../components/guildos/feed-api';
import { PostCard } from '../../../components/guildos/feed/feed';
import { StudentNav } from '../../../components/guildos/student-nav';
import { PageLoading } from '../../../components/guildos/ui/loading';

export default function PostDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = typeof params?.id === 'string' ? params.id : '';
  const [user, setUser] = useState<AuthUser | null>(null);
  const [post, setPost] = useState<FeedPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void (async () => {
      try {
        const current = await getCurrentUser();
        if (!current) {
          router.replace('/login');
          return;
        }
        if (!cancelled) setUser(current);
        const { post: loaded } = await getPost(id);
        if (!cancelled) setPost(loaded);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Post not found');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, router]);

  function patch(postId: string, updater: (p: FeedPost) => FeedPost) {
    setPost((current) => (current && current.id === postId ? updater(current) : current));
  }

  if (loading) {
    return <PageLoading label="Loading post..." />;
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <StudentNav active="/home" />
      <main className="mx-auto max-w-2xl space-y-4 px-4 py-6">
        <button
          onClick={() => navigateBack(router, '/home')}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Back to feed
        </button>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/50 dark:text-red-300">{error}</div>
        ) : post ? (
          <PostCard
            post={post}
            currentUserId={user?.id}
            onPatch={patch}
            onDelete={() => navigateBack(router, '/home')}
            defaultShowComments
            disableDetailNavigation
          />
        ) : (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-6 text-sm text-slate-500 dark:text-slate-400 shadow-sm">Post not found.</div>
        )}
      </main>
    </div>
  );
}
