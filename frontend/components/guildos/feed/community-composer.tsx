'use client';

import { useRef, useState } from 'react';
import { createCommunityPost, type FeedPost, type FeedTag } from '../feed-api';
import { ImagePreview, PhotoButton, acceptImageFile } from './post-attachments';
import { EmojiPicker } from './emoji-picker';
import { MentionTextarea } from './mention-textarea';
import { PollEditor, PollToggleButton, MIN_POLL_OPTIONS, cleanPollOptions } from './post-poll';

export function CommunityComposer({ communityId, communityName, onPosted }: { communityId: string; communityName: string; onPosted?: (post: FeedPost) => void }) {
  const [draft, setDraft] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [tags, setTags] = useState<FeedTag[]>([]);
  const [pollOptions, setPollOptions] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
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

  async function post() {
    if (!draft.trim() && !image) return;
    const poll = pollOptions ? cleanPollOptions(pollOptions) : [];
    if (pollOptions && poll.length < MIN_POLL_OPTIONS) {
      setError('A poll needs at least two options');
      return;
    }
    try {
      setBusy(true);
      setError('');
      const { post: created } = await createCommunityPost(communityId, draft.trim(), { image, tags, poll: poll.length ? poll : undefined });
      setDraft('');
      setImage(null);
      setTags([]);
      setPollOptions(null);
      setNotice('Announcement posted to the feed.');
      onPosted?.(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to post announcement');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-6 rounded-3xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/50 dark:bg-slate-900 p-4 shadow-sm">
      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Post an announcement as {communityName}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">Shared to the GuildOS feed for members and followers.</p>
      <MentionTextarea
        ref={composerRef}
        value={draft}
        onChange={setDraft}
        tags={tags}
        onTagsChange={setTags}
        placeholder={`What's the update for ${communityName}?`}
        rows={2}
        className="mt-2 w-full resize-none rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-500/30"
        onImagePaste={(file) => acceptImageFile(file, setImage)}
      />
      {image ? (
        <div className="mt-2">
          <ImagePreview image={image} setImage={setImage} />
        </div>
      ) : null}
      {pollOptions ? <PollEditor options={pollOptions} onChange={setPollOptions} /> : null}
      <div className="mt-1 flex items-center gap-1">
        <PhotoButton setImage={setImage} />
        <PollToggleButton active={Boolean(pollOptions)} onClick={() => setPollOptions((cur) => (cur ? null : ['', '']))} />
        <EmojiPicker onSelect={insertEmoji} />
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
