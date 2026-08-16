function escapePdfText(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function wrapLine(line: string, maxChars: number) {
  if (line.length <= maxChars) return [line];
  const words = line.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }
    if (current) out.push(current);
    current = word;
  }
  if (current) out.push(current);
  return out.length ? out : [line.slice(0, maxChars)];
}

function splitLines(lines: string[], maxChars: number) {
  const out: string[] = [];
  for (const line of lines) {
    if (!line.trim()) {
      out.push('');
      continue;
    }
    out.push(...wrapLine(line, maxChars));
  }
  return out;
}

export function buildSimpleTextPdf(input: {
  title: string;
  lines: string[];
  footer?: string;
}) {
  const marginLeft = 50;
  const marginTop = 800;
  const lineHeight = 15;
  const maxLinesPerPage = 46;
  const maxChars = 96;
  const allLines = [input.title, '', ...splitLines(input.lines, maxChars)];
  const pages: string[][] = [];
  for (let i = 0; i < allLines.length; i += maxLinesPerPage) {
    pages.push(allLines.slice(i, i + maxLinesPerPage));
  }
  if (!pages.length) pages.push([input.title]);

  const objects: string[] = [];
  const contentObjectIds: number[] = [];
  const pageObjectIds: number[] = [];
  const objectCount = 3 + pages.length * 2;

  const pageObjectsStart = 4 + pages.length;
  for (let i = 0; i < pages.length; i += 1) {
    contentObjectIds.push(4 + i);
    pageObjectIds.push(pageObjectsStart + i);
  }

  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`;
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

  for (let i = 0; i < pages.length; i += 1) {
    const pageLines = pages[i];
    let y = marginTop;
    const content: string[] = ['BT', '/F1 11 Tf'];
    for (const line of pageLines) {
      content.push(`1 0 0 1 ${marginLeft} ${y} Tm (${escapePdfText(line)}) Tj`);
      y -= lineHeight;
    }
    if (input.footer) {
      content.push('/F1 9 Tf');
      content.push(`1 0 0 1 50 30 Tm (${escapePdfText(input.footer)} · Page ${i + 1}/${pages.length}) Tj`);
    }
    content.push('ET');
    const body = `${content.join('\n')}\n`;
    objects[contentObjectIds[i]] = `<< /Length ${body.length} >>\nstream\n${body}endstream`;
    objects[pageObjectIds[i]] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectIds[i]} 0 R >>`;
  }

  const chunks: string[] = ['%PDF-1.4\n%\xFF\xFF\xFF\xFF\n'];
  const offsets: number[] = new Array(objectCount + 1).fill(0);
  let position = chunks[0].length;

  for (let id = 1; id <= objectCount; id += 1) {
    const objectBody = objects[id] ?? '';
    offsets[id] = position;
    const serialized = `${id} 0 obj\n${objectBody}\nendobj\n`;
    chunks.push(serialized);
    position += serialized.length;
  }

  const xrefOffset = position;
  chunks.push(`xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`);
  for (let id = 1; id <= objectCount; id += 1) {
    chunks.push(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
  }
  chunks.push(`trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  return Buffer.from(chunks.join(''), 'binary');
}
