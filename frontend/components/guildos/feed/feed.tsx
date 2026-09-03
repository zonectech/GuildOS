'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { GraduationCap, Heart, MessageCircle, Megaphone, Trash2, Send, Flag, Pencil, Pin, X } from 'lucide-react';

import {
  addPostComment,
  createPost,
  deletePost,
  editPost,
  getFeed,
  getPostComments,
  reportContent,
  resolveFeedAvatar,
  resolveFeedImage,
  togglePostLike,
  type FeedComment,
  type FeedPost,
  type FeedScope,
  type FeedSort,
  type FeedTag,
} from '../feed-api';
import { ImagePreview, PhotoButton, acceptImageFile } from './post-attachments';
import { EmojiPicker } from './emoji-picker';
import { MentionTextarea } from './mention-textarea';
import { MessageLinkPreview, firstPreviewableLink } from '../message-link-preview';
import { PollEditor, PollToggleButton, PostPoll, MIN_POLL_OPTIONS, cleanPollOptions } from './post-poll';
import { TYPE_LABEL } from '../certificate-canvas';
import { toast } from '../ui/toast';
import { confirmDialog, promptDialog } from '../ui/confirm-dialog';
import { getFollowedCommunityIds, toggleCommunityFollow } from '../follow-api';
import { getConnections, sendConnectionRequest } from '../connection-api';

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
  return new Date(value).toLocaleDateString('en-NG');
}

/** A small, pleasant palette so people without an avatar photo get a distinct, on-brand color
 * instead of everyone sharing the same flat grey circle. Picked deterministically from the name. */
