'use client';
import { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Markdown } from 'tiptap-markdown';
import { Bold, Heading2, Italic, Link2, List, ListOrdered } from 'lucide-react';

export type RichEditorProps = { value: string; onChange: (value: string) => void; placeholder?: string; autoFocus?: boolean };

/**
 * The same editor as the current site: what you type shows formatted, and it is saved as markdown
 * limited to what the event and community pages can show (headings, bold, italic, lists, links).
 */
function extensions(placeholder: string) {
  return [
    StarterKit.configure({
      blockquote: false, codeBlock: false, horizontalRule: false, strike: false, underline: false, code: false,
      heading: { levels: [2, 3] },
      link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
    }),
    Placeholder.configure({ placeholder }),
    Markdown.configure({ html: false, tightLists: true, bulletListMarker: '-', linkify: true, breaks: true, transformPastedText: true, transformCopiedText: false }),
  ];
}

/** Matches the markdown the pages render: bare URLs instead of <url>, and no backslash escapes. */
function toMarkdown(editor: Editor) {
  const storage = editor.storage as unknown as { markdown?: { getMarkdown: () => string } };
  return (storage.markdown?.getMarkdown() ?? '')
    .replace(/<(https?:\/\/[^>\s]+)>/g, '$1')
    .replace(/\\([*_`[\]#>~=+.!()-])/g, '$1')
    .replace(/ /g, ' ')
    .trimEnd();
}

type Tool = 'heading' | 'bold' | 'italic' | 'bullets' | 'numbers' | 'link';
const TOOLS: { tool: Tool; label: string; Icon: typeof Bold }[] = [
  { tool: 'heading', label: 'Heading', Icon: Heading2 },
  { tool: 'bold', label: 'Bold', Icon: Bold },
  { tool: 'italic', label: 'Italic', Icon: Italic },
  { tool: 'bullets', label: 'Bullet list', Icon: List },
  { tool: 'numbers', label: 'Numbered list', Icon: ListOrdered },
  { tool: 'link', label: 'Link', Icon: Link2 },
];

export default function RichEditorImpl({ value, onChange, placeholder = '', autoFocus }: RichEditorProps) {
  const last = useRef(value);
  const [link, setLink] = useState<{ text: string; url: string } | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: extensions(placeholder),
    content: value,
    autofocus: autoFocus ? 'end' : false,
    editorProps: { attributes: { class: 'rte-body', 'aria-label': placeholder || 'Description', role: 'textbox', 'aria-multiline': 'true' } },
    onUpdate: ({ editor: ed }) => { const md = toMarkdown(ed); last.current = md; onChange(md); },
  });

  // A value set from outside (for example loading an event to edit) replaces the content.
  useEffect(() => {
    if (editor && value !== last.current) { last.current = value; editor.commands.setContent(value); }
  }, [editor, value]);

  const active = (tool: Tool) => {
    if (!editor) return false;
    return { heading: editor.isActive('heading'), bold: editor.isActive('bold'), italic: editor.isActive('italic'), bullets: editor.isActive('bulletList'), numbers: editor.isActive('orderedList'), link: editor.isActive('link') }[tool];
  };
  function apply(tool: Tool) {
    if (!editor) return;
    const chain = editor.chain().focus();
    if (tool === 'heading') chain.toggleHeading({ level: 2 }).run();
    if (tool === 'bold') chain.toggleBold().run();
    if (tool === 'italic') chain.toggleItalic().run();
    if (tool === 'bullets') chain.toggleBulletList().run();
    if (tool === 'numbers') chain.toggleOrderedList().run();
    if (tool === 'link') {
      if (editor.isActive('link')) { chain.extendMarkRange('link').unsetLink().run(); return; }
      const { from, to } = editor.state.selection;
      setLink({ text: editor.state.doc.textBetween(from, to, ' '), url: '' });
    }
  }
  function insertLink() {
    if (!editor || !link?.url.trim()) return;
    const href = /^https?:\/\//i.test(link.url.trim()) ? link.url.trim() : `https://${link.url.trim()}`;
    editor.chain().focus().insertContent({ type: 'text', text: link.text.trim() || href, marks: [{ type: 'link', attrs: { href } }] }).run();
    setLink(null);
  }

  return (
    <div className="rte">
      <div className="rte-tools" role="toolbar" aria-label="Formatting">
        {TOOLS.map(({ tool, label, Icon }) => {
          const on = active(tool);
          return (
            <button key={tool} type="button" className={on ? 'on' : ''} aria-pressed={on} aria-label={on ? `Remove ${label.toLowerCase()}` : label} title={label}
              onMouseDown={(e) => e.preventDefault() /* keep the selection */} onClick={() => apply(tool)}>
              <Icon size={17} />
            </button>
          );
        })}
        <span className="rte-tip">Tip: type <code># </code> for a heading, <code>- </code> for a list. Links become clickable.</span>
      </div>
      {link ? (
        <div className="rte-link">
          <input className="input" autoFocus placeholder="Text to show" value={link.text} onChange={(e) => setLink({ ...link, text: e.target.value })} />
          <input className="input" placeholder="https://…" value={link.url} onChange={(e) => setLink({ ...link, url: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); insertLink(); } }} />
          <div className="row"><button type="button" className="btn s sm" onClick={() => setLink(null)}>Cancel</button><button type="button" className="btn p sm" disabled={!link.url.trim()} onClick={insertLink}>Add link</button></div>
        </div>
      ) : null}
      <EditorContent editor={editor} className="rte-area md" onClick={() => editor?.chain().focus().run()} />
    </div>
  );
}
