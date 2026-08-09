/**
 * CV export helpers — no dependencies.
 *
 * - DOCX: a real .docx is a ZIP of OOXML parts. We write a minimal package
 *   ([Content_Types].xml, _rels/.rels, word/document.xml) with STORED zip
 *   entries (no compression) + CRC32, which every version of Word/Google Docs
 *   accepts. Text is composed from the structured CvContent, so the export is
 *   native text (editable), not a screenshot.
 * - Europass: same DOCX engine with Europass section names and ordering
 *   (Personal information → Work experience → Education and training →
 *   Personal skills → Additional information), ready to paste/upload into the
 *   Europass editor.
 * - LinkedIn: clipboard-ready plain text blocks per LinkedIn profile section.
 */
import type { CvContent } from '../cv-api';

// ── ZIP writer (stored entries) ──────────────────────────────────────────────

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

type ZipEntry = { name: string; data: Uint8Array };

function u16(v: number) {
  return [v & 0xff, (v >> 8) & 0xff];
}
function u32(v: number) {
  return [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >> 24) & 0xff];
}

function buildZip(entries: ZipEntry[]): Uint8Array {
  const chunks: number[] = [];
  const central: number[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = new TextEncoder().encode(entry.name);
    const crc = crc32(entry.data);
    const header = [
      ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(entry.data.length), ...u32(entry.data.length),
      ...u16(nameBytes.length), ...u16(0),
    ];
    central.push(
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(entry.data.length), ...u32(entry.data.length),
      ...u16(nameBytes.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset),
      ...nameBytes,
    );
    chunks.push(...header, ...nameBytes, ...entry.data);
    offset += header.length + nameBytes.length + entry.data.length;
  }

  const centralStart = offset;
  chunks.push(...central);
  chunks.push(
    ...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(entries.length), ...u16(entries.length),
    ...u32(central.length), ...u32(centralStart), ...u16(0),
  );
  return new Uint8Array(chunks);
}

// ── OOXML document builder ───────────────────────────────────────────────────

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

type Run = { text: string; bold?: boolean; italic?: boolean; color?: string; size?: number };

function runXml(run: Run): string {
  const props: string[] = [];
  if (run.bold) props.push('<w:b/>');
  if (run.italic) props.push('<w:i/>');
  if (run.color) props.push(`<w:color w:val="${run.color}"/>`);
  if (run.size) props.push(`<w:sz w:val="${run.size * 2}"/><w:szCs w:val="${run.size * 2}"/>`);
  return `<w:r>${props.length ? `<w:rPr>${props.join('')}</w:rPr>` : ''}<w:t xml:space="preserve">${esc(run.text)}</w:t></w:r>`;
}

function para(runs: Run[], opts?: { spacingAfter?: number; bullet?: boolean }): string {
  const pPr: string[] = [];
  if (opts?.bullet) pPr.push('<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>');
  pPr.push(`<w:spacing w:after="${opts?.spacingAfter ?? 80}"/>`);
  return `<w:p><w:pPr>${pPr.join('')}</w:pPr>${runs.map(runXml).join('')}</w:p>`;
}

const ACCENT = '1E3A8A';

function heading(text: string): string {
  return para([{ text: text.toUpperCase(), bold: true, color: ACCENT, size: 13 }], { spacingAfter: 120 });
}

// ── CV content → paragraphs ──────────────────────────────────────────────────

export type CvSectionKey = 'summary' | 'education' | 'leadership' | 'experience' | 'certifications' | 'skills' | 'projects' | 'awards';

export const CV_DEFAULT_SECTION_ORDER: CvSectionKey[] = [
  'summary', 'education', 'leadership', 'experience', 'certifications', 'skills', 'projects', 'awards',
];

export const CV_SECTION_LABELS: Record<CvSectionKey, string> = {
  summary: 'Professional Summary',
  education: 'Education',
  leadership: 'Leadership Experience',
  experience: 'Experience',
  certifications: 'Certifications',
  skills: 'Skills',
  projects: 'Projects',
  awards: 'Awards & Recognition',
};

const EUROPASS_LABELS: Record<CvSectionKey, string> = {
  summary: 'About Me',
  experience: 'Work Experience',
  leadership: 'Work Experience — Leadership',
  education: 'Education and Training',
  skills: 'Personal Skills',
  certifications: 'Additional Information — Certifications',
  projects: 'Additional Information — Projects',
  awards: 'Additional Information — Honours and Awards',
};

const EUROPASS_ORDER: CvSectionKey[] = [
  'summary', 'experience', 'leadership', 'education', 'skills', 'certifications', 'projects', 'awards',
];

function fmtDate(value: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-NG', { year: 'numeric', month: 'short' });
}

