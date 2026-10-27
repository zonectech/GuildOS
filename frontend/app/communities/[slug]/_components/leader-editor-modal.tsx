'use client';

import { useState } from 'react';
import { Camera, XCircle } from 'lucide-react';

import { searchPeople, type PersonResult } from '../../../../components/guildos/auth-api';
import {
  addCommunityLeader, resolveAvatarUrl, updateCommunityLeader, uploadLeaderPhoto,
  type CommunityLeader,
} from '../../../../components/guildos/community-list-api';
import { MemberAvatar } from './leader-ui';
import { validateSessionLabel } from './session-label';

type LinkedUser = NonNullable<CommunityLeader['linkedUser']>;

const INPUT_CLASS = 'mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100';

/**
 * Add / edit a curated leadership-roster entry. Mount it fresh for each open (the form
 * state is seeded from `leader` once): pass `leader` to edit, omit it to add.
 */
export function LeaderEditorModal({
  communityId,
  leader,
  defaultSession = '',
  sessionSuggestions,
  onClose,
  onSaved,
  onPreviewPhoto,
}: {
  communityId: string;
  leader?: CommunityLeader | null;
  /** Pre-fills the session field when adding. */
  defaultSession?: string;
  sessionSuggestions: string[];
  onClose: () => void;
  /** Refresh the roster; the modal closes once this resolves. */
  onSaved: () => Promise<void>;
  onPreviewPhoto: (src: string, alt: string) => void;
}) {
  const [form, setForm] = useState(() => ({
    name: leader?.name ?? '',
    title: leader?.title ?? '',
    session: leader ? leader.session : defaultSession,
    bio: leader?.bio ?? '',
    phone: leader?.phone ?? '',
    department: leader?.department ?? '',
    level: leader?.level ?? '',
    displayRank: leader?.displayRank !== null && leader?.displayRank !== undefined ? String(leader.displayRank) : '',
  }));
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState(leader?.photo ? resolveAvatarUrl(leader.photo) : '');
  const [photoCleared, setPhotoCleared] = useState(false);
  // Raw `/uploads/...` path reused directly from a tagged GuildOS account's own avatar — no
  // re-upload needed. Cleared as soon as the admin uploads their own file instead.
  const [photoFromAvatar, setPhotoFromAvatar] = useState('');
  const [linkedUser, setLinkedUser] = useState<LinkedUser | null>(leader?.linkedUser ?? null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PersonResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSearch(q: string) {
    setSearchQuery(q);
    if (q.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const { people } = await searchPeople(q.trim());
      setSearchResults(people);
    } catch {
      /* typeahead is best-effort */
    }
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }

    // Only re-validate the session format/range when it's actually changing — leaving an
    // existing leader's untouched, legitimately-historical session alone should never fail.
    if (form.session.trim() !== (leader?.session ?? '')) {
      const sessionError = validateSessionLabel(form.session);
      if (sessionError) {
        setError(sessionError);
        return;
      }
    }

    try {
      setBusy(true);
      setError('');

      let photo = '';
      if (photoFile) {
        const uploaded = await uploadLeaderPhoto(photoFile);
        photo = uploaded.photo;
      } else if (photoFromAvatar) {
        photo = photoFromAvatar;
      } else if (!photoCleared && leader) {
        photo = leader.photo ?? '';
      }

      const input = {
        name: form.name.trim(),
        title: form.title.trim(),
        session: form.session.trim(),
        bio: form.bio.trim(),
        photo,
        phone: form.phone.trim(),
        department: form.department.trim(),
        level: form.level.trim(),
        displayRank: form.displayRank.trim() === '' ? null : Number(form.displayRank),
        linkedUserId: linkedUser?.id ?? null,
      };

      if (leader) {
        await updateCommunityLeader(communityId, leader.id, input);
      } else {
        await addCommunityLeader(communityId, input);
      }

      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save leader');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{leader ? 'Edit leader' : 'Add leader'}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 dark:text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600">
            <XCircle className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">List anyone on your leadership team. They don't need a GuildOS account.</p>

        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-3">
            {photoPreview ? (
              <button
                type="button"
                onClick={() => onPreviewPhoto(photoPreview, form.name || 'Leader photo')}
                title="Click to preview"
                className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-slate-200 dark:border-slate-800"
              >
                <img src={photoPreview} alt="" className="h-full w-full object-cover" />
              </button>
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50 text-indigo-300 dark:bg-indigo-500/15 dark:text-indigo-400">
                <Camera className="h-6 w-6" />
              </div>
            )}
            <div className="flex flex-col items-start gap-1">
              <label className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800">
                <Camera className="h-3.5 w-3.5" /> {photoPreview ? 'Change photo' : 'Add photo (optional)'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setPhotoFile(file);
                    setPhotoCleared(false);
                    setPhotoFromAvatar('');
                    setPhotoPreview(URL.createObjectURL(file));
                  }}
                />
              </label>
              {photoPreview && (
                <button
                  type="button"
                  onClick={() => {
                    setPhotoFile(null);
                    setPhotoPreview('');
                    setPhotoFromAvatar('');
                    setPhotoCleared(true);
                  }}
                  className="text-xs font-medium text-rose-600 hover:underline"
                >
                  Remove photo
                </button>
              )}
            </div>
          </div>

          {/* Suggest reusing the tagged GuildOS account's own profile picture when no photo is set yet. */}
          {linkedUser?.avatar && !photoPreview && (
            <div className="flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 dark:border-sky-500/30 dark:bg-sky-950/50">
              <button
                type="button"
                onClick={() => onPreviewPhoto(resolveAvatarUrl(linkedUser.avatar), linkedUser.fullName)}
                title="Click to preview"
                className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-sky-200 dark:border-sky-500/40"
              >
                <img src={resolveAvatarUrl(linkedUser.avatar)} alt="" className="h-full w-full object-cover" />
              </button>
              <p className="flex-1 text-xs text-sky-800 dark:text-sky-300">Use {linkedUser.fullName.split(' ')[0]}'s GuildOS profile picture as their photo?</p>
              <button
                type="button"
                onClick={() => {
                  setPhotoFromAvatar(linkedUser.avatar);
                  setPhotoFile(null);
                  setPhotoCleared(false);
                  setPhotoPreview(resolveAvatarUrl(linkedUser.avatar));
                }}
                className="shrink-0 rounded-lg bg-sky-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-700"
              >
                Use it
              </button>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value.slice(0, 120) }))}
              placeholder="e.g. Amina Yusuf"
              maxLength={120}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value.slice(0, 80) }))}
              placeholder="e.g. Amirah, General Secretary, PRO"
              maxLength={80}
              className={INPUT_CLASS}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Department</label>
              <input
                type="text"
                value={form.department}
                onChange={(e) => setForm((f) => ({ ...f, department: e.target.value.slice(0, 80) }))}
                placeholder="e.g. Mechatronics Engineering"
                maxLength={80}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Level</label>
              <input
                type="text"
                value={form.level}
                onChange={(e) => setForm((f) => ({ ...f, level: e.target.value.slice(0, 40) }))}
                placeholder="e.g. 300 Level"
                maxLength={40}
                className={INPUT_CLASS}
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Phone number</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value.slice(0, 30) }))}
              placeholder="e.g. +234 801 234 5678"
              maxLength={30}
              className={INPUT_CLASS}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Session</label>
              <input
                type="text"
                value={form.session}
                onChange={(e) => setForm((f) => ({ ...f, session: e.target.value.slice(0, 40) }))}
                placeholder="e.g. 2026/2027"
                maxLength={40}
                list="leader-session-options"
                className={INPUT_CLASS}
              />
              <datalist id="leader-session-options">
                {sessionSuggestions.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
              <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                {sessionSuggestions.length > 0 ? 'Re-use an existing session so leaders group together. ' : ''}Format: 2026/2027 (consecutive years, current session or later).
              </p>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Display order</label>
              <input
                type="number"
                value={form.displayRank}
                onChange={(e) => setForm((f) => ({ ...f, displayRank: e.target.value }))}
                placeholder="Optional"
                className={INPUT_CLASS}
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">About</label>
            <textarea
              value={form.bio}
              onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value.slice(0, 280) }))}
              rows={3}
              placeholder="A short bio: background, focus area, what they lead…"
              maxLength={280}
              className={`${INPUT_CLASS} resize-none`}
            />
            <p className="mt-1 text-right text-[11px] text-slate-400 dark:text-slate-500">{form.bio.length}/280</p>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Tag their GuildOS account (optional)</label>
            {linkedUser ? (
              <div className="mt-1 flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 dark:border-sky-500/30 dark:bg-sky-950/50">
                <MemberAvatar fullName={linkedUser.fullName} avatar={linkedUser.avatar} size="sm" />
                <span className="flex-1 truncate text-sm font-medium text-sky-800 dark:text-sky-300">{linkedUser.fullName}</span>
                <button type="button" onClick={() => setLinkedUser(null)} className="text-xs font-semibold text-sky-700 hover:underline dark:text-sky-300">
                  Remove
                </button>
              </div>
            ) : (
              <div className="relative mt-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => void handleSearch(e.target.value)}
                  placeholder="Search by name…"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
                {searchResults.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg">
                    {searchResults.map((person) => (
                      <button
                        key={person.id}
                        type="button"
                        onClick={() => {
                          setLinkedUser({ id: person.id, fullName: person.fullName, username: person.username, avatar: person.avatar });
                          setSearchQuery('');
                          setSearchResults([]);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        <MemberAvatar fullName={person.fullName} avatar={person.avatar} size="sm" />
                        <span className="truncate">{person.fullName}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
        </div>

        <div className="mt-5 flex gap-2">
          <button
            onClick={() => void handleSave()}
            disabled={busy}
            className="flex-1 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
          >
            {busy ? 'Saving…' : leader ? 'Save changes' : 'Add leader'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