const AVATAR_PALETTE = [
  'bg-indigo-100 text-indigo-700',
  'bg-sky-100 text-sky-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-violet-100 text-violet-700',
  'bg-teal-100 text-teal-700',
  'bg-orange-100 text-orange-700',
];
function avatarTone(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

/**
 * Guild-tier ring color for an author's avatar — the same tone used on the profile rail, brought
 * into the feed so a Gold/Platinum/Elite poster is recognizable as a proven campus leader at a
 * glance. Explorer Guild (everyone's starting tier) gets no ring, so earning one first tier feels
 * like an unlock rather than a participation trophy.
 */
const GUILD_RING: Partial<Record<NonNullable<FeedPost['author']['level']>, string>> = {
  'Bronze Guild': 'ring-2 ring-offset-2 ring-amber-600',
  'Silver Guild': 'ring-2 ring-offset-2 ring-slate-400',
  'Gold Guild': 'ring-2 ring-offset-2 ring-yellow-400',
  'Platinum Guild': 'ring-2 ring-offset-2 ring-cyan-400',
  'Elite Guild': 'ring-2 ring-offset-2 ring-fuchsia-500',
};

function Avatar({ author }: { author: FeedPost['author'] }) {
  const src = resolveFeedAvatar(author.avatar);
  const ring = author.level ? GUILD_RING[author.level] ?? '' : '';
  return src ? (
    <img src={src} alt={author.fullName} className={`h-9 w-9 rounded-full object-cover ${ring}`} title={author.level ?? undefined} />
  ) : (
    <span className={`grid h-9 w-9 place-items-center rounded-full text-xs font-semibold ${avatarTone(author.fullName)} ${ring}`} title={author.level ?? undefined}>
      {author.fullName.slice(0, 1).toUpperCase()}
    </span>
  );
}

function ComposerAvatar({ avatar, name }: { avatar?: string; name?: string }) {
  return avatar ? (
    <img src={avatar} alt={name || 'You'} className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-black/5" />
  ) : (
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">{(name || 'U').slice(0, 1)}</span>
  );
}

export function Feed({ currentUserId, currentUserAvatar, currentUserName }: { currentUserId?: string; currentUserAvatar?: string; currentUserName?: string }) {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [tags, setTags] = useState<FeedTag[]>([]);
  const [pollOptions, setPollOptions] = useState<string[] | null>(null);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');
  const [scope, setScope] = useState<FeedScope>('FORYOU');
  const [sortMode, setSortMode] = useState<FeedSort | undefined>(undefined);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  function insertEmoji(emoji: string) {
    const el = composerRef.current;
    const start = el?.selectionStart ?? draft.length;
    const end = el?.selectionEnd ?? draft.length;
    const next = draft.slice(0, start) + emoji + draft.slice(end);
    setDraft(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  }
  const [followed, setFollowed] = useState<Set<string>>(new Set());
  const [connected, setConnected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { connections } = await getConnections();
        if (!cancelled) setConnected(new Set(connections.map((c) => c.id)));
      } catch (err) {
        console.error('Failed to load connections for feed', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { communityIds } = await getFollowedCommunityIds();
        if (!cancelled) setFollowed(new Set(communityIds));
      } catch (err) {
        console.error('Failed to load followed communities for feed', err);
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
        const { posts: list, nextCursor } = await getFeed(undefined, scope, sortMode);
        if (!cancelled) {
          setPosts(list);
          setCursor(nextCursor);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load feed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scope, sortMode]);

  async function loadMore() {
    if (!cursor || loadingMore) return;
    try {
      setLoadingMore(true);
      const { posts: more, nextCursor } = await getFeed(cursor, scope, sortMode);
      setPosts((p) => [...p, ...more]);
      setCursor(nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load more');
    } finally {
      setLoadingMore(false);
    }
  }

  async function submitPost() {
    if (!draft.trim() && !image) return;
    const poll = pollOptions ? cleanPollOptions(pollOptions) : [];
    if (pollOptions && poll.length < MIN_POLL_OPTIONS) {
      setError('A poll needs at least two options');
      return;
    }
    try {
      setPosting(true);
      setError('');
      const { post } = await createPost(draft.trim(), { image, tags, poll: poll.length ? poll : undefined });
      setPosts((p) => [post, ...p]);
      setDraft('');
      setImage(null);
      setTags([]);
      setPollOptions(null);
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

  async function onConnect(userId: string) {
    await sendConnectionRequest(userId);
    setPending((prev) => new Set(prev).add(userId));
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-slate-950 dark:text-white">Campus feed</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Share progress, wins, questions, and opportunities with your network.</p>
          </div>
          <span className="rounded-full bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300">For students</span>
        </div>
      </div>

      <div data-tour="composer" className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm transition focus-within:border-indigo-300 dark:focus-within:border-indigo-700 focus-within:ring-2 focus-within:ring-indigo-100 dark:focus-within:ring-indigo-500/20">
        <div className="flex items-start gap-3">
          <ComposerAvatar avatar={currentUserAvatar} name={currentUserName} />
          <div className="min-w-0 flex-1">
            <MentionTextarea
              ref={composerRef}
              value={draft}
              onChange={setDraft}
              tags={tags}
              onTagsChange={setTags}
              placeholder="What are you working on?"
              rows={2}
              className="w-full resize-none border-0 bg-transparent p-0 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-0"
              onImagePaste={(file) => acceptImageFile(file, setImage)}
            />
          </div>
        </div>
        {image ? (
          <div className="mt-2 pl-[52px]">
            <ImagePreview image={image} setImage={setImage} />
          </div>
        ) : null}
        {pollOptions ? (
          <div className="pl-[52px]">
            <PollEditor options={pollOptions} onChange={setPollOptions} />
          </div>
        ) : null}
        <div className="mt-3 flex items-center gap-1 border-t border-slate-100 dark:border-slate-800 pl-[52px] pt-2">
          <PhotoButton setImage={setImage} />
          <PollToggleButton active={Boolean(pollOptions)} onClick={() => setPollOptions((cur) => (cur ? null : ['', '']))} />
          <EmojiPicker onSelect={insertEmoji} />
          <p className="ml-2 hidden truncate text-xs text-slate-400 dark:text-slate-500 sm:block">Tip: type @ to tag people or communities, or paste an image</p>
          <button
            onClick={() => void submitPost()}
            disabled={posting || (!draft.trim() && !image)}
            className="ml-auto shrink-0 rounded-full bg-indigo-600 px-5 py-1.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          >
            {posting ? 'Posting…' : 'Post'}
          </button>
        </div>
      </div>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/50 dark:text-red-300">{error}</div> : null}

      <div className="sticky top-[4.25rem] z-10 -mx-1 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-100/95 dark:bg-slate-950/95 px-3 py-2 backdrop-blur">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">View controls</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">{scope === 'FORYOU' ? 'Personalized' : 'Community-first'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button onClick={() => setScope('FORYOU')} className={`rounded-full px-3 py-1 text-xs font-medium ${scope === 'FORYOU' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'}`}>For you</button>
          <button onClick={() => setScope('COMMUNITIES')} className={`rounded-full px-3 py-1 text-xs font-medium ${scope === 'COMMUNITIES' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'}`}>My communities</button>
          <span className="mx-1 h-4 w-px bg-slate-200 dark:bg-slate-700" aria-hidden />
        {([
          { value: 'HOT' as const, label: 'Hot', title: 'Trending now — engagement weighted by recency' },
          { value: 'NEW' as const, label: 'New', title: 'Most recent first' },
          { value: 'TOP' as const, label: 'Top', title: 'Most liked & discussed this week' },
        ]).map((s) => (
          <button
            key={s.value}
            title={s.title}
            onClick={() => setSortMode((cur) => (cur === s.value ? undefined : s.value))}
            className={`rounded-full px-3 py-1 text-xs font-medium ${sortMode === s.value ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'}`}
          >
            {s.label}
          </button>
        ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-white dark:bg-slate-900" />)}</div>
      ) : posts.length ? (
        posts.map((post) => (
          <PostCard key={post.id} post={post} currentUserId={currentUserId} onPatch={patch} onDelete={(id) => setPosts((l) => l.filter((p) => p.id !== id))} isFollowing={post.author.id ? followed.has(post.author.id) : false} onToggleFollow={onToggleFollow} isConnected={post.author.id ? connected.has(post.author.id) : false} isPending={post.author.id ? pending.has(post.author.id) : false} onConnect={onConnect} />
        ))
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center text-sm text-slate-500 dark:text-slate-400">No posts yet. Be the first to share something.</div>
      )}

      {!loading && cursor ? (
        <div className="flex justify-center pt-1">
          <button
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 transition hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60"
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function renderPostContent(content: string, tags: FeedPost['tags']) {
  if (!content) return content;
  const withLinks = (text: string, keyBase: string) => {
    const urls = text.match(POST_URL_PATTERN);
    if (!urls) return <span key={keyBase}>{text}</span>;
    const parts = text.split(POST_URL_PATTERN);
    const nodes: React.ReactNode[] = [];
    parts.forEach((part, i) => {
      if (part) nodes.push(<span key={`${keyBase}-t${i}`}>{part}</span>);
      if (urls[i]) {
        nodes.push(
          <a key={`${keyBase}-u${i}`} href={urls[i]} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="break-all text-indigo-600 underline underline-offset-2 hover:text-indigo-500">
            {urls[i]}
          </a>,
        );
      }
    });
    return <span key={keyBase}>{nodes}</span>;
  };
  if (!tags?.length) return withLinks(content, 'c');
  const tokens = tags
    .map((t) => ({ token: `@${t.type === 'COMMUNITY' ? t.label : t.handle || t.label}`, tag: t }))
    .filter((x) => x.token.length > 1)
    .sort((a, b) => b.token.length - a.token.length);
  if (!tokens.length) return withLinks(content, 'c');
  const re = new RegExp(`(${tokens.map((x) => x.token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');
  return content.split(re).map((part, i) => {
    const hit = tokens.find((x) => x.token === part);
    if (!hit) return withLinks(part, `p${i}`);
    const t = hit.tag;
    const href = t.type === 'COMMUNITY' ? `/communities/${encodeURIComponent(t.handle)}` : t.handle ? `/u/${encodeURIComponent(t.handle)}` : '#';
    return (
      <Link key={i} href={href} className="font-semibold text-indigo-600 hover:underline">
        {part}
      </Link>
    );
  });
}

const POST_URL_PATTERN = /https?:\/\/[^\s<>"')\]]+/g;

function CertificateMilestoneCard({ certificate }: { certificate: NonNullable<FeedPost['certificate']> }) {
  const accent = /^#[0-9a-fA-F]{6}$/.test(certificate.accent) ? certificate.accent : '#b48b2e';
  const title = TYPE_LABEL[certificate.type] ?? 'Certificate';
  return (
    <Link
      href={`/certificates/${encodeURIComponent(certificate.serial)}`}
      className="mt-3 block overflow-hidden rounded-xl border-2 bg-gradient-to-br from-amber-50/70 via-white to-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      style={{ borderColor: accent }}
    >
      <div className="px-5 py-4 text-center">
        <div className="mx-auto grid h-10 w-10 place-items-center rounded-full text-white shadow" style={{ backgroundColor: accent }}><GraduationCap className="h-5 w-5" /></div>
        <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.25em]" style={{ color: accent }}>{title}</p>
        <p className="mt-1.5 font-serif text-lg font-semibold italic text-slate-900">{certificate.attendeeName}</p>
        <p className="mt-1 text-sm font-medium text-slate-700">{certificate.eventTitle}</p>
        <p className="text-xs text-slate-500">{certificate.communityName}{certificate.eventDate ? ` · ${new Date(certificate.eventDate).toLocaleDateString('en-NG', { month: 'short', year: 'numeric' })}` : ''}</p>
      </div>
      <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-4 py-2">
        <span className="font-mono text-[11px] text-slate-400">{certificate.serial}</span>
        <span className="text-xs font-semibold" style={{ color: accent }}>View verified certificate →</span>
      </div>
    </Link>
  );
}

export function PostCard({
  post,
  currentUserId,
  onPatch,
  onDelete,
  isFollowing,
  onToggleFollow,
  isConnected,
  isPending,
  onConnect,
  canPin = false,
  onTogglePin,
  defaultShowComments = false,
  disableDetailNavigation = false,
}: {
  post: FeedPost;
  currentUserId?: string;
  onPatch: (id: string, u: (p: FeedPost) => FeedPost) => void;
  onDelete: (id: string) => void;
  isFollowing?: boolean;
  onToggleFollow?: (communityId: string) => Promise<void> | void;
  isConnected?: boolean;
  isPending?: boolean;
  onConnect?: (userId: string) => Promise<void> | void;
  canPin?: boolean;
  onTogglePin?: (postId: string, pinned: boolean) => Promise<void> | void;
  defaultShowComments?: boolean;
  disableDetailNavigation?: boolean;
}) {
  const router = useRouter();
  const [showComments, setShowComments] = useState(defaultShowComments);
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [commentDraft, setCommentDraft] = useState('');
  const [replyTo, setReplyTo] = useState<FeedComment | null>(null);
  const [loadingComments, setLoadingComments] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [connectBusy, setConnectBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(post.content);
  const [editBusy, setEditBusy] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [justLiked, setJustLiked] = useState(false);
  const isMilestone = post.kind === 'MILESTONE';
  const isCommunity = post.author.isCommunity;
  const mine = currentUserId && post.author.id === currentUserId;

  useEffect(() => {
    if (!defaultShowComments || comments.length || loadingComments) return;
    void loadComments();
  }, [defaultShowComments]);

  function openDetail(event: React.MouseEvent<HTMLElement>) {
    if (disableDetailNavigation) return;
    const target = event.target as HTMLElement;
    if (target.closest('a,button,input,textarea')) return;
    router.push(`/posts/${encodeURIComponent(post.id)}`);
  }

  async function connect() {
    if (!onConnect || !post.author.id) return;
    try {
      setConnectBusy(true);
      await onConnect(post.author.id);
    } finally {
      setConnectBusy(false);
    }
  }

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
    if (liked) {
      setJustLiked(true);
      setTimeout(() => setJustLiked(false), 500);
    }
  }

  async function loadComments() {
    if (comments.length || loadingComments) return;
    setLoadingComments(true);
    try {
      const { comments: list } = await getPostComments(post.id);
      setComments(list);
    } finally {
      setLoadingComments(false);
    }
  }

  async function openComments() {
    const next = !showComments;
    setShowComments(next);
    if (!next) return;
    await loadComments();
  }

  async function submitComment() {
    if (!commentDraft.trim()) return;
    const { comment } = await addPostComment(post.id, commentDraft.trim(), replyTo?.id ?? null);
    if (comment.parentId) {
      setComments((list) => list.map((c) => (c.id === comment.parentId ? { ...c, replies: [...(c.replies ?? []), comment] } : c)));
    } else {
      setComments((c) => [...c, comment]);
    }
    setCommentDraft('');
    setReplyTo(null);
    onPatch(post.id, (p) => ({ ...p, commentCount: p.commentCount + 1 }));
  }

  async function remove() {
    const ok = await confirmDialog({ title: 'Delete this post?', message: 'This will permanently remove your post.', confirmLabel: 'Delete', tone: 'danger' });
    if (!ok) return;
    try {
      await deletePost(post.id);
      onDelete(post.id);
      toast.success('Post deleted');
    } catch (err) {
      toast.error('Unable to delete post', err instanceof Error ? err.message : undefined);
    }
  }

  async function saveEdit() {
    if (!editDraft.trim()) return;
    try {
      setEditBusy(true);
      const { post: updated } = await editPost(post.id, editDraft.trim());
      onPatch(post.id, (p) => ({ ...p, content: updated.content }));
      setEditing(false);
      toast.success('Post updated');
    } catch (err) {
      toast.error('Unable to edit post', err instanceof Error ? err.message : undefined);
    } finally {
      setEditBusy(false);
    }
  }

  async function reportPost() {
    const reason = await promptDialog({ title: 'Report this post', message: 'Tell us what is wrong with it (optional).', placeholder: 'Reason (optional)', confirmLabel: 'Report' });
    if (reason === null) return;
    try {
      const { already } = await reportContent('POST', post.id, reason);
      if (already) toast.info('Already reported', 'You have already reported this post.');
      else toast.success('Thanks for reporting', 'Our team will review this post.');
    } catch (err) {
      toast.error('Unable to submit report', err instanceof Error ? err.message : undefined);
    }
  }

  async function reportComment(commentId: string) {
    const reason = await promptDialog({ title: 'Report this comment', message: 'Tell us what is wrong with it (optional).', placeholder: 'Reason (optional)', confirmLabel: 'Report' });
    if (reason === null) return;
    try {
      const { already } = await reportContent('COMMENT', commentId, reason);
      if (already) toast.info('Already reported', 'You have already reported this comment.');
      else toast.success('Thanks for reporting', 'Our team will review this comment.');
    } catch (err) {
      toast.error('Unable to submit report', err instanceof Error ? err.message : undefined);
    }
  }

  return (
    <article onClick={openDetail} className={`relative overflow-hidden rounded-2xl border shadow-sm transition hover:shadow-md ${disableDetailNavigation ? '' : 'cursor-pointer'} ${isCommunity ? 'border-sky-200 dark:border-sky-500/30 bg-white dark:bg-slate-900' : isMilestone ? 'border-amber-200 dark:border-amber-500/30 bg-gradient-to-br from-amber-50/50 via-white to-white dark:from-amber-500/10 dark:via-slate-900 dark:to-slate-900' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'}`}>
      <span className={`absolute inset-y-0 left-0 w-1 ${isCommunity ? 'bg-sky-400' : isMilestone ? 'bg-amber-400' : 'bg-indigo-300'}`} aria-hidden />
      {post.pinned ? (
        <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-500/10 px-4 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300"><Pin className="h-3 w-3" /> Pinned</div>
      ) : null}
      {isCommunity ? (
        <div className="flex items-center gap-1.5 bg-sky-50 dark:bg-sky-500/10 px-4 py-1.5 text-xs font-semibold text-sky-700 dark:text-sky-300"><Megaphone className="h-3 w-3" /> Community announcement</div>
      ) : isMilestone ? (
        <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-500/10 px-4 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300"><GraduationCap className="h-3 w-3" /> Milestone</div>
      ) : null}
      <div className="p-4">
      <div className="flex items-start gap-3">
        <Avatar author={post.author} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <Link href={post.author.isCommunity ? (post.author.username ? `/communities/${encodeURIComponent(post.author.username)}` : '#') : post.author.username ? `/u/${encodeURIComponent(post.author.username)}` : '#'} className="text-sm font-semibold text-slate-900 dark:text-slate-100 hover:underline">{post.author.fullName}{post.author.isCommunity ? <span className="ml-1 align-middle text-xs font-normal text-indigo-500">· Community</span> : null}</Link>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{post.author.headline || 'Student'} · {timeAgo(post.createdAt)}{post.communityName ? ` · ${post.communityName}` : ''}</p>
            </div>
            {mine ? (
              <div className="flex shrink-0 items-center gap-1">
                {!isMilestone ? (
                  <button onClick={() => { setEditDraft(post.content); setEditing(true); }} className="text-slate-300 hover:text-indigo-500" title="Edit"><Pencil className="h-4 w-4" /></button>
                ) : null}
                <button onClick={() => void remove()} className="text-slate-300 hover:text-rose-500" title="Delete"><Trash2 className="h-4 w-4" /></button>
              </div>
            ) : isCommunity && onToggleFollow && post.author.id ? (
              <button onClick={() => void follow()} disabled={followBusy} className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${isFollowing ? 'border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400' : 'bg-sky-600 text-white'} disabled:opacity-50`}>{isFollowing ? 'Following' : 'Follow'}</button>
            ) : !isCommunity && onConnect && post.author.id && !isConnected ? (
              <button onClick={() => void connect()} disabled={connectBusy || isPending} className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${isPending ? 'border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400' : 'border border-indigo-200 bg-white dark:bg-slate-900 text-indigo-700 hover:bg-indigo-50'} disabled:opacity-60`}>{isPending ? 'Requested' : '+ Connect'}</button>
            ) : null}
          </div>
          {editing ? (
            <div className="mt-2">
              <textarea
                value={editDraft}
                onChange={(e) => setEditDraft(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
              <div className="mt-1.5 flex justify-end gap-2">
                <button onClick={() => setEditing(false)} className="rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800">Cancel</button>
                <button onClick={() => void saveEdit()} disabled={editBusy || !editDraft.trim()} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">{editBusy ? 'Saving…' : 'Save'}</button>
              </div>
            </div>
          ) : (
            <>
              <p className={`mt-2 whitespace-pre-line text-sm ${isMilestone ? 'font-medium text-slate-800 dark:text-slate-200' : 'text-slate-700 dark:text-slate-300'}`}>{renderPostContent(post.content, post.tags)}</p>
              {(() => {
                const link = firstPreviewableLink(post.content ?? '');
                return link ? <div className="mt-2 max-w-md"><MessageLinkPreview path={link.path} /></div> : null;
              })()}
            </>
          )}
          {post.certificate ? <CertificateMilestoneCard certificate={post.certificate} /> : null}
          {post.poll ? <PostPoll post={post} onPatch={onPatch} /> : null}
          {post.imageUrl ? (
            <img
              src={resolveFeedImage(post.imageUrl)}
              alt=""
              onClick={(event) => {
                event.stopPropagation();
                setPreviewImage(resolveFeedImage(post.imageUrl));
              }}
              className="mt-3 max-h-[28rem] w-full cursor-zoom-in rounded-xl border border-slate-200 dark:border-slate-800 object-cover"
            />
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-4 border-t border-slate-100 pt-2 text-xs text-slate-500 dark:text-slate-400">
        <button onClick={() => void like()} className={`relative flex items-center gap-1.5 ${post.liked ? 'text-rose-600' : 'hover:text-slate-800'}`}>
          {justLiked ? <span className="absolute -left-1 -top-1 h-6 w-6 rounded-full border-2 border-rose-400 animate-heart-ring" aria-hidden /> : null}
          <Heart className={`h-4 w-4 ${post.liked ? 'fill-rose-600' : ''} ${justLiked ? 'animate-heart-pop' : ''}`} />
          {post.likeCount > 0 ? `${post.likeCount} Like` : 'Be the first to react'}
        </button>
        <button onClick={() => void openComments()} className="flex items-center gap-1.5 hover:text-slate-800">
          <MessageCircle className="h-4 w-4" />
          {post.commentCount > 0 ? `${post.commentCount} Comment` : 'Start the conversation'}
        </button>
        {canPin && post.communityId && onTogglePin ? (
          <button onClick={() => void onTogglePin(post.id, !post.pinned)} className={`flex items-center gap-1.5 ${post.pinned ? 'text-amber-600' : 'hover:text-slate-800'}`} title={post.pinned ? 'Unpin from top' : 'Pin to top'}>
            <Pin className={`h-4 w-4 ${post.pinned ? 'fill-amber-500' : ''}`} /> {post.pinned ? 'Unpin' : 'Pin'}
          </button>
        ) : null}
        {!mine && !isCommunity ? (
          <button onClick={() => void reportPost()} className="ml-auto flex items-center gap-1.5 hover:text-rose-600" title="Report post">
            <Flag className="h-4 w-4" /> Report
          </button>
        ) : null}
      </div>

      {showComments ? (
        <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
          {loadingComments ? (
            <p className="text-xs text-slate-400 dark:text-slate-500">Loading…</p>
          ) : comments.length ? (
            comments.map((c) => (
              <div key={c.id} className="space-y-2">
                <div className="flex items-start gap-2">
                  <Avatar author={c.author} />
                  <div className="min-w-0">
                    <div className="group rounded-2xl bg-slate-50 dark:bg-slate-900 px-3 py-2">
                      <p className="text-xs font-medium text-slate-900 dark:text-slate-100">{c.author.fullName} <span className="ml-1 font-normal text-slate-400 dark:text-slate-500">{timeAgo(c.createdAt)}</span>
                        {currentUserId && c.author.id !== currentUserId ? (
                          <button onClick={() => void reportComment(c.id)} className="ml-2 align-middle text-[11px] font-normal text-slate-300 hover:text-rose-500" title="Report comment">Report</button>
                        ) : null}
                      </p>
                      <p className="text-sm text-slate-700 dark:text-slate-300">{c.content}</p>
                    </div>
                    <button onClick={() => setReplyTo(c)} className="ml-3 mt-0.5 text-[11px] font-medium text-slate-400 dark:text-slate-500 hover:text-indigo-600">Reply</button>
                  </div>
                </div>
                {(c.replies ?? []).length ? (
                  <div className="ml-8 space-y-2 border-l-2 border-slate-100 pl-3">
                    {c.replies!.map((r) => (
                      <div key={r.id} className="flex items-start gap-2">
                        <Avatar author={r.author} />
                        <div className="min-w-0">
                          <div className="group rounded-2xl bg-slate-50 dark:bg-slate-900 px-3 py-2">
                            <p className="text-xs font-medium text-slate-900 dark:text-slate-100">{r.author.fullName} <span className="ml-1 font-normal text-slate-400 dark:text-slate-500">{timeAgo(r.createdAt)}</span>
                              {currentUserId && r.author.id !== currentUserId ? (
                                <button onClick={() => void reportComment(r.id)} className="ml-2 align-middle text-[11px] font-normal text-slate-300 hover:text-rose-500" title="Report comment">Report</button>
                              ) : null}
                            </p>
                            <p className="text-sm text-slate-700 dark:text-slate-300">{r.content}</p>
                          </div>
                          <button onClick={() => setReplyTo(c)} className="ml-3 mt-0.5 text-[11px] font-medium text-slate-400 dark:text-slate-500 hover:text-indigo-600">Reply</button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-400 dark:text-slate-500">No comments yet.</p>
          )}
          {replyTo ? (
            <div className="flex items-center gap-2 rounded-xl bg-indigo-50 px-3 py-1.5 text-xs text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
              Replying to <span className="font-semibold">{replyTo.author.fullName}</span>
              <button onClick={() => setReplyTo(null)} className="ml-auto text-indigo-400 hover:text-indigo-700" title="Cancel reply"><X className="h-3.5 w-3.5" /></button>
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <input value={commentDraft} onChange={(e) => setCommentDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void submitComment(); }} placeholder={replyTo ? `Reply to ${replyTo.author.fullName}…` : 'Write a comment…'} className="flex-1 rounded-full border border-slate-200 dark:border-slate-800 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            <button onClick={() => void submitComment()} className="rounded-full bg-slate-900 p-2 text-white"><Send className="h-4 w-4" /></button>
          </div>
        </div>
      ) : null}
      {previewImage ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={(event) => {
            event.stopPropagation();
            setPreviewImage(null);
          }}
        >
          <button
            onClick={(event) => {
              event.stopPropagation();
              setPreviewImage(null);
            }}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label="Close image preview"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={previewImage}
            alt="Post image preview"
            className="max-h-[90vh] w-auto max-w-[95vw] rounded-xl object-contain"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      ) : null}
      </div>
    </article>
  );
}
