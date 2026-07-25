'use client';

import { useMemo, useRef, useState } from 'react';
import { Bold, Code, HelpCircle, Heading2, Italic, Link2, List } from 'lucide-react';

import { renderMarkdown } from '../markdown';

type MarkdownTextareaProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
};

type Action = 'heading' | 'bold' | 'italic' | 'code' | 'list' | 'link';

const GUIDE: { syntax: string; meaning: string }[] = [
  { syntax: '# Heading', meaning: 'Section heading (## and ### for smaller)' },
  { syntax: '**bold**', meaning: 'Bold text' },
  { syntax: '*italic*', meaning: 'Italic text' },
  { syntax: '`code`', meaning: 'Inline code chip' },
  { syntax: '- item', meaning: 'Bullet list (one per line)' },
  { syntax: '[text](url)', meaning: 'Named link' },
  { syntax: 'https://…', meaning: 'Bare URLs become clickable automatically' },
];

const LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;

type WrapMark = { mark: string; where: 'inner' | 'outer' } | null;

/** Is the selection wrapped in `mark` (either just outside it, or included in it)? */
function wrapState(value: string, start: number, end: number, mark: string, exclude?: string): WrapMark {
  const sel = value.slice(start, end);
  const m = mark.length;
  const before = value.slice(Math.max(0, start - m), start);
  const after = value.slice(end, end + m);
  const beforeExtra = value.slice(Math.max(0, start - m - 1), start - m);
  const afterExtra = value.slice(end + m, end + m + 1);
  // Markers sit just outside the selection (e.g. user selected the word inside **word**).
  if (before === mark && after === mark && !(exclude && (beforeExtra === exclude || afterExtra === exclude))) {
    return { mark, where: 'inner' };
  }
  // Selection includes the markers (e.g. user selected **word** whole).
  if (sel.length >= m * 2 + 1 && sel.startsWith(mark) && sel.endsWith(mark) && !(exclude && (sel.startsWith(mark + exclude) || sel.endsWith(exclude + mark)))) {
    return { mark, where: 'outer' };
  }
  return null;
}

/** Find the [text](url) link containing the cursor/selection, if any. */
function linkAt(value: string, start: number, end: number): { from: number; to: number; text: string } | null {
  LINK_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = LINK_RE.exec(value))) {
    if (start >= m.index && end <= m.index + m[0].length) {
      return { from: m.index, to: m.index + m[0].length, text: m[1] };
    }
  }
  return null;
}

function lineRange(value: string, start: number, end: number) {
  const from = value.lastIndexOf('\n', start - 1) + 1;
  const nl = value.indexOf('\n', Math.max(start, end === start ? start : end - 1));
  const to = end > start ? end : nl === -1 ? value.length : nl;
  return { from, to: Math.max(from, to) };
}

/** Convert pasted rich HTML (Word/Docs/webpages) to our markdown dialect. Output is plain text. */
function htmlToMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');

  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return (node.textContent ?? '').replace(/\s+/g, ' ');
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const el = node as HTMLElement;
    const children = () => Array.from(el.childNodes).map(walk).join('');
    const tag = el.tagName.toLowerCase();
    const bold = /^(b|strong)$/.test(tag) || parseInt(el.style.fontWeight || '0', 10) >= 600;
    const italic = /^(i|em)$/.test(tag) || el.style.fontStyle === 'italic';

    switch (true) {
      case /^h[12]$/.test(tag): return `\n\n# ${children().trim()}\n\n`;
      case tag === 'h3': return `\n\n## ${children().trim()}\n\n`;
      case /^h[4-6]$/.test(tag): return `\n\n### ${children().trim()}\n\n`;
      case tag === 'li': return `- ${children().trim()}\n`;
      case tag === 'ul' || tag === 'ol': return `\n\n${children()}\n`;
      case tag === 'a': {
        const href = el.getAttribute('href') ?? '';
        const text = children().trim();
        return /^https?:\/\//.test(href) && text ? `[${text}](${href})` : text;
      }
      case tag === 'code' || tag === 'kbd': {
        const text = children().trim();
        return text ? `\`${text}\`` : '';
      }
      case tag === 'br': return '\n';
      case /^(p|div|section|article|blockquote|tr)$/.test(tag): return `\n\n${children()}`;
      case /^(script|style|head|title|meta)$/.test(tag): return '';
      case bold: {
        const text = children().trim();
        return text ? `**${text}**` : '';
      }
      case italic: {
        const text = children().trim();
        return text ? `*${text}*` : '';
      }
      default: return children();
    }
  };

  return walk(doc.body)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Textarea with a markdown toolbar, Write/Preview tabs, link dialog + hover help guide. */