function sectionParas(key: CvSectionKey, content: CvContent, labels: Record<CvSectionKey, string>): string[] {
  const out: string[] = [];
  const add = (xml: string) => out.push(xml);

  switch (key) {
    case 'summary':
      if (!content.summary) return [];
      add(heading(labels.summary));
      add(para([{ text: content.summary }]));
      break;
    case 'education': {
      const edu = content.education;
      if (!edu.university) return [];
      add(heading(labels.education));
      add(para([{ text: edu.university, bold: true }, { text: edu.graduationYear ? `  ·  Class of ${edu.graduationYear}` : '' }]));
      if (edu.course || edu.level) add(para([{ text: [edu.course, edu.level].filter(Boolean).join(' · ') }]));
      for (const a of edu.achievements) add(para([{ text: a }], { bullet: true }));
      break;
    }
    case 'leadership':
      if (!content.leadership.length) return [];
      add(heading(labels.leadership));
      for (const l of content.leadership) {
        const when = [fmtDate(l.startDate), l.current ? 'Present' : fmtDate(l.endDate)].filter(Boolean).join(' – ');
        add(para([{ text: `${l.title} — ${l.organization}`, bold: true }, { text: when ? `  (${when})` : '' }, { text: l.verified ? '  ✓ Verified' : '', color: ACCENT }]));
        for (const b of l.bullets) add(para([{ text: b }], { bullet: true }));
      }
      break;
    case 'experience':
      if (!content.experience.length) return [];
      add(heading(labels.experience));
      for (const e of content.experience) {
        add(para([{ text: `${e.title}${e.organization ? ` — ${e.organization}` : ''}`, bold: true }, { text: e.period ? `  (${e.period})` : '' }]));
        for (const b of e.bullets) add(para([{ text: b }], { bullet: true }));
        if (e.url) add(para([{ text: e.url, color: ACCENT }]));
      }
      break;
    case 'certifications':
      if (!content.certifications.length) return [];
      add(heading(labels.certifications));
      for (const c of content.certifications) {
        add(para([{ text: c.title, bold: true }, { text: `${c.issuer ? ` — ${c.issuer}` : ''}${fmtDate(c.date) ? ` · ${fmtDate(c.date)}` : ''}` }]));
        if (c.verifyUrl) add(para([{ text: `Verify: ${c.verifyUrl}`, color: ACCENT }]));
      }
      break;
    case 'skills':
      if (!content.skills.length) return [];
      add(heading(labels.skills));
      add(para([{ text: content.skills.join('  ·  ') }]));
      break;
    case 'projects':
      if (!content.projects.length) return [];
      add(heading(labels.projects));
      for (const p of content.projects) {
        add(para([{ text: `${p.name}${p.role ? ` — ${p.role}` : ''}`, bold: true }]));
        if (p.description) add(para([{ text: p.description }]));
        if (p.url) add(para([{ text: p.url, color: ACCENT }]));
      }
      break;
    case 'awards': {
      const hasScore = Boolean(content.guildScore);
      if (!content.awards.length && !hasScore) return [];
      add(heading(labels.awards));
      if (content.guildScore) add(para([{ text: `Guild Score ${content.guildScore.score.toLocaleString('en-NG')} · ${content.guildScore.level}`, bold: true }]));
      for (const a of content.awards) add(para([{ text: a }], { bullet: true }));
      break;
    }
  }
  return out;
}

function buildDocumentXml(content: CvContent, order: CvSectionKey[], labels: Record<CvSectionKey, string>, verifyUrl: string): string {
  const body: string[] = [];
  // Header block
  body.push(para([{ text: content.header.fullName, bold: true, color: ACCENT, size: 20 }], { spacingAfter: 40 }));
  const contact = [content.header.email, content.header.phone, content.header.location].filter(Boolean).join('  •  ');
  if (contact) body.push(para([{ text: contact, size: 9 }], { spacingAfter: 40 }));
  if (content.header.publicProfileUrl) body.push(para([{ text: content.header.publicProfileUrl, color: ACCENT, size: 9 }], { spacingAfter: 40 }));
  body.push(para([{ text: `Verifiable CV · ${verifyUrl}`, italic: true, size: 8, color: '64748B' }], { spacingAfter: 200 }));

  for (const key of order) body.push(...sectionParas(key, content, labels));

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    `<w:body>${body.join('')}<w:sectPr><w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080"/></w:sectPr></w:body></w:document>`
  );
}

const CONTENT_TYPES_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
  '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>' +
  '</Types>';

const RELS_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
  '</Relationships>';

const DOC_RELS_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>' +
  '</Relationships>';

// Simple round-bullet list definition (numId 1).
const NUMBERING_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
  '<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
  '<w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/>' +
  '<w:pPr><w:ind w:left="480" w:hanging="240"/></w:pPr></w:lvl></w:abstractNum>' +
  '<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>';

