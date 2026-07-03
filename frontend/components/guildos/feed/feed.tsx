'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart, MessageCircle, Trash2, Send } from 'lucide-react';

import {
  addPostComment,
  createPost,
  deletePost,
  getFeed,
  getPostComments,
  resolveFeedAvatar,
  togglePostLike,
  type FeedComment,
  type FeedPost,
  type FeedScope,
} from '../feed-api';
import { getFollowedCommunityIds, toggleCommunityFollow } from '../follow-api';

function timeAgo(value: string) {
  const d = new Date(value).getTime();
  const secs = Math.floor((Date.now() - d) / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(value).toLocaleDateString();
}

function Avatar({ author }: { author: FeedPost['author'] }) {
  const src = resolveFeedAvatar(author.avatar);
  return src ? (
    <img src={src} alt={author.fullName} className="h-9 w-9 rounded-full object-cover" />
  ) : (
    <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">{author.fullName.slice(0, 1)}</span>
  );
}

export function Feed({ currentUserId }: { currentUserId?: string }) {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');
  const [scope, setScope] = useState<FeedScope>('FORYOU');
  const [followed, setFollowed] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { communityIds } = await getFollowedCommunityIds();
        if (!cancelled) setFollowed(new Set(communityIds));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const { posts: list } = await getFeed(undefined, scope);
        if (!cancelled) setPosts(list);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load feed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scope]);

  async function submitPost() {
    if (!draft.trim()) return;
    try {
      setPosting(true);
      const { post } = await createPost(draft.trim());
      setPosts((p) => [post, ...p]);
      setDraft('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to post');
    } finally {
      setPosting(false);
    }
  }

  function patch(id: string, updater: (p: FeedPost) => FeedPost) {
    setPosts((list) => list.map((p) => (p.id === id ? updater(p) : p)));
  }

  async function onToggleFollow(communityId: string) {
    const { following } = await toggleCommunityFollow(communityId);
    setFollowed((prev) => {
      const next = new Set(prev);
      if (following) next.add(communityId);
      else next.delete(communityId);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      {/* Composer */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Share an update, an achievement, or what you're looking for…"
          className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
          rows={2}
        />
        <div className="mt-2 flex justify-end">
          <button onClick={() => void submitPost()} disabled={posting || !draft.trim()} className="rounded-xl bg-slate-900 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50">
            {posting ? 'Posting…' : 'Post'}
          </button>
        </div>
      </div>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div> : null}

      <div className="flex gap-1.5">
        <button onClick={() => setScope('FORYOU')} className={`rounded-full px-3 py-1 text-xs font-medium ${scope === 'FORYOU' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>For you</button>
        <button onClick={() => setScope('COMMUNITIES')} className={`rounded-full px-3 py-1 text-xs font-medium ${scope === 'COMMUNITIES' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>My communities</button>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-white" />)}</div>
      ) : posts.length ? (
        posts.map((post) => (
          <PostCard key={post.id} post={post} currentUserId={currentUserId} onPatch={patch} onDelete={(id) => setPosts((l) => l.filter((p) => p.id !== id))} isFollowing={post.author.id ? followed.has(post.author.id) : false} onToggleFollow={onToggleFollow} />
        ))
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">No posts yet. Be the first to share something 🎉</div>
      )}
    </div>
  );
}

export function PostCard({ post, currentUserId, onPatch, onDelete, isFollowing, onToggleFollow }: { post: FeedPost; currentUserId?: string; onPatch: (id: string, u: (p: FeedPost) => FeedPost) => void; onDelete: (id: string) => void; isFollowing?: boolean; onToggleFollow?: (communityId: string) => Promise<void> | void }) {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [commentDraft, setCommentDraft] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const isMilestone = post.kind === 'MILESTONE';
  const isCommunity = post.author.isCommunity;
  const mine = currentUserId && post.author.id === currentUserId;

  async function follow() {
    if (!onToggleFollow || !post.author.id) return;
    try {
      setFollowBusy(true);
      await onToggleFollow(post.author.id);
    } finally {
      setFollowBusy(false);
    }
  }

  async function like() {
    const { liked, likeCount } = await togglePostLike(post.id);
    onPatch(post.id, (p) => ({ ...p, liked, likeCount }));
  }

  async function openComments() {
    setShowComments((s) => !s);
    if (comments.length || loadingComments) return;
    setLoadingComments(true);
    try {
      const { comments: list } = await getPostComments(post.id);
      setComments(list);
    } finally {
      setLoadingComments(false);
    }
  }

  async function submitComment() {
    if (!commentDraft.trim()) return;
    const { comment } = await addPostComment(post.id, commentDraft.trim());
    setComments((c) => [...c, comment]);
    setCommentDraft('');
    onPatch(post.id, (p) => ({ ...p, commentCount: p.commentCount + 1 }));
  }

  async function remove() {
    if (!window.confirm('Delete this post?')) return;
    await deletePost(post.id);
    onDelete(post.id);
  }

  return (
    <article className={`overflow-hidden rounded-2xl border shadow-sm ${isCommunity ? 'border-sky-200 bg-white' : isMilestone ? 'border-indigo-200 bg-gradient-to-br from-indigo-50/60 to-white' : 'border-slate-200 bg-white'}`}>
      {isCommunity ? (
        <div className="flex items-center gap-1.5 bg-sky-50 px-4 py-1.5 text-xs font-semibold text-sky-700">📣 Community announcement</div>
      ) : null}
      <div className="p-4">
      <div className="flex items-start gap-3">
        <Avatar author={post.author} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <Link href={post.author.isCommunity ? (post.author.username ? `/communities/${encodeURIComponent(post.author.username)}` : '#') : post.author.username ? `/u/${encodeURIComponent(post.author.username)}` : '#'} className="text-sm font-semibold text-slate-900 hover:underline">{post.author.fullName}{post.author.isCommunity ? <span className="ml-1 align-middle text-xs font-normal text-indigo-500">· Community</span> : null}</Link>
              <p className="truncate text-xs text-slate-500">{post.author.headline || 'Student'} · {timeAgo(post.createdAt)}{post.communityName ? ` · ${post.communityName}` : ''}</p>
            </div>
            {mine ? <button onClick={() => void remove()} className="text-slate-300 hover:text-rose-500" title="Delete"><Trash2 className="h-4 w-4" /></button> : isCommunity && onToggleFollow && post.author.id ? (
              <button onClick={() => void follow()} disabled={followBusy} className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${isFollowing ? 'border border-slate-200 bg-white text-slate-600' : 'bg-sky-600 text-white'} disabled:opacity-50`}>{isFollowing ? 'Following' : 'Follow'}</button>
            ) : null}
          </div>
          <p className={`mt-2 whitespace-pre-line text-sm ${isMilestone ? 'font-medium text-slate-800' : 'text-slate-700'}`}>{post.content}</p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-4 border-t border-slate-100 pt-2 text-xs text-slate-500">
        <button onClick={() => void like()} className={`flex items-center gap-1.5 ${post.liked ? 'text-rose-600' : 'hover:text-slate-800'}`}>
          <Heart className={`h-4 w-4 ${post.liked ? 'fill-rose-600' : ''}`} /> {post.likeCount > 0 ? post.likeCount : ''} Like
        </button>
        <button onClick={() => void openComments()} className="flex items-center gap-1.5 hover:text-slate-800">
          <MessageCircle className="h-4 w-4" /> {post.commentCount > 0 ? post.commentCount : ''} Comment
        </button>
      </div>

      {showComments ? (
        <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
          {loadingComments ? (
            <p className="text-xs text-slate-400">Loading…</p>
          ) : comments.length ? (
            comments.map((c) => (
              <div key={c.id} className="flex items-start gap-2">
                <Avatar author={c.author} />
                <div className="rounded-2xl bg-slate-50 px-3 py-2">
                  <p className="text-xs font-medium text-slate-900">{c.author.fullName} <span className="ml-1 font-normal text-slate-400">{timeAgo(c.createdAt)}</span></p>
                  <p className="text-sm text-slate-700">{c.content}</p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-400">No comments yet.</p>
          )}
          <div className="flex items-center gap-2">
            <input value={commentDraft} onChange={(e) => setCommentDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void submitComment(); }} placeholder="Write a comment…" className="flex-1 rounded-full border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            <button onClick={() => void submitComment()} className="rounded-full bg-slate-900 p-2 text-white"><Send className="h-4 w-4" /></button>
          </div>
        </div>
      ) : null}
      </div>
    </article>
  );
}
