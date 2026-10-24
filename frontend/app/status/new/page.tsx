'use client';

// Save as: app/status/new/page.tsx
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarDays, Check, ChevronDown, GraduationCap, Palette, Send, Ticket, X } from 'lucide-react';

import { getCurrentUser, readCachedCurrentUser } from '../../../components/guildos/auth-api';
import { getManagedCommunities, type CommunitySummary } from '../../../components/guildos/community-list-api';
import { StatusAttachmentCard } from '../../../components/guildos/status/status-attachment-card';
import { StatusAttachmentPicker } from '../../../components/guildos/status/status-attachment-picker';
import {
  listAttachmentOptions,
  previewStatusAttachment,
  saveStatusStory,
  STATUS_COLORS,
  STATUS_MAX_LENGTH,
  uploadStatusImage,
  type StatusAttachment,
  type StatusAttachmentOption,
  type StatusAttachmentType,
  type StatusPickerType,
  type StatusStoryKind,
} from '../../../components/guildos/status-store';

const ATTACH_BUTTONS: Array<{ type: StatusPickerType; label: string; Icon: typeof Ticket }> = [
  { type: 'EVENT', label: 'Event', Icon: CalendarDays },
  { type: 'TICKET', label: 'Ticket', Icon: Ticket },
  { type: 'CERTIFICATE', label: 'Certificate', Icon: GraduationCap },
];

/** Uploaded media paths ("/uploads/…") live on the API host. */
function mediaSrc(path: string) {
  return path.startsWith('/') ? `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}${path}` : path;
}

/** Bigger text for short statuses, smaller as it grows (like WhatsApp). */
function textSizeClass(length: number, hasAttachment: boolean) {
  if (hasAttachment) return 'text-lg';
  if (length <= 60) return 'text-3xl';
  if (length <= 140) return 'text-2xl';
  if (length <= 300) return 'text-xl';
  return 'text-lg';
}