function downloadBlob(bytes: Uint8Array, filename: string, type: string) {
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function buildDocx(content: CvContent, order: CvSectionKey[], labels: Record<CvSectionKey, string>, verifyUrl: string): Uint8Array {
  const enc = new TextEncoder();
  return buildZip([
    { name: '[Content_Types].xml', data: enc.encode(CONTENT_TYPES_XML) },
    { name: '_rels/.rels', data: enc.encode(RELS_XML) },
    { name: 'word/_rels/document.xml.rels', data: enc.encode(DOC_RELS_XML) },
    { name: 'word/numbering.xml', data: enc.encode(NUMBERING_XML) },
    { name: 'word/document.xml', data: enc.encode(buildDocumentXml(content, order, labels, verifyUrl)) },
  ]);
}

/** Native, editable Word document in the CV's section order. */
export function downloadCvAsDocx(content: CvContent, cvId: string, verifyUrl: string, sectionOrder?: string[]) {
  const order = normalizeOrder(sectionOrder);
  downloadBlob(
    buildDocx(content, order, CV_SECTION_LABELS, verifyUrl),
    `${cvId}.docx`,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  );
}

/** Europass-structured Word document (their section names + ordering). */
export function downloadCvAsEuropassDocx(content: CvContent, cvId: string, verifyUrl: string) {
  downloadBlob(
    buildDocx(content, EUROPASS_ORDER, EUROPASS_LABELS, verifyUrl),
    `${cvId}-europass.docx`,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  );
}

export function normalizeOrder(sectionOrder?: string[]): CvSectionKey[] {
  const known = new Set<string>(CV_DEFAULT_SECTION_ORDER);
  const given = (sectionOrder ?? []).filter((k): k is CvSectionKey => known.has(k));
  const missing = CV_DEFAULT_SECTION_ORDER.filter((k) => !given.includes(k));
  return [...given, ...missing];
}

// ── LinkedIn ─────────────────────────────────────────────────────────────────

/**
 * Clipboard-ready text organized by LinkedIn profile section, so filling in a
 * profile is paste-paste-paste instead of retyping.
 */
export function buildLinkedInText(content: CvContent, verifyUrl: string): string {
  const blocks: string[] = [];

  if (content.summary) {
    blocks.push(`── ABOUT (paste into your About section) ──\n${content.summary}\n\nVerified activity record: ${verifyUrl}`);
  }

  const experiences = [
    ...content.leadership.map((l) => ({
      title: l.title,
      org: l.organization,
      period: [fmtDate(l.startDate), l.current ? 'Present' : fmtDate(l.endDate)].filter(Boolean).join(' – '),
      bullets: l.bullets,
    })),
    ...content.experience.map((e) => ({ title: e.title, org: e.organization, period: e.period, bullets: e.bullets })),
  ];
  if (experiences.length) {
    blocks.push(
      '── EXPERIENCE (one entry each) ──\n' +
        experiences
          .map((e) => `Title: ${e.title}\nOrganization: ${e.org}\nDates: ${e.period}\nDescription:\n${e.bullets.map((b) => `• ${b}`).join('\n')}`)
          .join('\n\n'),
    );
  }

  if (content.education.university) {
    const edu = content.education;
    blocks.push(
      `── EDUCATION ──\nSchool: ${edu.university}\nDegree/Field: ${[edu.course, edu.level].filter(Boolean).join(' · ')}${edu.graduationYear ? `\nGraduation: ${edu.graduationYear}` : ''}`,
    );
  }

  if (content.certifications.length) {
    blocks.push(
      '── LICENSES & CERTIFICATIONS ──\n' +
        content.certifications
          .map((c) => `Name: ${c.title}\nIssuer: ${c.issuer || (c.status === 'SELF_REPORTED' ? 'Self-reported' : 'GuildOS')}${fmtDate(c.date) ? `\nIssue date: ${fmtDate(c.date)}` : ''}${c.serial ? `\nCredential ID: ${c.serial}` : ''}${c.verifyUrl ? `\nCredential URL: ${c.verifyUrl}` : ''}`)
          .join('\n\n'),
    );
  }

  if (content.projects.length) {
    blocks.push(
      '── PROJECTS ──\n' +
        content.projects.map((p) => `${p.name}${p.role ? ` — ${p.role}` : ''}${p.description ? `\n${p.description}` : ''}${p.url ? `\n${p.url}` : ''}`).join('\n\n'),
    );
  }

  if (content.skills.length) {
    blocks.push(`── SKILLS (add individually) ──\n${content.skills.join(', ')}`);
  }

  return blocks.join('\n\n\n');
}