export function MarkdownTextarea({ value, onChange, className, placeholder }: MarkdownTextareaProps) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkText, setLinkText] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const selRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });
  const [selPos, setSelPos] = useState<{ start: number; end: number }>({ start: 0, end: 0 });

  function syncSelection() {
    const el = ref.current;
    if (el) setSelPos({ start: el.selectionStart, end: el.selectionEnd });
  }

  /** Rich paste from Word/Docs/webpages: convert the HTML clipboard to markdown so bold/lists/links survive. */
  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const html = e.clipboardData.getData('text/html');
    const plain = e.clipboardData.getData('text/plain');
    // If the pasted text already looks like markdown, or there's no rich HTML, leave the default paste alone.
    if (!html || /(\*\*|^#{1,3}\s|^- |\[[^\]]+\]\()/m.test(plain)) return;
    const md = htmlToMarkdown(html);
    if (!md || md === plain.trim()) return; // nothing formatted — default paste is fine
    e.preventDefault();
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const next = value.slice(0, start) + md + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + md.length, start + md.length);
    });
    setSelPos({ start: start + md.length, end: start + md.length });
  }

  /** Which formats are already applied at the current selection — clicking those buttons undoes them. */
  const active = useMemo<Set<Action>>(() => {
    const set = new Set<Action>();
    const { start, end } = selPos;
    if (start > value.length || end > value.length) return set;
    if (wrapState(value, start, end, '**')) set.add('bold');
    if (wrapState(value, start, end, '*', '*')) set.add('italic');
    if (wrapState(value, start, end, '`')) set.add('code');
    if (linkAt(value, start, end)) set.add('link');
    const { from, to } = lineRange(value, start, end);
    const lines = value.slice(from, to).split('\n');
    if (/^#{1,3}\s/.test(lines[0] ?? '')) set.add('heading');
    if (lines.some((l) => l.trim()) && lines.every((l) => !l.trim() || /^\s*-\s/.test(l))) set.add('list');
    return set;
  }, [value, selPos]);

  function openLinkDialog() {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    selRef.current = { start, end };
    setLinkText(value.slice(start, end));
    setLinkUrl('');
    setLinkOpen(true);
  }

  function insertLink() {
    const url = linkUrl.trim();
    if (!url) return;
    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    const text = linkText.trim() || href;
    const { start, end } = selRef.current;
    const snippet = `[${text}](${href})`;
    onChange(value.slice(0, start) + snippet + value.slice(end));
    setLinkOpen(false);
    requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.setSelectionRange(start + snippet.length, start + snippet.length);
    });
  }

  function apply(action: Action) {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const sel = value.slice(start, end);
    let next = value;
    let selStart = start;
    let selEnd = end;

    if (action === 'link') {
      const existing = linkAt(value, start, end);
      if (existing) {
        // Undo: replace [text](url) with just the text.
        next = value.slice(0, existing.from) + existing.text + value.slice(existing.to);
        onChange(next);
        requestAnimationFrame(() => {
          el?.focus();
          el?.setSelectionRange(existing.from, existing.from + existing.text.length);
        });
        setSelPos({ start: existing.from, end: existing.from + existing.text.length });
        return;
      }
      openLinkDialog();
      return;
    }

    if (action === 'heading' || action === 'list') {
      const { from, to } = lineRange(value, start, end);
      const block = value.slice(from, to);
      let changed: string;
      if (action === 'heading') {
        changed = active.has('heading')
          ? block.replace(/^#{1,3}\s+/, '')
          : block.startsWith('#') ? block : `## ${block}`;
      } else {
        changed = active.has('list')
          ? block.split('\n').map((l) => l.replace(/^(\s*)-\s+/, '$1')).join('\n')
          : block.split('\n').map((l) => (l.trim().startsWith('- ') || !l.trim() ? l : `- ${l}`)).join('\n');
      }
      next = value.slice(0, from) + changed + value.slice(to);
      selStart = from;
      selEnd = from + changed.length;
    } else {
      const wrap: Record<Exclude<Action, 'heading' | 'list' | 'link'>, [string, string, string]> = {
        bold: ['**', '**', 'bold text'],
        italic: ['*', '*', 'italic text'],
        code: ['`', '`', 'code'],
      };
      const [open, , sample] = wrap[action];
      const m = open.length;
      const state = wrapState(value, start, end, open, action === 'italic' ? '*' : undefined);
      if (state && active.has(action)) {
        // Undo: strip the surrounding markers.
        if (state.where === 'inner') {
          next = value.slice(0, start - m) + sel + value.slice(end + m);
          selStart = start - m;
          selEnd = selStart + sel.length;
        } else {
          const inner = sel.slice(m, -m);
          next = value.slice(0, start) + inner + value.slice(end);
          selStart = start;
          selEnd = start + inner.length;
        }
      } else {
        const inner = sel || sample;
        next = value.slice(0, start) + open + inner + open + value.slice(end);
        selStart = start + m;
        selEnd = selStart + inner.length;
      }
    }

    onChange(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(selStart, selEnd);
    });
    setSelPos({ start: selStart, end: selEnd });
  }

  const tools: { action: Action; label: string; Icon: typeof Bold }[] = [
    { action: 'heading', label: 'Heading', Icon: Heading2 },
    { action: 'bold', label: 'Bold', Icon: Bold },
    { action: 'italic', label: 'Italic', Icon: Italic },
    { action: 'code', label: 'Inline code', Icon: Code },
    { action: 'list', label: 'Bullet list', Icon: List },
    { action: 'link', label: 'Link', Icon: Link2 },
  ];

  return (
    <div className="relative">
      <div className="mb-1.5 flex items-center gap-1">
        <div className="mr-2 flex rounded-lg border border-slate-200 p-0.5">
          <button
            type="button"
            onClick={() => setTab('write')}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${tab === 'write' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Write
          </button>
          <button
            type="button"
            onClick={() => setTab('preview')}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${tab === 'preview' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Preview
          </button>
        </div>
        {tab === 'write'
          ? tools.map(({ action, label, Icon }) => {
              const isActive = active.has(action);
              return (
                <button
                  key={action}
                  type="button"
                  title={isActive ? `Remove ${label.toLowerCase()}` : label}
                  aria-label={isActive ? `Remove ${label.toLowerCase()}` : label}
                  aria-pressed={isActive}
                  onMouseDown={(e) => e.preventDefault() /* keep textarea selection */}
                  onClick={() => apply(action)}
                  className={`rounded-lg border p-1.5 transition ${
                    isActive
                      ? 'border-indigo-300 bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                      : 'border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </button>
              );
            })
          : null}
        <div className="group relative ml-auto">
          <button
            type="button"
            aria-label="Formatting guide"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <HelpCircle className="h-4 w-4" />
          </button>
          <div className="invisible absolute right-0 top-8 z-30 w-72 rounded-xl border border-slate-200 bg-white p-3 opacity-0 shadow-lg transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
            <p className="text-xs font-semibold text-slate-900">Formatting guide</p>
            <ul className="mt-2 space-y-1.5">
              {GUIDE.map((row) => (
                <li key={row.syntax} className="flex items-start gap-2 text-xs">
                  <code className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-800">{row.syntax}</code>
                  <span className="text-slate-500">{row.meaning}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      {tab === 'write' ? (
        <textarea
          ref={ref}
          className={className}
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            onChange(e.target.value);
            syncSelection();
          }}
          onSelect={syncSelection}
          onKeyUp={syncSelection}
          onClick={syncSelection}
          onPaste={handlePaste}
        />
      ) : (
        <div className="min-h-56 rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5">
          {value.trim() ? renderMarkdown(value) : <p className="text-sm text-slate-400">Nothing to preview yet — write something first.</p>}
        </div>
      )}
      {linkOpen ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setLinkOpen(false)} />
          <div className="absolute left-0 top-9 z-50 w-80 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
            <p className="text-xs font-semibold text-slate-900">Insert link</p>
            <label className="mt-2 block">
              <span className="text-[11px] font-medium text-slate-500">Text to display</span>
              <input
                autoFocus
                className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
                placeholder="e.g. attendee guidelines"
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
              />
            </label>
            <label className="mt-2 block">
              <span className="text-[11px] font-medium text-slate-500">URL</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
                placeholder="https://…"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    insertLink();
                  }
                }}
              />
            </label>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={() => setLinkOpen(false)} className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100">Cancel</button>
              <button type="button" onClick={insertLink} disabled={!linkUrl.trim()} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">Insert link</button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
