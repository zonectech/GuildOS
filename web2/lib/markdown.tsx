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
    const parts = text.split(/(\[[^\]]+\]\((?:https?:\/\/[^\s)]+|\/[^\s)]*)\)|\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`|https?:\/\/[^\s<>"')\]]+)/g);
    return parts.map((part, i) => {
      const key = `${keyBase}-${i}`;
      const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)$/);
      if (link) {
        // Internal app paths navigate in the same tab; external links open safely in a new one.
        if (link[2].startsWith('/')) {
          return (
            <a key={key} href={link[2]}>
              {link[1]}
            </a>
          );
        }
        return (
          <a key={key} href={link[2]} target="_blank" rel="noopener noreferrer nofollow">
            {link[1]}
          </a>
        );
      }
      if (/^https?:\/\//.test(part)) {
        return (
          <a key={key} href={part} target="_blank" rel="noopener noreferrer nofollow">
            {part}
          </a>
        );
      }
      if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={key}>{part.slice(2, -2)}</strong>;
      if (/^\*[^*\n]+\*$/.test(part)) return <em key={key}>{part.slice(1, -1)}</em>;
      if (/^`[^`]+`$/.test(part)) return <code key={key}>{part.slice(1, -1)}</code>;
      return <span key={key}>{part}</span>;
    });
  };

  const renderList = (lines: string[], key: string): ReactNode => {
    const items = lines.filter((l) => l.trim());
    const ordered = items.every((l) => /^\s*\d+\.\s/.test(l));
    if (ordered) {
      return (
        <ol key={key}>
          {items.map((l, li) => (
            <li key={`${key}-${li}`}>
              <span>{(l.match(/^\s*(\d+)\./) as RegExpMatchArray)[1]}.</span>
              <span>{inline(l.replace(/^\s*\d+\.\s+/, ''), `${key}-${li}`)}</span>
            </li>
          ))}
        </ol>
      );
    }
    return (
      <ul key={key}>
        {items.map((l, li) => (
          <li key={`${key}-${li}`}>
            <span />
            <span>{inline(l.replace(/^\s*([-*]|\d+\.)\s+/, ''), `${key}-${li}`)}</span>
          </li>
        ))}
      </ul>
    );
  };

  const isListLine = (l: string) => /^\s*([-*]|\d+\.)\s/.test(l);

  /** Render one blank-line-separated block (may be a heading followed by list/paragraph lines). */
  const renderBlock = (block: string, key: string): ReactNode => {
    const lines = block.split('\n');
    if (/^#{1,3}\s/.test(lines[0])) {
      const level = (lines[0].match(/^#+/) as RegExpMatchArray)[0].length;
      const text = lines[0].replace(/^#{1,3}\s+/, '');
      const rest = lines.slice(1).join('\n');
      const heading =
        level === 1 ? (
          <h2 key={`${key}-h`}>{inline(text, key)}</h2>
        ) : level === 2 ? (
          <h3 key={`${key}-h`}>{inline(text, key)}</h3>
        ) : (
          <h4 key={`${key}-h`}>{inline(text, key)}</h4>
        );
      return (
        <div key={key}>
          {heading}
          {rest ? renderBlock(rest, `${key}-r`) : null}
        </div>
      );
    }
    if (lines.every((l) => isListLine(l) || !l.trim())) {
      return renderList(lines, key);
    }
    // Mixed block: paragraph lines followed by list lines (no blank line between).
    const firstList = lines.findIndex(isListLine);
    if (firstList > 0 && lines.slice(firstList).every((l) => isListLine(l) || !l.trim())) {
      return (
        <div key={key}>
          <p>
            {inline(lines.slice(0, firstList).join('\n'), key)}
          </p>
          {renderList(lines.slice(firstList), `${key}-l`)}
        </div>
      );
    }
    return (
      <p key={key}>
        {inline(block, key)}
      </p>
    );
  };

  const blocks = md.replace(/\r\n/g, '\n').split(/\n{2,}/);
  return blocks.map((block, bi) => renderBlock(block, `b-${bi}`));
}
