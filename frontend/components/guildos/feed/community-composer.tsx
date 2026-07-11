'use client';

import { useState } from 'react';
import { createCommunityPost, type FeedPost, type FeedTag } from '../feed-api';
import { PostAttachments } from './post-attachments';
import { MentionTextarea } from './mention-textarea';

export function CommunityComposer({ communityId, communityName, onPosted }: { communityId: string; communityName: string; onPosted?: (post: FeedPost) => void }) {
  const [draft, setDraft] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [tags, setTags] = useState<FeedTag[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function post() {
    if (!draft.trim() && !image) return;
    try {
      setBusy(true);
      setError('');
      const { post: created } = await createCommunityPost(communityId, draft.trim(), { image, tags });
      setDraft('');
      setImage(null);
      setTags([]);
      setNotice('Announcement posted to the feed.');
      onPosted?.(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to post announcement');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-6 rounded-3xl border border-indigo-200 bg-indigo-50/50 p-4 shadow-sm">
      <p className="text-sm font-semibold text-slate-900">Post an announcement as {communityName}</p>
      <p className="text-xs text-slate-500">Shared to the GuildOS feed for members and followers.</p>
      <MentionTextarea
        value={draft}
        onChange={setDraft}
        tags={tags}
        onTagsChange={setTags}
        placeholder="Share an update… type @ to tag people or communities"
        rows={2}
        className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
      />
      <div className="mt-2">
        <PostAttachments image={image} setImage={setImage} />
      </div>
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
      {notice ? <p className="mt-1 text-xs text-emerald-600">{notice}</p> : null}
      <div className="mt-2 flex justify-end">
        <button onClick={() => void post()} disabled={busy || (!draft.trim() && !image)} className="rounded-xl bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50">
          {busy ? 'Posting…' : 'Post announcement'}
        </button>
      </div>
    </div>
  );
}
