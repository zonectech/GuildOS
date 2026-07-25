import type { ReactNode } from 'react';

/**
 * Minimal, safe markdown rendering shared across GuildOS (Knowledge Hub articles,
 * event About sections). Supports: # headings, **bold**, `code`, - / 1. lists,
 * [links](url), and bare http(s) URLs. Everything is rendered as React nodes —
 * no HTML injection.
 */
export function renderMarkdown(md: string): ReactNode[] {
  const inline = (text: string, keyBase: string): ReactNode[] => {
    // Split on links, bold, italic, inline code, and bare URLs; all rendered as React nodes.
    const parts = text.split(/(\[[^\]]+\]\(https?:\/\/[^\s)]+\)|\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`|https?:\/\/[^\s<>"')\]]+)/g);
    return parts.map((part, i) => {
      const key = `${keyBase}-${i}`;
      const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
      if (link) {
        return (
          <a key={key} href={link[2]} target="_blank" rel="noopener noreferrer nofollow" className="font-medium text-indigo-600 hover:underline">
            {link[1]}
          </a>
        );
      }
      if (/^https?:\/\//.test(part)) {
        return (
          <a key={key} href={part} target="_blank" rel="noopener noreferrer nofollow" className="break-all font-medium text-indigo-600 underline underline-offset-2 hover:text-indigo-800">
            {part}
          </a>
        );
      }
      if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={key}>{part.slice(2, -2)}</strong>;
      if (/^\*[^*\n]+\*$/.test(part)) return <em key={key}>{part.slice(1, -1)}</em>;
      if (/^`[^`]+`$/.test(part)) return <code key={key} className="rounded bg-slate-100 px-1 py-0.5 text-[13px]">{part.slice(1, -1)}</code>;
      return <span key={key}>{part}</span>;
    });
  };

  const blocks = md.replace(/\r\n/g, '\n').split(/\n{2,}/);
  return blocks.map((block, bi) => {
    const key = `b-${bi}`;
    const lines = block.split('\n');
    if (/^#{1,3}\s/.test(lines[0])) {
      const level = (lines[0].match(/^#+/) as RegExpMatchArray)[0].length;
      const text = lines[0].replace(/^#{1,3}\s+/, '');
      const rest = lines.slice(1).join('\n');
      const heading =
        level === 1 ? (
          <h2 key={`${key}-h`} className="mt-5 text-lg font-bold text-slate-950">{inline(text, key)}</h2>
        ) : level === 2 ? (
          <h3 key={`${key}-h`} className="mt-4 text-base font-bold text-slate-900">{inline(text, key)}</h3>
        ) : (
          <h4 key={`${key}-h`} className="mt-3 text-sm font-bold text-slate-900">{inline(text, key)}</h4>
        );
      return (
        <div key={key}>
          {heading}
          {rest ? <p className="mt-2 text-sm leading-relaxed text-slate-600">{inline(rest, `${key}-r`)}</p> : null}
        </div>
      );
    }
    if (lines.every((l) => /^\s*([-*]|\d+\.)\s/.test(l) || !l.trim())) {
      return (
        <ul key={key} className="mt-2 space-y-1.5 pl-1">
          {lines.filter((l) => l.trim()).map((l, li) => (
            <li key={`${key}-${li}`} className="flex gap-2 text-sm leading-relaxed text-slate-600">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
              <span>{inline(l.replace(/^\s*([-*]|\d+\.)\s+/, ''), `${key}-${li}`)}</span>
            </li>
          ))}
        </ul>
      );
    }
    return (
      <p key={key} className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600">
        {inline(block, key)}
      </p>
    );
  });
}