export default function NewStatusPage() {
  const router = useRouter();
  const cachedUser = readCachedCurrentUser();

  const [text, setText] = useState('');
  const [name, setName] = useState(cachedUser?.fullName ?? '');
  const [avatar, setAvatar] = useState(cachedUser?.profile?.avatar ?? '');
  const [accentIndex, setAccentIndex] = useState(0);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<StatusStoryKind>('update');

  const [attachment, setAttachment] = useState<StatusAttachment | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [picker, setPicker] = useState<StatusPickerType | null>(null);
  const [suggestions, setSuggestions] = useState<StatusAttachmentOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // "Post as": '' = yourself, otherwise the id of a community you lead.
  const [managedCommunities, setManagedCommunities] = useState<CommunitySummary[]>([]);
  const [postAs, setPostAs] = useState('');
  const [identityOpen, setIdentityOpen] = useState(false);
  const postingAs = managedCommunities.find((c) => c._id === postAs) ?? null;

  // The caption we pre-filled, so we only overwrite it while the user hasn't edited it.
  const lastDefaultCaption = useRef('');
  const textRef = useRef(text);
  textRef.current = text;
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const accent = STATUS_COLORS[accentIndex].accent;
  const isUpload = attachment?.type === 'TICKET_UPLOAD' || attachment?.type === 'CERTIFICATE_UPLOAD';

  // Grow the text box with its content.
  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight}px`;
  }, [text, attachment]);

  const selectItem = useCallback(async (type: StatusAttachmentType, id: string, keepCaption = false) => {
    setPreviewing(true);
    setError('');
    try {
      const result = await previewStatusAttachment({ type, id });
      setAttachment(result.attachment);

      const current = textRef.current.trim();
      const linkCaption = keepCaption && current;

      if (!linkCaption && (!current || current === lastDefaultCaption.current)) {
        // Empty, or still our own pre-filled caption: use this item's default.
        const caption = result.defaultCaption.slice(0, STATUS_MAX_LENGTH);
        setText(caption);
        lastDefaultCaption.current = caption;
      } else if (linkCaption) {
        // Caption came with the share link: keep it, but let picking another item replace it.
        lastDefaultCaption.current = current;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load that item');
    } finally {
      setPreviewing(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const params = new URLSearchParams(window.location.search);
    setText((params.get('content') ?? '').slice(0, STATUS_MAX_LENGTH));
    setTitle(params.get('title') ?? '');
    const sharedKind = params.get('kind');
    if (sharedKind === 'event' || sharedKind === 'milestone') setKind(sharedKind);

    // Deep link from an event / ticket / certificate page: ?attach=event&id=<slug or id>
    const attach = (params.get('attach') ?? '').toUpperCase();
    const attachId = params.get('id') ?? '';
    if ((attach === 'EVENT' || attach === 'TICKET' || attach === 'CERTIFICATE') && attachId) {
      void selectItem(attach, attachId, true);
    }

    void getCurrentUser().then((user) => {
      if (!active || !user) return;
      setName(user.fullName);
      setAvatar(user.profile?.avatar ?? '');
    }).catch(() => undefined);

    // Communities this user leads — they can post as them. ?as=<communityId> pre-selects one
    // (the Events dashboard's "Share to status" link), but only if they really lead it.
    const requestedCommunity = params.get('as') ?? '';
    void getManagedCommunities().then(({ communities }) => {
      if (!active) return;
      setManagedCommunities(communities);
      if (requestedCommunity && communities.some((c) => c._id === requestedCommunity)) setPostAs(requestedCommunity);
    }).catch(() => undefined);

    // Quick suggestions: your next ticket and your latest certificate, one tap each.
    void Promise.allSettled([listAttachmentOptions('TICKET'), listAttachmentOptions('CERTIFICATE')]).then(([tickets, certificates]) => {
      if (!active) return;
      const next: StatusAttachmentOption[] = [];
      if (tickets.status === 'fulfilled' && tickets.value[0]) next.push(tickets.value[0]);
      if (certificates.status === 'fulfilled' && certificates.value[0]) next.push(certificates.value[0]);
      setSuggestions(next);
    });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clearAttachment() {
    setAttachment(null);
    // Drop a caption we pre-filled; keep anything the user typed.
    if (textRef.current.trim() === lastDefaultCaption.current) setText('');
    lastDefaultCaption.current = '';
  }

  /** The user's own ticket / certificate image instead of the generated one. */
  async function handleUpload(type: 'TICKET' | 'CERTIFICATE', file: File) {
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('That image is over 5 MB.');
      return;
    }

    setError('');
    setUploading(true);
    try {
      const path = await uploadStatusImage(file);
      setPicker(null);
      await selectItem(type === 'TICKET' ? 'TICKET_UPLOAD' : 'CERTIFICATE_UPLOAD', path);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to upload that image');
    } finally {
      setUploading(false);
    }
  }

  const canSubmit =
    !saving &&
    !previewing &&
    !uploading &&
    Boolean(name.trim()) &&
    (attachment ? true : Boolean(text.trim()));

  async function submit() {
    if (!canSubmit) return;

    setSaving(true);
    setError('');
    try {
      await saveStatusStory({
        // Empty caption on an attachment: the server fills in the default one.
        content: text.trim(),
        title,
        kind: attachment ? undefined : kind,
        accent,
        attachment: attachment ? { type: attachment.type, id: attachment.refId, title: attachment.title } : undefined,
        communityId: postAs || undefined,
      });
      router.push('/status');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to share status');
    } finally {
      setSaving(false);
    }
  }

  const showSuggestions = !attachment && !previewing && !text.trim() && suggestions.length > 0;

  return (
    <div className={`fixed inset-0 z-[60] flex flex-col bg-gradient-to-br ${accent} transition-colors`}>
      {/* Top bar */}
      <header className="mx-auto flex w-full max-w-md items-center justify-between px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
        <Link
          href="/status"
          aria-label="Close"
          className="grid h-10 w-10 place-items-center rounded-full bg-black/20 text-white backdrop-blur hover:bg-black/30"
        >
          <X className="h-5 w-5" />
        </Link>

        {/* Identity pill — doubles as the "Post as" switcher for community leaders. */}
        <div className="relative">
          <button
            type="button"
            disabled={!managedCommunities.length}
            onClick={() => setIdentityOpen((open) => !open)}
            aria-haspopup={managedCommunities.length ? 'menu' : undefined}
            aria-expanded={identityOpen}
            className="flex items-center gap-2 rounded-full bg-black/20 px-3 py-1.5 text-xs font-medium text-white backdrop-blur enabled:hover:bg-black/30"
          >
            {postingAs ? (
              postingAs.logo ? <img src={mediaSrc(postingAs.logo)} alt="" className="h-5 w-5 rounded-full object-cover" /> : null
            ) : avatar ? (
              <img src={mediaSrc(avatar)} alt="" className="h-5 w-5 rounded-full object-cover" />
            ) : null}
            <span className="max-w-[10rem] truncate">{postingAs?.name || name || 'Your status'}</span>
            <span className="text-white/70">· 24h</span>
            {managedCommunities.length ? <ChevronDown className="h-3.5 w-3.5 text-white/80" /> : null}
          </button>
          {identityOpen && managedCommunities.length ? (
            <div role="menu" className="absolute left-1/2 top-full z-10 mt-2 w-64 -translate-x-1/2 overflow-hidden rounded-2xl bg-white py-1 shadow-xl dark:bg-slate-900">
              <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Post as</p>
              {[{ id: '', name: name || 'You', logo: avatar, hint: 'Your personal status' }, ...managedCommunities.map((c) => ({ id: c._id, name: c.name, logo: c.logo ?? '', hint: 'Community status' }))].map((option) => (
                <button
                  key={option.id || 'me'}
                  type="button"
                  role="menuitemradio"
                  aria-checked={postAs === option.id}
                  onClick={() => { setPostAs(option.id); setIdentityOpen(false); }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  {option.logo ? (
                    <img src={mediaSrc(option.logo)} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
                  ) : (
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">{option.name.slice(0, 1)}</span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-900 dark:text-slate-100">{option.name}</span>
                    <span className="block text-[11px] text-slate-500 dark:text-slate-400">{option.hint}</span>
                  </span>
                  {postAs === option.id ? <Check className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" /> : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => setAccentIndex((index) => (index + 1) % STATUS_COLORS.length)}
          aria-label={`Change background colour (now ${STATUS_COLORS[accentIndex].name})`}
          className="grid h-10 w-10 place-items-center rounded-full bg-black/20 text-white backdrop-blur hover:bg-black/30"
        >
          <Palette className="h-5 w-5" />
        </button>
      </header>

      {/* Leaders see the switch up front instead of having to discover the identity pill. */}
      {managedCommunities.length ? (
        <div className="mx-auto flex w-full max-w-md justify-center px-4 pb-1">
          <div role="radiogroup" aria-label="Post as" className="inline-flex rounded-full bg-black/25 p-1 text-xs font-semibold text-white backdrop-blur">
            <button
              type="button"
              role="radio"
              aria-checked={!postAs}
              onClick={() => { setPostAs(''); setIdentityOpen(false); }}
              className={`rounded-full px-4 py-1.5 transition ${!postAs ? 'bg-white text-slate-900 shadow' : 'text-white/85 hover:text-white'}`}
            >
              You
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={Boolean(postAs)}
              onClick={() => {
                if (!postAs) setPostAs(managedCommunities[0]._id);
                // With several communities, open the picker so it's obvious which one you're posting as.
                if (managedCommunities.length > 1) setIdentityOpen(true);
              }}
              className={`inline-flex max-w-[14rem] items-center gap-1 rounded-full px-4 py-1.5 transition ${postAs ? 'bg-white text-slate-900 shadow' : 'text-white/85 hover:text-white'}`}
            >
              <span className="truncate">{postingAs?.name ?? 'Community'}</span>
              {managedCommunities.length > 1 ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : null}
            </button>
          </div>
        </div>
      ) : null}

      {/* The status itself: what you type is what people see */}
      <main className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-4">
        <div className="w-full max-w-sm space-y-4">
          {previewing && !attachment ? <div className="h-44 animate-pulse rounded-xl bg-white/20" /> : null}

          {attachment ? (
            <div className="relative">
              <StatusAttachmentCard attachment={attachment} />
              <button
                type="button"
                onClick={clearAttachment}
                aria-label="Remove attachment"
                className="absolute -right-2 -top-2 grid h-8 w-8 place-items-center rounded-full bg-black/70 text-white shadow hover:bg-black"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : null}

          {attachment && isUpload ? (
            <input
              value={attachment.title}
              onChange={(event) => setAttachment({ ...attachment, title: event.target.value.slice(0, 100) })}
              placeholder="Name it (optional)"
              aria-label="Name of your upload"
              className="w-full border-b border-white/40 bg-transparent pb-1 text-center text-sm text-white outline-none placeholder:text-white/60 focus:border-white"
            />
          ) : null}

          <textarea
            ref={textareaRef}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                void submit();
              }
            }}
            maxLength={STATUS_MAX_LENGTH}
            rows={1}
            autoFocus={!attachment}
            aria-label={attachment ? 'Caption' : 'Status text'}
            placeholder={attachment ? 'Add a caption' : 'Type a status'}
            className={`block w-full resize-none overflow-hidden bg-transparent text-center font-semibold leading-snug text-white outline-none placeholder:text-white/70 ${textSizeClass(text.length, Boolean(attachment))}`}
          />
        </div>
      </main>

      {/* Bottom bar */}
      <footer className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
        <div className="mx-auto w-full max-w-sm space-y-3">
          {error ? (
            <p role="alert" className="rounded-2xl bg-black/60 px-3 py-2 text-sm text-white backdrop-blur">
              {error}
            </p>
          ) : null}

          {showSuggestions ? (
            <div className="flex flex-wrap justify-center gap-2" aria-label="Suggestions">
              {suggestions.map((option) => (
                <button
                  key={`${option.type}-${option.id}`}
                  type="button"
                  onClick={() => void selectItem(option.type, option.id)}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-xs font-medium text-white backdrop-blur hover:bg-white/30"
                >
                  {option.type === 'TICKET' ? <Ticket className="h-3.5 w-3.5 shrink-0" /> : <GraduationCap className="h-3.5 w-3.5 shrink-0" />}
                  <span className="truncate">
                    {option.type === 'TICKET' ? 'Share your ticket' : 'Share your certificate'}: {option.title}
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {ATTACH_BUTTONS.map(({ type, label, Icon }) => {
                const active =
                  attachment?.type === type ||
                  (type === 'TICKET' && attachment?.type === 'TICKET_UPLOAD') ||
                  (type === 'CERTIFICATE' && attachment?.type === 'CERTIFICATE_UPLOAD');

                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setPicker(type)}
                    aria-label={`Attach ${label.toLowerCase()}`}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold backdrop-blur transition ${active ? 'bg-white text-slate-900' : 'bg-black/20 text-white hover:bg-black/30'}`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden min-[380px]:inline">{label}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-3">
              {text.length > 400 ? (
                <span className={`text-xs font-medium ${text.length >= STATUS_MAX_LENGTH ? 'text-white' : 'text-white/70'}`}>
                  {text.length}/{STATUS_MAX_LENGTH}
                </span>
              ) : null}

              <button
                type="button"
                onClick={() => void submit()}
                disabled={!canSubmit}
                aria-label="Share status"
                className="grid h-14 w-14 place-items-center rounded-full bg-indigo-600 text-white shadow-lg ring-2 ring-white/70 transition hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <Send className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* Event / ticket / certificate picker: its own scrolling overlay */}
      {picker ? (
        <StatusAttachmentPicker
          type={picker}
          busy={previewing || uploading}
          onClose={() => setPicker(null)}
          onSelect={(id) => {
            const type = picker;
            setPicker(null);
            void selectItem(type, id);
          }}
          onUpload={(file) => {
            if (picker === 'TICKET' || picker === 'CERTIFICATE') void handleUpload(picker, file);
          }}
        />
      ) : null}
    </div>
  );
}