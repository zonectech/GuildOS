'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Clock, GraduationCap, Heart, Smile } from 'lucide-react';

type EmojiEntry = { char: string; keywords: string };

const CATEGORIES: { key: string; label: string; Icon: typeof Smile; emojis: EmojiEntry[] }[] = [
  {
    key: 'reactions',
    label: 'Reactions',
    Icon: Smile,
    emojis: [
      { char: '😀', keywords: 'happy grin smile' },
      { char: '😄', keywords: 'happy laugh smile' },
      { char: '😊', keywords: 'happy smile blush' },
      { char: '😂', keywords: 'laugh funny lol' },
      { char: '🥳', keywords: 'party celebrate' },
      { char: '😍', keywords: 'love heart eyes' },
      { char: '🤩', keywords: 'starstruck wow' },
      { char: '🤔', keywords: 'thinking hmm' },
      { char: '😅', keywords: 'phew relief sweat' },
      { char: '😉', keywords: 'wink' },
      { char: '🙌', keywords: 'praise hands celebrate' },
      { char: '👏', keywords: 'clap applause' },
      { char: '💪', keywords: 'strong flex effort' },
      { char: '🙏', keywords: 'thanks pray please' },
      { char: '👍', keywords: 'thumbs up yes agree' },
      { char: '👀', keywords: 'eyes look watching' },
    ],
  },
  {
    key: 'campus',
    label: 'Campus & wins',
    Icon: GraduationCap,
    emojis: [
      { char: '🎓', keywords: 'graduate certificate degree' },
      { char: '🏆', keywords: 'trophy win award' },
      { char: '🥇', keywords: 'gold medal first' },
      { char: '📚', keywords: 'books study learn' },
      { char: '💡', keywords: 'idea lightbulb' },
      { char: '🚀', keywords: 'launch ship rocket' },
      { char: '🔥', keywords: 'fire hot streak' },
      { char: '✅', keywords: 'done check complete' },
      { char: '🎯', keywords: 'goal target focus' },
      { char: '📢', keywords: 'announce megaphone' },
      { char: '⭐', keywords: 'star favorite' },
      { char: '✨', keywords: 'sparkle new shiny' },
      { char: '🎉', keywords: 'party celebrate confetti' },
      { char: '🛠️', keywords: 'tools build work' },
      { char: '💻', keywords: 'laptop code dev' },
      { char: '📸', keywords: 'camera photo' },
    ],
  },
  {
    key: 'hearts',
    label: 'Hearts & more',
    Icon: Heart,
    emojis: [
      { char: '❤️', keywords: 'love heart red' },
      { char: '💙', keywords: 'blue heart' },
      { char: '💚', keywords: 'green heart' },
      { char: '🧡', keywords: 'orange heart' },
      { char: '💜', keywords: 'purple heart' },
      { char: '🤝', keywords: 'handshake deal partner' },
      { char: '😎', keywords: 'cool sunglasses' },
      { char: '💯', keywords: 'hundred perfect' },
      { char: '🙈', keywords: 'shy oops monkey' },
      { char: '🕒', keywords: 'time clock soon' },
    ],
  },
];

const RECENTS_KEY = 'guildos-recent-emoji';
const MAX_RECENTS = 8;

function loadRecents(): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    return raw ? (JSON.parse(raw) as string[]).slice(0, MAX_RECENTS) : [];
  } catch {
    return [];
  }
}

function saveRecent(emoji: string) {
  try {
    const next = [emoji, ...loadRecents().filter((e) => e !== emoji)].slice(0, MAX_RECENTS);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
}

/** Modern popover emoji picker: category tabs, live search, and a "Recently used" row —
 * instead of a plain static grid of tiny unstyled glyphs. */
export function EmojiPicker({ onSelect }: { onSelect: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState(CATEGORIES[0].key);
  const [query, setQuery] = useState('');
  const [recents, setRecents] = useState<string[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setRecents(loadRecents());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CATEGORIES.find((c) => c.key === category)?.emojis ?? [];
    return CATEGORIES.flatMap((c) => c.emojis).filter((e) => e.keywords.includes(q));
  }, [query, category]);

  function pick(emoji: string) {
    saveRecent(emoji);
    onSelect(emoji);
    setOpen(false);
    setQuery('');
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Add emoji"
        aria-haspopup="true"
        aria-expanded={open}
        title="Add emoji"
        className={`grid h-9 w-9 place-items-center rounded-full transition ${open ? 'bg-amber-100 text-amber-600' : 'text-slate-500 hover:bg-amber-50 hover:text-amber-600'}`}
      >
        <Smile className="h-[18px] w-[18px]" />
      </button>

      {open ? (
        <div className="absolute left-0 top-11 z-30 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 p-2.5">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search emoji…"
              className="w-full rounded-lg bg-slate-50 px-3 py-1.5 text-sm outline-none placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {!query ? (
            <div className="flex items-center gap-1 border-b border-slate-100 px-2 py-1.5">
              {CATEGORIES.map(({ key, label, Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setCategory(key)}
                  title={label}
                  aria-label={label}
                  aria-pressed={category === key}
                  className={`grid h-8 w-8 place-items-center rounded-lg transition ${category === key ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          ) : null}

          <div className="max-h-64 overflow-y-auto p-2.5">
            {!query && recents.length ? (
              <div className="mb-2">
                <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  <Clock className="h-3 w-3" /> Recently used
                </p>
                <div className="grid grid-cols-8 gap-0.5">
                  {recents.map((emoji) => (
                    <button
                      key={`recent-${emoji}`}
                      type="button"
                      onClick={() => pick(emoji)}
                      className="grid h-9 w-9 place-items-center rounded-lg text-xl transition hover:scale-110 hover:bg-slate-100"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {filtered.length ? (
              <div className="grid grid-cols-8 gap-0.5">
                {filtered.map((e) => (
                  <button
                    key={e.char}
                    type="button"
                    onClick={() => pick(e.char)}
                    title={e.keywords.split(' ')[0]}
                    className="grid h-9 w-9 place-items-center rounded-lg text-xl transition hover:scale-110 hover:bg-slate-100"
                  >
                    {e.char}
                  </button>
                ))}
              </div>
            ) : (
              <p className="py-6 text-center text-xs text-slate-400">No emoji match &ldquo;{query}&rdquo;</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

