'use client';

import { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Markdown } from 'tiptap-markdown';
import { Bold, Code, HelpCircle, Heading2, Italic, Link2, List } from 'lucide-react';

export type RichTextEditorProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
};

/**
 * Extension set shared by the editor and the markdown round-trip spike.
 * Deliberately limited to EXACTLY what renderMarkdown supports:
 * h1–h3, bold, italic, inline code, bullet/ordered lists, links, autolink.
 */
export function createMarkdownEditorExtensions(placeholder = '') {
  return [
    StarterKit.configure({
      blockquote: false,
      codeBlock: false,
      horizontalRule: false,
      strike: false,
      underline: false,
      heading: { levels: [1, 2, 3] },
      link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
    }),
    Placeholder.configure({ placeholder }),
    Markdown.configure({
      html: false,
      tightLists: true,
      bulletListMarker: '-',
      linkify: true,
      breaks: true,
      transformPastedText: true,
      transformCopiedText: false,
    }),
  ];
}

/**
 * Aligns serializer output with the GuildOS markdown dialect:
 * - `<url>` autolinks → bare URLs (renderMarkdown auto-links those)
 * - backslash escapes stripped (renderMarkdown has no escape syntax)
 */
export function normalizeEditorMarkdown(md: string): string {
  return md
    .replace(/<(https?:\/\/[^>\s]+)>/g, '$1')
    .replace(/\\([*_`[\]#>~=+.!()-])/g, '$1')
    .replace(/\u00a0/g, ' ')
    .trimEnd();
}

/** Serializes the editor document back to GuildOS-dialect markdown. */
export function editorMarkdown(editor: Editor): string {
  const storage = editor.storage as unknown as { markdown?: { getMarkdown: () => string } };
  return normalizeEditorMarkdown(storage.markdown?.getMarkdown() ?? '');
}

type Action = 'heading' | 'bold' | 'italic' | 'code' | 'list' | 'link';

const GUIDE: { syntax: string; meaning: string }[] = [
  { syntax: '# ', meaning: 'Type at line start for a heading (## smaller)' },
  { syntax: '**bold**', meaning: 'Typing markdown still works — it formats live' },
  { syntax: '- ', meaning: 'Starts a bullet list' },
  { syntax: 'https://…', meaning: 'URLs become links automatically' },
];

/**
 * Inline WYSIWYG editor — bold shows bold while typing. Drop-in replacement for
 * MarkdownTextarea: same value/onChange contract, markdown stays the stored format.
 */
export function RichTextEditorImpl({ value, onChange, className, placeholder }: RichTextEditorProps) {
  const lastMarkdown = useRef(value);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkText, setLinkText] = useState('');
  const [linkUrl, setLinkUrl] = useState('');

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: createMarkdownEditorExtensions(placeholder ?? ''),
    content: value,
    editorProps: {
      attributes: { class: 'focus:outline-none' },
    },
    onUpdate: ({ editor: ed }) => {
      const md = editorMarkdown(ed);
      lastMarkdown.current = md;
      onChange(md);
    },
  });

  // External value change (e.g. AI draft fills the form) → replace editor content.
  useEffect(() => {
    if (!editor) return;
    if (value !== lastMarkdown.current) {
      lastMarkdown.current = value;
      editor.commands.setContent(value);
    }
  }, [editor, value]);

  function openLinkDialog() {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    setLinkText(editor.state.doc.textBetween(from, to, ' '));
    setLinkUrl('');
    setLinkOpen(true);
  }

  function insertLink() {
    if (!editor) return;
    const url = linkUrl.trim();
    if (!url) return;
    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    const text = linkText.trim() || href;
    editor
      .chain()
      .focus()
      .insertContent({ type: 'text', text, marks: [{ type: 'link', attrs: { href } }] })
      .run();
    setLinkOpen(false);
  }

  function apply(action: Action) {
    if (!editor) return;
    const chain = editor.chain().focus();
    switch (action) {
      case 'heading':
        chain.toggleHeading({ level: 2 }).run();
        break;
      case 'bold':
        chain.toggleBold().run();
        break;
      case 'italic':
        chain.toggleItalic().run();
        break;
      case 'code':
        chain.toggleCode().run();
        break;
      case 'list':
        chain.toggleBulletList().run();
        break;
      case 'link':
        if (editor.isActive('link')) {
          chain.extendMarkRange('link').unsetLink().run();
        } else {
          openLinkDialog();
        }
        break;
    }
  }

  const isActive = (action: Action): boolean => {
    if (!editor) return false;
    switch (action) {
      case 'heading':
        return editor.isActive('heading');
      case 'bold':
        return editor.isActive('bold');
      case 'italic':
        return editor.isActive('italic');
      case 'code':
        return editor.isActive('code');
      case 'list':
        return editor.isActive('bulletList');
      case 'link':
        return editor.isActive('link');
    }
  };

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
        {tools.map(({ action, label, Icon }) => {
          const on = isActive(action);
          return (
            <button
              key={action}
              type="button"
              title={on ? `Remove ${label.toLowerCase()}` : label}
              aria-label={on ? `Remove ${label.toLowerCase()}` : label}
              aria-pressed={on}
              onMouseDown={(e) => e.preventDefault() /* keep editor selection */}
              onClick={() => apply(action)}
              className={`rounded-lg border p-1.5 transition ${
                on
                  ? 'border-indigo-300 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:border-indigo-500/40 dark:bg-indigo-500/20 dark:text-indigo-300 dark:hover:bg-indigo-500/30'
                  : 'border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          );
        })}
        <div className="group relative ml-auto">
          <button
            type="button"
            aria-label="Formatting tips"
            className="rounded-lg p-1.5 text-slate-400 dark:text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700"
          >
            <HelpCircle className="h-4 w-4" />
          </button>
          <div className="invisible absolute right-0 top-8 z-30 w-72 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 opacity-0 shadow-lg transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
            <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">Formatting tips</p>
            <ul className="mt-2 space-y-1.5">
              {GUIDE.map((row) => (
                <li key={row.syntax} className="flex items-start gap-2 text-xs">
                  <code className="shrink-0 rounded bg-slate-100 dark:bg-slate-950 px-1.5 py-0.5 font-mono text-[11px] text-slate-800 dark:text-slate-200">{row.syntax}</code>
                  <span className="text-slate-500 dark:text-slate-400">{row.meaning}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <EditorContent
        editor={editor}
        className={`guildos-rte ${className ?? ''}`}
        onClick={() => editor?.chain().focus().run()}
      />
      {linkOpen ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setLinkOpen(false)} />
          <div className="absolute left-0 top-9 z-50 w-80 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-lg">
            <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">Insert link</p>
            <label className="mt-2 block">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Text to display</span>
              <input
                autoFocus
                className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-800 px-2.5 py-1.5 text-sm"
                placeholder="e.g. attendee guidelines"
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
              />
            </label>
            <label className="mt-2 block">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">URL</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-800 px-2.5 py-1.5 text-sm"
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
              <button type="button" onClick={() => setLinkOpen(false)} className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">Cancel</button>
              <button type="button" onClick={insertLink} disabled={!linkUrl.trim()} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">Insert link</button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
