'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Flag, MessageSquare, ShieldCheck, Trash2 } from 'lucide-react';

import { getCurrentUser } from '../../../components/guildos/auth-api';
import {
  getCommunityModerationReports,
  getManagedCommunities,
  moderateCommunityComment,
  moderateCommunityPost,
  type CommunitySummary,
  type ReportedComment,
  type ReportedPost,
} from '../../../components/guildos/community-list-api';
import { DashboardShell } from '../../../components/guildos/dashboard-shell';
import { DashboardSidebar } from '../../../components/guildos/dashboard-sidebar';
import { DashboardTopbar } from '../../../components/guildos/dashboard-topbar';
import { LogoSpinner } from '../../../components/guildos/ui/loading';
import { SelectMenu } from '../../../components/guildos/ui/select-menu';
import { toast } from '../../../components/guildos/ui/toast';
import { confirmDialog } from '../../../components/guildos/ui/confirm-dialog';

function timeAgo(value: string) {
  const secs = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(value).toLocaleDateString();
}

export default function ModerationPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [communities, setCommunities] = useState<CommunitySummary[]>([]);
  const [communityId, setCommunityId] = useState('');
  const [posts, setPosts] = useState<ReportedPost[]>([]);
  const [comments, setComments] = useState<ReportedComment[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [busyId, setBusyId] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const user = await getCurrentUser();
        if (!user) {
          window.location.href = '/login';
          return;
        }
        const response = await getManagedCommunities();
        const verified = response.communities.filter((c) => c.verificationStatus === 'VERIFIED');
        setCommunities(verified);
        if (verified.length) setCommunityId(verified[0]._id);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load communities');
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, []);

  useEffect(() => {
    if (!communityId) {
      setPosts([]);
      setComments([]);
      return;
    }
    let cancelled = false;
    setQueueLoading(true);
    void (async () => {
      try {
        const result = await getCommunityModerationReports(communityId);
        if (!cancelled) {
          setPosts(result.posts);
          setComments(result.comments);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load reports');
      } finally {
        if (!cancelled) setQueueLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [communityId]);

  async function handlePost(post: ReportedPost, action: 'REMOVE' | 'DISMISS') {
    if (action === 'REMOVE') {
      const ok = await confirmDialog({ title: 'Hide this post?', message: 'The post will no longer be visible to members. Reports on it will be marked as actioned.', confirmLabel: 'Hide post', tone: 'danger' });
      if (!ok) return;
    }
    try {
      setBusyId(post.id);
      await moderateCommunityPost(communityId, post.id, action);
      setPosts((list) => list.filter((p) => p.id !== post.id));
      toast.success(action === 'REMOVE' ? 'Post hidden' : 'Reports dismissed');
    } catch (err) {
      toast.error('Unable to moderate post', err instanceof Error ? err.message : undefined);
    } finally {
      setBusyId('');
    }
  }

  async function handleComment(comment: ReportedComment, action: 'REMOVE' | 'DISMISS') {
    if (action === 'REMOVE') {
      const ok = await confirmDialog({ title: 'Delete this comment?', message: 'The comment will be permanently removed. Reports on it will be marked as actioned.', confirmLabel: 'Delete comment', tone: 'danger' });
      if (!ok) return;
    }
    try {
      setBusyId(comment.id);
      await moderateCommunityComment(communityId, comment.id, action);
      setComments((list) => list.filter((c) => c.id !== comment.id));
      toast.success(action === 'REMOVE' ? 'Comment removed' : 'Reports dismissed');
    } catch (err) {
      toast.error('Unable to moderate comment', err instanceof Error ? err.message : undefined);
    } finally {
      setBusyId('');
    }
  }

  if (isLoading) {
    return (
      <DashboardShell sidebar={<DashboardSidebar />} topbar={<DashboardTopbar />}>
        <div className="grid min-h-[40vh] place-items-center"><LogoSpinner /></div>
      </DashboardShell>
    );
  }

  const empty = !queueLoading && !posts.length && !comments.length;

  return (
    <DashboardShell sidebar={<DashboardSidebar />} topbar={<DashboardTopbar />}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-950"><ShieldCheck className="h-6 w-6 text-indigo-500" /> Moderation</h1>
            <p className="mt-1 text-sm text-slate-500">Review reported posts and comments in your communities.</p>
          </div>
          {communities.length > 1 ? (
            <SelectMenu
              aria-label="Community"
              className="w-56"
              value={communityId}
              onChange={setCommunityId}
              options={communities.map((c) => ({ value: c._id, label: c.name }))}
            />
          ) : null}
        </div>

        {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

        {!communities.length ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">You don't manage any verified communities yet.</div>
        ) : queueLoading ? (
          <div className="space-y-3">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-white" />)}</div>
        ) : empty ? (
          <div className="rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/40 p-8 text-center text-sm text-emerald-700">
            All clear — no pending reports in this community.
          </div>
        ) : (
          <div className="space-y-6">
            {posts.length ? (
              <section className="space-y-3">
                <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500"><Flag className="h-4 w-4" /> Reported posts ({posts.length})</h2>
                {posts.map((post) => (
                  <article key={post.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs text-slate-500">
                          <span className="font-semibold text-slate-800">{post.author.fullName}</span> · posted {timeAgo(post.createdAt)} · last reported {timeAgo(post.lastReportedAt)}
                        </p>
                        <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{post.content || '(image post)'}</p>
                        {post.reasons.length ? (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {post.reasons.map((r, i) => (
                              <span key={i} className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-600">{r}</span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <span className="shrink-0 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-700">{post.reportCount} {post.reportCount === 1 ? 'report' : 'reports'}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                      <button onClick={() => void handlePost(post, 'REMOVE')} disabled={busyId === post.id} className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /> Hide post</button>
                      <button onClick={() => void handlePost(post, 'DISMISS')} disabled={busyId === post.id} className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-50">Dismiss reports</button>
                      <Link href={`/posts/${encodeURIComponent(post.id)}`} className="ml-auto text-xs font-medium text-indigo-600 hover:underline">View post →</Link>
                    </div>
                  </article>
                ))}
              </section>
            ) : null}

            {comments.length ? (
              <section className="space-y-3">
                <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500"><MessageSquare className="h-4 w-4" /> Reported comments ({comments.length})</h2>
                {comments.map((comment) => (
                  <article key={comment.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs text-slate-500">
                          <span className="font-semibold text-slate-800">{comment.author.fullName}</span> · commented {timeAgo(comment.createdAt)} · last reported {timeAgo(comment.lastReportedAt)}
                        </p>
                        <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{comment.content}</p>
                        {comment.reasons.length ? (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {comment.reasons.map((r, i) => (
                              <span key={i} className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-600">{r}</span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <span className="shrink-0 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-700">{comment.reportCount} {comment.reportCount === 1 ? 'report' : 'reports'}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                      <button onClick={() => void handleComment(comment, 'REMOVE')} disabled={busyId === comment.id} className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /> Delete comment</button>
                      <button onClick={() => void handleComment(comment, 'DISMISS')} disabled={busyId === comment.id} className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-50">Dismiss reports</button>
                      <Link href={`/posts/${encodeURIComponent(comment.postId)}`} className="ml-auto text-xs font-medium text-indigo-600 hover:underline">View post →</Link>
                    </div>
                  </article>
                ))}
              </section>
            ) : null}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
