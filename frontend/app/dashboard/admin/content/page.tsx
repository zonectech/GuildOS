'use client';

import { useEffect, useState } from 'react';
import { Loader2, Flag, Trash2, Check } from 'lucide-react';

import {
  getContentReports,
  moderatePost,
  moderateComment,
  type ReportedPost,
  type ReportedComment,
} from '../../../../components/guildos/admin-api';
import { Loading } from '../../../../components/guildos/ui/loading';

export default function ContentModerationPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [posts, setPosts] = useState<ReportedPost[]>([]);
  const [comments, setComments] = useState<ReportedComment[]>([]);

  async function load() {
    const { posts: p, comments: c } = await getContentReports();
    setPosts(p);
    setComments(c);
  }

  useEffect(() => {
    void (async () => {
      try {
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load reports');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function actPost(id: string, action: 'remove' | 'dismiss') {
    try {
      await moderatePost(id, action);
      setPosts((list) => list.filter((p) => p.id !== id));
      setNotice(action === 'remove' ? 'Post removed.' : 'Reports dismissed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    }
  }

  async function actComment(id: string, action: 'remove' | 'dismiss') {
    try {
      await moderateComment(id, action);
      setComments((list) => list.filter((c) => c.id !== id));
      setNotice(action === 'remove' ? 'Comment removed.' : 'Reports dismissed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    }
  }

  if (loading) {
    return <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-sm"><Loading /></div>;
  }

  const total = posts.length + comments.length;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-950 dark:text-white"><Flag className="h-6 w-6" /> Content moderation</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Review posts and comments reported by the community. Remove content that breaks the rules or dismiss the reports.</p>
      </header>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/50 dark:text-red-300">{error}</div> : null}
      {notice ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-950/50 dark:text-emerald-300">{notice}</div> : null}

      {total === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-sm text-slate-500 dark:text-slate-400">Nothing reported right now.</p>
      ) : null}

      {posts.length ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Reported posts ({posts.length})</h2>
          {posts.map((p) => (
            <div key={p.id} className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700"><Flag className="h-3 w-3" /> {p.reportCount} report{p.reportCount === 1 ? '' : 's'}</span>
                  <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">{p.author.fullName} <span className="font-normal text-slate-400 dark:text-slate-500">@{p.author.username || '—'}</span></p>
                  <p className="mt-1 whitespace-pre-line text-sm text-slate-700 dark:text-slate-300">{p.content || <span className="text-slate-400 dark:text-slate-500">(no text)</span>}</p>
                  {p.reasons.length ? <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Reasons: {p.reasons.filter(Boolean).join(' · ') || '—'}</p> : null}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button onClick={() => void actPost(p.id, 'remove')} className="inline-flex items-center gap-1.5 rounded-2xl bg-rose-600 px-4 py-2 text-sm font-medium text-white"><Trash2 className="h-4 w-4" /> Remove</button>
                  <button onClick={() => void actPost(p.id, 'dismiss')} className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400"><Check className="h-4 w-4" /> Dismiss</button>
                </div>
              </div>
            </div>
          ))}
        </section>
      ) : null}

      {comments.length ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Reported comments ({comments.length})</h2>
          {comments.map((c) => (
            <div key={c.id} className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700"><Flag className="h-3 w-3" /> {c.reportCount} report{c.reportCount === 1 ? '' : 's'}</span>
                  <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">{c.author.fullName} <span className="font-normal text-slate-400 dark:text-slate-500">@{c.author.username || '—'}</span></p>
                  <p className="mt-1 whitespace-pre-line text-sm text-slate-700 dark:text-slate-300">{c.content}</p>
                  {c.reasons.length ? <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Reasons: {c.reasons.filter(Boolean).join(' · ') || '—'}</p> : null}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button onClick={() => void actComment(c.id, 'remove')} className="inline-flex items-center gap-1.5 rounded-2xl bg-rose-600 px-4 py-2 text-sm font-medium text-white"><Trash2 className="h-4 w-4" /> Remove</button>
                  <button onClick={() => void actComment(c.id, 'dismiss')} className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400"><Check className="h-4 w-4" /> Dismiss</button>
                </div>
              </div>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}
