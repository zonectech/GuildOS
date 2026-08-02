// Builds a PDF replicating the real AMAS FUT Minna nomination list (user-provided reference)
// for testing the "Import from document" flow, including BROTHERS/SISTERS section headers.
import { writeFileSync } from 'node:fs';

const lines = [
  'FEDERAL UNIVERSITY OF TECHNOLOGY, MINNA',
  'ASSOCIATION OF MUSLIM AGRICULTURAL STUDENTS (AMAS)',
  'NEWLY NOMINATED SET OF EXECUTIVES',
  'SESSION 2026/2027 (1448/1449 AH)',
  '',
  'S/N  NAME                     OFFICE                 DEPT   LEVEL  PHONE NUMBER',
  'BROTHERS',
  "1   Muhammed Aliyu           NAQEEB                 AEC    200L   07069990997",
  "2   Sulaimon Abdulqodir      NAIBUN NAQEEB          APT    200L   08057046549",
  "3   Abdulqodir Abdussalam    GENERAL SECRETARY      APT    200L   07039048939",
  "4   Fawaaz Abdulazeez        ACADEMIC SECRETARY     WAFT   200L   08146713319",
  "5   Jimoh Abdulmujeeb        WELFARE (BROTHER)      AEX    200L   08102608928",
  "6   Adekunle Ibrahim         PRO (BROTHER)          FWT    100L   08147839351",
  "7   Alhasan Idris            AMO (BROTHER)          APT    200L   07036833820",
  "8   Tajudeen Abdullah        FINANCIAL SECRETARY    APT    100L   09161866603",
  'SISTERS',
  "9   Ma'arufah Ma'aruf        NAQEEBAH               HRT    300L   08115228481",
  "10  Thumayya Hanafi          NAIBATUN NAQEEBAH      AGR    100L   09043848278",
  "11  Junainah Abdulrazaq      SISTER'S SECRETARY     AEX    200L   09157671020",
  "12  Ghaniyah Tiamiyy         WELFARE (SISTER)       FST    200L   08136328126",
  "13  Badmus Ma'arufah         AMO (SISTER)           AEC    100L   07078069540",
  "14  Rahmah Uthman            PRO (SISTER)           FST    200L   09125948378",
  "15  Popoola Faizah           TREASURER              AEC    200L   07048477801",
];

function esc(s: string) {
  return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

const contentStream = lines.map((l, i) => `BT /F1 10 Tf 40 ${760 - i * 18} Td (${esc(l)}) Tj ET`).join('\n');

const objects: string[] = [];
objects.push('<< /Type /Catalog /Pages 2 0 R >>');
objects.push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>');
objects.push(`<< /Length ${Buffer.byteLength(contentStream)} >>\nstream\n${contentStream}\nendstream`);
objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>');

let pdf = '%PDF-1.4\n';
const offsets: number[] = [];
objects.forEach((obj, i) => {
  offsets.push(Buffer.byteLength(pdf));
  pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
});
const xrefStart = Buffer.byteLength(pdf);
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
for (const off of offsets) pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

writeFileSync('amas-executives.pdf', pdf, 'binary');
console.log('Wrote amas-executives.pdf');
